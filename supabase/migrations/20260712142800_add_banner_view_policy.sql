-- Add a policy to allow anyone to view active banners
CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (true);
