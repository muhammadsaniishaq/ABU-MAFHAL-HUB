// Removed std/http/server.ts import
import { createClient } from "@supabase/supabase-js";
import { createPayvesselDVA } from "../_shared/payvessel.ts";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";

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

            // Dispatch Official Dedicated Account Ready Email
            if (profile?.email && profile.email.includes('@')) {
                try {
                    const recipientName = profile.full_name || 'Valued User';
                    const dvaBody = `
                        Your dedicated automatic virtual funding bank account is now ready and linked to your Abu Mafhal Sub wallet.<br/><br/>
                        <div style="background: #F8FAFC; border-radius: 14px; border: 1.5px solid #E2E8F0; padding: 18px 20px; margin: 16px 0;">
                            <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0284C7; letter-spacing: 0.5px;">Dedicated Virtual Account</div>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13.5px; line-height: 2; margin-top: 8px;">
                                <tr>
                                    <td style="color: #64748B;">Bank Name:</td>
                                    <td align="right" style="font-weight: 800; color: #0A192F;">${virtualAccountData.bank_name}</td>
                                </tr>
                                <tr>
                                    <td style="color: #64748B;">Account Number:</td>
                                    <td align="right" style="font-weight: 900; font-size: 17px; color: #EAB308; letter-spacing: 1px;">${virtualAccountData.account_number}</td>
                                </tr>
                                <tr>
                                    <td style="color: #64748B;">Account Name:</td>
                                    <td align="right" style="font-weight: 700; color: #0A192F;">${virtualAccountData.account_name}</td>
                                </tr>
                            </table>
                        </div>
                        <p style="font-size: 13px; color: #64748B; margin-top: 10px;">
                            Any bank transfer sent to this account number will automatically fund your Abu Mafhal wallet within seconds, 24/7.
                        </p>
                    `;

                    const dvaHtml = renderAbuMafhalEmailTemplate({
                        recipientName,
                        headlineBadge: 'Account Ready',
                        headlineTitle: 'Dedicated Bank Account Assigned! 🏦',
                        headlineSubtitle: 'Automatic, instant 24/7 wallet funding is now enabled.',
                        greeting: `Hi ${recipientName} 👋`,
                        messageBody: dvaBody,
                        buttonText: 'Open ABU MAFHAL SUB &rarr;',
                        buttonUrl: 'https://abumafhal.com.ng'
                    });

                    sendEmail(
                        profile.email,
                        'Your Dedicated Funding Account is Ready! 🏦 - ABU MAFHAL SUB',
                        `Hello ${recipientName}, your dedicated virtual account (${virtualAccountData.bank_name} - ${virtualAccountData.account_number}) is ready. Transfers sent to this account fund your wallet instantly!`,
                        dvaHtml,
                        supabaseAdmin
                    ).catch(mErr => console.warn('[Assign-DVA Email Warning]:', mErr));
                } catch (emErr) {
                    console.warn('[Assign-DVA Email Prepare Warning]:', emErr);
                }
            }
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
