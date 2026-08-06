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

    return jsonOk({ error: 'Invalid action specified' })

  } catch (error: any) {
    return jsonOk({ error: error.message || 'Internal server error' })
  }
})
