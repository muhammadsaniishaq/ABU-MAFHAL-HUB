import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { type, value, firstname, lastname, dob, gender } = requestData

    const searchType = requestData.searchType || type
    const searchValue = requestData.searchValue || value

    if (!searchType) {
      return jsonOk({ error: 'Missing search type' })
    }


    let FEE_AMOUNT = 0; // Set to 0 for development testing/bypassing insufficient balance

    // We need to use a transaction-like approach or just update if balance >= FEE_AMOUNT
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError?.message)
      return jsonOk({ error: 'Failed to fetch user profile. Please try again.' })
    }

    const currentBalance = parseFloat(profile.balance?.toString() || '0');

    if (currentBalance < FEE_AMOUNT) {
      return jsonOk({ error: `Insufficient wallet balance. You need ₦${FEE_AMOUNT} but have ₦${currentBalance.toFixed(2)}.` })
    }

    // Deduct the balance
    const newBalance = currentBalance - FEE_AMOUNT;
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', user.id)

    if (updateError) {
      console.error('Balance update error:', updateError.message)
      return jsonOk({ error: 'Failed to deduct wallet balance. Please try again.' })
    }

    // Record the transaction for the deduction
    await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        amount: FEE_AMOUNT,
        type: 'payment',
        status: 'success',
        reference: `id_verify_${searchType}_${Date.now()}`,
        description: `Verification Fee (${searchType.toUpperCase()})`
    });

    // 2. Call IDPRO API
    // Retrieve IDPRO API Key from system_secrets or environment
    let IDPRO_API_KEY = Deno.env.get('IDPRO_API_KEY');
    if (!IDPRO_API_KEY) {
        const { data: secrets } = await supabaseAdmin
            .from('system_secrets')
            .select('value')
            .eq('key', 'IDPRO_API_KEY')
            .single();
        if (secrets && secrets.value) {
            IDPRO_API_KEY = secrets.value;
        }
    }

    if (!IDPRO_API_KEY) {
        // If API key is missing, refund the user
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: IDPRO API key not configured`);
        console.error('IDPRO_API_KEY is not set in environment or system_secrets table')
        return jsonOk({ error: 'Verification service is not configured. Please contact support.' })
    }

    let endpoint = 'https://idpro.ng/api/v1/nin';
    let bodyPayload: any = {};
    
    // Switch between all the IDPRO services
    switch (searchType) {
        case 'nin':
            endpoint = 'https://idpro.ng/api/v1/nin';
            bodyPayload = { number: searchValue };
            break;
        case 'phone':
            endpoint = 'https://idpro.ng/api/v1/phone';
            bodyPayload = { number: searchValue };
            break;
        case 'demographic':
            endpoint = 'https://idpro.ng/api/v1/demo';
            bodyPayload = { 
                firstname, 
                lastname, 
                gender, 
                dob 
            };
            break;
        case 'bvn':
            endpoint = 'https://idpro.ng/api/v1/bvn';
            bodyPayload = { number: searchValue };
            break;
        case 'bvn-phone':
            endpoint = 'https://idpro.ng/api/v1/bvn-phone';
            bodyPayload = { number: searchValue };
            break;
        case 'bvn-card':
            endpoint = 'https://idpro.ng/api/v1/bvncard';
            bodyPayload = { number: searchValue };
            break;
        case 'tracking-id':
            endpoint = 'https://idpro.ng/api/v1/tracking-id';
            bodyPayload = { number: searchValue };
            break;
        case 'tracking-id-status':
            endpoint = 'https://idpro.ng/api/v1/tracking-id/status';
            bodyPayload = { number: searchValue };
            break;
        case 'ipe':
            endpoint = 'https://idpro.ng/api/v1/ipe';
            bodyPayload = { number: searchValue };
            break;
        case 'ipe-status':
            endpoint = 'https://idpro.ng/api/v1/ipe/status';
            bodyPayload = { number: searchValue };
            break;
        case 'val':
            endpoint = 'https://idpro.ng/api/v1/val';
            bodyPayload = { number: searchValue };
            break;
        case 'val-status':
            endpoint = 'https://idpro.ng/api/v1/val/status';
            bodyPayload = { number: searchValue };
            break;
        case 'val-slip':
            endpoint = 'https://idpro.ng/api/v1/val/slip';
            bodyPayload = { number: searchValue };
            break;
        case 'delink':
            endpoint = 'https://idpro.ng/api/v1/delink';
            bodyPayload = { number: searchValue };
            break;
        case 'delink-status':
            endpoint = 'https://idpro.ng/api/v1/delink/status';
            bodyPayload = { number: searchValue };
            break;
        default:
            await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Invalid verification type`);
            return jsonOk({ error: `Invalid verification type: ${searchType}` })
    }

    try {
        console.log(`Calling IDPRO API: ${endpoint} with payload:`, bodyPayload);
        const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${IDPRO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
        });

        const responseData = await apiResponse.json();
        
        // Handle IDPro statuses: "success", "pending" (for tracking/ipe), "failed"
        const idproStatus = (responseData.status || '').toLowerCase();
        if (idproStatus !== 'success' && idproStatus !== 'pending') {
            console.error('IDPRO API Error:', responseData);
            const idproMsg = responseData.message || 'NIN not found or verification failed';
            await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: ${idproMsg}`);
            return jsonOk({ error: idproMsg, details: responseData })
        }

        return jsonOk({ data: responseData })

    } catch (apiError: any) {
        console.error('IDPRO Fetch Error:', apiError);
        // Refund on network error
        await refundUser(supabaseAdmin, user.id, FEE_AMOUNT, `Refund: Network error during verification`);
        return jsonOk({ error: 'Failed to reach verification provider. Please try again.' })
    }

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return jsonOk({ error: `An unexpected error occurred: ${error?.message || 'Unknown'}` })
  }
})

async function refundUser(supabaseAdmin: any, userId: string, amount: number, reason: string) {
    // Fetch current balance
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
