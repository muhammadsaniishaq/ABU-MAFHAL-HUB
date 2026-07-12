ALTER TABLE public.cac_requests ADD COLUMN IF NOT EXISTS memorandum_url TEXT;

-- Reload the schema cache for postgrest
NOTIFY pgrst, 'reload schema';
