ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS slides jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_format_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_format_check CHECK (format IN ('post','carousel','video','story'));