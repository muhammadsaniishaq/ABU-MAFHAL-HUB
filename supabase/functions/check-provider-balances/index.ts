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

    // Check user role in profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      return jsonOk({ error: 'Access denied: Admin privileges required' })
    }

    // Fetch API secrets from system_secrets table & env vars
    const { data: secretsData } = await supabaseAdmin
      .from('system_secrets')
      .select('*')

    const secrets: Record<string, string> = {}
    if (secretsData) {
      secretsData.forEach(s => {
        secrets[s.key] = s.value
      })
    }

    const agentHubKey = secrets['AGENTHUB_API_KEY'] || Deno.env.get('AGENTHUB_API_KEY') || ''
    const bilalToken = secrets['BILALSADASUB_TOKEN'] || Deno.env.get('BILALSADASUB_TOKEN') || ''
    const bigiToken = secrets['BIGI_API_TOKEN'] || Deno.env.get('BIGI_API_TOKEN') || ''
    const paystackSecret = secrets['PAYSTACK_SECRET_KEY'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const termiiKey = secrets['TERMII_API_KEY'] || Deno.env.get('EXPO_PUBLIC_TERMII_API_KEY') || ''

    const providerBalances: any[] = []

    // 1. AgentHub API Balance Check
    if (agentHubKey) {
      try {
        const res = await fetch('https://agenthub.ng/api/balance', {
          headers: { 'Authorization': `Bearer ${agentHubKey}`, 'Accept': 'application/json' }
        })
        const data = await res.json()
        const balance = data?.balance || data?.data?.balance || data?.user?.balance || 0
        providerBalances.push({
          id: 'agenthub',
          name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
          balance: Number(balance),
          currency: 'NGN',
          status: balance > 5000 ? 'healthy' : balance > 1000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Monnify / Sterling Bank (AgentHub)',
            accountNumber: '9081234567',
            accountName: 'AgentHub Corporate / ABUMAFHAL',
            instructions: 'Transfer to this virtual account to instantly top up your AgentHub balance.'
          }
        })
      } catch (err: any) {
        providerBalances.push({
          id: 'agenthub',
          name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: err.message || 'Failed to reach AgentHub API',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'agenthub',
        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 2. BilalSadaSub API Balance Check
    if (bilalToken) {
      try {
        const res = await fetch('https://bilalsadasub.com/api/user/', {
          headers: { 'Authorization': `Token ${bilalToken}`, 'Accept': 'application/json' }
        })
        const data = await res.json()
        const balance = data?.user?.wallet_balance || data?.wallet_balance || data?.balance || 0
        providerBalances.push({
          id: 'bilalsadasub',
          name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
          balance: Number(balance),
          currency: 'NGN',
          status: balance > 10000 ? 'healthy' : balance > 2000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Sterling / Monnify (BilalSadaSub)',
            accountNumber: '8910293841',
            accountName: 'BilalSadaSub Telecom',
            instructions: 'Auto-funding bank account for BilalSadaSub VTU portal.'
          }
        })
      } catch (err: any) {
        providerBalances.push({
          id: 'bilalsadasub',
          name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: err.message || 'Failed to reach BilalSadaSub API',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'bilalsadasub',
        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Token not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 3. Paystack Merchant Settlement Balance
    try {
      if (paystackSecret && paystackSecret.startsWith('sk_')) {
        const res = await fetch('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${paystackSecret}`, 'Accept': 'application/json' }
        })
        const data = await res.json()
        const balanceItem = data?.data?.find((b: any) => b.currency === 'NGN') || data?.data?.[0]
        const balance = (balanceItem?.balance || 0) / 100 // kobo to NGN
        providerBalances.push({
          id: 'paystack',
          name: 'Paystack (Payment Gateway & Settlements)',
          balance: Number(balance),
          currency: 'NGN',
          status: balance > 50000 ? 'healthy' : balance > 5000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: true,
          depositAccount: {
            bankName: 'Paystack Merchant TopUp',
            accountNumber: 'Paystack Dashboard',
            accountName: 'ABUMAFHAL Paystack Merchant',
            instructions: 'Use Paystack Dashboard / TopUp to add funds to merchant balance.'
          }
        })
      } else {
        providerBalances.push({
          id: 'paystack',
          name: 'Paystack (Payment Gateway & Settlements)',
          balance: 0,
          currency: 'NGN',
          status: 'unconfigured',
          error: 'Secret Key required for live balance',
          allowDeposit: true,
          allowWithdrawal: true
        })
      }
    } catch (e: any) {
      providerBalances.push({
        id: 'paystack',
        name: 'Paystack (Payment Gateway & Settlements)',
        balance: 0,
        currency: 'NGN',
        status: 'error',
        error: e.message,
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 4. Termii SMS Gateway Balance
    if (termiiKey) {
      try {
        const res = await fetch(`https://api.ng.termii.com/api/get-balance?api_key=${termiiKey}`)
        const data = await res.json()
        const balance = data?.balance || 0
        providerBalances.push({
          id: 'termii',
          name: 'Termii (SMS & OTP Messaging Gateway)',
          balance: Number(balance),
          currency: data?.currency || 'NGN',
          status: balance > 2000 ? 'healthy' : balance > 500 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Termii Dashboard Topup',
            accountNumber: 'Termii Portal',
            accountName: 'ABUMAFHAL SMS',
            instructions: 'Top up SMS credits via Termii online merchant portal.'
          }
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'termii',
          name: 'Termii (SMS & OTP Messaging Gateway)',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: e.message,
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    }

    // Calculate total aggregated balance across healthy providers
    const totalAggregatedBalance = providerBalances.reduce((acc, curr) => acc + (curr.balance || 0), 0)

    return jsonOk({
      success: true,
      timestamp: new Date().toISOString(),
      totalBalance: totalAggregatedBalance,
      providers: providerBalances
    })

  } catch (error: any) {
    return jsonOk({ error: error.message || 'Internal server error' })
  }
})
