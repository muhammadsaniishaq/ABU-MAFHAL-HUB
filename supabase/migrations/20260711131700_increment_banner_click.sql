-- Create RPC function to increment banner clicks
CREATE OR REPLACE FUNCTION public.increment_banner_click(banner_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.banners
    SET clicks = clicks + 1
    WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
