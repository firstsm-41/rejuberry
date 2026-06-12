-- Phase 6: profiles 자동 생성 trigger (가입 시 RLS 우회)
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- ── 신규 auth.users 행 생성 시 profiles 자동 삽입 ──────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- signUp options.data 에 담긴 메타데이터로 프로필 생성
  IF (NEW.raw_user_meta_data->>'employee_id') IS NOT NULL THEN
    INSERT INTO public.profiles (id, name, level, employee_id)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'name',
      (NEW.raw_user_meta_data->>'level')::int,
      NEW.raw_user_meta_data->>'employee_id'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 후 재생성 (재실행 가능)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
