ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS show_contact boolean NOT NULL DEFAULT false;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS contact_info jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.template_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, template_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_favorites TO authenticated;
GRANT ALL ON public.template_favorites TO service_role;

ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own template favorites"
ON public.template_favorites FOR ALL TO authenticated
USING (public.is_business_member(business_id) OR public.is_super_admin())
WITH CHECK (public.is_business_member(business_id) OR public.is_super_admin());