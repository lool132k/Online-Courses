begin;
create table public.courses (
 id text primary key check(id ~ '^[a-z0-9-]{1,64}$'),
 title text not null check(char_length(title) between 2 and 160),
 category text not null check(char_length(category) between 1 and 80),
 level text not null check(level in ('Начальный','Средний')),
 author text not null check(char_length(author) between 1 and 80),
 description text not null check(char_length(description) between 1 and 4000),
 cover text not null check(char_length(cover) between 1 and 8),
 color text not null check(color ~ '^#[a-fA-F0-9]{6}$'),
 ink text not null check(ink ~ '^#[a-fA-F0-9]{6}$'),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
create table public.lessons (
 id uuid primary key default gen_random_uuid(),
 course_id text not null references public.courses(id) on delete cascade,
 position integer not null check(position between 1 and 100),
 title text not null check(char_length(title) between 1 and 160),
 body text not null check(char_length(body) between 1 and 20000),
 unique(course_id,position)
);
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
revoke all on public.courses,public.lessons from public,anon,authenticated;
grant select on public.courses,public.lessons to anon,authenticated;
create policy published_courses on public.courses for select to anon,authenticated
using(status='published');
create policy published_lessons on public.lessons for select to anon,authenticated
using(exists(select 1 from public.courses c where c.id=course_id and c.status='published'));
commit;
