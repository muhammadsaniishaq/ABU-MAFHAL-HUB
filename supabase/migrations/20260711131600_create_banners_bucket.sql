-- Create the banners storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for Banners Bucket

-- 1. Everyone can view banners
CREATE POLICY "Public can view banners" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'banners');

-- 2. Only Admins can insert/update/delete banners
-- Using our custom is_admin() function to verify if the user is an admin
CREATE POLICY "Admins can upload banners" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'banners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can update banners" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'banners' 
    AND public.is_admin()
);

CREATE POLICY "Admins can delete banners" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'banners' 
    AND public.is_admin()
);
