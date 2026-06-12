-- Phase 5: employees·schedules 테이블 RLS — 직원이 전체 인원 근무표 조회 가능하도록
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- ────────────────────────────────────────────
-- employees 테이블
-- ────────────────────────────────────────────
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mgr_all_employees"   ON employees;
DROP POLICY IF EXISTS "staff_read_all"      ON employees;

-- 관리자: 전체 CRUD
CREATE POLICY "mgr_all_employees" ON employees FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 직원: 재직 중인 전체 직원 읽기 (자신 포함)
CREATE POLICY "staff_read_all" ON employees FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    status = 'active'
  );

-- ────────────────────────────────────────────
-- schedules 테이블
-- ────────────────────────────────────────────
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mgr_all_schedules"  ON schedules;
DROP POLICY IF EXISTS "staff_read_all_sch" ON schedules;
DROP POLICY IF EXISTS "staff_write_own"    ON schedules;

-- 관리자: 전체 CRUD
CREATE POLICY "mgr_all_schedules" ON schedules FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 직원: 전체 근무표 읽기 (근무표 전체 조회용)
CREATE POLICY "staff_read_all_sch" ON schedules FOR SELECT
  USING (auth.role() = 'authenticated');

-- 직원: 자신의 근무표만 수정 (교환 신청 시)
CREATE POLICY "staff_write_own" ON schedules FOR ALL
  USING (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );
