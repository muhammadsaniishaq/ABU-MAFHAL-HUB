-- Enable RLS
ALTER TABLE public.data_plans ENABLE ROW LEVEL SECURITY;

-- Allow Admins to Manage Plans
DROP POLICY IF EXISTS "Admins can manage data plans" ON public.data_plans;
CREATE POLICY "Admins can manage data plans" ON public.data_plans FOR ALL USING (public.is_admin());

-- Allow Users/App to View Active Plans
DROP POLICY IF EXISTS "Users can view active data plans" ON public.data_plans;
CREATE POLICY "Users can view active data plans" ON public.data_plans FOR SELECT USING (is_active = true);
