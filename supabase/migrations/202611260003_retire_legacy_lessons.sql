begin;

drop policy if exists published_lessons on public.lessons;
revoke all on public.lessons from public,anon,authenticated;

commit;
