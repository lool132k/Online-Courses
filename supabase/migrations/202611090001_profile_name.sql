-- Extend the existing profile permissions; all role columns stay read-only.
begin;
grant update(name) on public.profiles to authenticated;
create policy update_own_active_profile_name on public.profiles
for update to authenticated
using (id = (select auth.uid()) and (select private.active_student()))
with check (id = (select auth.uid()) and (select private.active_student()));
commit;
