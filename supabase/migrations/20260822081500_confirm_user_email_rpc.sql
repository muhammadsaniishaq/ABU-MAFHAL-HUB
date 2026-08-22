-- Migration: Add confirm_user_email RPC function to enable seamless auth verification

CREATE OR REPLACE FUNCTION public.confirm_user_email(target_email text)
RETURNS void AS $$
BEGIN
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE LOWER(email) = LOWER(TRIM(target_email))
      AND email_confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.confirm_user_email(text) TO anon, authenticated, service_role;
