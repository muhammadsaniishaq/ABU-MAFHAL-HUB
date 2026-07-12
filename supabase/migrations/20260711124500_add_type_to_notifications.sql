-- 1. Create the table if it completely doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    type TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. If it does exist, the above just does nothing. So we still need to safely add columns.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE public.notifications ADD COLUMN type TEXT DEFAULT 'general';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='priority') THEN
        ALTER TABLE public.notifications ADD COLUMN priority TEXT DEFAULT 'normal';
    END IF;
END $$;

-- 3. Ensure RLS and Policies are enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Admins/ServiceRole can insert notifications'
    ) THEN
        CREATE POLICY "Admins/ServiceRole can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
