-- ============================================================
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. schedules RLS 수정 — 레벨2도 전체 근무표 열람 가능
drop policy if exists "전체 조회 (직원은 본인 또는 월별 전체 열람)" on schedules;
create policy "전체 조회" on schedules for select using (auth.uid() is not null);

-- 2. overtime 테이블
drop table if exists overtime cascade;

create table overtime (
  id          bigint generated always as identity primary key,
  employee_id text not null references employees(id) on delete cascade,
  date        date not null,
  hours       numeric(4,1) not null check (hours > 0),
  type        text not null check (type in ('earn', 'use')),
  note        text,
  created_at  timestamptz default now()
);

alter table overtime enable row level security;

create policy "조회"
  on overtime for select
  using (my_level() <= 1 or employee_id = my_employee_id());

create policy "등록/사용"
  on overtime for insert
  with check (employee_id = my_employee_id() or my_level() <= 1);

create policy "운영자 수정"
  on overtime for update using (my_level() <= 1);

create policy "운영자 삭제"
  on overtime for delete using (my_level() <= 1);

-- 3. 근무 교환 RPC (같은 팀 1:1)
create or replace function swap_schedules(
  p_emp1   text,
  p_emp2   text,
  p_year   int,
  p_month  int,
  p_day    int
) returns void language plpgsql security definer as $$
declare
  v_my_emp text;
  v_dept1  text;
  v_dept2  text;
  v_st1    text;
  v_st2    text;
begin
  v_my_emp := (select employee_id from profiles where id = auth.uid());
  if v_my_emp is null then raise exception '직원 정보가 없습니다'; end if;
  if v_my_emp != p_emp1 then raise exception '본인의 근무만 교환할 수 있습니다'; end if;

  select dept into v_dept1 from employees where id = p_emp1;
  select dept into v_dept2 from employees where id = p_emp2;
  if v_dept1 is distinct from v_dept2 then raise exception '같은 팀끼리만 교환 가능합니다'; end if;

  select status into v_st1 from schedules
    where employee_id = p_emp1 and year = p_year and month = p_month and day = p_day;
  select status into v_st2 from schedules
    where employee_id = p_emp2 and year = p_year and month = p_month and day = p_day;

  if v_st2 is null then
    delete from schedules where employee_id = p_emp1 and year = p_year and month = p_month and day = p_day;
  else
    insert into schedules (employee_id, year, month, day, status) values (p_emp1, p_year, p_month, p_day, v_st2)
    on conflict (employee_id, year, month, day) do update set status = excluded.status;
  end if;

  if v_st1 is null then
    delete from schedules where employee_id = p_emp2 and year = p_year and month = p_month and day = p_day;
  else
    insert into schedules (employee_id, year, month, day, status) values (p_emp2, p_year, p_month, p_day, v_st1)
    on conflict (employee_id, year, month, day) do update set status = excluded.status;
  end if;
end;
$$;
