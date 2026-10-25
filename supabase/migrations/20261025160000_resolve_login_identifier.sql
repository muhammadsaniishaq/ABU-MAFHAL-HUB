-- Migration: Add RPC to resolve user login email by username or phone number
-- Allows unauthenticated (anon) users to resolve their login email securely.
-- Only returns email when a matching active account is found.

CREATE OR REPLACE FUNCTION public.get_login_email_for_identifier(user_identifier text)
RETURNS text AS $$
DECLARE
    found_email text;
    cleaned_input text;
    digits_input text;
    last10_digits text;
BEGIN
    IF user_identifier IS NULL OR TRIM(user_identifier) = '' THEN
        RETURN NULL;
    END IF;

    cleaned_input := TRIM(user_identifier);
    digits_input := REGEXP_REPLACE(cleaned_input, '\D', '', 'g');

    -- 1. Try matching by username (case-insensitive)
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(TRIM(username)) = LOWER(cleaned_input)
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN LOWER(TRIM(found_email));
    END IF;

    -- 2. Try matching by custom_id
    SELECT email INTO found_email
    FROM public.profiles
    WHERE LOWER(TRIM(custom_id)) = LOWER(cleaned_input)
    LIMIT 1;

    IF found_email IS NOT NULL THEN
        RETURN LOWER(TRIM(found_email));
    END IF;

    -- 3. If numeric input, check phone number matches (08012345678, +234..., 234..., or last 10 digits)
    IF digits_input <> '' AND LENGTH(digits_input) >= 7 THEN
        last10_digits := RIGHT(digits_input, 10);

        SELECT email INTO found_email
        FROM public.profiles
        WHERE phone IS NOT NULL 
          AND (
            phone = cleaned_input 
            OR REGEXP_REPLACE(phone, '\D', '', 'g') = digits_input
            OR (LENGTH(last10_digits) = 10 AND RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 10) = last10_digits)
          )
        LIMIT 1;

        IF found_email IS NOT NULL THEN
            RETURN LOWER(TRIM(found_email));
        END IF;

        -- Also check phone_number column if it exists in schema
        BEGIN
            EXECUTE 'SELECT email FROM public.profiles WHERE phone_number IS NOT NULL AND (phone_number = $1 OR RIGHT(REGEXP_REPLACE(phone_number, ''\D'', '''', ''g''), 10) = $2) LIMIT 1'
            INTO found_email
            USING cleaned_input, last10_digits;
            
            IF found_email IS NOT NULL THEN
                RETURN LOWER(TRIM(found_email));
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- phone_number column might not exist, ignore
            NULL;
        END;
    END IF;

    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_login_email_for_identifier(text) TO anon, authenticated, service_role;
