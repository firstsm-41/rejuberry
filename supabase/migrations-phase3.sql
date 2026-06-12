-- Phase 3: 반차 오전/오후 컬럼 + 직원 연차 신청 권한
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- 1) leave_entries 에 오전/오후 컬럼 추가
ALTER TABLE leave_entries
  ADD COLUMN IF NOT EXISTS half_day TEXT
  CHECK (half_day IN ('AM', 'PM'));

-- 2) leave_entries RLS — 직원이 자신의 연차 신청/조회/삭제 가능
DROP POLICY IF EXISTS "staff_read_own"    ON leave_entries;
DROP POLICY IF EXISTS "staff_insert_own"  ON leave_entries;
DROP POLICY IF EXISTS "staff_delete_own"  ON leave_entries;
DROP POLICY IF EXISTS "mgr_all"           ON leave_entries;

-- 관리자(level <= 1): 전체 접근
CREATE POLICY "mgr_all" ON leave_entries FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 직원(level 2): 자신의 항목만 조회
CREATE POLICY "staff_read_own" ON leave_entries FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- 직원(level 2): 자신의 항목만 등록
CREATE POLICY "staff_insert_own" ON leave_entries FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- 직원(level 2): 자신의 항목만 삭제
CREATE POLICY "staff_delete_own" ON leave_entries FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );

-- 3) schedules RLS — 직원이 자신의 Y/H 상태 등록 가능 (연차 신청 시 근무표 자동 반영)
DROP POLICY IF EXISTS "staff_own_yh_insert" ON schedules;
DROP POLICY IF EXISTS "staff_own_yh_update" ON schedules;
DROP POLICY IF EXISTS "staff_own_yh_delete" ON schedules;

-- 직원: 자신의 연차(Y)/반차(H) 등록
CREATE POLICY "staff_own_yh_insert" ON schedules FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND
    status IN ('Y', 'H')
  );

-- 직원: 자신의 연차(Y)/반차(H) 수정
CREATE POLICY "staff_own_yh_update" ON schedules FOR UPDATE
  USING (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND
    status IN ('Y', 'H')
  )
  WITH CHECK (
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND
    status IN ('Y', 'H')
  );

-- 직원: 자신의 연차(Y)/반차(H) 삭제 (연차 취소 시)
CREATE POLICY "staff_own_yh_delete" ON schedules FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid()) AND
    status IN ('Y', 'H')
  );
