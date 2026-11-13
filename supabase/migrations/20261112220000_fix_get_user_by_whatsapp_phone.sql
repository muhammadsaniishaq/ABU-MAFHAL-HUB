-- Fix get_user_by_whatsapp_phone RPC function casting role to TEXT to prevent error 42804
CREATE OR REPLACE FUNCTION public.get_user_by_whatsapp_phone(wa_phone TEXT)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    balance NUMERIC,
    transaction_pin TEXT,
    phone TEXT,
    role TEXT
) AS $$
DECLARE
    cleaned_digits TEXT;
    last10 TEXT;
BEGIN
    IF wa_phone IS NULL OR TRIM(wa_phone) = '' THEN
        RETURN;
    END IF;

    cleaned_digits := REGEXP_REPLACE(wa_phone, '\D', '', 'g');
    
    IF LENGTH(cleaned_digits) >= 10 THEN
        last10 := RIGHT(cleaned_digits, 10);
    ELSE
        last10 := cleaned_digits;
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.full_name,
        p.email,
        p.balance,
        p.transaction_pin,
        p.phone,
        p.role::TEXT
    FROM public.profiles p
    WHERE p.phone IS NOT NULL 
      AND (
          REGEXP_REPLACE(p.phone, '\D', '', 'g') = cleaned_digits
          OR (LENGTH(last10) = 10 AND RIGHT(REGEXP_REPLACE(p.phone, '\D', '', 'g'), 10) = last10)
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_whatsapp_phone(TEXT) TO service_role, authenticated, anon;

