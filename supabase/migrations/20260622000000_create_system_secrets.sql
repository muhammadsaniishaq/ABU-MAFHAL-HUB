-- Create System Secrets Table
CREATE TABLE IF NOT EXISTS public.system_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_secrets ENABLE ROW LEVEL SECURITY;

-- Only Admins can manage or view secrets
CREATE POLICY "Admins can manage system secrets" 
ON public.system_secrets FOR ALL 
USING (public.is_admin());

-- Notice: Regular authenticated users CANNOT read from this table.
-- Edge functions will use the service_role key to bypass RLS and read secrets.
