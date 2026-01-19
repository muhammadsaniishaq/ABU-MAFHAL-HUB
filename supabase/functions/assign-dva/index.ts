
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createPaystackDVA } from "../_shared/paystack.ts";
import { createFlutterwaveDVA } from "../_shared/flutterwave.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const { record, old_record } = await req.json();

        // Only proceed if status changed to 'approved'
        if (record.status !== 'approved' || (old_record && old_record.status === 'approved')) {
            return new Response(JSON.stringify({ message: "Not an approval event" }), {
                headers: { "Content-Type": "application/json" },
                status: 200, // Not an error, just ignore
            });
        }

        const userId = record.user_id;
        const documentType = record.document_type;
        // In a real app, you might extract BVN/NIN from the document or input
        // For this demo, we assume we might need to fetch profile or use a placeholder if not stored directly.

        // Initialize Supabase Admin Client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 1. Fetch User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            throw new Error("Profile not found");
        }

        // 2. Check if already has virtual account
        const { data: existingAccount } = await supabaseAdmin
            .from('virtual_accounts')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingAccount) {
            return new Response(JSON.stringify({ message: "User already has a virtual account" }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3. Create Virtual Account (Default to Paystack for this logic, user can switch to FW if they want)
        // You can use a config to decide which provider to use.
        // For flexibility, let's try Flutterwave if they provided BVN (simulated check) or Paystack otherwise.

        let virtualAccountData: any = null;
        let provider = '';

        // NOTE: This logic assumes we have user's phone number. If not in profile, this might fail for Paystack.
        // Ideally, `profiles` should have phone numbers.
        const userPhone = profile.phone || '08000000000'; // Fallback
        const userEmail = profile.email;
        const userName = profile.full_name || 'Valued User';
        const splitName = userName.split(' ');
        const firstName = splitName[0];
        const lastName = splitName.slice(1).join(' ') || firstName;

        try {
            console.log(`Creating Paystack DVA for ${userEmail}`);
            const paystackRes = await createPaystackDVA(userEmail, firstName, lastName, userPhone);

            if (paystackRes.status && paystackRes.data) {
                provider = 'paystack';
                virtualAccountData = {
                    user_id: userId,
                    provider: 'paystack',
                    bank_name: paystackRes.data.bank.name,
                    account_number: paystackRes.data.account_number,
                    account_name: paystackRes.data.account_name,
                    currency: paystackRes.data.currency,
                    meta_data: paystackRes.data
                };
            } else {
                throw new Error(paystackRes.message || "Paystack creation failed");
            }

        } catch (e) {
            console.error("Paystack failed, trying Flutterwave...", e);
            // Fallback or Alternative Logic here
            throw e; // Rethrow for now to see logs in Dashboard
        }

        // 4. Save to DB
        if (virtualAccountData) {
            const { error: insertError } = await supabaseAdmin
                .from('virtual_accounts')
                .insert(virtualAccountData);

            if (insertError) throw insertError;
        }

        return new Response(JSON.stringify({ message: `Virtual Account Assigned (${provider})` }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
