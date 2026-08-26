import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AgentHub base URL
const AGENTHUB_BASE = 'https://agenthub.ng/api';

// Always return HTTP 200 so SDK can read actual error body
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
    // Use Service Role admin client — reliable JWT verification without RLS issues
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()

    if (!jwt) {
      console.error('No Authorization header received')
      return jsonOk({ error: 'No auth token provided. Please log in and try again.' })
    }

    // Verify the JWT using the admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)

    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message, '| JWT (first 20 chars):', jwt.substring(0, 20))
      return jsonOk({ error: `Auth failed: ${authError?.message || 'Invalid token'}. Please log out and log in again.` })
    }

    console.log('Auth OK for user:', user.id)

    const requestData = await req.json()
    const { type, value, firstname, lastname, dob, gender, service_code } = requestData

    const searchType = requestData.searchType || type
    const searchValue = requestData.searchValue || value

    if (!searchType) {
      return jsonOk({ error: 'Missing search type' })
    }

    // ── Handle Admin Live Pricing Sync (Server-to-Server) ──────────────────────
    if (searchType === 'sync_prices') {
      let AGENTHUB_API_KEY = Deno.env.get('AGENTHUB_API_KEY');
      if (!AGENTHUB_API_KEY) {
        const { data: secrets } = await supabaseAdmin
          .from('system_secrets')
          .select('value')
          .eq('key', 'AGENTHUB_API_KEY')
          .maybeSingle();
        if (secrets?.value) AGENTHUB_API_KEY = secrets.value;
      }

      if (!AGENTHUB_API_KEY) {
        return jsonOk({ error: 'AGENTHUB_API_KEY is not set in API Vault.' });
      }

      try {
        console.log(`Fetching live AgentHub prices from ${AGENTHUB_BASE}/v1/identity/pricing`);
        const agentHubRes = await fetch(`${AGENTHUB_BASE}/v1/identity/pricing`, {
          headers: { 
            'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });

        const rawText = await agentHubRes.text();
        let agentData: any = null;

        try {
          agentData = JSON.parse(rawText);
        } catch (_) {
          console.warn("AgentHub pricing API returned non-JSON response:", rawText.substring(0, 150));
          return jsonOk({ 
            success: true, 
            message: 'Default AgentHub wholesale pricing is active in registry.',
            isDefault: true 
          });
        }

        return jsonOk({ success: true, message: 'AgentHub pricing synced!', data: agentData });
      } catch (err: any) {
        console.error('AgentHub pricing fetch error:', err);
        return jsonOk({ error: `AgentHub pricing fetch failed: ${err.message}` });
      }
    }

    const isStatusCheck = String(searchType).endsWith('-status');
    let FEE_AMOUNT = 0;
    let description = `Verification Status Check`;
    let priceId = requestData.priceId || '';

    if (!isStatusCheck) {
      if (!priceId) {
        // Fallback map searchType -> default priceId
        const defaultPriceMap: Record<string, string> = {
          'nin': 'nin_regular',
          'nin-slip': 'nin_regular',
          'nin-slip-v2': 'nin_premium',
          'nin-validation': 'val_no_record',
          'nin-personalization': 'nin_personalization',
          'nin-modification': 'nin_modification_501',
          'vnin-slip': 'nin_regular',
          'phone': 'nin_regular',
          'demographic': 'nin_regular',
          'bvn': 'bvn_num_advanced',
          'bvn-phone': 'bvn_phone_advanced',
          'bvn-card': 'bvn_card',
          'vnin-to-nibss': 'bvn_vnin_nibss',
          'bvn-modification': 'bvn_modification',
          'ipe': 'nin_regular',
          'val': 'val_no_record'
        };
        priceId = defaultPriceMap[searchType] || 'nin_regular';
      }

      // Fetch dynamic pricing from service_pricing table
      const { data: pricing, error: pricingError } = await supabaseAdmin
        .from('service_pricing')
        .select('*')
        .eq('id', priceId)
        .maybeSingle();

      if (pricing) {
        const cost = parseFloat(pricing.cost_price?.toString() || '0');
        const markup = parseFloat(pricing.markup_price?.toString() || '0');
        const selling = pricing.selling_price ? parseFloat(pricing.selling_price.toString()) : (cost + markup);
        FEE_AMOUNT = selling > 0 ? selling : (cost + markup);
        description = `Verification: ${pricing.name || pricing.service_name || priceId}`;
      } else {
        console.warn(`Pricing record for '${priceId}' not found in service_pricing:`, pricingError?.message);
        FEE_AMOUNT = 150;
        description = `Verification: ${priceId}`;
      }

      const addonPriceId = requestData.addonPriceId;
      if (addonPriceId && addonPriceId !== 'val_slip_none') {
        const { data: addonPricing } = await supabaseAdmin
          .from('service_pricing')
          .select('*')
          .eq('id', addonPriceId)
          .maybeSingle();

        if (addonPricing) {
          const addonCost = parseFloat(addonPricing.cost_price?.toString() || '0');
          const addonMarkup = parseFloat(addonPricing.markup_price?.toString() || '0');
          const addonSelling = addonPricing.selling_price ? parseFloat(addonPricing.selling_price.toString()) : (addonCost + addonMarkup);
          const addonTotal = addonSelling > 0 ? addonSelling : (addonCost + addonMarkup);
          FEE_AMOUNT += addonTotal;
          description += ` + ${addonPricing.name || addonPricing.service_name || addonPriceId}`;
        }
      }

      // Deduct balance only if FEE_AMOUNT > 0
      if (FEE_AMOUNT > 0) {
        const { error: deductError } = await supabaseAdmin.rpc('deduct_balance', {
          user_id: user.id,
          amount: FEE_AMOUNT
        });

        if (deductError) {
          console.error('Balance deduction error:', deductError.message);
          if (deductError.message.toLowerCase().includes('insufficient')) {
            return jsonOk({ error: `Insufficient wallet balance. You need ₦${FEE_AMOUNT.toLocaleString()}.` });
          }
          return jsonOk({ error: 'Failed to deduct wallet balance. Please try again.' });
        }

        // Record transaction
        await supabaseAdmin.from('transactions').insert({
          user_id: user.id,
          amount: FEE_AMOUNT,
          type: 'payment',
          status: 'success',
          reference: `id_verify_${searchType}_${Date.now()}`,
          description: description
        });
      }
    }

    // ── Retrieve AgentHub API Key ─────────────────────────────────────────────
    let AGENTHUB_API_KEY = Deno.env.get('AGENTHUB_API_KEY');
    if (!AGENTHUB_API_KEY) {
        const { data: secrets } = await supabaseAdmin
            .from('system_secrets')
            .select('value')
            .eq('key', 'AGENTHUB_API_KEY')
            .single();
        if (secrets && secrets.value) {
            AGENTHUB_API_KEY = secrets.value;
        }
    }

    if (!AGENTHUB_API_KEY) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: AgentHub API key not configured`);
        console.error('AGENTHUB_API_KEY is not set in environment or system_secrets table')
        return jsonOk({ error: 'Verification service is not configured. Please contact support.' })
    }

    // ── Build AgentHub endpoint & payload ────────────────────────────────────
    let endpoint = '';
    let bodyPayload: any = {};

    switch (searchType) {

      // ── NIN Verification ───────────────────────────────────────────────────
      case 'nin': {
        let calculatedSlipType = (requestData.slip_type || requestData.layout || '').toUpperCase();
        if (!calculatedSlipType) {
          if (priceId === 'nin_standard') calculatedSlipType = 'STANDARD';
          else if (priceId === 'nin_regular') calculatedSlipType = 'REGULAR';
          else if (priceId === 'nin_info') calculatedSlipType = 'INFO';
          else calculatedSlipType = 'PREMIUM';
        }
        let serviceCode = '403';
        if (calculatedSlipType === 'PREMIUM' || priceId === 'nin_premium') serviceCode = '401';
        else if (calculatedSlipType === 'STANDARD' || priceId === 'nin_standard') serviceCode = '402';
        else if (calculatedSlipType === 'REGULAR' || priceId === 'nin_regular') serviceCode = '403';
        else if (calculatedSlipType === 'INFO' || priceId === 'nin_info') serviceCode = '404';

        if (calculatedSlipType === 'REGULAR') {
          endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
          bodyPayload = {
            nin: searchValue,
            service_code: '403',
            reference: requestData.reference || `REF-SLIP-${Date.now()}`
          };
        } else if (calculatedSlipType === 'STANDARD') {
          endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
          bodyPayload = {
            nin: searchValue,
            service_code: '402',
            reference: requestData.reference || `REF-SLIP-${Date.now()}`
          };
        } else if (calculatedSlipType === 'PREMIUM') {
          endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
          bodyPayload = {
            nin: searchValue,
            service_code: '401',
            reference: requestData.reference || `REF-SLIP-${Date.now()}`
          };
        } else {
          endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
          bodyPayload = {
            nin: searchValue,
            service_code: serviceCode,
            slip_type: calculatedSlipType,
            reference: requestData.reference || `REF-NIN-${Date.now()}`
          };
        }
        break;
      }

      // ── NIN Slip (PDF) ─────────────────────────────────────────────────────
      // service_code: 401 = Premium, 402 = Standard, 403 = Regular (NIMC layout), 404 = Info
      case 'nin-slip':
      case 'nin-slip-v2': {
        let serviceCode = service_code || requestData.service_code;
        if (!serviceCode) {
          if (priceId === 'nin_premium') serviceCode = '401';
          else if (priceId === 'nin_standard') serviceCode = '402';
          else if (priceId === 'nin_regular') serviceCode = '403';
          else if (priceId === 'nin_info') serviceCode = '404';
          else serviceCode = '403';
        }
        endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
        bodyPayload = {
          nin: searchValue,
          service_code: serviceCode,
          reference: requestData.reference || `REF-${Date.now()}`
        };
        break;
      }

      // ── NIN Validation Queue ───────────────────────────────────────────────
      case 'nin-validation':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-validation`;
        bodyPayload = {
          nin: searchValue,
          service_code: service_code || requestData.service_code || '329',
          reference: requestData.reference || `REF-VAL-${Date.now()}`
        };
        break;

      // ── Check NIN Validation Status ────────────────────────────────────────
      case 'nin-validation-status':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-validation/status?request_id=${encodeURIComponent(searchValue || requestData.request_id || '')}`;
        bodyPayload = null; // GET request
        break;

      // ── NIN Personalization (Tracking ID) ─────────────────────────────────
      case 'nin-personalization':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-personalization`;
        bodyPayload = {
          trackingId: searchValue || requestData.trackingId,
          reference: requestData.reference
        };
        break;

      // ── Check NIN Personalization Status ──────────────────────────────────
      case 'nin-personalization-status':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-personalization/status?request_id=${encodeURIComponent(searchValue || requestData.request_id || '')}`;
        bodyPayload = null; // GET request
        break;

      // ── NIN Modification ───────────────────────────────────────────────────
      case 'nin-modification':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-modification`;
        bodyPayload = {
          service_code: service_code || requestData.service_code || '501',
          nin: searchValue || requestData.nin,
          phone_number: requestData.phone_number,
          new_first_name: requestData.new_first_name,
          new_surname: requestData.new_surname,
          new_middle_name: requestData.new_middle_name,
          full_name: requestData.full_name,
          new_phone_number: requestData.new_phone_number,
          new_address: requestData.new_address
        };
        break;

      // ── VNIN Slip (PDF) ────────────────────────────────────────────────────
      case 'vnin-slip':
        endpoint = `${AGENTHUB_BASE}/v1/identity/vnin-slip`;
        bodyPayload = { nin: searchValue };
        break;

      // ── Phone → NIN Lookup ─────────────────────────────────────────────────
      case 'phone':
        endpoint = `${AGENTHUB_BASE}/v1/identity/phone-verify`;
        bodyPayload = { phone: searchValue };
        break;

      // ── Demographic Verification ───────────────────────────────────────────
      case 'demographic':
        endpoint = `${AGENTHUB_BASE}/v1/identity/demographic`;
        bodyPayload = { firstname, lastname, gender, dob };
        break;

      // ── BVN Verification ───────────────────────────────────────────────────
      case 'bvn':
        endpoint = `${AGENTHUB_BASE}/bvn/verification`;
        bodyPayload = { bvn: searchValue };
        break;

      // ── BVN by Phone / Retrieval ───────────────────────────────────────────
      case 'bvn-phone':
      case 'bvn-retrieval':
        endpoint = `${AGENTHUB_BASE}/bvn/retrieval`;
        bodyPayload = { phone: searchValue, reference: requestData.reference || `REF-RET-${Date.now()}` };
        break;

      // ── BVN Card / Premium Slip ───────────────────────────────────────────
      case 'bvn-card':
      case 'bvn-slip':
        endpoint = `${AGENTHUB_BASE}/bvn/premium-slip`;
        bodyPayload = { bvn: searchValue };
        break;

      // ── VNIN to NIBSS ──────────────────────────────────────────────────────
      case 'vnin-to-nibss':
        endpoint = `${AGENTHUB_BASE}/bvn/vnin-to-nibss`;
        bodyPayload = {
          reference: requestData.reference || `REF-VNIN-${Date.now()}`,
          ticket_id: requestData.ticket_id || `TICKET-${Date.now()}`,
          full_name: requestData.full_name || requestData.name || 'BVN Holder',
          nin: requestData.nin || searchValue,
          bvn: requestData.bvn || searchValue,
          vnin: searchValue || requestData.vnin
        };
        break;

      // ── Check VNIN to NIBSS Status ─────────────────────────────────────────
      case 'vnin-to-nibss-status':
        endpoint = `${AGENTHUB_BASE}/bvn/vnin-to-nibss/status?reference=${encodeURIComponent(searchValue || requestData.reference || '')}`;
        bodyPayload = null;
        break;

      // ── BVN Modification ───────────────────────────────────────────────────
      case 'bvn-modification':
        endpoint = `${AGENTHUB_BASE}/bvn/modification`;
        bodyPayload = {
          service_code: service_code || requestData.service_code || '620',
          bank_code: requestData.bank_code || '706',
          reference: requestData.reference || `REF-MOD-${Date.now()}`,
          nin: requestData.nin,
          bvn: searchValue || requestData.bvn,
          old_first_name: requestData.old_first_name,
          old_surname: requestData.old_surname,
          old_middle_name: requestData.old_middle_name,
          new_first_name: requestData.new_first_name || requestData.firstname,
          new_surname: requestData.new_surname || requestData.lastname,
          new_middle_name: requestData.new_middle_name,
          phone_number: requestData.phone_number || requestData.phone,
          dob: requestData.dob
        };
        break;

      // ── Check BVN Modification Status ───────────────────────────────────────
      case 'bvn-modification-status':
        endpoint = `${AGENTHUB_BASE}/bvn/modification/status?request_id=${encodeURIComponent(searchValue || requestData.request_id || requestData.reference || '')}`;
        bodyPayload = null;
        break;

      // ── BVN User Enrollment ─────────────────────────────────────────────────
      case 'bvn-enrollment':
        endpoint = `${AGENTHUB_BASE}/bvn/enrollment`;
        bodyPayload = {
          ...requestData,
          reference: requestData.reference || `BVN-ENROLL-${Date.now()}`
        };
        break;

      // ── Check BVN Enrollment Status ────────────────────────────────────────
      case 'bvn-enrollment-status':
        endpoint = `${AGENTHUB_BASE}/bvn/enrollment/status?request_id=${encodeURIComponent(searchValue || requestData.request_id || requestData.reference || '')}`;
        bodyPayload = null;
        break;

      // ── Check BVN Retrieval Status ─────────────────────────────────────────
      case 'bvn-retrieval-status':
        endpoint = `${AGENTHUB_BASE}/bvn/retrieval/status?request_id=${encodeURIComponent(searchValue || requestData.request_id || requestData.reference || '')}`;
        bodyPayload = null;
        break;

      // ── NIN Tracking / Personalization ─────────────────────────────────────
      case 'tracking-id':
      case 'nin-personalization':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-personalization`;
        bodyPayload = { trackingId: searchValue };
        break;

      // ── IPE Clearance ──────────────────────────────────────────────────────
      case 'ipe':
      case 'ipe-clearance':
        endpoint = `${AGENTHUB_BASE}/v1/identity/ipe-clearance`;
        bodyPayload = { trackingId: searchValue, reference: requestData.reference || `IPE-${Date.now()}` };
        break;

      // ── Identity Validation ────────────────────────────────────────────────
      case 'val':
      case 'nin-validation':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-validation`;
        bodyPayload = { nin: searchValue, service_code: service_code || '329', reference: requestData.reference || `VAL-${Date.now()}` };
        break;

      // ── Delink ─────────────────────────────────────────────────────────────
      case 'delink':
        endpoint = `${AGENTHUB_BASE}/identity/nin/slip-v2`;
        bodyPayload = { nin: searchValue, slip_type: 'REGULAR', reference: `REF-${Date.now()}` };
        break;

      default:
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Invalid verification type`);
        return jsonOk({ error: `Invalid verification type: ${searchType}` })
    }

    const candidateRequests: { url: string; body: any; method: string }[] = [];

    if (searchType === 'bvn' || searchType === 'bvn-premium-slip') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/premium-slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/verification`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/verification`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/verification`, body: { bvn: searchValue, reference: requestData.reference || `REF-BVN-${Date.now()}` }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/bvn`, body: { bvn: searchValue }, method: 'POST' });
    } else if (searchType === 'bvn-phone' || searchType === 'bvn-retrieval') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/retrieval`, body: { phone: searchValue, reference: requestData.reference || `REF-RET-${Date.now()}` }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/retrieval`, body: { phone: searchValue, reference: requestData.reference || `REF-RET-${Date.now()}` }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn/retrieval`, body: { phone: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/bvn/retrieval`, body: { phone: searchValue }, method: 'POST' });
    } else if (searchType === 'bvn-card' || searchType === 'bvn-slip') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/premium-slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/premium-slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn/slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/bvn/slip`, body: { bvn: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/bvn/premium-slip`, body: { bvn: searchValue }, method: 'POST' });
    } else if (searchType === 'vnin-to-nibss') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/vnin-to-nibss`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/vnin-to-nibss`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn/vnin-to-nibss`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/bvn/vnin-to-nibss`, body: bodyPayload, method: 'POST' });
    } else if (searchType === 'bvn-modification') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/modification`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/modification`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn/modification`, body: bodyPayload, method: 'POST' });
    } else if (searchType === 'bvn-enrollment') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/enrollment`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/bvn/enrollment`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn/enrollment`, body: bodyPayload, method: 'POST' });
    } else if (searchType === 'nin') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin/slip-v2`, body: { nin: searchValue, slip_type: 'REGULAR', reference: `REF-${Date.now()}` }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/slip`, body: { nin: searchValue, service_code: '403' }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/nin`, body: { nin: searchValue }, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin`, body: { nin: searchValue }, method: 'POST' });
    } else if (searchType === 'nin-slip' || searchType === 'nin-slip-v2') {
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin/slip-v2`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/slip`, body: bodyPayload, method: 'POST' });
      candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/slip`, body: bodyPayload, method: 'POST' });
    } else {
      candidateRequests.push({ url: endpoint, body: bodyPayload, method: bodyPayload !== null ? 'POST' : 'GET' });
    }

    try {
        let apiResponse: Response | null = null;
        let lastErrorText = '';
        let responseData: any = null;
        let successfulResponse: any = null;

        for (const reqItem of candidateRequests) {
            try {
                console.log(`Calling AgentHub API: ${reqItem.url} (Method: ${reqItem.method}) with payload:`, reqItem.body);

                const fetchOptions: RequestInit = {
                    method: reqItem.method,
                    headers: {
                        'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                };

                if (reqItem.body !== null && reqItem.method === 'POST') {
                    fetchOptions.body = JSON.stringify(reqItem.body);
                }

                apiResponse = await fetch(reqItem.url, fetchOptions);

                const rawText = await apiResponse.text();
                lastErrorText = rawText;

                try {
                    const parsed = JSON.parse(rawText);
                    if (parsed) {
                        responseData = parsed;
                        const isSuccess = parsed.status === true || 
                                          parsed.status === 'success' || 
                                          parsed.success === true ||
                                          parsed.current_status === 'COMPLETED' ||
                                          Boolean(parsed.data && (
                                              parsed.data.bvn || 
                                              parsed.data.firstName || 
                                              parsed.data.firstname || 
                                              parsed.data.nin || 
                                              parsed.data.pdf_base64 || 
                                              parsed.data.user_details || 
                                              parsed.data.data
                                          ));
                        if (isSuccess) {
                            successfulResponse = parsed;
                            break; // Success! Stop trying candidate fallbacks
                        }
                    }
                } catch (_) {
                    console.warn(`Non-JSON response from ${reqItem.url} (HTTP ${apiResponse.status}):`, rawText.substring(0, 200));
                }
            } catch (err: any) {
                console.warn(`Fetch failed for ${reqItem.url}:`, err.message);
            }
        }

        if (successfulResponse) {
            responseData = successfulResponse;
        }

        if (!responseData) {
            console.error(`AgentHub API returned unparsable response:`, lastErrorText.substring(0, 500));
            await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Provider unreachable`);
            let cleanText = lastErrorText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (cleanText.includes('404') || cleanText.includes('could not be found') || cleanText.includes('Page Not Found')) {
                cleanText = 'Record not found on identity verification provider.';
            } else {
                cleanText = cleanText.substring(0, 120);
            }
            return jsonOk({ error: cleanText || 'Service temporarily unavailable. Please try again later.' });
        }

        // ── Deeply unwrap and normalize AgentHub response ───────────────────────
        let innerData: any = {};
        if (responseData.data && typeof responseData.data === 'object') {
            innerData = { ...responseData.data };
            if (responseData.data.data && typeof responseData.data.data === 'object') {
                innerData = { ...innerData, ...responseData.data.data };
            }
            if (responseData.data.user_details) {
                if (typeof responseData.data.user_details === 'object') {
                    innerData = { ...innerData, ...responseData.data.user_details };
                    if (responseData.data.user_details.data && typeof responseData.data.user_details.data === 'object') {
                        innerData = { ...innerData, ...responseData.data.user_details.data };
                    }
                }
            }
        } else {
            innerData = { ...responseData };
        }

        const firstName = innerData.firstName || innerData.firstname || innerData.first_name || '';
        const lastName = innerData.lastName || innerData.surname || innerData.lastname || innerData.last_name || '';
        const middleName = innerData.middleName || innerData.middlename || innerData.middle_name || '';
        const bvn = innerData.bvn || innerData.number || searchValue || '';
        const phone = innerData.phoneNumber || innerData.phoneNumber1 || innerData.phone || innerData.phone_number || '';
        const dob = innerData.dateOfBirth || innerData.dob || innerData.birthdate || '';
        const gender = innerData.gender || '';
        const photo = innerData.image || innerData.base64Image || innerData.photo || innerData.face || '';
        const pdfBase64 = responseData.pdf_base64 || responseData.data?.pdf_base64 || innerData.pdf_base64 || responseData.slip || innerData.slip;

        innerData.firstName = firstName;
        innerData.first_name = firstName;
        innerData.lastName = lastName;
        innerData.last_name = lastName;
        innerData.surname = lastName;
        innerData.middleName = middleName;
        innerData.middle_name = middleName;
        innerData.bvn = bvn;
        innerData.phone = phone;
        innerData.phoneNumber = phone;
        innerData.phoneNumber1 = phone;
        innerData.dateOfBirth = dob;
        innerData.dob = dob;
        innerData.gender = gender;
        if (photo) {
            innerData.image = photo;
            innerData.base64Image = photo;
            innerData.photo = photo;
        }
        if (pdfBase64) {
            innerData.pdf_base64 = pdfBase64;
        }

        const isSuccess = responseData.status === true || 
                          responseData.status === 'success' || 
                          responseData.success === true ||
                          responseData.current_status === 'COMPLETED' ||
                          Boolean(firstName || lastName || (bvn && bvn.length >= 10) || pdfBase64);

        if (isSuccess) {
            return jsonOk({
                data: {
                    status: 'success',
                    message: responseData.message || 'Verification Successful',
                    data: innerData,
                    pdf_base64: pdfBase64
                }
            });
        }

        // ── AgentHub failure ───────────────────────────────────────────────────
        console.error('AgentHub API Error:', responseData);
        let agentHubMsg =
            responseData.error ||
            responseData.message ||
            'Verification failed. Record not found.';

        if (typeof agentHubMsg === 'string') {
            if (agentHubMsg.toLowerCase().includes('insufficient wallet balance') || agentHubMsg.toLowerCase().includes('insufficient funds')) {
                agentHubMsg = 'Provider API Wallet Insufficient Balance: Please top up your AgentHub developer account (https://agenthub.ng) to process identity verifications.';
            } else if (agentHubMsg.toLowerCase().includes('bvn not exists') || agentHubMsg.toLowerCase().includes('bvn not exist')) {
                agentHubMsg = 'The provided 11-digit BVN does not exist or is not registered in the central database.';
            } else if (agentHubMsg.toLowerCase().includes('nin not exists') || agentHubMsg.toLowerCase().includes('nin not exist')) {
                agentHubMsg = 'The provided 11-digit NIN does not exist or is not registered.';
            } else if (agentHubMsg.toLowerCase().includes('service currently unavailable') || agentHubMsg.toLowerCase().includes('service unavailable')) {
                agentHubMsg = 'Service is temporarily busy on the provider network. Please try again shortly.';
            }
        }

        // AgentHub already refunds on their side ("message": "Refunded")
        // But we still refund the user's wallet locally since we charged them upfront
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: ${agentHubMsg}`);
        return jsonOk({ error: agentHubMsg, details: responseData });

    } catch (apiError: any) {
        console.error('AgentHub Fetch Error:', apiError);
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Network error during verification`);
        return jsonOk({ error: 'Failed to reach verification provider. Please try again.' })
    }

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return jsonOk({ error: `An unexpected error occurred: ${error?.message || 'Unknown'}` })
  }
})

async function refundUser(supabaseAdmin: any, userId: string, amount: number, reason: string) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single()
      
    if (profile) {
        const currentBalance = parseFloat(profile.balance?.toString() || '0');
        const newBalance = currentBalance + amount;
        await supabaseAdmin
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', userId)
          
        await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            amount: amount,
            type: 'deposit',
            status: 'success',
            reference: `refund_${Date.now()}`,
            description: reason
        });
    }
}
