
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;

Deno.serve(async (req: Request) => {
    // Handle Paystack POST
    if (req.method !== 'POST') {
        return new Response("Method not allowed", { status: 405 });
    }

    // 1. Verify Signature (Paystack)
    // Paystack sends 'x-paystack-signature' header which is HMAC SHA512 of the body
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
        return new Response("No signature", { status: 401 });
    }

    const body = await req.text();

    // Authenticate Webhook
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(PAYSTACK_SECRET_KEY),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(body)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex !== signature) {
        console.error("Invalid Paystack signature");
        return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
        const { reference, amount, currency, customer } = event.data;
        const paidAmount = amount / 100; // Paystack is in kobo

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // 2. Check Idempotency
        const { data: existing } = await supabaseAdmin
            .from('payment_events')
            .select('id')
            .eq('reference', reference)
            .maybeSingle();

        if (existing) {
            return new Response("Already Processed", { status: 200 });
        }

        // 3. Find User
        // Use customer.email or customer.customer_code if stored
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, balance')
            .eq('email', customer.email)
            .single();

        if (!profile) {
            console.error(`User not found for payment: ${customer.email}`);
            return new Response("User not found", { status: 200 }); // Return 200 to stop Paystack retrying
        }

        // 4. Fund Wallet (Atomic Transaction preferred, doing discrete steps for now)
        const newBalance = (Number(profile.balance) || 0) + paidAmount;

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', profile.id);

        if (updateError) throw updateError;

        // 5. Record Transaction
        await supabaseAdmin.from('transactions').insert({
            user_id: profile.id,
            type: 'deposit',
            amount: paidAmount,
            status: 'success',
            reference: reference,
            description: `Deposit via Paystack (${event.data.channel})`
        });

        // 6. Log Event
        await supabaseAdmin.from('payment_events').insert({
            provider: 'paystack',
            reference: reference,
            amount: paidAmount,
            currency: currency,
            status: 'success',
            metadata: event.data,
            processed_at: new Date().toISOString()
        });

        return new Response("Wallet Funded", { status: 200 });
    }

    return new Response("Event Ignored", { status: 200 });
});
