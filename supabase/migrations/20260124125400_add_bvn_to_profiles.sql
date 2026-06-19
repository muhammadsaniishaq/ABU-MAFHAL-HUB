-- Add BVN column to profiles table
alter table public.profiles 
add column if not exists bvn text;

-- Add comment to indicate sensitivity
comment on column public.profiles.bvn is 'User BVN - Sensitive Data';

-- Ensure RLS allows user to view their own BVN (already covered by select * policy, but good to double check)
-- Existing policy: "Users can view own profile" using (auth.uid() = id); covers this.
