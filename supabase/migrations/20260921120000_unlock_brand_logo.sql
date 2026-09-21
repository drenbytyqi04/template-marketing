-- A brand may change its own logo.
--
-- The rule was that the first save fixed the logo for good and only a krijo24
-- admin could replace it, enforced by a trigger so the app could not talk its
-- way around it. In practice it is the customer's own mark on the customer's
-- own posts: they rebrand, they upload the wrong file, they get a version with
-- a transparent background a week later. Every one of those turned into a
-- support request for something they should simply be able to do.
--
-- The trigger goes before the column, because the function it runs raises an
-- exception on any attempt to clear the flag - including this migration's.
drop trigger if exists brand_profiles_guard_identity on public.brand_profiles;
drop function if exists public.guard_brand_identity();

-- Unlock what is already locked, then remove the flag entirely rather than
-- leaving a column that no longer decides anything. A field that is read but
-- never true is a rule waiting to be reintroduced by accident.
update public.brand_profiles set logo_locked = false where logo_locked;
alter table public.brand_profiles drop column if exists logo_locked;
