-- Add image_url and target_url to the banners table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='image_url') THEN
        ALTER TABLE public.banners ADD COLUMN image_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='target_url') THEN
        ALTER TABLE public.banners ADD COLUMN target_url TEXT;
    END IF;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
