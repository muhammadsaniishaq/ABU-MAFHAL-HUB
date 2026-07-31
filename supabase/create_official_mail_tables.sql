-- 1. Corporate Admin Emails Table (@abumafhal.com.ng)
CREATE TABLE IF NOT EXISTS public.corporate_admin_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. In-App Mail Inbox & Sent Items Table
CREATE TABLE IF NOT EXISTS public.in_app_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  folder TEXT DEFAULT 'inbox',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.corporate_admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_emails ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for authenticated users
CREATE POLICY "Allow authenticated to read/write corporate_admin_emails" ON public.corporate_admin_emails FOR ALL USING (true);
CREATE POLICY "Allow users to read/write their in_app_emails" ON public.in_app_emails FOR ALL USING (true);
