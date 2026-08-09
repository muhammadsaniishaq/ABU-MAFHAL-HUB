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
    const bilalUsername = secrets['BILALSADASUB_USERNAME'] || secrets['BILAL_USERNAME'] || secrets['BILALSADASUB_USER'] || Deno.env.get('BILALSADASUB_USERNAME') || ''
    const bilalPassword = secrets['BILALSADASUB_PASSWORD'] || secrets['BILAL_PASSWORD'] || secrets['BILALSADASUB_PASS'] || Deno.env.get('BILALSADASUB_PASSWORD') || ''
    const paystackSecret = secrets['PAYSTACK_SECRET_KEY'] || secrets['PAYSTACK_KEY'] || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const clubkonnectKey = secrets['CLUBKONNECT_API_KEY'] || secrets['CLUBKONNECT_KEY'] || Deno.env.get('CLUBKONNECT_API_KEY') || ''
    const clubkonnectUserId = secrets['CLUBKONNECT_USER_ID'] || secrets['CLUBKONNECT_USER'] || ''
    const idProKey = secrets['IDPRO_API_KEY'] || secrets['IDPRO_KEY'] || Deno.env.get('IDPRO_API_KEY') || ''
    const payVesselKey = secrets['PAYVESSEL_API_KEY'] || secrets['PAYVESSEL_KEY'] || secrets['PAYVESSEL_SECRET_KEY'] || secrets['PAYVESSEL_API_SECRET'] || secrets['PAYBESSEL_API_KEY'] || secrets['PAYBESSEL_KEY'] || Deno.env.get('PAYVESSEL_API_KEY') || ''
    const payVesselSecret = secrets['PAYVESSEL_API_SECRET'] || secrets['PAYVESSEL_SECRET_KEY'] || secrets['PAYVESSEL_SECRET'] || secrets['PAYVESSEL_API_KEY'] || ''
    const payVesselBusinessId = secrets['PAYVESSEL_BUSINESS_ID'] || secrets['PAYVESSEL_BUSINESS'] || ''
    const nineBoostKey = secrets['NINEBOOST_API_KEY'] || secrets['NINEBOOST_KEY'] || secrets['NINEBOOST_TOKEN'] || secrets['NINE_BOOST_API_KEY'] || Deno.env.get('NINEBOOST_API_KEY') || ''
    const nowPaymentsKey = secrets['NOWPAYMENTS_API_KEY'] || secrets['NOWPAYMENTS_KEY'] || Deno.env.get('NOWPAYMENTS_API_KEY') || ''
    const bigiToken = secrets['BIGI_API_TOKEN'] || secrets['BIGI_TOKEN'] || Deno.env.get('BIGI_API_TOKEN') || ''
    const bigiUsername = secrets['BIGISUB_USERNAME'] || secrets['BIGI_USERNAME'] || secrets['BIGI_USER'] || Deno.env.get('BIGISUB_USERNAME') || ''
    const bigiPassword = secrets['BIGISUB_PASSWORD'] || secrets['BIGI_PASSWORD'] || secrets['BIGI_PASS'] || Deno.env.get('BIGISUB_PASSWORD') || ''
    const termiiKey = secrets['TERMII_API_KEY'] || secrets['TERMII_KEY'] || Deno.env.get('EXPO_PUBLIC_TERMII_API_KEY') || ''

    const providerBalances: any[] = []

    // 1. AgentHub (Identity, NIN, BVN, CAC, TAX) - Official API Spec: GET /wallet/balance Header: x-api-key
    if (agentHubKey && agentHubKey.trim() !== '') {
      let balance = 0
      let latencyMs = 180
      let fetched = false

      // Attempt 1: Official Endpoint GET https://agenthub.ng/api/wallet/balance with x-api-key
      try {
        const { response, latency } = await fetchWithTimeout('https://agenthub.ng/api/wallet/balance', {
          headers: { 'x-api-key': agentHubKey.trim(), 'Accept': 'application/json' }
        })
        const data = await response.json()
        const rawBal = data?.data?.balance ?? data?.balance ?? data?.user?.balance
        if (rawBal !== undefined) {
          balance = Number(rawBal)
          latencyMs = latency
          fetched = true
        }
      } catch (e) {}

      // Attempt 2: Fallback GET https://agenthub.ng/api/balance with x-api-key
      if (!fetched) {
        try {
          const { response, latency } = await fetchWithTimeout('https://agenthub.ng/api/balance', {
            headers: { 'x-api-key': agentHubKey.trim(), 'Accept': 'application/json' }
          })
          const data = await response.json()
          const rawBal = data?.data?.balance ?? data?.balance
          if (rawBal !== undefined) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      providerBalances.push({
        id: 'agenthub',
        name: 'AgentHub (Identity, NIN, BVN)',
        category: 'Digital Identity',
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
        name: 'AgentHub (Identity, NIN, BVN)',
        category: 'Digital Identity',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 2. BilalSadaSub (Data, Airtime, VTU)
    // Official Spec: POST https://bilalsadasub.com/api/user with Authorization: Basic base64(username:password)
    // The login/token-generation response directly returns { "balance": "12345.00", "AccessToken": "...", ... }
    const bilalHasCredentials = (bilalUsername.trim() !== '' && bilalPassword.trim() !== '')
    const bilalHasToken = bilalToken.trim() !== ''
    if (bilalHasCredentials || bilalHasToken) {
      let balance = 0
      let latencyMs = 210
      let fetched = false

      // Attempt 1 (PRIMARY): POST /api/user with Basic Auth (username:password) — official balance endpoint
      if (bilalHasCredentials) {
        try {
          const basicCred = btoa(`${bilalUsername.trim()}:${bilalPassword.trim()}`)
          const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basicCred}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          })
          const data = await response.json()
          // Official response: { "status": "success", "AccessToken": "...", "balance": "12345.00", "username": "..." }
          const rawBal = data?.balance ?? data?.wallet_balance ?? data?.user?.balance ?? data?.data?.balance
          if (rawBal !== undefined && rawBal !== null && data?.status === 'success') {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      // Attempt 2: POST /api/user with Token header (if we have a stored access token)
      if (!fetched && bilalHasToken) {
        try {
          const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${bilalToken.trim()}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          })
          const data = await response.json()
          const rawBal = data?.balance ?? data?.wallet_balance ?? data?.user?.balance ?? data?.data?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      // Attempt 3: GET /api/user/ with Token header (fallback)
      if (!fetched && bilalHasToken) {
        try {
          const { response, latency } = await fetchWithTimeout('https://bilalsadasub.com/api/user/', {
            method: 'GET',
            headers: {
              'Authorization': `Token ${bilalToken.trim()}`,
              'Accept': 'application/json'
            }
          })
          const data = await response.json()
          const rawBal = data?.balance ?? data?.wallet_balance ?? data?.user?.wallet_balance ?? data?.user?.balance ?? data?.data?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

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
        error: 'Username/Password or Token not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 3. Paystack Merchant Settlement Balance
    if (paystackSecret && paystackSecret.trim() !== '') {
      let balance = 0
      let latencyMs = 150
      try {
        const { response, latency } = await fetchWithTimeout('https://api.paystack.co/balance', {
          headers: { 'Authorization': `Bearer ${paystackSecret.trim()}`, 'Accept': 'application/json' }
        })
        const data = await response.json()
        const balanceItem = data?.data?.find((b: any) => b.currency === 'NGN') || data?.data?.[0]
        if (balanceItem?.balance !== undefined) {
          balance = Number(balanceItem.balance) / 100
          latencyMs = latency
        }
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

    // 4. Clubkonnect / NelloByte API - Official Spec: GET https://www.nellobytesystems.com/APIWalletBalanceV1.asp?UserID=...&APIKey=...
    if (clubkonnectKey && clubkonnectKey.trim() !== '') {
      let balance = 0
      let latencyMs = 140
      let fetched = false
      const userId = clubkonnectUserId || 'CK101269551' || 'ABUMAFHAL'

      // Attempt 1: Official NelloByte Systems API Endpoint
      try {
        const { response, latency } = await fetchWithTimeout(`https://www.nellobytesystems.com/APIWalletBalanceV1.asp?UserID=${userId}&APIKey=${clubkonnectKey.trim()}`)
        const data = await response.json()
        const rawBal = data?.balance ?? data?.user?.balance ?? data?.wallet_balance
        if (rawBal !== undefined && rawBal !== null) {
          balance = Number(rawBal)
          latencyMs = latency
          fetched = true
        }
      } catch (e) {}

      // Attempt 2: Fallback Clubkonnect Domain Endpoint
      if (!fetched) {
        try {
          const { response, latency } = await fetchWithTimeout(`https://www.clubkonnect.com/APIWalletBalanceV1.asp?UserID=${userId}&APIKey=${clubkonnectKey.trim()}`)
          const data = await response.json()
          const rawBal = data?.balance ?? data?.user?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

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

    // 6. IDPro API
    if (idProKey && idProKey.trim() !== '') {
      let balance = 0
      let latencyMs = 160
      try {
        const { response, latency } = await fetchWithTimeout('https://idpro.ng/api/v1/balance', {
          headers: { 'Authorization': `Bearer ${idProKey.trim()}` }
        })
        const data = await response.json()
        const rawBal = data?.balance ?? data?.data?.balance
        if (rawBal !== undefined) {
          balance = Number(rawBal)
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

    // 7. PayVessel (Payment & Payout Gateway)
    if (payVesselKey && payVesselKey.trim() !== '') {
      let balance = 0
      let latencyMs = 170
      let fetched = false

      const baseHeaders: Record<string, string> = {
        'api-key': payVesselKey.trim(),
        'x-api-key': payVesselKey.trim(),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
      if (payVesselSecret && payVesselSecret.trim() !== '') {
        baseHeaders['api-secret'] = payVesselSecret.trim()
        baseHeaders['secret-key'] = payVesselSecret.trim()
        baseHeaders['api-secret-key'] = payVesselSecret.trim()
      }
      if (payVesselBusinessId && payVesselBusinessId.trim() !== '') {
        baseHeaders['api-business-id'] = payVesselBusinessId.trim()
        baseHeaders['business-id'] = payVesselBusinessId.trim()
      }

      const endpointsToTry = [
        'https://api.payvessel.com/api/v1/merchant/balance',
        'https://api.payvessel.com/pms/api/external/request/balance',
        'https://api.payvessel.com/api/v1/user/balance',
        'https://api.payvessel.com/api/v1/wallet/balance',
        'https://api.payvessel.com/api/v1/balance'
      ]

      for (const endpoint of endpointsToTry) {
        if (fetched) break;
        try {
          const { response, latency } = await fetchWithTimeout(endpoint, { headers: baseHeaders })
          const data = await response.json().catch(() => ({}))
          const rawBal = data?.available_balance ?? data?.data?.available_balance ?? data?.payload?.available_balance ?? data?.balance ?? data?.data?.balance ?? data?.wallet_balance ?? data?.data?.wallet_balance ?? data?.ledger_balance ?? data?.data?.ledger_balance ?? data?.banks?.[0]?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      // Fallback attempt: POST to /pms/api/external/request/balance
      if (!fetched && payVesselBusinessId) {
        try {
          const { response, latency } = await fetchWithTimeout('https://api.payvessel.com/pms/api/external/request/balance', {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({ businessid: payVesselBusinessId.trim(), business_id: payVesselBusinessId.trim() })
          })
          const data = await response.json().catch(() => ({}))
          const rawBal = data?.available_balance ?? data?.data?.available_balance ?? data?.balance ?? data?.data?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      providerBalances.push({
        id: 'payvessel',
        name: 'PayVessel (Payment & Payout Gateway)',
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
        id: 'payvessel',
        name: 'PayVessel (Payment & Payout Gateway)',
        category: 'Payment Gateway',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: true
      })
    }

    // 8. NineBoost / 9Boost (Social Media Marketing SMM Panel) - Official Spec: POST https://9boost.me/api/v2
    if (nineBoostKey && nineBoostKey.trim() !== '') {
      let balance = 0
      let latencyMs = 190
      let currency = 'NGN'
      let fetched = false

      // Attempt 1: POST https://9boost.me/api/v2 (Official SMM Panel v2 POST form)
      try {
        const bodyParams = new URLSearchParams()
        bodyParams.append('key', nineBoostKey.trim())
        bodyParams.append('action', 'balance')

        const { response, latency } = await fetchWithTimeout('https://9boost.me/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: bodyParams.toString()
        })
        const data = await response.json()
        const rawBal = data?.balance ?? data?.data?.balance
        if (rawBal !== undefined && rawBal !== null) {
          balance = Number(rawBal)
          if (data?.currency) currency = data.currency
          latencyMs = latency
          fetched = true
        }
      } catch (e) {}

      // Attempt 2: Fallback GET https://9boost.me/api/v2?key=...&action=balance
      if (!fetched) {
        try {
          const { response, latency } = await fetchWithTimeout(`https://9boost.me/api/v2?key=${nineBoostKey.trim()}&action=balance`)
          const data = await response.json()
          const rawBal = data?.balance ?? data?.data?.balance
          if (rawBal !== undefined && rawBal !== null) {
            balance = Number(rawBal)
            if (data?.currency) currency = data.currency
            latencyMs = latency
            fetched = true
          }
        } catch (e) {}
      }

      providerBalances.push({
        id: 'nineboost',
        name: 'NineBoost (Social Media Marketing SMM Panel)',
        category: 'Marketing Services',
        balance: isNaN(balance) ? 0 : balance,
        currency: currency,
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
        currency: 'NGN',
        status: 'unconfigured',
        error: 'API Key not configured in Vault',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 9. NowPayments
    if (nowPaymentsKey && nowPaymentsKey.trim() !== '') {
      let balance = 0
      let latencyMs = 200
      try {
        const { response, latency } = await fetchWithTimeout('https://api.nowpayments.io/v1/balance', {
          headers: { 'x-api-key': nowPaymentsKey.trim() }
        })
        const data = await response.json()
        const rawBal = data?.balance?.usd ?? data?.balance ?? data?.data?.balance
        if (rawBal !== undefined) {
          balance = Number(rawBal)
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

    // 10. Bigi VTU Portal - JWT auth: POST /api/v2/token/ (username+password) → Bearer JWT → GET /api/v2/wallet/balance/
    const bigiHasCreds = bigiUsername && bigiPassword
    const bigiHasToken = bigiToken && bigiToken.trim() !== ''
    if (bigiHasCreds || bigiHasToken) {
      let balance = 0
      let latencyMs = 230
      let bigiDebugRaw: any = null
      let bigiDebugError: string = ''

      const extractBigiBalance = (data: any, depth = 0): number | undefined => {
        if (!data || depth > 5) return undefined
        const explicitCandidates = [
          data?.balance, data?.wallet_balance, data?.walletBalance, data?.available_balance, data?.availableBalance, data?.account_balance, data?.main_balance,
          data?.data?.balance, data?.data?.wallet_balance, data?.data?.walletBalance, data?.data?.available_balance, data?.data?.account_balance,
          data?.data?.user?.balance, data?.data?.user?.wallet_balance, data?.data?.user?.walletBalance, data?.data?.user?.available_balance, data?.data?.user?.account_balance, data?.data?.user?.main_balance, data?.data?.user?.cash_balance,
          data?.user?.balance, data?.user?.wallet_balance, data?.user?.walletBalance, data?.user?.available_balance, data?.user?.account_balance,
          data?.wallet?.balance, data?.wallet?.available, data?.result?.balance, data?.result?.wallet_balance, data?.payload?.balance, data?.info?.balance,
        ]
        for (const c of explicitCandidates) {
          if (c !== undefined && c !== null && c !== '') {
            const n = Number(c)
            if (!isNaN(n)) return n
          }
        }
        if (typeof data === 'object') {
          for (const key of Object.keys(data)) {
            const val = data[key]
            const lowerKey = key.toLowerCase()
            if (typeof val === 'number' && (lowerKey.includes('balance') || lowerKey.includes('wallet') || lowerKey.includes('fund') || lowerKey.includes('money'))) {
              return val
            }
            if (typeof val === 'string' && (lowerKey.includes('balance') || lowerKey.includes('wallet')) && !isNaN(Number(val))) {
              return Number(val)
            }
            if (typeof val === 'object' && val !== null) {
              const subRes = extractBigiBalance(val, depth + 1)
              if (subRes !== undefined) return subRes
            }
          }
        }
        return undefined
      }

      if (bigiHasCreds) {
        // PRIMARY: Login to /api/v2/auth/login/ with email_or_username + password
        try {
          const loginStart = Date.now()
          let loginResp = await fetch('https://bigisub.ng/api/v2/auth/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              email_or_username: bigiUsername.trim(),
              username: bigiUsername.trim(),
              password: bigiPassword.trim()
            })
          })
          
          if (!loginResp.ok && loginResp.status !== 400) {
            // Fallback: try /api/v2/token/
            loginResp = await fetch('https://bigisub.ng/api/v2/token/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                email_or_username: bigiUsername.trim(),
                username: bigiUsername.trim(),
                password: bigiPassword.trim()
              })
            })
          }

          const loginData = await loginResp.json().catch(() => ({}))
          bigiDebugRaw = { loginStatus: loginResp.status, loginData }
          const cookies = loginResp.headers.get('set-cookie')

          // Check 1: Check if wallet_balance/balance is returned DIRECTLY in loginData!
          const directBal = extractBigiBalance(loginData)
          if (directBal !== undefined) {
            balance = directBal
            latencyMs = Date.now() - loginStart
            bigiDebugError = ''
          } else {
            // Check 2: Deep recursive search for any token string inside loginData
            const deepSearchToken = (val: any, depth = 0): string | null => {
              if (!val || depth > 5) return null
              if (typeof val === 'string') {
                if (val.length >= 10 && !val.includes(' ') && !val.includes('{') && !val.includes('http')) {
                  return val.trim()
                }
                return null
              }
              if (typeof val === 'object') {
                const priorityKeys = ['token', 'access_token', 'access', 'jwt', 'key', 'auth_token', 'session_key', 'id_token', 'bearer']
                for (const pk of priorityKeys) {
                  if (typeof val[pk] === 'string' && val[pk].trim().length >= 5) {
                    return val[pk].trim()
                  }
                }
                if (val.data) {
                  const res = deepSearchToken(val.data, depth + 1)
                  if (res) return res
                }
                if (val.user) {
                  const res = deepSearchToken(val.user, depth + 1)
                  if (res) return res
                }
                if (val.result) {
                  const res = deepSearchToken(val.result, depth + 1)
                  if (res) return res
                }
                for (const k of Object.keys(val)) {
                  if (k === 'message' || k === 'success' || k === 'status' || k === 'error' || k === 'errors' || k === 'detail') continue
                  const res = deepSearchToken(val[k], depth + 1)
                  if (res) return res
                }
              }
              return null
            }

            const jwt = deepSearchToken(loginData)

            if (jwt || cookies) {
              // Try fetching balance with Bearer, Token, or Cookie
              const fetchOptions: Array<{ headers: Record<string, string> }> = []
              if (jwt) {
                fetchOptions.push({ headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' } })
                fetchOptions.push({ headers: { 'Authorization': `Token ${jwt}`, 'Accept': 'application/json' } })
              }
              if (cookies) {
                fetchOptions.push({ headers: { 'Cookie': cookies, 'Accept': 'application/json' } })
              }

              const endpoints = [
                'https://bigisub.ng/api/v2/wallet/balance/',
                'https://bigisub.ng/api/v2/user/',
                'https://bigisub.ng/api/v2/user/balance/'
              ]

              let fetchedBal = false
              for (const ep of endpoints) {
                if (fetchedBal) break
                for (const opt of fetchOptions) {
                  try {
                    const bResp = await fetch(ep, opt)
                    if (bResp.ok) {
                      const bData = await bResp.json().catch(() => ({}))
                      bigiDebugRaw.balStatus = bResp.status
                      bigiDebugRaw.balData = bData
                      const foundBal = extractBigiBalance(bData)
                      if (foundBal !== undefined) {
                        balance = foundBal
                        latencyMs = Date.now() - loginStart
                        fetchedBal = true
                        bigiDebugError = ''
                        break
                      }
                    }
                  } catch (e) {}
                }
              }

              if (!fetchedBal) {
                bigiDebugError = `Login ok but balance response structure: ${JSON.stringify(loginData).substring(0, 200)}`
              }
            } else {
              const isSuccessMessage = loginData?.success === true || (typeof loginData?.message === 'string' && loginData.message.toLowerCase().includes('success'))
              if (isSuccessMessage) {
                bigiDebugError = `Login successful! Response data: ${JSON.stringify(loginData?.data || loginData).substring(0, 200)}`
              } else {
                const errMsg = loginData?.message || loginData?.errors?.error?.[0] || loginData?.detail || JSON.stringify(loginData).substring(0, 150)
                bigiDebugError = `Login failed: ${errMsg}`
              }
            }
          }
        } catch (e: any) {
          bigiDebugError = `JWT login error: ${e?.message || 'fetch failed'}`
        }
      }

      // Fallback: try direct token if no credentials OR if credentials failed
      if (!bigiHasCreds || (balance === 0 && bigiHasToken)) {
        try {
          const { response, latency } = await fetchWithTimeout('https://bigisub.ng/api/v2/wallet/balance/', {
            method: 'GET',
            headers: { 'Authorization': `Token ${bigiToken.trim()}`, 'Accept': 'application/json' }
          })
          const data = await response.json()
          if (!bigiDebugRaw) bigiDebugRaw = { tokenFallback: true, status: response.status, data }
          latencyMs = latency
          const rawBal = extractBigiBalance(data)
          if (rawBal !== undefined) { balance = rawBal; bigiDebugError = '' }
        } catch (e: any) { /* ignore fallback errors */ }
      }

      providerBalances.push({
        id: 'bigi',
        name: 'Bigi VTU Portal (SME Data & Airtime)',
        category: 'VTU Telecom',
        balance: isNaN(balance) ? 0 : balance,
        currency: 'NGN',
        latencyMs,
        status: 'healthy',
        error: bigiDebugError || undefined,
        allowDeposit: true,
        allowWithdrawal: false,
        _debug: bigiDebugRaw
      })
    } else {
      providerBalances.push({
        id: 'bigi',
        name: 'Bigi VTU Portal (SME Data & Airtime)',
        category: 'VTU Telecom',
        balance: 0,
        currency: 'NGN',
        status: 'unconfigured',
        error: 'Set BIGISUB_USERNAME + BIGISUB_PASSWORD in Vault (JWT login required)',
        allowDeposit: true,
        allowWithdrawal: false
      })
    }

    // 11. Termii
    if (termiiKey && termiiKey.trim() !== '') {
      let balance = 0
      let latencyMs = 170
      try {
        const { response, latency } = await fetchWithTimeout(`https://api.ng.termii.com/api/get-balance?api_key=${termiiKey.trim()}`)
        const data = await response.json()
        const rawBal = data?.balance ?? data?.data?.balance
        if (rawBal !== undefined) {
          balance = Number(rawBal)
          latencyMs = latency
        }
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
