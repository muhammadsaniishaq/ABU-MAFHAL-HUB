-- Create the partners table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create policies for the table
CREATE POLICY "Public can view active partners" 
ON public.partners FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage partners" 
ON public.partners FOR ALL 
USING (public.is_admin());

-- Insert a storage bucket for partners if not exists using ON CONFLICT DO NOTHING
-- The buckets table has id as primary key
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partners', 'partners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the partners bucket
CREATE POLICY "Public can view partner logos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'partners');

CREATE POLICY "Admins can upload partner logos" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'partners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can update partner logos" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'partners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can delete partner logos" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'partners' 
    AND public.is_admin()
);
