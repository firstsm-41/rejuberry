-- Phase 7: 구조 정리
--   1) 운영자 레벨을 사번 하드코딩 → employees.manager_level 데이터화
--   2) 직원 근무표 RLS 좁히기 (직접 쓰기 제거, 조회만 + 교환은 RPC)
--   3) 미사용 leave_requests 테이블 제거
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- ════════════════════════════════════════════════════════════
-- 1) 운영자 레벨 데이터화
-- ════════════════════════════════════════════════════════════
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS manager_level INT NOT NULL DEFAULT 2
  CHECK (manager_level IN (0, 1, 2));

-- 기존 하드코딩(0001 최수민, 0023 유다인 → 운영자)을 데이터로 이관
UPDATE employees SET manager_level = 1 WHERE id IN ('0001', '0023');

-- verify_employee: 하드코딩 제거하고 manager_level 사용
CREATE OR REPLACE FUNCTION verify_employee(p_name text, p_birth_date date)
RETURNS TABLE(employee_id text, emp_level int)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT e.id, e.manager_level
  FROM employees e
  WHERE trim(e.name) = trim(p_name)
    AND e.birth_date = p_birth_date
    AND e.status     = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.employee_id = e.id
    );
$$;

GRANT EXECUTE ON FUNCTION verify_employee(text, date) TO anon;

-- ════════════════════════════════════════════════════════════
-- 2) 직원 근무표 RLS 좁히기
--    - 직원은 전체 근무표 "조회"만 가능 (전체 열람용)
--    - 직접 쓰기 정책 제거 (연차는 leave_entries로 분리됨, 교환은 swap_schedules RPC 사용)
-- ════════════════════════════════════════════════════════════

-- phase3에서 추가한 직원 Y/H 직접 쓰기 정책 제거 (연차 신청이 더 이상 근무표에 자동 반영되지 않음)
DROP POLICY IF EXISTS "staff_own_yh_insert" ON schedules;
DROP POLICY IF EXISTS "staff_own_yh_update" ON schedules;
DROP POLICY IF EXISTS "staff_own_yh_delete" ON schedules;

-- phase5에서 추가한 광범위한 직원 쓰기(FOR ALL) 정책 제거
DROP POLICY IF EXISTS "staff_write_own" ON schedules;

-- 직원 전체 조회 정책은 유지/재생성 (전체 근무표 열람)
DROP POLICY IF EXISTS "staff_read_all_sch" ON schedules;
CREATE POLICY "staff_read_all_sch" ON schedules FOR SELECT
  USING (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- 3) 미사용 leave_requests 테이블 제거
--    프론트엔드는 leave_entries 직접 사용으로 전환됨 (승인 플로우 폐기)
-- ════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS leave_requests CASCADE;
