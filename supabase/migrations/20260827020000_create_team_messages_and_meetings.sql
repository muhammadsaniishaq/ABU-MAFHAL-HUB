-- Migration: 20260827020000_create_team_messages_and_meetings.sql
-- Description: Create tables for internal team communications, meetings, polls, and task collaboration

CREATE TABLE IF NOT EXISTS public.team_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL DEFAULT 'general',
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL DEFAULT 'Admin Staff',
    sender_role TEXT DEFAULT 'admin',
    sender_avatar TEXT,
    content TEXT,
    type TEXT NOT NULL DEFAULT 'text', -- 'text', 'meeting', 'poll', 'task', 'image', 'voice', 'announcement'
    media_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.team_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL DEFAULT 'general',
    meeting_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'live', 'completed', 'cancelled'
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL DEFAULT 'Admin Staff',
    participants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-speed channel loading
CREATE INDEX IF NOT EXISTS idx_team_messages_channel_created_at ON public.team_messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_meetings_scheduled_at ON public.team_meetings(scheduled_at DESC);

-- Enable RLS
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_meetings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and post
CREATE POLICY "Allow authenticated read team_messages"
    ON public.team_messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert team_messages"
    ON public.team_messages FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update team_messages"
    ON public.team_messages FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated delete team_messages"
    ON public.team_messages FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated read team_meetings"
    ON public.team_meetings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert team_meetings"
    ON public.team_meetings FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update team_meetings"
    ON public.team_meetings FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated delete team_meetings"
    ON public.team_meetings FOR DELETE
    TO authenticated
    USING (true);
