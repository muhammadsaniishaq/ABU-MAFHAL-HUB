import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonOk = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify Super Admin Auth JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()

    if (!jwt) {
      return jsonOk({ error: 'No authorization token provided' })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) {
      return jsonOk({ error: 'Authentication failed' })
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return jsonOk({ error: 'Access denied: Admin privileges required' })
    }

    const body = await req.json()
    const { action, providerId, amount, bankCode, accountNumber, accountName, reason } = body

    if (action === 'withdraw') {
      if (!amount || amount <= 0) {
        return jsonOk({ error: 'Please specify a valid withdrawal amount' })
      }
      if (!accountNumber || !bankCode) {
        return jsonOk({ error: 'Please provide destination bank account number and bank code' })
      }

      // ── FLUTTERWAVE WITHDRAWAL / TRANSFER ──────────────────────
      if (providerId === 'flutterwave') {
        const { data: flwSecretRow } = await supabaseAdmin
          .from('system_secrets')
          .select('value')
          .in('key', ['FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_KEY', 'FLUTTERWAVE_SECRET'])
          .maybeSingle()

        const flwSecret = flwSecretRow?.value || Deno.env.get('FLUTTERWAVE_SECRET_KEY') || ''
        if (!flwSecret) {
          return jsonOk({ error: 'Flutterwave Secret Key is not configured for automated transfers' })
        }

        const transferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${flwSecret.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_bank: bankCode,
            account_number: accountNumber,
            amount: Number(amount),
            narration: reason || 'ABUMAFHAL Admin Withdrawal',
            currency: 'NGN',
            reference: `FLW-WDR-${Date.now()}`
          })
        })

        const transferData = await transferRes.json()
        if (transferData.status !== 'success') {
          return jsonOk({ error: transferData.message || 'Flutterwave transfer failed' })
        }

        await supabaseAdmin.from('audit_logs').insert({
          admin_id: user.id,
          action: 'PROVIDER_WALLET_WITHDRAWAL',
          details: {
            providerId: 'flutterwave',
            amount,
            accountNumber,
            bankCode,
            reference: transferData.data?.reference || transferData.data?.id
          }
        })

        return jsonOk({
          success: true,
          message: `Successfully transferred ₦${amount.toLocaleString()} to ${accountNumber} via Flutterwave`,
          transferData: transferData.data
        })
      }

      // ── PAYSTACK WITHDRAWAL / TRANSFER ──────────────────────────
      // Fetch Paystack secret key
      const { data: secretRow } = await supabaseAdmin
        .from('system_secrets')
        .select('value')
        .eq('key', 'PAYSTACK_SECRET_KEY')
        .maybeSingle()

      const paystackSecret = secretRow?.value || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

      if (!paystackSecret || !paystackSecret.startsWith('sk_')) {
        return jsonOk({ error: 'Paystack Secret Key is not configured for automated transfers' })
      }

      // 1. Create Transfer Recipient on Paystack
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'nuban',
          name: accountName || 'Admin Withdrawal',
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN'
        })
      })

      const recipientData = await recipientRes.json()
      if (!recipientData.status) {
        return jsonOk({ error: recipientData.message || 'Failed to create transfer recipient' })
      }

      const recipientCode = recipientData.data.recipient_code

      // 2. Initiate Transfer
      const transferRes = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'balance',
          amount: amount * 100, // NGN to Kobo
          recipient: recipientCode,
          reason: reason || 'ABUMAFHAL Admin Provider Withdrawal'
        })
      })

      const transferData = await transferRes.json()
      if (!transferData.status) {
        return jsonOk({ error: transferData.message || 'Transfer failed' })
      }

      // Log withdrawal transaction in admin audit logs
      await supabaseAdmin.from('audit_logs').insert({
        admin_id: user.id,
        action: 'PROVIDER_WALLET_WITHDRAWAL',
        details: {
          providerId,
          amount,
          accountNumber,
          bankCode,
          reference: transferData.data.reference
        }
      })

      return jsonOk({
        success: true,
        message: `Successfully transferred ₦${amount.toLocaleString()} to ${accountNumber} (${bankCode})`,
        transferData: transferData.data
      })
    }

    // ── ACTION: Save CAC Service Pricing ───────────────────────────────────
    if (action === 'save_cac_price') {
      const { id, price, name, original_price, discount_label } = body;
      const p = parseFloat(price);
      if (isNaN(p) || p < 0) {
        return jsonOk({ error: 'Please specify a valid numeric price' });
      }

      const origP = original_price !== undefined && original_price !== null && original_price !== ''
        ? parseFloat(original_price)
        : null;

      let updatedData = null;
      const updatePayload: Record<string, any> = { price: p };
      if (origP !== null && !isNaN(origP)) {
        updatePayload.original_price = origP;
      }
      if (discount_label !== undefined) {
        updatePayload.discount_label = discount_label;
      }

      if (id && !id.startsWith('cac-certificate-retrieval-default')) {
        let { data, error } = await supabaseAdmin
          .from('cac_pricing')
          .update(updatePayload)
          .eq('id', id)
          .select();

        if (error && (error.message?.includes('original_price') || error.message?.includes('discount_label'))) {
          const fallback = await supabaseAdmin
            .from('cac_pricing')
            .update({ price: p })
            .eq('id', id)
            .select();
          data = fallback.data;
          error = fallback.error;
        }

        if (error) return jsonOk({ error: error.message });
        updatedData = data;
      } else {
        const { data, error } = await supabaseAdmin
          .from('cac_pricing')
          .upsert([{
            name: name || 'CAC Certificate Retrieval / Document Search',
            price: p,
            active: true
          }])
          .select();
        if (error) return jsonOk({ error: error.message });
        updatedData = data;
      }

      try {
        await supabaseAdmin.from('app_settings').upsert({
          key: `cac_price_${id || 'retrieval'}`,
          value: JSON.stringify({
            price: p,
            original_price: origP && !isNaN(origP) ? origP : null,
            discount_label: discount_label || null
          }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (_) {}

      return jsonOk({
        success: true,
        message: 'CAC Price and discount updated successfully',
        data: updatedData
      });
    }

    // ── ACTION: Save TIN Add-on Fee ─────────────────────────────────────────
    if (action === 'save_tin_fee') {
      const { fee } = body;
      const val = parseFloat(fee);
      if (isNaN(val) || val < 0) {
        return jsonOk({ error: 'Please specify a valid TIN fee' });
      }
      const { error } = await supabaseAdmin.from('app_settings').upsert({
        key: 'cac_tin_fee',
        value: String(val),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) return jsonOk({ error: error.message });
      return jsonOk({ success: true, message: 'TIN fee updated successfully' });
    }

    return jsonOk({ error: 'Invalid action specified' })

  } catch (error: any) {
    return jsonOk({ error: error.message || 'Internal server error' })
  }
})
