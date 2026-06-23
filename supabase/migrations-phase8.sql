-- Phase 8: 근무 교환 요청·승인 프로세스
--   확정된 근무표에서 같은 파트 직원끼리 1:1 교환 (상대 직원 승인 후 실행)
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

-- ── 교환 가능 "파트 그룹" 정의 ────────────────────────────────
-- 총괄실장 + 실장(상담실장 등)은 같은 파트로 묶어 교환 허용. 대표원장+부원장도 의료진으로 묶음.
create or replace function swap_group(p_dept text) returns text language sql immutable as $$
  select case
    when p_dept in ('대표원장','부원장')  then '의료진'
    when p_dept in ('총괄실장','실장')    then '실장'
    else p_dept
  end;
$$;

-- ── 교환 요청 테이블 ──────────────────────────────────────────
create table if not exists schedule_swap_requests (
  id               bigserial primary key,
  year             int  not null,
  month            int  not null,
  day              int  not null,
  requester_emp    text not null references employees(id) on delete cascade,
  target_emp       text not null references employees(id) on delete cascade,
  requester_status text,                 -- 요청 시점 스냅샷 (표시용)
  target_status    text,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','cancelled')),
  created_at       timestamptz default now(),
  resolved_at      timestamptz
);

alter table schedule_swap_requests enable row level security;

drop policy if exists "swap_req_select" on schedule_swap_requests;
drop policy if exists "swap_req_delete" on schedule_swap_requests;

-- 요청자·대상자·운영자만 조회
create policy "swap_req_select" on schedule_swap_requests for select
  using (
    my_level() <= 1
    or requester_emp = my_employee_id()
    or target_emp    = my_employee_id()
  );

-- 요청자(또는 운영자)가 요청 취소(삭제) 가능
create policy "swap_req_delete" on schedule_swap_requests for delete
  using (requester_emp = my_employee_id() or my_level() <= 1);

-- ── 교환 요청 생성 RPC ────────────────────────────────────────
create or replace function request_swap(p_target text, p_year int, p_month int, p_day int)
returns void language plpgsql security definer as $$
declare
  v_me text; v_my_dept text; v_target_dept text; v_my_st text; v_tg_st text;
begin
  v_me := (select employee_id from profiles where id = auth.uid());
  if v_me is null then raise exception '인증이 필요합니다'; end if;
  if v_me = p_target then raise exception '본인과는 교환할 수 없습니다'; end if;

  select dept into v_my_dept     from employees where id = v_me;
  select dept into v_target_dept from employees where id = p_target;
  if swap_group(v_my_dept) is distinct from swap_group(v_target_dept) then
    raise exception '같은 파트 직원과만 교환할 수 있습니다';
  end if;

  -- 동일 대기 요청 중복 방지
  if exists (
    select 1 from schedule_swap_requests
    where year=p_year and month=p_month and day=p_day
      and requester_emp=v_me and target_emp=p_target and status='pending'
  ) then
    raise exception '이미 대기 중인 교환 요청이 있습니다';
  end if;

  select status into v_my_st from schedules where employee_id=v_me     and year=p_year and month=p_month and day=p_day;
  select status into v_tg_st from schedules where employee_id=p_target and year=p_year and month=p_month and day=p_day;

  insert into schedule_swap_requests(year,month,day,requester_emp,target_emp,requester_status,target_status)
  values (p_year,p_month,p_day,v_me,p_target,v_my_st,v_tg_st);
end; $$;

grant execute on function request_swap(text,int,int,int) to authenticated;

-- ── 교환 요청 응답(수락/거절) RPC ─────────────────────────────
create or replace function respond_swap_request(p_request_id bigint, p_approve boolean)
returns void language plpgsql security definer as $$
declare
  r record; v_me text; v_level int; v_s1 text; v_s2 text;
begin
  select employee_id, level into v_me, v_level from profiles where id = auth.uid();
  if v_me is null then raise exception '인증이 필요합니다'; end if;

  select * into r from schedule_swap_requests where id = p_request_id;
  if r is null then raise exception '요청을 찾을 수 없습니다'; end if;
  if r.status <> 'pending' then raise exception '이미 처리된 요청입니다'; end if;

  -- 대상자 본인 또는 운영자만 응답 가능
  if v_me <> r.target_emp and v_level > 1 then
    raise exception '응답 권한이 없습니다';
  end if;

  -- 거절
  if not p_approve then
    update schedule_swap_requests set status='rejected', resolved_at=now() where id=p_request_id;
    return;
  end if;

  -- 승인: 현재 근무 상태 기준으로 맞교환
  select status into v_s1 from schedules where employee_id=r.requester_emp and year=r.year and month=r.month and day=r.day;
  select status into v_s2 from schedules where employee_id=r.target_emp    and year=r.year and month=r.month and day=r.day;

  -- requester ← target 상태
  if v_s2 is not null then
    insert into schedules(employee_id,year,month,day,status)
      values(r.requester_emp,r.year,r.month,r.day,v_s2)
      on conflict(employee_id,year,month,day) do update set status=excluded.status;
  else
    delete from schedules where employee_id=r.requester_emp and year=r.year and month=r.month and day=r.day;
  end if;

  -- target ← requester 상태
  if v_s1 is not null then
    insert into schedules(employee_id,year,month,day,status)
      values(r.target_emp,r.year,r.month,r.day,v_s1)
      on conflict(employee_id,year,month,day) do update set status=excluded.status;
  else
    delete from schedules where employee_id=r.target_emp and year=r.year and month=r.month and day=r.day;
  end if;

  -- 로그 기록 (phase2의 schedule_swap_logs 재사용)
  insert into schedule_swap_logs(year,month,day,emp1_id,emp2_id,emp1_old_status,emp2_old_status,requested_by)
    values(r.year,r.month,r.day,r.requester_emp,r.target_emp,v_s1,v_s2,auth.uid());

  update schedule_swap_requests set status='approved', resolved_at=now() where id=p_request_id;
end; $$;

grant execute on function respond_swap_request(bigint, boolean) to authenticated;
