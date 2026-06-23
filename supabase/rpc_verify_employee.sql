-- ============================================================
-- 직원 본인 인증 RPC 함수
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 이름 + 생년월일로 직원 인증 후 사번/레벨 반환
-- security definer: 비로그인 상태(anon)에서도 호출 가능
-- 레벨은 employees.manager_level 컬럼에서 읽음 (하드코딩 제거 — migrations-phase7 참고)
create or replace function verify_employee(p_name text, p_birth_date date)
returns table(employee_id text, emp_level int)
language sql security definer as $$
  select e.id, e.manager_level
  from employees e
  where trim(e.name)       = trim(p_name)
    and e.birth_date       = p_birth_date
    and e.status           = 'active'
    and not exists (
      select 1 from profiles p
      where p.employee_id = e.id
    );
$$;

-- anon(비로그인) 사용자도 호출 가능하도록 권한 부여
grant execute on function verify_employee(text, date) to anon;
