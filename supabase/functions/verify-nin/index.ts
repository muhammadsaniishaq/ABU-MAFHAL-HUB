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

    if (!isStatusCheck) {
      let priceId = requestData.priceId;
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
        endpoint = `${AGENTHUB_BASE}/identity/nin/slip-v2`;
        bodyPayload = {
          nin: searchValue,
          slip_type: calculatedSlipType,
          reference: requestData.reference || `REF-NIN-${Date.now()}`
        };
        break;
      }

      // ── NIN Slip (PDF) ─────────────────────────────────────────────────────
      // service_code: 401 = Premium, 402 = Standard, 403 = Regular (NIMC layout)
      case 'nin-slip':
        endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
        bodyPayload = {
          nin: searchValue,
          service_code: service_code || requestData.service_code || '403',
        };
        break;

      // ── NIN Slip V2 (PDF) ──────────────────────────────────────────────────
      case 'nin-slip-v2': {
        let calculatedSlipTypeV2 = (requestData.slip_type || requestData.layout || '').toUpperCase();
        if (!calculatedSlipTypeV2) {
          if (priceId === 'nin_standard') calculatedSlipTypeV2 = 'STANDARD';
          else if (priceId === 'nin_regular') calculatedSlipTypeV2 = 'REGULAR';
          else if (priceId === 'nin_info') calculatedSlipTypeV2 = 'INFO';
          else calculatedSlipTypeV2 = 'PREMIUM';
        }
        endpoint = `${AGENTHUB_BASE}/identity/nin/slip-v2`;
        bodyPayload = {
          nin: searchValue,
          slip_type: calculatedSlipTypeV2,
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
        endpoint = `${AGENTHUB_BASE}/v1/identity/bvn`;
        bodyPayload = { bvn: searchValue };
        break;

      // ── BVN by Phone ───────────────────────────────────────────────────────
      case 'bvn-phone':
        endpoint = `${AGENTHUB_BASE}/v1/identity/bvn-phone`;
        bodyPayload = { phone: searchValue };
        break;

      // ── BVN Card ───────────────────────────────────────────────────────────
      case 'bvn-card':
        endpoint = `${AGENTHUB_BASE}/v1/identity/bvn-card`;
        bodyPayload = { bvn: searchValue };
        break;

      // ── VNIN to NIBSS ──────────────────────────────────────────────────────
      case 'vnin-to-nibss':
        endpoint = `${AGENTHUB_BASE}/v1/identity/vnin-to-nibss`;
        bodyPayload = {
          vnin: searchValue || requestData.vnin,
          bvn: requestData.bvn,
          reference: requestData.reference || `VNIN-NIBSS-${Date.now()}`
        };
        break;

      // ── BVN Modification ───────────────────────────────────────────────────
      case 'bvn-modification':
        endpoint = `${AGENTHUB_BASE}/v1/identity/bvn-modification`;
        bodyPayload = {
          bvn: searchValue || requestData.bvn,
          service_code: service_code || requestData.service_code || '601',
          phone_number: requestData.phone_number || requestData.phone,
          firstname: requestData.firstname,
          lastname: requestData.lastname,
          dob: requestData.dob,
          reference: requestData.reference || `BVN-MOD-${Date.now()}`
        };
        break;

      // ── NIN Tracking / Personalization ─────────────────────────────────────
      case 'tracking-id':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-personalization`;
        bodyPayload = { trackingId: searchValue };
        break;

      // ── IPE Clearance ──────────────────────────────────────────────────────
      // AgentHub does not have a separate IPE endpoint; use NIN verification
      case 'ipe':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
        break;

      // ── Identity Validation ────────────────────────────────────────────────
      case 'val':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin-validation`;
        bodyPayload = { nin: searchValue, service_code: service_code || '329' };
        break;

      // ── Delink (no direct AgentHub equivalent, use NIN) ────────────────────
      case 'delink':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
        break;

      default:
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Invalid verification type`);
        return jsonOk({ error: `Invalid verification type: ${searchType}` })
    }

    try {
        console.log(`Calling AgentHub API: ${endpoint} (Method: ${bodyPayload ? 'POST' : 'GET'}) with payload:`, bodyPayload);

        const fetchOptions: RequestInit = {
            method: bodyPayload !== null ? 'POST' : 'GET',
            headers: {
                'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        if (bodyPayload !== null) {
            fetchOptions.body = JSON.stringify(bodyPayload);
        }

        const apiResponse = await fetch(endpoint, fetchOptions);

        const rawText = await apiResponse.text();
        let responseData: any = null;
        try {
            responseData = JSON.parse(rawText);
        } catch (_) {
            console.error(`AgentHub API returned non-JSON (HTTP ${apiResponse.status}):`, rawText.substring(0, 500));
            await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Provider HTTP ${apiResponse.status}`);
            const cleanText = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 120);
            return jsonOk({ error: `Verification provider error (HTTP ${apiResponse.status}): ${cleanText || 'Unexpected response format. Please try again.'}` });
        }

        // ── AgentHub response format ───────────────────────────────────────────
        // Success: { status: true,  message: "...", data: {...} }
        // Slip:    { status: true,  message: "Slip Generated Successfully", pdf_base64: "..." }
        // Failure: { status: false, error:   "...", message: "Refunded" }
        //
        // Note: AgentHub uses boolean status (not string like IDPro)

        if (responseData.status === true) {
            const innerData = responseData.data ?? responseData;
            const pdfBase64 = responseData.pdf_base64 || innerData?.pdf_base64 || responseData.data?.pdf_base64;

            if (pdfBase64 && typeof innerData === 'object') {
                innerData.pdf_base64 = pdfBase64;
            }

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
        const agentHubMsg =
            responseData.error ||
            responseData.message ||
            'Verification failed. Record not found.';

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
