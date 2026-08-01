-- Reset & Wipe Old Test Corporate Emails and In-App Emails
TRUNCATE TABLE public.corporate_admin_emails RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.in_app_emails RESTART IDENTITY CASCADE;
