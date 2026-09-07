-- 1. New business types (soft categories only, never restrict templates)
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'hotel';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'beauty';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'fitness';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'healthcare';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'construction';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'cleaning';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'events';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'education';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'professional_services';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'ecommerce';
ALTER TYPE public.business_type ADD VALUE IF NOT EXISTS 'automotive_service';

-- 2. Database backed admin allowlist. No client side email checks.
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_allowlist TO authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage the allowlist" ON public.admin_allowlist;
CREATE POLICY "Admins manage the allowlist"
  ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.admin_allowlist (email) VALUES ('contact@webdoagency.com')
  ON CONFLICT (email) DO NOTHING;

-- Grants the platform admin role to the signed in user only when their
-- verified JWT email is on the allowlist. The email never comes from the client.
CREATE OR REPLACE FUNCTION public.claim_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if _uid is null or _email = '' then
    return false;
  end if;
  if not exists (select 1 from public.admin_allowlist where lower(email) = _email) then
    return public.has_role(_uid, 'super_admin');
  end if;
  insert into public.user_roles (user_id, role)
  values (_uid, 'super_admin')
  on conflict (user_id, role) do nothing;
  return true;
end;
$$;

REVOKE ALL ON FUNCTION public.claim_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_role() TO authenticated;

-- Existing auth user with that email gets the role right away.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Demo / contact requests from the public site
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  business text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send a demo request" ON public.contact_requests;
CREATE POLICY "Anyone can send a demo request"
  ON public.contact_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(name)) between 1 and 100
    AND length(btrim(email)) between 3 and 255
    AND email like '%@%'
    AND length(coalesce(business, '')) <= 120
    AND length(coalesce(message, '')) <= 2000
  );

DROP POLICY IF EXISTS "Admins read demo requests" ON public.contact_requests;
CREATE POLICY "Admins read demo requests"
  ON public.contact_requests FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Admins update demo requests" ON public.contact_requests;
CREATE POLICY "Admins update demo requests"
  ON public.contact_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 4. Product name in user facing database messages
CREATE OR REPLACE FUNCTION public.guard_brand_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if public.is_super_admin() then
    return new;
  end if;
  if old.logo_locked and new.logo_path is distinct from old.logo_path then
    raise exception 'Brand logo can only be changed by a krijo24 admin';
  end if;
  if new.logo_path is not null and old.logo_path is null then
    new.logo_locked := true;
  end if;
  if old.logo_locked and new.logo_locked = false then
    raise exception 'Brand logo lock cannot be removed';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_business_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_super_admin() then
    if new.status is distinct from old.status then
      raise exception 'Only platform admins can change approval status';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Business ownership cannot be reassigned';
    end if;
    if old.onboarded and new.name is distinct from old.name then
      raise exception 'Business name can only be changed by a krijo24 admin';
    end if;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.guard_post_format()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _owner uuid;
  _allowed boolean;
begin
  if coalesce(new.format, 'post') = 'post' then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  select owner_id into _owner from public.businesses where id = new.business_id;
  select (p.active and (case when new.format = 'carousel' then p.allow_carousel else p.allow_video end))
    into _allowed
  from public.account_plans p where p.user_id = _owner;
  if not coalesce(_allowed, false) then
    raise exception 'Your plan does not include % content. Ask a krijo24 admin to activate it.', new.format;
  end if;
  return new;
end;
$$;

REVOKE ALL ON FUNCTION public.guard_brand_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_business_privileged_fields() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_post_format() FROM PUBLIC, anon;

-- 5. Profile row exists for every new account, so display names persist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();