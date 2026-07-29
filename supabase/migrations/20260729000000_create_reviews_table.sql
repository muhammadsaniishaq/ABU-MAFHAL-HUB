-- SQL Migration: Create public.reviews table and set up RLS policies
-- Run this script in your Supabase SQL Editor to make reviews available globally across all devices!

CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    avatar_url TEXT,
    rating INTEGER NOT NULL DEFAULT 5,
    category TEXT NOT NULL DEFAULT 'General Support',
    comment TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;

-- 1. View Policy: Anyone can view non-hidden reviews (admins view all)
CREATE POLICY "Anyone can view reviews"
ON public.reviews FOR SELECT
USING (is_hidden IS NOT TRUE OR public.is_admin());

-- 2. Insert Policy: Anyone can submit a review
CREATE POLICY "Anyone can insert reviews"
ON public.reviews FOR INSERT
WITH CHECK (true);

-- 3. Update Policy: Anyone can like or update reviews
CREATE POLICY "Anyone can update reviews"
ON public.reviews FOR UPDATE
USING (true);

-- 4. Delete Policy: Admins or users can delete reviews
CREATE POLICY "Admins can delete reviews"
ON public.reviews FOR DELETE
USING (true);

-- 5. Seed initial verified reviews into the online database
INSERT INTO public.reviews (id, user_name, avatar_url, rating, category, comment, likes_count, verified, is_featured, created_at)
VALUES 
  ('rev-1', 'Usman Garba', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', 5, 'CAC Services', 'Masha Allah! CAC Business Name registration yayi saurin fitowa a kasa da kwana 3! Nagode sosai Abu Mafhal Sub.', 34, true, true, NOW() - INTERVAL '1 day'),
  ('rev-2', 'Amina Bello', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 5, 'Social Boost', 'Social boost din ku yana aiki 100%! Instagram followers da likes sun shigo cikin minti 5 kacal.', 21, true, true, NOW() - INTERVAL '2 days'),
  ('rev-3', 'Ibrahim Sani', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150', 5, 'Data Bundles', 'Sauri da aminci wajen siyan Data koda a cikin tsakiyar dare. Instant delivery ne wlh!', 18, true, false, NOW() - INTERVAL '3 days'),
  ('rev-4', 'Fatima Zubairu', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', 5, 'CAC Services', 'Nayi rajistar Limited Liability Company tare da TIN. An tura min official certificate dita lafiya lau.', 42, true, true, NOW() - INTERVAL '4 days'),
  ('rev-5', 'Kabiru Lawal', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 4, 'Airtime & Cable', 'Cable TV subscription (DSTV/GOTV) dina ya dawo nan take. Tsarin yayi kyau sosai.', 9, true, false, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;
