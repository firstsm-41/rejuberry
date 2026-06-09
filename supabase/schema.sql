-- ============================================================
-- Rejubery HR — Supabase Schema
-- Supabase SQL Editor에 이 전체 내용을 붙여넣고 실행하세요.
-- ============================================================

-- ── 기존 테이블 정리 (재실행 시 충돌 방지) ──────────────────
drop table if exists leave_entries cascade;
drop table if exists leave_requests cascade;
drop table if exists leave_data cascade;
drop table if exists schedules cascade;
drop table if exists hr_changes cascade;
drop table if exists employees cascade;
drop table if exists profiles cascade;

-- ── profiles ─────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  level       int  not null default 2 check (level in (0,1,2)),
  employee_id text,                          -- employees.id 와 연결 (optional)
  created_at  timestamptz default now()
);

-- ── employees ────────────────────────────────────────────────
create table employees (
  id           text primary key,            -- 사번 (예: 0001)
  name         text not null,
  ssn          text,                        -- 주민등록번호 (암호화 권장)
  birth_date   date,
  phone        text,
  email        text,
  dept         text not null,
  position     text not null,
  salary       text,
  prev_company text,
  note         text,
  start_date   date not null,
  end_date     date,
  status       text not null default 'active' check (status in ('active','retired')),
  created_at   timestamptz default now()
);

-- ── hr_changes (입퇴사 이력) ──────────────────────────────────
create table hr_changes (
  id          bigint generated always as identity primary key,
  employee_id text not null references employees(id) on delete cascade,
  type        text not null check (type in ('join','leave','transfer')),
  date        date not null,
  note        text,
  created_at  timestamptz default now()
);

-- ── schedules (월별 근무표) ────────────────────────────────────
create table schedules (
  id          bigint generated always as identity primary key,
  employee_id text not null references employees(id) on delete cascade,
  year        int  not null,
  month       int  not null check (month between 1 and 12),
  day         int  not null check (day between 1 and 31),
  status      text not null check (status in ('D','S','H','Y','OFF')),
  updated_at  timestamptz default now(),
  constraint schedules_unique unique (employee_id, year, month, day)
);

-- ── leave_data (연차 기본 정보) ────────────────────────────────
create table leave_data (
  id          bigint generated always as identity primary key,
  employee_id text not null references employees(id) on delete cascade,
  year        int  not null,
  total_days  numeric(4,1) not null default 15,
  created_at  timestamptz default now(),
  constraint leave_data_unique unique (employee_id, year)
);

-- ── leave_entries (사용 연차 내역) ─────────────────────────────
create table leave_entries (
  id          bigint generated always as identity primary key,
  employee_id text not null references employees(id) on delete cascade,
  year        int  not null,
  start_date  date not null,
  end_date    date not null,
  days        numeric(3,1) not null default 1,
  type        text not null default 'Y' check (type in ('Y','H')),
  note        text,
  created_at  timestamptz default now()
);

-- ── leave_requests (연차 신청) ─────────────────────────────────
create table leave_requests (
  id              bigint generated always as identity primary key,
  employee_id     text not null references employees(id) on delete cascade,
  requester_id    uuid references auth.users(id),
  start_date      date not null,
  end_date        date not null,
  days            numeric(4,1) not null,
  type            text not null default 'Y' check (type in ('Y','H')),
  reason          text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejected_reason text,
  approved_by     uuid references auth.users(id),
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Updated_at 자동 갱신 트리거 ────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_schedules_updated
  before update on schedules
  for each row execute function update_updated_at();

create trigger trg_leave_requests_updated
  before update on leave_requests
  for each row execute function update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════
alter table profiles      enable row level security;
alter table employees     enable row level security;
alter table hr_changes    enable row level security;
alter table schedules     enable row level security;
alter table leave_data    enable row level security;
alter table leave_entries enable row level security;
alter table leave_requests enable row level security;

-- ── 헬퍼: 현재 로그인 사용자의 레벨 ──────────────────────────
create or replace function my_level()
returns int language sql stable security definer as $$
  select level from profiles where id = auth.uid();
$$;

-- ── 헬퍼: 현재 로그인 사용자의 연결 직원 사번 ────────────────
create or replace function my_employee_id()
returns text language sql stable security definer as $$
  select employee_id from profiles where id = auth.uid();
$$;

-- ──────────────────────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────────────────────
create policy "본인 프로필 조회"
  on profiles for select using (id = auth.uid() or my_level() <= 1);

create policy "본인 프로필 수정"
  on profiles for update using (id = auth.uid() or my_level() = 0);

create policy "Admin이 계정 생성 가능"
  on profiles for insert with check (my_level() = 0 or id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- employees
-- ──────────────────────────────────────────────────────────────
create policy "운영자+ 전체 조회"
  on employees for select
  using (my_level() <= 1 or id = my_employee_id());

create policy "운영자+ 삽입"
  on employees for insert with check (my_level() <= 1);

create policy "운영자+ 수정"
  on employees for update using (my_level() <= 1);

create policy "운영자+ 삭제"
  on employees for delete using (my_level() <= 1);

-- ──────────────────────────────────────────────────────────────
-- hr_changes
-- ──────────────────────────────────────────────────────────────
create policy "운영자+ 조회"
  on hr_changes for select using (my_level() <= 1);

create policy "운영자+ 삽입"
  on hr_changes for insert with check (my_level() <= 1);

create policy "운영자+ 수정"
  on hr_changes for update using (my_level() <= 1);

-- ──────────────────────────────────────────────────────────────
-- schedules
-- ──────────────────────────────────────────────────────────────
create policy "전체 조회 (직원은 본인 또는 월별 전체 열람)"
  on schedules for select
  using (my_level() <= 1 or employee_id = my_employee_id());

create policy "운영자+ 삽입/수정"
  on schedules for insert with check (my_level() <= 1);

create policy "운영자+ 업서트"
  on schedules for update using (my_level() <= 1);

create policy "운영자+ 삭제"
  on schedules for delete using (my_level() <= 1);

-- ──────────────────────────────────────────────────────────────
-- leave_data
-- ──────────────────────────────────────────────────────────────
create policy "전체 조회 (운영자) 또는 본인"
  on leave_data for select
  using (my_level() <= 1 or employee_id = my_employee_id());

create policy "운영자+ 삽입"
  on leave_data for insert with check (my_level() <= 1);

create policy "운영자+ 수정"
  on leave_data for update using (my_level() <= 1);

-- ──────────────────────────────────────────────────────────────
-- leave_entries
-- ──────────────────────────────────────────────────────────────
create policy "전체 조회 또는 본인"
  on leave_entries for select
  using (my_level() <= 1 or employee_id = my_employee_id());

create policy "운영자+ 삽입"
  on leave_entries for insert with check (my_level() <= 1);

create policy "운영자+ 삭제"
  on leave_entries for delete using (my_level() <= 1);

-- ──────────────────────────────────────────────────────────────
-- leave_requests
-- ──────────────────────────────────────────────────────────────
create policy "전체 조회 (운영자) 또는 본인 신청"
  on leave_requests for select
  using (my_level() <= 1 or employee_id = my_employee_id());

create policy "직원 본인이 신청 가능"
  on leave_requests for insert
  with check (employee_id = my_employee_id() or my_level() <= 1);

create policy "운영자+ 승인/거절"
  on leave_requests for update using (my_level() <= 1);

create policy "운영자+ 삭제"
  on leave_requests for delete using (my_level() <= 1);


-- ══════════════════════════════════════════════════════════════
-- 초기 데이터: 실제 직원 28명
-- ══════════════════════════════════════════════════════════════
insert into employees (id, name, ssn, birth_date, phone, email, dept, position, note, salary, prev_company, start_date, status) values
('0001','최수민','910928-1559119','1991-09-28','010-3082-9321','lykos2@naver.com',        '대표원장',   '대표원장',       null,       null,        '에이비성형외과',         '2026-06-01','active'),
('0002','김주안','990310-1547417','1999-03-10','010-7179-4359','kjawndks@naver.com',      '부원장',     '부원장',         null,       null,        '전북대병원',             '2026-06-01','active'),
('0003','유라',  '830221-2558619','1983-02-21','010-4709-0983','rurpst@naver.com',        '총괄실장',   '총괄실장',       null,       '세후 300',  '더코 성형외과',          '2026-06-01','active'),
('0004','김보영','930130-2644511','1993-01-30','010-5892-3695','chuc3695@naver.com',      '실장',       '상담실장',       null,       '세후 400',  '톡스엔필 광주점',        '2026-06-01','active'),
('0005','공슬비','940125-2555216','1994-01-25','010-2098-1044','tmfqlgo7@naver.com',      '실장',       '상담실장',       null,       '세후 350',  '미미썸 첨단점',          '2026-06-01','active'),
('0006','이은경','000509-4622916','2000-05-09','010-5113-7186','lek5588@naver.com',       '실장',       '상담실장',       null,       '세후 320',  '닥터디자이너 광주점',    '2026-06-01','active'),
('0007','김서린','990719-2640212','1999-07-19','010-7210-0174','kimjsjk425@naver.com',   '코디',       'VIP실장',        null,       '세후 300',  '광주 미의원',            '2026-06-01','active'),
('0008','신하미','970309-2624417','1997-03-09','010-7582-2858','jungs2sin@naver.com',    '코디',       '코디네이터',     null,       '세후 270',  '압구정제이엘의원',       '2026-06-01','active'),
('0009','박민희','010216-4642714','2001-02-16','010-7418-8832','alsgml8832@naver.com',   '코디',       '코디네이터',     null,       '세후 280',  '톡스엔필의원',           '2026-06-01','active'),
('0010','손수지','950123-2617017','1995-01-23','010-4110-7213','hmzz0308@naver.com',     '코디',       '코디네이터',     null,       '세후 280',  '청담리브의원',           '2026-06-01','active'),
('0011','정재희','861204-2070811','1986-12-04','010-9314-0636','jaehee1204@naver.com',   '간호',       '간호팀장',       null,       '세후 320',  '에이비성형외과',         '2026-06-01','active'),
('0012','이솔빈','000627-4650711','2000-06-27','010-4200-5104','22beauty_@naver.com',    '간호',       '간호조무사',     null,       '세후 280',  '엘츠의원',               '2026-06-01','active'),
('0013','국지혜','950519-2561417','1995-05-19','010-6880-2307','love2703@naver.com',     '간호',       '간호조무사',     null,       '세후 270',  '쁘띠2.7의원',            '2026-06-01','active'),
('0014','조현숙','651030-2550621','1965-10-30','010-9924-9321','amy9321@naver.com',      '간호',       '간호사',         null,       '세후 270',  '전남대학교병원',         '2026-06-01','active'),
('0015','윤시은','020830-4641415','2002-08-30','010-4026-0797','emma0797@naver.com',     '간호',       '간호사',         null,       '세후 260',  '톱스타성형외과',         '2026-06-01','active'),
('0016','조미연','930719-2042511','1993-07-19','010-4648-0719','alal3674@naver.com',     '피부1(시술)','피부1팀 팀장',   null,       '세후 280',  '모리프한의원',           '2026-06-01','active'),
('0017','이혜인','960518-2622716','1996-05-18','010-2434-3873','dkvma16@naver.com',      '피부1(시술)','피부관리사',     null,       '세후 290',  '닥터에버스광주점',       '2026-06-01','active'),
('0018','이수경','950507-2558813','1995-05-07','010-7571-3878','dltnrud950507@naver.com','피부1(시술)','피부관리사',     null,       '세후 270',  '블리비 광주점',          '2026-06-01','active'),
('0019','변정현','991220-2057019','1999-12-20','010-9053-9094','vnfnalsl777@naver.com',  '피부2(관리)','피부2팀 팀장',   null,       '세후 280',  '미미썸 광천점',          '2026-06-01','active'),
('0020','정은비','001101-4648815','2000-11-01','010-5036-3085','dmsql5036@naver.com',    '피부2(관리)','피부관리사',     null,       '세후 280',  '약손명가 봉선점',        '2026-06-01','active'),
('0021','허윤정','990729-2553813','1999-07-29','010-3150-0212','9gjdbswjd@naver.com',   '피부2(관리)','피부관리사',     null,       '세후 270',  '라프레리 롯데광주점',    '2026-06-01','active'),
('0022','최성민','990401-1163929','1999-04-01','010-7529-0837','firstsm41@naver.com',   '마케팅',     '마케팅팀 이사',  null,       '연봉 4200', '법무법인 테헤란',        '2026-06-01','active'),
('0023','유다인','011026-4031911','2001-10-26','010-5715-6895','dysu1026@naver.com',     '마케팅',     '마케팅팀 실장',  null,       null,        '조선대병원',             '2026-06-01','active'),
('0024','이경주','940128-2450711','1994-01-28','010-5163-1159','rudwn4321@gmail.com',    '마케팅',     '마케팅팀 디자이너',null,     null,        '라본브아',               '2026-05-22','active'),
('0025','윤다은','680210-2653018','1968-02-10','010-3637-2557','wjdwk2557@hanmail.net',  '미분류',     '청소',           '메모보기', '세전 195',  null,                     '2026-06-01','active'),
('0026','김복자','750321-2634921','1975-03-21','010-8672-2801','10ve1004girl@naver.com', '미분류',     '청소',           '메모보기', '세전 195',  null,                     '2026-06-01','active'),
('0027','황성현','021019-4616824','2002-10-19','010-4785-4792','ioio4785@naver.com',     '피부1(시술)','피부관리사',     null,       null,        null,                     '2026-06-19','active'),
('0028','주명옥','010922-4646519','2001-09-22','010-2817-2156','jumyo01@naver.com',      '코디',       '코디네이터',     null,       '세후250',   null,                     '2026-06-25','active')
on conflict (id) do update set
  name         = excluded.name,
  ssn          = excluded.ssn,
  birth_date   = excluded.birth_date,
  phone        = excluded.phone,
  email        = excluded.email,
  dept         = excluded.dept,
  position     = excluded.position,
  note         = excluded.note,
  salary       = excluded.salary,
  prev_company = excluded.prev_company,
  start_date   = excluded.start_date,
  status       = excluded.status;

-- 2026년 연차 기본 데이터
insert into leave_data (employee_id, year, total_days)
select id, 2026, 15 from employees
on conflict (employee_id, year) do nothing;

-- 입사 이력 자동 생성
insert into hr_changes (employee_id, type, date)
select id, 'join', start_date from employees
on conflict do nothing;
