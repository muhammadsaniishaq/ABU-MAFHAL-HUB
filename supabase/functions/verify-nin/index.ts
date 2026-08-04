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

    const priceId = requestData.priceId;
    if (!priceId) {
      return jsonOk({ error: 'Missing priceId for verification service.' })
    }

    const addonPriceId = requestData.addonPriceId;

    // Fetch dynamic pricing for base price
    const { data: pricing, error: pricingError } = await supabaseAdmin
      .from('service_pricing')
      .select('markup_price, name')
      .eq('id', priceId)
      .single()

    if (pricingError || !pricing) {
      console.error('Pricing lookup error:', pricingError?.message)
      return jsonOk({ error: 'Failed to retrieve pricing for this service.' })
    }

    let FEE_AMOUNT = parseFloat(pricing.markup_price?.toString() || '0');
    let description = `Verification: ${pricing.name}`;

    // Fetch dynamic pricing for addon if provided
    if (addonPriceId && addonPriceId !== 'val_slip_none') {
        const { data: addonPricing } = await supabaseAdmin
          .from('service_pricing')
          .select('markup_price, name')
          .eq('id', addonPriceId)
          .single();
          
        if (addonPricing) {
            FEE_AMOUNT += parseFloat(addonPricing.markup_price?.toString() || '0');
            description += ` + ${addonPricing.name}`;
        }
    }

    // Secure Atomic Deduction via RPC
    const { error: deductError } = await supabaseAdmin.rpc('deduct_balance', {
      user_id: user.id,
      amount: FEE_AMOUNT
    });

    if (deductError) {
      console.error('Balance deduction error:', deductError.message)
      if (deductError.message.toLowerCase().includes('insufficient')) {
         return jsonOk({ error: `Insufficient wallet balance. You need ₦${FEE_AMOUNT}.` })
      }
      return jsonOk({ error: 'Failed to deduct wallet balance. Please try again.' })
    }

    // Record the transaction for the deduction securely on the backend
    await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        amount: FEE_AMOUNT,
        type: 'payment',
        status: 'success',
        reference: `id_verify_${searchType}_${Date.now()}`,
        description: description
    });

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
      case 'nin':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
        break;

      // ── NIN Slip (PDF) ─────────────────────────────────────────────────────
      // service_code: 401 = Premium, 402 = Standard, 403 = Regular (NIMC layout)
      case 'nin-slip':
        endpoint = `${AGENTHUB_BASE}/v1/identity/slip`;
        bodyPayload = {
          nin: searchValue,
          service_code: service_code || requestData.service_code || '403',
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

      // ── NIN Tracking / Personalization ─────────────────────────────────────
      case 'tracking-id':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
        break;

      // ── IPE Clearance ──────────────────────────────────────────────────────
      // AgentHub does not have a separate IPE endpoint; use NIN verification
      case 'ipe':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
        break;

      // ── Identity Validation ────────────────────────────────────────────────
      case 'val':
        endpoint = `${AGENTHUB_BASE}/v1/identity/nin`;
        bodyPayload = { nin: searchValue };
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
        console.log(`Calling AgentHub API: ${endpoint} with payload:`, bodyPayload);

        const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AGENTHUB_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
        });

        const rawText = await apiResponse.text();
        let responseData: any = null;
        try {
            responseData = JSON.parse(rawText);
        } catch (_) {
            console.error('AgentHub API returned non-JSON response:', rawText.substring(0, 200));
            await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Invalid provider response format`);
            return jsonOk({ error: 'Verification provider returned an unexpected response format. Please try again later.' });
        }

        // ── AgentHub response format ───────────────────────────────────────────
        // Success: { status: true,  message: "...", data: {...} }
        // Slip:    { status: true,  message: "Slip Generated Successfully", pdf_base64: "..." }
        // Failure: { status: false, error:   "...", message: "Refunded" }
        //
        // Note: AgentHub uses boolean status (not string like IDPro)

        if (responseData.status === true) {
            // For any PDF slip (nin-slip, vnin-slip, etc.), return pdf_base64 directly
            if (responseData.pdf_base64) {
                return jsonOk({
                    data: {
                        status: 'success',
                        message: responseData.message || 'Slip Generated Successfully',
                        pdf_base64: responseData.pdf_base64,
                    }
                });
            }

            // Standard identity response — wrap in consistent structure
            return jsonOk({
                data: {
                    status: 'success',
                    message: responseData.message || 'Verification Successful',
                    data: responseData.data ?? responseData,
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
