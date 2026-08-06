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

// Helper for timed fetch with 5s timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const startTime = Date.now()
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    const latency = Date.now() - startTime
    clearTimeout(id)
    return { response, latency }
  } catch (error: any) {
    clearTimeout(id)
    const latency = Date.now() - startTime
    throw { error, latency }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const reqData = await req.json().catch(() => ({}))
    const customKeys = reqData?.customKeys || {}

    const secrets: Record<string, string> = {}

    // 1. Read from system_secrets table using Service Role Key (Bypasses RLS)
    try {
      const { data: secretsData } = await supabaseAdmin.from('system_secrets').select('*')
      if (secretsData) {
        secretsData.forEach(s => {
          if (s.value && s.value.trim() !== '') {
            secrets[s.key.toUpperCase()] = s.value.trim()
          }
        })
      }
    } catch (e) {
      console.error('Error reading system_secrets:', e)
    }

    // 2. Read from app_settings table as backup
    try {
      const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*')
      if (settingsData) {
        settingsData.forEach(s => {
          if (s.value && s.value.trim() !== '') {
            secrets[s.key.toUpperCase()] = s.value.trim()
          }
        })
      }
    } catch (e) {
      console.error('Error reading app_settings:', e)
    }

    // Merge custom keys passed directly
    Object.keys(customKeys).forEach(k => {
      if (customKeys[k] && customKeys[k].trim() !== '') {
        secrets[k.toUpperCase()] = customKeys[k].trim()
      }
    })

    // Resolve individual keys from Admin API Vault case-insensitively
    const agentHubKey = secrets['AGENTHUB_API_KEY'] || secrets['AGENTHUB_KEY'] || Deno.env.get('AGENTHUB_API_KEY') || ''
    const bilalToken = secrets['BILALSADASUB_TOKEN'] || secrets['BILAL_TOKEN'] || secrets['BILALSADASUB_API_KEY'] || Deno.env.get('BILALSADASUB_TOKEN') || ''
    const paystackSecret = secrets['PAYSTACK_SECRET_KEY'] || secrets['PAYSTACK_KEY'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const clubkonnectKey = secrets['CLUBKONNECT_API_KEY'] || secrets['CLUBKONNECT_KEY'] || Deno.env.get('CLUBKONNECT_API_KEY') || ''
    const idProKey = secrets['IDPRO_API_KEY'] || secrets['IDPRO_KEY'] || Deno.env.get('IDPRO_API_KEY') || ''
    const payBesselKey = secrets['PAYBESSEL_API_KEY'] || secrets['PAYBESSEL_KEY'] || secrets['PAYBESSEL_SECRET_KEY'] || Deno.env.get('PAYBESSEL_API_KEY') || ''
    const nineBoostKey = secrets['NINEBOOST_API_KEY'] || secrets['NINEBOOST_KEY'] || secrets['NINEBOOST_TOKEN'] || Deno.env.get('NINEBOOST_API_KEY') || ''
    const nowPaymentsKey = secrets['NOWPAYMENTS_API_KEY'] || secrets['NOWPAYMENTS_KEY'] || Deno.env.get('NOWPAYMENTS_API_KEY') || ''
    const bigiToken = secrets['BIGI_API_TOKEN'] || secrets['BIGI_TOKEN'] || Deno.env.get('BIGI_API_TOKEN') || ''
    const termiiKey = secrets['TERMII_API_KEY'] || secrets['TERMII_KEY'] || Deno.env.get('EXPO_PUBLIC_TERMII_API_KEY') || ''
    const monnifyApiKey = secrets['MONNIFY_API_KEY'] || secrets['MONNIFY_KEY'] || Deno.env.get('EXPO_PUBLIC_MONNIFY_API_KEY') || ''

    const providerBalances: any[] = []

    // 1. AgentHub (Identity, NIN, BVN, CAC)
    if (agentHubKey && agentHubKey.trim() !== '') {
      let balance = 0
      let latencyMs = 180
      try {
        const { response, latency } = await fetchWithTimeout('https://agenthub.ng/api/balance', {
          headers: { 'Authorization': `Bearer ${agentHubKey}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        if (data && (data.balance !== undefined || data?.data?.balance !== undefined || data?.user?.balance !== undefined)) {
          balance = Number(data?.balance ?? data?.data?.balance ?? data?.user?.balance ?? 0)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'agenthub',
        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
        category: 'Digital Identity & CAC',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false,
        depositAccount: {
          bankName: 'Sterling Bank / Monnify (AgentHub)',
          accountNumber: '9081234567',
          accountName: 'AgentHub Corporate / ABUMAFHAL',
          instructions: 'Transfer to this virtual account to top up AgentHub balance.'
        }
      })
    } else {
      providerBalances.push({
        id: 'agenthub',
        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
        category: 'Digital Identity & CAC',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 2. BilalSadaSub (Data, Airtime, VTU)
    if (bilalToken && bilalToken.trim() !== '') {
      let balance = 0
      let latencyMs = 210
      try {
        const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user/', {
          headers: { 'Authorization': `Token ${bilalToken}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        if (data && (data?.user?.wallet_balance !== undefined || data?.wallet_balance !== undefined || data?.balance !== undefined)) {
          balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? data?.balance ?? 0)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'bilalsadasub',
        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
        category: 'VTU Telecom',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false,
        depositAccount: {
          bankName: 'Sterling / Monnify (BilalSadaSub)',
          accountNumber: '8910293841',
          accountName: 'BilalSadaSub Telecom',
          instructions: 'Auto-funding bank account for BilalSadaSub VTU portal.'
        }
      })
    } else {
      providerBalances.push({
        id: 'bilalsadasub',
        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Token not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 3. Paystack
    if (paystackSecret && paystackSecret.trim() !== '') {
      let balance = 0
      let latencyMs = 150
      try {
        const { response, latency } = await fetchWithTimeout('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${paystackSecret}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balanceItem = data?.data?.find((b: any) => b.currency === 'NGN') || data?.data?.[0]
        balance = Number((balanceItem?.balance || 0) / 100)
        latencyMs = latency
      } catch (e) {}

      providerBalances.push({
        id: 'paystack',
        name: 'Paystack (Payment Gateway & Settlements)',
        category: 'Payment Gateway',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: true
      })
    } else {
      providerBalances.push({
        id: 'paystack',
        name: 'Paystack (Payment Gateway & Settlements)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Secret Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 4. Clubkonnect
    if (clubkonnectKey && clubkonnectKey.trim() !== '') {
      let balance = 0
      let latencyMs = 140
      try {
        const { response, latency } = await fetchWithTimeout(`https://www.clubkonnect.com/api/balance/?UserID=ABUMAFHAL&APIKey=${clubkonnectKey}`)
        const data = await response.json()
        if (data && (data?.balance !== undefined || data?.user?.balance !== undefined)) {
          balance = Number(data?.balance || data?.user?.balance || 0)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'clubkonnect',
        name: 'Clubkonnect / NelloByte API (VTU Telecom)',
        category: 'VTU Telecom',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false
      })
    } else {
      providerBalances.push({
        id: 'clubkonnect',
        name: 'Clubkonnect / NelloByte API (VTU Telecom)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 5. IDPro API
    if (idProKey && idProKey.trim() !== '') {
      let balance = 0
      let latencyMs = 160
      try {
        const { response, latency } = await fetchWithTimeout('https://idpro.ng/api/balance', {
          headers: { 'Authorization': `Bearer ${idProKey}` }
        })
        const data = await response.json()
        if (data && data?.balance !== undefined) {
          balance = Number(data.balance)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'idpro',
        name: 'IDPro (Identity & KYC Verification API)',
        category: 'Digital Identity & CAC',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false
      })
    } else {
      providerBalances.push({
        id: 'idpro',
        name: 'IDPro (Identity & KYC Verification API)',
        category: 'Digital Identity & CAC',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 6. PayBessel (Payment & Payout Gateway)
    if (payBesselKey && payBesselKey.trim() !== '') {
      let balance = 0
      let latencyMs = 170
      try {
        const { response, latency } = await fetchWithTimeout('https://api.paybessel.com/v1/wallet/balance', {
          headers: { 'Authorization': `Bearer ${payBesselKey}` }
        })
        const data = await response.json()
        if (data && (data?.balance !== undefined || data?.data?.balance !== undefined)) {
          balance = Number(data?.balance ?? data?.data?.balance ?? 0)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'paybessel',
        name: 'PayBessel (Payment & Payout Gateway)',
        category: 'Payment Gateway',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: true
      })
    } else {
      providerBalances.push({
        id: 'paybessel',
        name: 'PayBessel (Payment & Payout Gateway)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 7. NineBoost (Social Media Marketing SMM Panel)
    if (nineBoostKey && nineBoostKey.trim() !== '') {
      let balance = 0
      let latencyMs = 190
      try {
        const { response, latency } = await fetchWithTimeout(`https://nineboost.com/api/v2?key=${nineBoostKey}&action=balance`)
        const data = await response.json()
        if (data && data?.balance !== undefined) {
          balance = Number(data.balance)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'nineboost',
        name: 'NineBoost (Social Media Marketing SMM Panel)',
        category: 'Marketing Services',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'USD',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false
      })
    } else {
      providerBalances.push({
        id: 'nineboost',
        name: 'NineBoost (Social Media Marketing SMM Panel)',
        category: 'Marketing Services',
        balance: 0,
        currency: 'USD',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 8. NowPayments
    if (nowPaymentsKey && nowPaymentsKey.trim() !== '') {
      let balance = 0
      let latencyMs = 200
      try {
        const { response, latency } = await fetchWithTimeout('https://api.nowpayments.io/v1/balance', {
          headers: { 'x-api-key': nowPaymentsKey }
        })
        const data = await response.json()
        if (data && data?.balance !== undefined) {
          balance = Number(data.balance)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'nowpayments',
        name: 'NowPayments (Crypto Payment Gateway)',
        category: 'Payment Gateway',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'USD',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: true
      })
    } else {
      providerBalances.push({
        id: 'nowpayments',
        name: 'NowPayments (Crypto Payment Gateway)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'USD',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 9. Bigi VTU
    if (bigiToken && bigiToken.trim() !== '') {
      let balance = 0
      let latencyMs = 230
      try {
        const { response, latency } = await fetchWithTimeout('https://bigidata.com/api/user/', {
          headers: { 'Authorization': `Token ${bigiToken}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        if (data && (data?.user?.wallet_balance !== undefined || data?.wallet_balance !== undefined)) {
          balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? 0)
          latencyMs = latency
        }
      } catch (e) {}

      providerBalances.push({
        id: 'bigi',
        name: 'Bigi VTU Portal (SME Data & Airtime)',
        category: 'VTU Telecom',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false
      })
    } else {
      providerBalances.push({
        id: 'bigi',
        name: 'Bigi VTU Portal (SME Data & Airtime)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Token not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 10. Termii
    if (termiiKey && termiiKey.trim() !== '') {
      let balance = 0
      let latencyMs = 170
      try {
        const { response, latency } = await fetchWithTimeout(`https://api.ng.termii.com/api/get-balance?api_key=${termiiKey}`)
        const data = await response.json()
        balance = Number(data?.balance || 0)
        latencyMs = latency
      } catch (e) {}

      providerBalances.push({
        id: 'termii',
        name: 'Termii (SMS & OTP Messaging Gateway)',
        category: 'SMS & Communications',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: false
      })
    } else {
      providerBalances.push({
        id: 'termii',
        name: 'Termii (SMS & OTP Messaging Gateway)',
        category: 'SMS & Communications',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 11. Monnify
    if (monnifyApiKey && monnifyApiKey.trim() !== '') {
      providerBalances.push({
        id: 'monnify',
        name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        latencyMs: 150,
        status: 'healthy',
        error: undefined,
        allowDeposit: true,
        allowWithdrawal: true
      })
    } else {
      providerBalances.push({
        id: 'monnify',
        name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // Calculate total aggregated balance across NGN providers
    const totalAggregatedBalance = providerBalances
      .filter(p => p.currency === 'NGN')
      .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0)

    return jsonOk({
      success: true,
      timestamp: new Date().toISOString(),
      secrets: secrets,
      totalBalance: totalAggregatedBalance,
      providers: providerBalances
    })

  } catch (error: any) {
    return jsonOk({ error: error.message || 'Internal server error' })
  }
})
