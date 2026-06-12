-- Phase 4: overtime 테이블 RLS 정책
-- 잔여 오버타임이 음수일 때 -로 표시되려면 데이터를 제대로 읽어야 함
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- overtime 테이블 RLS 활성화
ALTER TABLE overtime ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 가능)
DROP POLICY IF EXISTS "mgr_all"   ON overtime;
DROP POLICY IF EXISTS "staff_own" ON overtime;

-- 관리자(level <= 1): 전체 접근
CREATE POLICY "mgr_all" ON overtime FOR ALL
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level <= 1));

-- 직원(level 2): 자신의 항목만 접근
CREATE POLICY "staff_own" ON overtime FOR ALL
  USING (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    employee_id = (SELECT employee_id FROM profiles WHERE id = auth.uid())
  );
