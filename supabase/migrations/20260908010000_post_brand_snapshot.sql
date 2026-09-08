-- Saved posts rendered with the brand's CURRENT colours and fonts, so editing the
-- palette silently restyled every post ever made, including ones already
-- downloaded and published. A post is a finished artefact: it should keep the
-- brand it was made with.
--
-- The snapshot holds only what the templates read while rendering. Contact block
-- and "show brand name" are already stored per post.
alter table public.posts
  add column if not exists brand_snapshot jsonb;

comment on column public.posts.brand_snapshot is
  'Brand styling as it was when the post was saved: colours, fonts, logo path, currency, language. Null on posts created before this column, which fall back to the live brand.';

-- Freeze posts that already exist at exactly how they render today. Nothing
-- changes visually; they simply stop following future palette edits.
update public.posts p
set brand_snapshot = jsonb_build_object(
  'primary',       bp.primary_color,
  'secondary',     bp.secondary_color,
  'accent',        bp.accent_color,
  'background',    bp.background_color,
  'fontFamily',    bp.font_family,
  'fontSecondary', bp.font_secondary,
  'logoPath',      bp.logo_path,
  'currency',      bp.currency,
  'language',      bp.language
)
from public.brand_profiles bp
where bp.business_id = p.business_id
  and p.brand_snapshot is null;
