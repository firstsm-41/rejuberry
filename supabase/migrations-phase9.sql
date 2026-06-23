-- Phase 9: 관리자 직접 수정 이력 (확정된 근무표 셀 변경 기록)
--   - 교환 기록(schedule_swap_logs)에 더해 관리자가 직접 바꾼 내역도 남김
--   - 운영자·직원 모두 조회 가능 (읽기 전체 공개)
-- Supabase SQL Editor에서 실행하세요 (재실행 가능)

create table if not exists schedule_edit_logs (
  id          bigserial primary key,
  employee_id text not null references employees(id) on delete cascade,
  year        int  not null,
  month       int  not null,
  day         int  not null,
  old_status  text,
  new_status  text,
  edited_by   uuid default auth.uid() references auth.users(id),
  edited_at   timestamptz default now()
);

alter table schedule_edit_logs enable row level security;

drop policy if exists "edit_log_read"   on schedule_edit_logs;
drop policy if exists "edit_log_insert" on schedule_edit_logs;

-- 조회: 로그인 사용자 전체 (운영자·직원 모두)
create policy "edit_log_read" on schedule_edit_logs for select
  using (auth.role() = 'authenticated');

-- 기록: 운영자만 (관리자 직접 수정)
create policy "edit_log_insert" on schedule_edit_logs for insert
  with check (my_level() <= 1);

-- 참고: 교환 기록(schedule_swap_logs)은 phase2에서 이미 전체 조회 허용됨.
