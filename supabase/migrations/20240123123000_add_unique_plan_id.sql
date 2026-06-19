-- Add Unique Constraint to plan_id to allow UPSERT operations
ALTER TABLE public.data_plans ADD CONSTRAINT data_plans_plan_id_key UNIQUE (plan_id);
