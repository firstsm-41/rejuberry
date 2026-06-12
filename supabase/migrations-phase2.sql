-- Phase 2: 근무표 확정, 교환 로그, 희망오프 쿼터 테이블
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- 1) 근무표 확정 상태
CREATE TABLE IF NOT EXISTS schedule_confirmed (
  year  INTEGER NOT NULL,
  month INTEGER NOT NULL,
  confirmed_at  TIMESTAMPTZ,
  confirmed_by  UUID REFERENCES auth.users(id),
  PRIMARY KEY (year, month)
);

ALTER TABLE schedule_confirmed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all"  ON schedule_confirmed;
DROP POLICY IF EXISTS "write_mgr" ON schedule_confirmed;

CREATE POLICY "read_all" ON schedule_confirmed FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "write_mgr" ON schedule_confirmed FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 2) 근무 교환 로그
CREATE TABLE IF NOT EXISTS schedule_swap_logs (
  id              BIGSERIAL PRIMARY KEY,
  year            INTEGER  NOT NULL,
  month           INTEGER  NOT NULL,
  day             INTEGER  NOT NULL,
  emp1_id         TEXT     NOT NULL REFERENCES employees(id),
  emp2_id         TEXT     NOT NULL REFERENCES employees(id),
  emp1_old_status TEXT,
  emp2_old_status TEXT,
  requested_by    UUID     REFERENCES auth.users(id),
  swapped_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_swap_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all"   ON schedule_swap_logs;
DROP POLICY IF EXISTS "insert_all" ON schedule_swap_logs;

CREATE POLICY "read_all" ON schedule_swap_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "insert_all" ON schedule_swap_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3) 희망 오프 쿼터 (파트별 최대 오프 인원)
CREATE TABLE IF NOT EXISTS off_quotas (
  dept        TEXT    PRIMARY KEY,
  max_persons INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE off_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all"  ON off_quotas;
DROP POLICY IF EXISTS "write_mgr" ON off_quotas;

CREATE POLICY "read_all" ON off_quotas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "write_mgr" ON off_quotas FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 기본 쿼터 삽입
INSERT INTO off_quotas (dept, max_persons) VALUES
  ('실장',       1),
  ('코디',       1),
  ('간호',       1),
  ('피부1(시술)', 1),
  ('피부2(관리)', 1)
ON CONFLICT (dept) DO NOTHING;

-- 4) 근무 교환 RPC (원자적 swap + 인증 + 로그)
CREATE OR REPLACE FUNCTION swap_schedules(
  p_emp1 TEXT, p_emp2 TEXT, p_year INT, p_month INT, p_day INT
) RETURNS VOID AS $$
DECLARE
  v_s1             TEXT;
  v_s2             TEXT;
  v_caller_emp_id  TEXT;
  v_caller_level   INT;
  v_dept1          TEXT;
  v_dept2          TEXT;
BEGIN
  -- 호출자 확인
  SELECT employee_id, level INTO v_caller_emp_id, v_caller_level
  FROM profiles WHERE id = auth.uid();

  IF v_caller_emp_id IS NULL THEN
    RAISE EXCEPTION '인증이 필요합니다';
  END IF;

  -- 직원(level > 1)은 본인이 당사자여야 함
  IF v_caller_level > 1 AND v_caller_emp_id != p_emp1 AND v_caller_emp_id != p_emp2 THEN
    RAISE EXCEPTION '권한이 없습니다';
  END IF;

  -- 직원은 같은 부서끼리만 교환 가능
  IF v_caller_level > 1 THEN
    SELECT dept INTO v_dept1 FROM employees WHERE id = p_emp1;
    SELECT dept INTO v_dept2 FROM employees WHERE id = p_emp2;
    IF v_dept1 IS DISTINCT FROM v_dept2 THEN
      RAISE EXCEPTION '같은 팀 직원과만 교환 가능합니다';
    END IF;
  END IF;

  -- 현재 상태 조회
  SELECT status INTO v_s1 FROM schedules
    WHERE employee_id = p_emp1 AND year = p_year AND month = p_month AND day = p_day;
  SELECT status INTO v_s2 FROM schedules
    WHERE employee_id = p_emp2 AND year = p_year AND month = p_month AND day = p_day;

  -- 교환 실행 (emp1 ← emp2 상태)
  IF v_s2 IS NOT NULL THEN
    INSERT INTO schedules(employee_id, year, month, day, status)
      VALUES(p_emp1, p_year, p_month, p_day, v_s2)
      ON CONFLICT(employee_id, year, month, day) DO UPDATE SET status = EXCLUDED.status;
  ELSE
    DELETE FROM schedules
      WHERE employee_id = p_emp1 AND year = p_year AND month = p_month AND day = p_day;
  END IF;

  -- 교환 실행 (emp2 ← emp1 상태)
  IF v_s1 IS NOT NULL THEN
    INSERT INTO schedules(employee_id, year, month, day, status)
      VALUES(p_emp2, p_year, p_month, p_day, v_s1)
      ON CONFLICT(employee_id, year, month, day) DO UPDATE SET status = EXCLUDED.status;
  ELSE
    DELETE FROM schedules
      WHERE employee_id = p_emp2 AND year = p_year AND month = p_month AND day = p_day;
  END IF;

  -- 교환 로그 저장
  INSERT INTO schedule_swap_logs(year, month, day, emp1_id, emp2_id, emp1_old_status, emp2_old_status, requested_by)
    VALUES(p_year, p_month, p_day, p_emp1, p_emp2, v_s1, v_s2, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
