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

// Helper for timed fetch with 6s timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000) {
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
    const latency = Date.now() - startTime;
    throw { error, latency }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Admin client with SERVICE_ROLE_KEY bypasses RLS on system_secrets & app_settings
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const secrets: Record<string, string> = {}

    // 1. Fetch from system_secrets table using Service Role Key
    try {
      const { data: secretsData } = await supabaseAdmin.from('system_secrets').select('*')
      if (secretsData) {
        secretsData.forEach(s => {
          if (s.value && s.key) {
            secrets[s.key.toUpperCase()] = s.value.trim()
          }
        })
      }
    } catch (e) {
      console.error('Error fetching system_secrets:', e)
    }

    // 2. Fetch from app_settings table as backup
    try {
      const { data: settingsData } = await supabaseAdmin.from('app_settings').select('*')
      if (settingsData) {
        settingsData.forEach(s => {
          if (s.value && s.key) {
            secrets[s.key.toUpperCase()] = s.value.trim()
          }
        })
      }
    } catch (e) {
      console.error('Error fetching app_settings:', e)
    }

    // Resolve key aliases
    const agentHubKey = secrets['AGENTHUB_API_KEY'] || secrets['AGENTHUB_KEY'] || Deno.env.get('AGENTHUB_API_KEY') || ''
    const bilalToken = secrets['BILALSADASUB_TOKEN'] || secrets['BILAL_TOKEN'] || Deno.env.get('BILALSADASUB_TOKEN') || ''
    const paystackSecret = secrets['PAYSTACK_SECRET_KEY'] || secrets['PAYSTACK_KEY'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const clubkonnectKey = secrets['CLUBKONNECT_API_KEY'] || secrets['CLUBKONNECT_KEY'] || Deno.env.get('CLUBKONNECT_API_KEY') || ''
    const idProKey = secrets['IDPRO_API_KEY'] || secrets['IDPRO_KEY'] || Deno.env.get('IDPRO_API_KEY') || ''
    const payBesselKey = secrets['PAYBESSEL_API_KEY'] || secrets['PAYBESSEL_KEY'] || Deno.env.get('PAYBESSEL_API_KEY') || ''
    const nineBoostKey = secrets['NINEBOOST_API_KEY'] || secrets['NINEBOOST_KEY'] || Deno.env.get('NINEBOOST_API_KEY') || ''
    const nowPaymentsKey = secrets['NOWPAYMENTS_API_KEY'] || secrets['NOWPAYMENTS_KEY'] || Deno.env.get('NOWPAYMENTS_API_KEY') || ''
    const bigiToken = secrets['BIGI_API_TOKEN'] || secrets['BIGI_TOKEN'] || Deno.env.get('BIGI_API_TOKEN') || ''
    const termiiKey = secrets['TERMII_API_KEY'] || secrets['TERMII_KEY'] || Deno.env.get('EXPO_PUBLIC_TERMII_API_KEY') || ''
    const monnifyApiKey = secrets['MONNIFY_API_KEY'] || secrets['MONNIFY_KEY'] || Deno.env.get('EXPO_PUBLIC_MONNIFY_API_KEY') || ''
    const monnifySecret = secrets['MONNIFY_SECRET_KEY'] || secrets['MONNIFY_SECRET'] || Deno.env.get('MONNIFY_SECRET_KEY') || ''

    const providerBalances: any[] = []

    // 1. AgentHub API (Identity, NIN, BVN, CAC, TAX)
    if (agentHubKey) {
      try {
        const { response, latency } = await fetchWithTimeout('https://agenthub.ng/api/balance', {
          headers: { 'Authorization': `Bearer ${agentHubKey}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balance = Number(data?.balance ?? data?.data?.balance ?? data?.user?.balance ?? 0)
        providerBalances.push({
          id: 'agenthub',
          name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
          category: 'Digital Identity & CAC',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 5000 ? 'healthy' : balance > 1000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Sterling Bank / Monnify (AgentHub)',
            accountNumber: '9081234567',
            accountName: 'AgentHub Corporate / ABUMAFHAL',
            instructions: 'Transfer to this virtual account to top up AgentHub balance.'
          }
        })
      } catch (err: any) {
        providerBalances.push({
          id: 'agenthub',
          name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
          category: 'Digital Identity & CAC',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Connection timeout or invalid key',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'agenthub',
        name: 'AgentHub (Identity, NIN, BVN, CAC, TAX)',
        category: 'Digital Identity & CAC',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Key missing in API Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 2. BilalSadaSub API (Data, Airtime, Cable, Bills)
    if (bilalToken) {
      try {
        const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user/', {
          headers: { 'Authorization': `Token ${bilalToken}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? data?.balance ?? 0)
        providerBalances.push({
          id: 'bilalsadasub',
          name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
          category: 'VTU Telecom',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
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
          category: 'VTU Telecom',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Connection timeout or invalid token',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'bilalsadasub',
        name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Token missing in API Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 3. Paystack Merchant Settlement Balance
    if (paystackSecret && paystackSecret.startsWith('sk_')) {
      try {
        const { response, latency } = await fetchWithTimeout('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${paystackSecret}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balanceItem = data?.data?.find((b: any) => b.currency === 'NGN') || data?.data?.[0]
        const balance = Number((balanceItem?.balance || 0) / 100)
        providerBalances.push({
          id: 'paystack',
          name: 'Paystack (Payment Gateway & Settlements)',
          category: 'Payment Gateway',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 50000 ? 'healthy' : balance > 5000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: true,
          depositAccount: {
            bankName: 'Paystack Merchant TopUp',
            accountNumber: 'Paystack Dashboard',
            accountName: 'ABUMAFHAL Paystack Merchant',
            instructions: 'Use Paystack Merchant Dashboard to add funds.'
          }
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'paystack',
          name: 'Paystack (Payment Gateway & Settlements)',
          category: 'Payment Gateway',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Paystack API fetch error',
          allowDeposit: true,
          allowWithdrawal: true
        })
      }
    } else {
      providerBalances.push({
        id: 'paystack',
        name: 'Paystack (Payment Gateway & Settlements)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Secret Key missing in API Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 4. Clubkonnect API
    if (clubkonnectKey) {
      try {
        const { response, latency } = await fetchWithTimeout(`https://www.clubkonnect.com/api/balance/?UserID=ABUMAFHAL&APIKey=${clubkonnectKey}`)
        const data = await response.json()
        const balance = Number(data?.balance || data?.user?.balance || 0)
        providerBalances.push({
          id: 'clubkonnect',
          name: 'Clubkonnect / NelloByte API (VTU Telecom)',
          category: 'VTU Telecom',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 5000 ? 'healthy' : balance > 1000 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Wema Bank (Clubkonnect)',
            accountNumber: '9182345678',
            accountName: 'Clubkonnect Telecom',
            instructions: 'Transfer to virtual account for Clubkonnect portal.'
          }
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'clubkonnect',
          name: 'Clubkonnect / NelloByte API (VTU Telecom)',
          category: 'VTU Telecom',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Clubkonnect API unreachable',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'clubkonnect',
        name: 'Clubkonnect / NelloByte API (VTU Telecom)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 5. IDPro API (Identity Verification)
    if (idProKey) {
      try {
        const { response, latency } = await fetchWithTimeout('https://idpro.ng/api/balance', {
          headers: { 'Authorization': `Bearer ${idProKey}` }
        })
        const data = await response.json()
        const balance = Number(data?.balance || 0)
        providerBalances.push({
          id: 'idpro',
          name: 'IDPro (Identity & KYC Verification API)',
          category: 'Digital Identity & CAC',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 5000 ? 'healthy' : 'low',
          allowDeposit: true,
          allowWithdrawal: false
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'idpro',
          name: 'IDPro (Identity & KYC Verification API)',
          category: 'Digital Identity & CAC',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'IDPro API error',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'idpro',
        name: 'IDPro (Identity & KYC Verification API)',
        category: 'Digital Identity & CAC',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 6. PayBessel Payment Gateway
    if (payBesselKey) {
      try {
        const { response, latency } = await fetchWithTimeout('https://api.paybessel.com/v1/wallet/balance', {
          headers: { 'Authorization': `Bearer ${payBesselKey}` }
        })
        const data = await response.json()
        const balance = Number(data?.balance || 0)
        providerBalances.push({
          id: 'paybessel',
          name: 'PayBessel (Payment & Payout Gateway)',
          category: 'Payment Gateway',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 20000 ? 'healthy' : 'low',
          allowDeposit: true,
          allowWithdrawal: true
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'paybessel',
          name: 'PayBessel (Payment & Payout Gateway)',
          category: 'Payment Gateway',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'PayBessel API error',
          allowDeposit: true,
          allowWithdrawal: true
        })
      }
    } else {
      providerBalances.push({
        id: 'paybessel',
        name: 'PayBessel (Payment & Payout Gateway)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 7. NineBoost SMM Services API
    if (nineBoostKey) {
      try {
        const { response, latency } = await fetchWithTimeout(`https://nineboost.com/api/v2?key=${nineBoostKey}&action=balance`)
        const data = await response.json()
        const balance = Number(data?.balance || 0)
        providerBalances.push({
          id: 'nineboost',
          name: 'NineBoost (Social Media Marketing SMM Panel)',
          category: 'Marketing Services',
          balance: isNaN(balance) ? 0 : balance,
          currency: data?.currency || 'USD',
          latencyMs: latency,
          status: balance > 20 ? 'healthy' : 'low',
          allowDeposit: true,
          allowWithdrawal: false
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'nineboost',
          name: 'NineBoost (Social Media Marketing SMM Panel)',
          category: 'Marketing Services',
          balance: 0,
          currency: 'USD',
          status: 'error',
          error: 'NineBoost API error',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'nineboost',
        name: 'NineBoost (Social Media Marketing SMM Panel)',
        category: 'Marketing Services',
        balance: 0,
        currency: 'USD',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 8. NowPayments Crypto Gateway
    if (nowPaymentsKey) {
      try {
        const { response, latency } = await fetchWithTimeout('https://api.nowpayments.io/v1/balance', {
          headers: { 'x-api-key': nowPaymentsKey }
        })
        const data = await response.json()
        const balance = Number(data?.balance || 0)
        providerBalances.push({
          id: 'nowpayments',
          name: 'NowPayments (Crypto Payment Gateway)',
          category: 'Payment Gateway',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'USD',
          latencyMs: latency,
          status: balance > 100 ? 'healthy' : 'low',
          allowDeposit: true,
          allowWithdrawal: true
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'nowpayments',
          name: 'NowPayments (Crypto Payment Gateway)',
          category: 'Payment Gateway',
          balance: 0,
          currency: 'USD',
          status: 'error',
          error: 'NowPayments API error',
          allowDeposit: true,
          allowWithdrawal: true
        })
      }
    } else {
      providerBalances.push({
        id: 'nowpayments',
        name: 'NowPayments (Crypto Payment Gateway)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'USD',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 9. Bigi VTU / BigiSub API
    if (bigiToken) {
      try {
        const { response, latency } = await fetchWithTimeout('https://bigidata.com/api/user/', {
          headers: { 'Authorization': `Token ${bigiToken}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balance = Number(data?.user?.wallet_balance ?? data?.wallet_balance ?? data?.balance ?? 0)
        providerBalances.push({
          id: 'bigi',
          name: 'Bigi VTU Portal (SME Data & Airtime)',
          category: 'VTU Telecom',
          balance: isNaN(balance) ? 0 : balance,
          currency: 'NGN',
          latencyMs: latency,
          status: balance > 8000 ? 'healthy' : balance > 1500 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false,
          depositAccount: {
            bankName: 'Moniepoint / Wema (Bigi VTU)',
            accountNumber: '7082930412',
            accountName: 'Bigi Data Services',
            instructions: 'Top up virtual account for Bigi VTU API portal.'
          }
        })
      } catch (err: any) {
        providerBalances.push({
          id: 'bigi',
          name: 'Bigi VTU Portal (SME Data & Airtime)',
          category: 'VTU Telecom',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Bigi API error',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'bigi',
        name: 'Bigi VTU Portal (SME Data & Airtime)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Token missing in API Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 10. Termii SMS Gateway
    if (termiiKey) {
      try {
        const { response, latency } = await fetchWithTimeout(`https://api.ng.termii.com/api/get-balance?api_key=${termiiKey}`)
        const data = await response.json()
        const balance = Number(data?.balance || 0)
        providerBalances.push({
          id: 'termii',
          name: 'Termii (SMS & OTP Messaging Gateway)',
          category: 'SMS & Communications',
          balance: isNaN(balance) ? 0 : balance,
          currency: data?.currency || 'NGN',
          latencyMs: latency,
          status: balance > 2000 ? 'healthy' : balance > 500 ? 'low' : 'critical',
          allowDeposit: true,
          allowWithdrawal: false
        })
      } catch (e: any) {
        providerBalances.push({
          id: 'termii',
          name: 'Termii (SMS & OTP Messaging Gateway)',
          category: 'SMS & Communications',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Termii API error',
          allowDeposit: true,
          allowWithdrawal: false
        })
      }
    } else {
      providerBalances.push({
        id: 'termii',
        name: 'Termii (SMS & OTP Messaging Gateway)',
        category: 'SMS & Communications',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key missing in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 11. Monnify Disbursement Wallet
    if (monnifyApiKey && monnifySecret) {
      try {
        const authStr = btoa(`${monnifyApiKey}:${monnifySecret}`)
        const { response: authRes } = await fetchWithTimeout('https://api.monnify.com/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Authorization': `Basic ${authStr}`, 'Content-Type': 'application/json' }
        })
        const authData = await authRes.json()
        const token = authData?.responseBody?.accessToken

        if (token) {
          const { response: balRes, latency } = await fetchWithTimeout('https://api.monnify.com/api/v2/disbursements/wallet-balance', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const balData = await balRes.json()
          const balance = Number(balData?.responseBody?.availableBalance || 0)
          providerBalances.push({
            id: 'monnify',
            name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
            category: 'Payment Gateway',
            balance: isNaN(balance) ? 0 : balance,
            currency: 'NGN',
            latencyMs: latency,
            status: balance > 30000 ? 'healthy' : balance > 3000 ? 'low' : 'critical',
            allowDeposit: true,
            allowWithdrawal: true
          })
        }
      } catch (err: any) {
        providerBalances.push({
          id: 'monnify',
          name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
          category: 'Payment Gateway',
          balance: 0,
          currency: 'NGN',
          status: 'error',
          error: 'Monnify API error',
          allowDeposit: true,
          allowWithdrawal: true
        })
      }
    } else {
      providerBalances.push({
        id: 'monnify',
        name: 'Monnify (Dynamic Virtual Accounts & Payouts)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key / Secret missing in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // Calculate total aggregated balance across NGN providers safely
    const totalAggregatedBalance = providerBalances
      .filter(p => p.currency === 'NGN')
      .reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0)

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
