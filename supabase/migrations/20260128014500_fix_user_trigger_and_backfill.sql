-- 1. Update the handle_new_user trigger function to capture custom_id, username, and phone
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, custom_id, username, phone)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'user',
    new.raw_user_meta_data->>'custom_id',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill existing profiles that have missing custom_id
DO $$
DECLARE 
    r RECORD;
    new_id TEXT;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE custom_id IS NULL LOOP
        -- Generate a random 10-digit number (simple approach for backfill)
        new_id := (floor(random() * 9000000000) + 1000000000)::text;
        
        -- Update the record
        UPDATE profiles SET custom_id = new_id WHERE id = r.id;
    END LOOP;
END $$;
