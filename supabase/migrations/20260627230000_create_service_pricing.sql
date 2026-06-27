-- Create service_pricing table
CREATE TABLE IF NOT EXISTS public.service_pricing (
    id TEXT PRIMARY KEY,
    service_category TEXT NOT NULL,
    name TEXT NOT NULL,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    markup_price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend app to fetch prices)
CREATE POLICY "Allow public read access on service_pricing" 
    ON public.service_pricing FOR SELECT 
    USING (true);

-- Allow admin write access (this is a simplified policy, adjust if you have a specific admin role)
CREATE POLICY "Allow authenticated users to manage service_pricing" 
    ON public.service_pricing FOR ALL 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

-- Insert default NIN pricing
INSERT INTO public.service_pricing (id, service_category, name, cost_price, markup_price) VALUES
('nin_premium', 'nin', 'Premium Slip', 200, 0),
('nin_standard', 'nin', 'Standard Slip', 200, 0),
('nin_regular', 'nin', 'Regular Slip', 180, 0),
('nin_info', 'nin', 'Information Slip', 200, 0)
ON CONFLICT (id) DO NOTHING;
