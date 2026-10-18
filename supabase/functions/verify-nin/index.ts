import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Official SKBTECH Base URL (replaces legacy AgentHub and IDPro)
const SKBTECH_BASE = 'https://skbtech.com.ng/api/v1';

// Always return HTTP 200 so client SDK can parse JSON payload
const jsonOk = (body: object) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let hasDeducted = false;
  let supabaseAdmin: any = null;
  let userId = '';
  let FEE_AMOUNT = 0;

  try {
    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();

    if (!jwt) {
      return jsonOk({ error: 'No auth token provided. Please log in and try again.' });
    }

    // Verify JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return jsonOk({ error: `Auth failed: ${authError?.message || 'Invalid token'}. Please log in again.` });
    }

    userId = user.id;

    const requestData = await req.json();
    const { type, value, firstname, lastname, dob, gender } = requestData;

    const searchType = String(requestData.searchType || type || '').trim();
    const searchValue = String(requestData.searchValue || value || '').trim();

    if (!searchType) {
      return jsonOk({ error: 'Missing search type' });
    }

    // ── Free Status Checks Detection ──────────────────────────────────────────
    const isStatusCheck =
      searchType === 'request-status' ||
      searchType === 'ipe-status' ||
      searchType === 'nin-personalization-status' ||
      searchType.endsWith('-status');

    let description = `Verification: ${searchType}`;
    let priceId = requestData.priceId || '';

    // ── Price Resolution & Wallet Deduction ──────────────────────────────────
    if (!isStatusCheck) {
      if (!priceId) {
        const defaultPriceMap: Record<string, string> = {
          'nin': 'nin_premium',
          'nin-standard': 'nin_standard',
          'nin-premium': 'nin_premium',
          'nin-regular': 'nin_regular',
          'nin-slip': 'nin_premium',
          'nin-slip-v2': 'nin_premium',
          'nin-validation': 'val_bypass_nin',
          'val': 'val_bypass_nin',
          'nin-personalization': 'pers_status',
          'pers_status': 'pers_status',
          'nin-modification': 'nin_mod_name',
          'nin_modification': 'nin_mod_name',
          'vnin-slip': 'nin_premium',
          'vnin': 'nin_premium',
          'vnin-to-nibss': 'nin_premium',
          'phone': 'nin_phone',
          'demographic': 'nin_demographic',
          'bvn': 'bvn_num_advanced',
          'bvn-card': 'bvn_card',
          'bvn-slip': 'bvn_premium_slip',
          'bvn-premium-slip': 'bvn_premium_slip',
          'bvn-retrieval': 'bvn_retrieval',
          'bvn-phone': 'bvn_retrieval',
          'bvn-central-risk': 'bvn_central_risk',
          'central-risk': 'bvn_central_risk',
          'bvn-modification': 'bvn_modification',
          'ipe': 'ipe_clearance',
          'ipe_clearance': 'ipe_clearance',
        };
        priceId = defaultPriceMap[searchType] || 'nin_premium';
      }

      // Fetch dynamic price from service_pricing table
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

      // Addon fee support
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

      // Atomic Balance Deduction
      if (FEE_AMOUNT > 0) {
        const { error: deductError } = await supabaseAdmin.rpc('deduct_balance', {
          user_id: user.id,
          amount: FEE_AMOUNT
        });

        if (deductError) {
          if (deductError.message.toLowerCase().includes('insufficient')) {
            return jsonOk({ error: `Insufficient wallet balance. You need ₦${FEE_AMOUNT.toLocaleString()}.` });
          }
          return jsonOk({ error: 'Failed to process wallet payment. Please try again.' });
        }

        hasDeducted = true;

        // Record payment transaction
        await supabaseAdmin.from('transactions').insert({
          user_id: user.id,
          amount: FEE_AMOUNT,
          type: 'payment',
          status: 'success',
          reference: `id_${searchType}_${Date.now()}`,
          description: description
        });
      }
    }

    // ── Retrieve SKBTECH API Key ─────────────────────────────────────────────
    let SKBTECH_API_KEY = Deno.env.get('SKBTECH_API_KEY');

    const { data: secrets } = await supabaseAdmin
      .from('system_secrets')
      .select('key, value');

    if (secrets && Array.isArray(secrets)) {
      // 1. Primary check: SKBTECH keys
      for (const s of secrets) {
        const k = String(s.key || '').toUpperCase();
        if (!SKBTECH_API_KEY && ['SKBTECH_API_KEY', 'SKB_API_KEY', 'SKBTECH_KEY', 'SKB_KEY'].includes(k)) {
          SKBTECH_API_KEY = s.value;
        }
      }
      // 2. Fallback check: If admin pasted it into AGENTHUB_API_KEY or IDPRO_API_KEY slot
      if (!SKBTECH_API_KEY) {
        for (const s of secrets) {
          const k = String(s.key || '').toUpperCase();
          if (['AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'IDPRO_API_KEY'].includes(k) && s.value) {
            SKBTECH_API_KEY = s.value;
            break;
          }
        }
      }
    }

    if (!SKBTECH_API_KEY) {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value');
      if (settings && Array.isArray(settings)) {
        for (const s of settings) {
          const k = String(s.key || '').toUpperCase();
          if (['SKBTECH_API_KEY', 'SKB_API_KEY', 'SKBTECH_KEY', 'SKB_KEY'].includes(k) && s.value) {
            let v = s.value;
            if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('"'))) {
              try {
                const parsed = JSON.parse(v);
                v = typeof parsed === 'string' ? parsed : (parsed.key || parsed.value || v);
              } catch (_) {}
            }
            SKBTECH_API_KEY = typeof v === 'string' ? v.trim() : String(v);
            break;
          }
        }
      }
    }

    if (!SKBTECH_API_KEY) {
      if (hasDeducted) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: SKBTECH API Key not configured');
        hasDeducted = false;
      }
      return jsonOk({ error: 'Identity verification provider key is not configured in Admin -> API Vault. Please add SKBTECH_API_KEY in Admin API settings.' });
    }

    // ── Map searchType to SKBTECH API Endpoint & Payload ─────────────────────
    let endpoint = '';
    let payload: Record<string, any> = { api_key: SKBTECH_API_KEY };

    const slipType = String(requestData.slip_type || requestData.layout || '').toUpperCase();

    switch (searchType) {
      // ── NIN Endpoints ──
      case 'nin':
      case 'nin-slip':
      case 'nin-slip-v2':
        if (slipType === 'STANDARD') {
          endpoint = '/nin/standard-slip';
        } else if (slipType === 'REGULAR') {
          endpoint = '/nin/regular-slip';
        } else if (slipType === 'BASIC') {
          endpoint = '/nin/basic-slip';
        } else if (slipType === 'BY_NIN' || slipType === 'DIRECT') {
          endpoint = '/nin/by-nin';
        } else {
          // Default to premium full details
          endpoint = '/nin/premium-slip';
        }
        payload.nin = searchValue;
        break;

      case 'phone':
      case 'nin-phone':
        endpoint = '/nin/by-phone';
        payload.phone = searchValue;
        if (requestData.variant) payload.variant = String(requestData.variant).toLowerCase();
        break;

      case 'demographic':
        endpoint = '/nin/by-demo';
        payload.firstname = (requestData.firstname || firstname || '').toUpperCase();
        payload.lastname = (requestData.lastname || lastname || '').toUpperCase();
        payload.dob = requestData.dob || dob;
        payload.gender = String(requestData.gender || gender || 'm').toLowerCase();
        if (requestData.variant) payload.variant = String(requestData.variant).toLowerCase();
        break;

      case 'nin-validation':
      case 'val':
        endpoint = '/nin/validation';
        payload.nin = requestData.nin || searchValue;
        break;

      case 'ipe':
      case 'ipe_clearance':
        endpoint = '/nin/ipe';
        payload.trackingID = requestData.trackingID || searchValue;
        break;

      case 'ipe-status':
        endpoint = '/nin/ipe-status';
        payload.trackingID = requestData.trackingID || searchValue;
        break;

      case 'nin-personalization':
      case 'pers_status':
      case 'tracking-id':
        endpoint = '/nin/personalization';
        payload.trackingID = requestData.trackingID || searchValue;
        payload.type = requestData.type || 'info';
        break;

      case 'nin-personalization-status':
        endpoint = '/nin/personalization-status';
        payload.trackingID = requestData.trackingID || searchValue;
        break;

      case 'nin-modification':
      case 'nin_modification':
        endpoint = '/nin/modification';
        payload.nin = requestData.nin || searchValue;
        payload.modification_type = requestData.modification_type || 'change_of_name';
        if (requestData.new_first_name) payload.new_first_name = requestData.new_first_name;
        if (requestData.new_surname) payload.new_surname = requestData.new_surname;
        if (requestData.new_middle_name) payload.new_middle_name = requestData.new_middle_name;
        if (requestData.current_dob) payload.current_dob = requestData.current_dob;
        if (requestData.new_dob) payload.new_dob = requestData.new_dob;
        if (requestData.npc_certificate_number) payload.npc_certificate_number = requestData.npc_certificate_number;
        if (requestData.npc_certificate) payload.npc_certificate = requestData.npc_certificate;
        if (requestData.address_line_1) payload.address_line_1 = requestData.address_line_1;
        if (requestData.town_city) payload.town_city = requestData.town_city;
        if (requestData.state) payload.state = requestData.state;
        if (requestData.address_line_2) payload.address_line_2 = requestData.address_line_2;
        if (requestData.postal_code) payload.postal_code = requestData.postal_code;
        if (requestData.new_phone) payload.new_phone = requestData.new_phone;
        break;

      // ── BVN Endpoints ──
      case 'bvn':
      case 'bvn-card':
      case 'bvn-standard':
        endpoint = '/bvn/standard-slip';
        payload.bvn = requestData.bvn || searchValue;
        break;

      case 'bvn-slip':
      case 'bvn-premium-slip':
        endpoint = '/bvn/premium-slip';
        payload.bvn = requestData.bvn || searchValue;
        break;

      case 'bvn-retrieval':
      case 'bvn-phone':
        endpoint = '/bvn/retrieve-by-phone';
        payload.phone = requestData.phone || requestData.phone_number || searchValue;
        let fn = (requestData.first_name || requestData.firstname || '').trim();
        let ln = (requestData.last_name || requestData.lastname || requestData.surname || '').trim();
        let mn = (requestData.middle_name || requestData.middlename || '').trim();
        if (!fn && (requestData.full_name || requestData.name)) {
          const parts = String(requestData.full_name || requestData.name).trim().split(/\s+/);
          fn = parts[0] || '';
          ln = parts.length > 1 ? parts[parts.length - 1] : '';
          mn = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
        }
        payload.first_name = fn.toUpperCase();
        payload.last_name = ln.toUpperCase();
        if (mn) payload.middle_name = mn.toUpperCase();
        break;

      case 'bvn-central-risk':
      case 'central-risk':
        endpoint = '/bvn/central-risk';
        payload.ticket_id = requestData.ticket_id || searchValue;
        if (requestData.batch_id) payload.batch_id = requestData.batch_id;
        if (requestData.screenshot) payload.screenshot = requestData.screenshot;
        break;

      case 'bvn-modification':
        endpoint = '/bvn/modification';
        payload.bvn = requestData.bvn || searchValue;
        payload.nin = requestData.nin;
        payload.enrollment_type = requestData.enrollment_type || 'NIBSS';
        payload.modification_type = requestData.modification_type || 'change_of_name';
        if (requestData.new_first_name) payload.new_first_name = requestData.new_first_name;
        if (requestData.new_surname) payload.new_surname = requestData.new_surname;
        if (requestData.new_middle_name) payload.new_middle_name = requestData.new_middle_name;
        if (requestData.new_dob) payload.new_dob = requestData.new_dob;
        if (requestData.address_line_1) payload.address_line_1 = requestData.address_line_1;
        if (requestData.town_city) payload.town_city = requestData.town_city;
        if (requestData.state) payload.state = requestData.state;
        if (requestData.address_line_2) payload.address_line_2 = requestData.address_line_2;
        if (requestData.postal_code) payload.postal_code = requestData.postal_code;
        if (requestData.new_phone) payload.new_phone = requestData.new_phone;
        if (requestData.affidavit) payload.affidavit = requestData.affidavit;
        break;

      // ── VNIN Endpoints ──
      case 'vnin-slip':
      case 'vnin':
      case 'vnin-to-nibss':
        endpoint = '/vnin/premium-slip';
        payload.vnin = requestData.vnin || searchValue;
        break;

      // ── Status Poll Endpoint (Free) ──
      case 'request-status':
      case 'bvn-retrieval-status':
      case 'bvn-modification-status':
      case 'vnin-to-nibss-status':
        endpoint = '/request/status';
        payload.reference = requestData.reference || requestData.request_id || searchValue;
        break;

      // ── SMS Endpoint ──
      case 'sms':
        endpoint = '/sms/send';
        payload.phone_numbers = requestData.phone_numbers || [searchValue];
        payload.text = requestData.text || '';
        break;

      default:
        endpoint = '/nin/premium-slip';
        payload.nin = searchValue;
        break;
    }

    // ── Execute SKBTECH POST Request ──────────────────────────────────────────
    const targetUrl = `${SKBTECH_BASE}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    let skbRes: Response;
    try {
      skbRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (netErr: any) {
      clearTimeout(timeoutId);
      if (hasDeducted) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: Network timeout contacting provider');
        hasDeducted = false;
      }
      return jsonOk({ error: `Connection to identity provider failed: ${netErr.message || 'Timeout'}. Please try again.` });
    }

    const rawResponseText = await skbRes.text();
    let skbData: any = null;

    try {
      skbData = JSON.parse(rawResponseText);
    } catch (_) {
      if (hasDeducted) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, 'Refund: Provider invalid response');
        hasDeducted = false;
      }
      return jsonOk({ error: 'Identity provider returned an unreadable response. Your wallet has been refunded.' });
    }

    // ── Handle Provider Error or Failure ─────────────────────────────────────
    if (!skbRes.ok || skbData.success === false) {
      const errMsg = skbData.message || skbData.error || 'The verification could not be completed at this time.';

      // Check for common error cases to give human-friendly messages
      let friendlyError = errMsg;
      const lower = errMsg.toLowerCase();
      if (lower.includes('insufficient balance') || lower.includes('insufficient wallet')) {
        friendlyError = 'Provider gateway balance is low. Please notify administrator.';
      } else if (lower.includes('record not found') || lower.includes('not found') || lower.includes('no record') || lower.includes('does not exist')) {
        friendlyError = 'The provided record could not be found in the identity database. Please verify the details.';
      } else if (lower.includes('invalid api key')) {
        friendlyError = 'Invalid API credentials. Please verify your SKBTECH API Key in Admin Settings.';
      }

      if (hasDeducted) {
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: ${errMsg}`);
        hasDeducted = false;
      }

      return jsonOk({ error: friendlyError, raw: skbData });
    }

    // ── Handle Successful Async / Manual Requests ────────────────────────────
    if (skbData.request_status === 'pending' || skbData.request_status === 'processing') {
      return jsonOk({
        data: {
          status: skbData.request_status,
          request_status: skbData.request_status,
          reference: skbData.reference || skbData.transaction_id,
          transaction_id: skbData.transaction_id,
          service: skbData.service || skbData.type,
          price: skbData.price,
          message: skbData.message || 'Request submitted and queued for processing by the SKBTECH team.',
          data: skbData,
        }
      });
    }

    // ── Handle /request/status Response ──────────────────────────────────────
    if (endpoint === '/request/status') {
      let extractedBvn: string | null = null;
      if (skbData.response && typeof skbData.response === 'string') {
        const match = skbData.response.match(/\b\d{11}\b/);
        if (match) extractedBvn = match[0];
      }

      return jsonOk({
        data: {
          status: skbData.request_status,
          request_status: skbData.request_status,
          reference: skbData.reference,
          service: skbData.service,
          type: skbData.type,
          refunded: skbData.refunded,
          amount: skbData.amount,
          response: skbData.response,
          bvn: extractedBvn,
          attachments: skbData.attachments || [],
          submitted_at: skbData.submitted_at,
          updated_at: skbData.updated_at,
          message: skbData.response || `Status: ${skbData.request_status}`,
        }
      });
    }

    // ── Normalize Instant Identity Record Responses ──────────────────────────
    let rawPerson: any = {};

    if (Array.isArray(skbData.user_data)) {
      if (skbData.user_data.length > 0 && typeof skbData.user_data[0] === 'object') {
        rawPerson = { ...skbData.user_data[0] };
      } else {
        rawPerson = { user_data: skbData.user_data };
      }
    } else if (skbData.user_data && typeof skbData.user_data === 'object') {
      rawPerson = { ...skbData.user_data };
    } else if (skbData.data && typeof skbData.data === 'object') {
      rawPerson = { ...skbData.data };
    } else {
      rawPerson = { ...skbData };
    }

    const firstName = rawPerson.firstname || rawPerson.firstName || rawPerson.first_name || '';
    const lastName = rawPerson.surname || rawPerson.lastname || rawPerson.lastName || rawPerson.last_name || '';
    const middleName = rawPerson.middlename || rawPerson.middleName || rawPerson.middle_name || '';
    const ninNum = rawPerson.nin || rawPerson.number || (searchType.includes('nin') ? searchValue : '');
    const bvnNum = rawPerson.bvn || (searchType.includes('bvn') ? searchValue : '');
    const phoneNum = rawPerson.phone || rawPerson.phoneNumber || rawPerson.telephoneno || rawPerson.phone_number || '';
    const dobVal = rawPerson.dob || rawPerson.dateOfBirth || rawPerson.birthdate || '';
    const genderVal = rawPerson.gender || rawPerson.sex || '';
    const photoVal = rawPerson.photo || rawPerson.image || rawPerson.base64Image || rawPerson.picture || rawPerson.face || '';
    const pdfBase64Val = skbData.pdf_base64 || rawPerson.pdf_base64 || skbData.slip || rawPerson.slip || '';
    const trackingIdVal = rawPerson.tracking_id || rawPerson.trackingId || rawPerson.ref || '';
    const stateVal = rawPerson.residence_state || rawPerson.state || rawPerson.residenceState || '';
    const lgaVal = rawPerson.residence_lga || rawPerson.lga || rawPerson.residenceLga || '';
    const bStateVal = rawPerson.birthstate || rawPerson.birthState || '';
    const bLgaVal = rawPerson.birthlga || rawPerson.birthLga || '';
    const addressVal = rawPerson.residence_address || rawPerson.address || '';

    const normalized: any = {
      ...rawPerson,
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
      residence_state: stateVal,
      state: stateVal,
      residence_lga: lgaVal,
      lga: lgaVal,
      birthstate: bStateVal,
      birthlga: bLgaVal,
      residence_address: addressVal,
      address: addressVal,
      pdf_base64: pdfBase64Val,
      transaction_id: skbData.transaction_id || `TXN-${Date.now()}`,
    };

    return jsonOk({
      data: {
        status: 'success',
        message: skbData.message || 'Verification Successful',
        data: normalized,
        pdf_base64: pdfBase64Val,
        transaction_id: skbData.transaction_id,
      }
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
});

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
