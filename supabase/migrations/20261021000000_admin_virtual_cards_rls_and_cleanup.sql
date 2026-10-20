-- Migration: 20261021000000_admin_virtual_cards_rls_and_cleanup.sql
-- Description: Grant Admins management/read/delete permissions on user_virtual_cards & card_transactions, and purge any legacy mock/demo cards.

DO $$
BEGIN
    -- 1. Admin Full Access Policy for user_virtual_cards
    DROP POLICY IF EXISTS "Admins have full access to virtual cards" ON public.user_virtual_cards;
    CREATE POLICY "Admins have full access to virtual cards"
        ON public.user_virtual_cards FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        );

    -- 2. Admin Full Access Policy for card_transactions
    DROP POLICY IF EXISTS "Admins have full access to card transactions" ON public.card_transactions;
    CREATE POLICY "Admins have full access to card transactions"
        ON public.card_transactions FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND (profiles.role = 'admin' OR profiles.role = 'super_admin')
            )
        );
END $$;

-- 3. Direct cleanup of any mock or demo virtual cards in the database
DELETE FROM public.user_virtual_cards
WHERE card_id ILIKE 'mock_%'
   OR card_id ILIKE 'test_%'
   OR card_id ILIKE 'demo_%'
   OR card_holder_name ILIKE '%demo%'
   OR card_holder_name ILIKE '%test user%'
   OR card_number_masked ILIKE '4111 11** **** 1111'
   OR card_number_masked ILIKE '4532 75** **** 0084';
