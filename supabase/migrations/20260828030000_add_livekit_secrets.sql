-- Description: LiveKit WebRTC Conference Keys Declaration in public.system_secrets
-- Note: Secrets are managed securely via Admin API Vault (app/manage/secrets.tsx) without committing raw keys to source control.

INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('livekit_url', '', 'LiveKit Cloud URL'),
    ('livekit_api_key', '', 'LiveKit API Key'),
    ('livekit_api_secret', '', 'LiveKit API Secret')
ON CONFLICT (key) DO NOTHING;
