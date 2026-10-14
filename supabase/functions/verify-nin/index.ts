import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Provider Base URLs
const AGENTHUB_BASE = 'https://agenthub.ng/api';
const IDPRO_BASE = 'https://idpro.ng/api/v1';

// Always return HTTP 200 so Supabase Client SDK can read the actual JSON body
const jsonOk = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Track if user was deducted in this invocation to prevent phantom refunds
  let hasDeducted = false;
  let supabaseAdmin: any = null;
  let userId = '';
  let FEE_AMOUNT = 0;

  try {
    supabaseAdmin = createClient(
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

    // Verify the JWT using admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)

    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message)
      return jsonOk({ error: `Auth failed: ${authError?.message || 'Invalid token'}. Please log out and log in again.` })
    }

    userId = user.id;

    const requestData = await req.json()
    const { type, value, firstname, lastname, dob, gender, service_code } = requestData

    const searchType = requestData.searchType || type
    const searchValue = requestData.searchValue || value

    if (!searchType) {
      return jsonOk({ error: 'Missing search type' })
    }

    // ── Handle Admin Live Pricing Sync ───────────────────────────────────────
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
        const agentHubRes = await fetch(`${AGENTHUB_BASE}/v1/identity/pricing`, {
          headers: { 
            'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
            'Accept': 'application/json'
          }
        });

        const rawText = await agentHubRes.text();
        let agentData: any = null;

        try {
          agentData = JSON.parse(rawText);
        } catch (_) {
          return jsonOk({ 
            success: true, 
            message: 'Default wholesale pricing active in registry.',
            isDefault: true 
          });
        }

        return jsonOk({ success: true, message: 'Pricing synced!', data: agentData });
      } catch (err: any) {
        return jsonOk({ error: `Pricing fetch failed: ${err.message}` });
      }
    }

    const isStatusCheck = String(searchType).endsWith('-status');
    let description = `Verification Status Check`;
    let priceId = requestData.priceId || '';

    if (!isStatusCheck) {
      if (!priceId) {
        // Fallback map searchType -> default priceId
        const defaultPriceMap: Record<string, string> = {
          'nin': 'nin_standard',
          'nin-standard': 'nin_standard',
          'nin-premium': 'nin_premium',
          'nin-regular': 'nin_regular',
          'nin-slip': 'nin_regular',
          'nin-slip-v2': 'nin_premium',
          'nin-validation': 'val_bypass_nin',
          'nin-personalization': 'pers_status',
          'pers_status': 'pers_status',
          'nin-modification': 'nin_mod_name',
          'vnin-slip': 'nin_standard',
          'phone': 'nin_phone',
          'demographic': 'nin_standard',
          'bvn': 'bvn_num_advanced',
          'bvn-phone': 'bvn_phone_basic',
          'bvn-card': 'bvn_card',
          'bvn-slip': 'bvn_premium_slip',
          'bvn-premium-slip': 'bvn_premium_slip',
          'bvn-retrieval': 'bvn_phone_basic',
          'vnin-to-nibss': 'vnin_to_nibss',
          'bvn-modification': 'bvn_modification',
          'bvn-enrollment': 'bvn_enrollment',
          'ipe': 'ipe_clearance',
          'ipe_clearance': 'ipe_clearance',
          'val': 'nin_validation'
        };
        priceId = defaultPriceMap[searchType] || 'nin_standard';
      }

      // Fetch dynamic pricing from service_pricing table
      const { data: pricing } = await supabaseAdmin
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
        FEE_AMOUNT = 190;
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

      // Single Atomic Balance Deduction via RPC
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
          return jsonOk({ error: 'Failed to process wallet payment. Please try again.' });
        }

        hasDeducted = true;

        // Record single payment transaction
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

    // ── Retrieve API Keys for AgentHub and IDPro ───────────────────────────────
    let AGENTHUB_API_KEY = Deno.env.get('AGENTHUB_API_KEY');
    let IDPRO_API_KEY = Deno.env.get('IDPRO_API_KEY');

    const { data: secrets } = await supabaseAdmin
      .from('system_secrets')
      .select('key, value');

    if (secrets && Array.isArray(secrets)) {
      for (const s of secrets) {
        const k = String(s.key || '').toUpperCase();
        if (!AGENTHUB_API_KEY && ['AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'AGENTS_HUB_KEY', 'AH_API_KEY'].includes(k)) {
          AGENTHUB_API_KEY = s.value;
        }
        if (!IDPRO_API_KEY && ['IDPRO_API_KEY', 'IDPRO_KEY', 'ID_PRO_KEY'].includes(k)) {
          IDPRO_API_KEY = s.value;
        }
      }
    }

    if (!AGENTHUB_API_KEY && !IDPRO_API_KEY) {
      if (hasDeducted) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: Verification provider keys not configured');
        hasDeducted = false;
      }
      return jsonOk({ error: 'Verification service is not configured. Please contact support.' });
    }

    // ── Build Candidate Request List for AgentHub ────────────────────────────
    let endpoint = '';
    let bodyPayload: any = {};
    const candidateRequests: { url: string; body: any; method: 'GET' | 'POST' }[] = [];

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

    switch (searchType) {
      case 'nin':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/nin`, body: { nin: searchValue }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin/slip-v2`, body: { nin: searchValue, slip_type: calculatedSlipType, reference: `REF-${Date.now()}` }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/slip`, body: { nin: searchValue, service_code: serviceCode }, method: 'POST' });
        break;

      case 'nin-slip':
      case 'nin-slip-v2':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin/slip-v2`, body: { nin: searchValue, slip_type: calculatedSlipType, reference: `REF-${Date.now()}` }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/slip`, body: { nin: searchValue, service_code: serviceCode, reference: `REF-${Date.now()}` }, method: 'POST' });
        break;

      case 'phone':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/identity/nin/slip-v2-phone`, body: { nin: searchValue, slip_type: 'STANDARD', reference: `REF-${Date.now()}` }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/phone-verify`, body: { phone: searchValue }, method: 'POST' });
        break;

      case 'demographic':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/demographic`, body: { firstname, lastname, gender, dob }, method: 'POST' });
        break;

      case 'bvn':
      case 'bvn-card':
      case 'bvn-slip':
      case 'bvn-premium-slip':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/premium-slip`, body: { bvn: searchValue }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/api/bvn/verification`, body: { bvn: searchValue }, method: 'POST' });
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/bvn`, body: { bvn: searchValue }, method: 'POST' });
        break;

      case 'bvn-phone':
      case 'bvn-retrieval':
        candidateRequests.push({ url: `${AGENTHUB_BASE}/bvn/retrieval`, body: { phone: searchValue, reference: requestData.reference || `REF-RET-${Date.now()}` }, method: 'POST' });
        break;

      default:
        candidateRequests.push({ url: `${AGENTHUB_BASE}/v1/identity/nin`, body: { nin: searchValue }, method: 'POST' });
        break;
    }

    let successfulResponse: any = null;

    // ── PROVIDER 1: Try AgentHub ─────────────────────────────────────────────
    if (AGENTHUB_API_KEY && candidateRequests.length > 0) {
      for (const reqItem of candidateRequests) {
        try {
          const fetchOptions: RequestInit = {
            method: reqItem.method,
            headers: {
              'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
          };

          if (reqItem.body !== null && reqItem.method === 'POST') {
            fetchOptions.body = JSON.stringify(reqItem.body);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          fetchOptions.signal = controller.signal;

          const apiResponse = await fetch(reqItem.url, fetchOptions);
          clearTimeout(timeoutId);

          if (apiResponse.ok) {
            const rawText = await apiResponse.text();
            try {
              const parsed = JSON.parse(rawText);
              if (parsed) {
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
                  break;
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
    }

    // ── PROVIDER 2: Failover to IDPro if AgentHub did not succeed ────────────
    if (!successfulResponse && IDPRO_API_KEY) {
      console.log(`AgentHub did not succeed. Triggering IDPro failover for searchType: ${searchType}`);
      let idproEndpoint = `${IDPRO_BASE}/nin`;
      let idproPayload: any = { number: searchValue };

      switch (searchType) {
        case 'nin':
        case 'nin-slip':
        case 'nin-slip-v2':
          idproEndpoint = `${IDPRO_BASE}/nin`;
          idproPayload = { number: searchValue };
          break;
        case 'phone':
          idproEndpoint = `${IDPRO_BASE}/phone`;
          idproPayload = { number: searchValue };
          break;
        case 'demographic':
          idproEndpoint = `${IDPRO_BASE}/demo`;
          idproPayload = { firstname, lastname, gender, dob };
          break;
        case 'bvn':
        case 'bvn-slip':
        case 'bvn-premium-slip':
          idproEndpoint = `${IDPRO_BASE}/bvn`;
          idproPayload = { number: searchValue };
          break;
        case 'bvn-card':
          idproEndpoint = `${IDPRO_BASE}/bvncard`;
          idproPayload = { number: searchValue };
          break;
        case 'bvn-phone':
        case 'bvn-retrieval':
          idproEndpoint = `${IDPRO_BASE}/bvn-phone`;
          idproPayload = { number: searchValue };
          break;
        case 'tracking-id':
        case 'pers_status':
        case 'nin-personalization':
          idproEndpoint = `${IDPRO_BASE}/tracking-id`;
          idproPayload = { number: searchValue };
          break;
        case 'ipe':
          idproEndpoint = `${IDPRO_BASE}/ipe`;
          idproPayload = { number: searchValue };
          break;
        case 'val':
        case 'nin-validation':
          idproEndpoint = `${IDPRO_BASE}/val`;
          idproPayload = { number: searchValue };
          break;
        case 'delink':
          idproEndpoint = `${IDPRO_BASE}/delink`;
          idproPayload = { number: searchValue };
          break;
      }

      try {
        const idproController = new AbortController();
        const idproTimeout = setTimeout(() => idproController.abort(), 12000);

        const idproRes = await fetch(idproEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${IDPRO_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(idproPayload),
          signal: idproController.signal
        });
        clearTimeout(idproTimeout);

        const idproRawText = await idproRes.text();
        try {
          const parsedIdpro = JSON.parse(idproRawText);
          if (parsedIdpro) {
            const statusStr = String(parsedIdpro.status || '').toLowerCase();
            const isIdproSuccess = (idproRes.ok && (statusStr === 'success' || statusStr === 'true' || parsedIdpro.status === true)) ||
                                   Boolean(parsedIdpro.data && (parsedIdpro.data.firstname || parsedIdpro.data.surname || parsedIdpro.data.nin)) ||
                                   Boolean(parsedIdpro.firstname || parsedIdpro.surname || parsedIdpro.nin);

            if (isIdproSuccess) {
              successfulResponse = parsedIdpro;
            } else if (parsedIdpro.message && (
              parsedIdpro.message.toLowerCase().includes('not found') || 
              parsedIdpro.message.toLowerCase().includes('no record') || 
              parsedIdpro.message.toLowerCase().includes('does not exist')
            )) {
              if (hasDeducted) {
                await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: Record not found');
                hasDeducted = false;
              }
              return jsonOk({ error: 'The provided NIN does not exist or has no record in the central database.' });
            }
          }
        } catch (_) {}
      } catch (idproErr: any) {
        console.warn('IDPro failover error:', idproErr.message);
      }
    }

    // ── Handle Successful Verification ───────────────────────────────────────
    if (successfulResponse) {
      let personData: any = {};
      if (successfulResponse.data && typeof successfulResponse.data === 'object') {
        personData = { ...successfulResponse.data };
        if (successfulResponse.data.data && typeof successfulResponse.data.data === 'object') {
          personData = { ...personData, ...successfulResponse.data.data };
        }
        if (successfulResponse.data.user_details && typeof successfulResponse.data.user_details === 'object') {
          personData = { ...personData, ...successfulResponse.data.user_details };
        }
      } else {
        personData = { ...successfulResponse };
      }

      // Universal field normalizer for all slip components
      const firstName = personData.firstName || personData.firstname || personData.first_name || '';
      const lastName = personData.lastName || personData.surname || personData.lastname || personData.last_name || '';
      const middleName = personData.middleName || personData.middlename || personData.middle_name || '';
      const ninNum = personData.nin || personData.number || searchValue || '';
      const bvnNum = personData.bvn || '';
      const phoneNum = personData.phoneNumber || personData.phoneNumber1 || personData.phone || personData.telephoneno || '';
      const dobVal = personData.dateOfBirth || personData.dob || personData.birthdate || '';
      const genderVal = personData.gender || personData.sex || '';
      const photoVal = personData.image || personData.base64Image || personData.photo || personData.picture || personData.face || '';
      const pdfBase64Val = successfulResponse.pdf_base64 || successfulResponse.data?.pdf_base64 || personData.pdf_base64 || successfulResponse.slip || personData.slip || '';
      const trackingIdVal = personData.tracking_id || personData.trackingId || personData.ref || '';
      const resState = personData.residence_state || personData.residenceState || personData.state || '';
      const resLga = personData.residence_lga || personData.residenceLga || personData.lga || '';
      const bState = personData.birthstate || personData.birthState || '';
      const bLga = personData.birthlga || personData.birthLga || '';
      const resAddress = personData.residence_address || personData.address || '';

      const normalized: any = {
        ...personData,
        firstname: firstName,
        first_name: firstName,
        firstName: firstName,
        surname: lastName,
        lastname: lastName,
        last_name: lastName,
        lastName: lastName,
        middlename: middleName,
        middle_name: middleName,
        middleName: middleName,
        nin: ninNum,
        number: ninNum,
        bvn: bvnNum,
        phone: phoneNum,
        phoneNumber: phoneNum,
        telephoneno: phoneNum,
        dob: dobVal,
        birthdate: dobVal,
        dateOfBirth: dobVal,
        gender: genderVal,
        sex: genderVal,
        photo: photoVal,
        image: photoVal,
        base64Image: photoVal,
        picture: photoVal,
        tracking_id: trackingIdVal,
        trackingId: trackingIdVal,
        residence_state: resState,
        residenceState: resState,
        state: resState,
        residence_lga: resLga,
        residenceLga: resLga,
        lga: resLga,
        birthstate: bState,
        birthState: bState,
        birthlga: bLga,
        birthLga: bLga,
        residence_address: resAddress,
        address: resAddress,
        pdf_base64: pdfBase64Val
      };

      return jsonOk({
        data: {
          status: 'success',
          message: successfulResponse.message || 'Verification Successful',
          data: normalized,
          pdf_base64: pdfBase64Val
        }
      });
    }

    // ── Fallback Failure: Refund cleanly if deducted ─────────────────────────
    if (hasDeducted) {
      await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: Verification could not be completed');
      hasDeducted = false;
    }

    return jsonOk({ 
      error: 'The NIN could not be verified on the national identity database. Please verify the number and try again.' 
    });

  } catch (error: any) {
    console.error('Unexpected error in verify-nin:', error);
    if (hasDeducted && supabaseAdmin && userId && FEE_AMOUNT > 0) {
      try {
        await refundUser(supabaseAdmin, userId, FEE_AMOUNT, 'Refund: System error during verification');
      } catch (_) {}
    }
    return jsonOk({ error: error?.message || 'An unexpected error occurred during verification.' });
  }
})

async function refundUser(supabaseAdmin: any, userId: string, amount: number, reason: string) {
  if (!amount || amount <= 0) return;
  try {
    const { error: rpcError } = await supabaseAdmin.rpc('refund_balance', {
      user_id: userId,
      amount: amount
    });

    if (rpcError) {
      console.warn('refund_balance RPC failed, updating profile directly:', rpcError.message);
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        const currentBalance = parseFloat(profile.balance?.toString() || '0');
        const newBalance = currentBalance + amount;
        await supabaseAdmin
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', userId);
      }
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: amount,
      type: 'refund',
      status: 'success',
      reference: `refund_${Date.now()}`,
      description: reason
    });
  } catch (err: any) {
    console.error('Failed to execute refund:', err.message);
  }
}
