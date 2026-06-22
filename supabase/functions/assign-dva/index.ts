// Removed std/http/server.ts import
import { createClient } from "@supabase/supabase-js";
import { createPayvesselDVA } from "../_shared/payvessel.ts";

interface VirtualAccountData {
    user_id: string;
    provider: string;
    bank_name: string;
    account_number: string;
    account_name: string;
    currency: string;
    metadata: Record<string, unknown> | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
    // 1. Log Request for Debugging
    console.log("Assign-DVA Invoked");
    
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const payload = await req.json();
        console.log("Payload:", JSON.stringify(payload));
        
        const { record, old_record: _old_record } = payload;

        // Validation: Ensure we have a record
        if (!record) {
             console.error("No record found in payload");
             return new Response(JSON.stringify({ error: "Missing record" }), { status: 400 });
        }

        // Logic: specific to 'approved' status
        if (record.status !== 'approved') {
            console.log(`Status is '${record.status}', skipping DVA creation.`);
            return new Response(JSON.stringify({ message: "Not an approval event" }), {
                headers: { "Content-Type": "application/json" },
                status: 200, 
            });
        }

        const userId = record.user_id;
        console.log(`Processing DVA for User ID: ${userId}`);

        // Initialize Supabase Admin Client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 2. Fetch User Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error("Profile Fetch Error:", profileError);
            throw new Error("Profile not found");
        }

        // 3. Check if already has virtual account (Idempotency)
        const { data: existingAccount } = await supabaseAdmin
            .from('virtual_accounts')
            .select('id, account_number')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingAccount) {
            console.log(`User already has DVA: ${existingAccount.account_number}`);
            return new Response(JSON.stringify({ message: "User already has a virtual account" }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 4. Prepare Payvessel Data
        const userEmail = profile.email;
        const userName = profile.full_name || 'Valued User';
        const userPhone = profile.phone || '08000000000'; 
        let userBVN = profile.bvn;
        let userNIN = null;

        // Fallback: If profile has no BVN/NIN, check if the approved request provides it
        if (!userBVN && record.document_type === 'bvn' && record.document_number) {
            console.log("Using BVN from current approved request:", record.document_number);
            userBVN = record.document_number;
        } else if (!userBVN && record.document_type === 'nin' && record.document_number) {
            console.log("Using NIN from current approved request:", record.document_number);
            userNIN = record.document_number;
        }

        if (!userBVN && !userNIN) {
            console.error("User does not have a BVN or NIN in profile/record, cannot create DVA.");
            return new Response(JSON.stringify({ error: "User missing BVN and NIN" }), { status: 400 });
        }

        console.log(`Creating Payvessel DVA for ${userEmail} (${userName})`);

        let virtualAccountData: VirtualAccountData | null = null;
        let providerError: unknown = null;

        try {
            const payvesselRes = await createPayvesselDVA({
                email: userEmail,
                name: userName,
                phone: userPhone,
                bvn: userBVN || undefined,
                nin: userNIN || undefined
            });
            
            if (payvesselRes.status && payvesselRes.banks && payvesselRes.banks.length > 0) {
                console.log("Payvessel DVA Created Successfully");
                const primaryBank = payvesselRes.banks[0];
                virtualAccountData = {
                    user_id: userId,
                    provider: 'payvessel',
                    bank_name: primaryBank.bankName,
                    account_number: primaryBank.accountNumber,
                    account_name: primaryBank.accountName,
                    currency: 'NGN', 
                    metadata: payvesselRes as unknown as Record<string, unknown>
                };
            } else {
                console.error("Payvessel Response Invalid:", payvesselRes);
                throw new Error(payvesselRes.message || "Payvessel creation failed");
            }
        } catch (e) {
            console.error("Payvessel Attempt Failed:", e);
            providerError = e;
        }

        // 5. Save to DB
        if (virtualAccountData) {
            const { error: insertError } = await supabaseAdmin
                .from('virtual_accounts')
                .insert(virtualAccountData);

            if (insertError) {
                console.error("DB Insert Error:", insertError);
                throw insertError;
            }
            console.log("DVA Saved to Database");
        } else {
            // failed to create
            throw providerError || new Error("Failed to generate virtual account");
        }

        return new Response(JSON.stringify({ 
            message: `Virtual Account Assigned Successfully`,
            account: virtualAccountData
        }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error("Assign-DVA Final Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }
});
