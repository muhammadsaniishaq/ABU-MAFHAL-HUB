import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { renderAbuMafhalEmailTemplate } from '../_shared/email-template.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 1x1 Transparent PNG base64 fallback for PayVessel KYC image requirement if user avatar is absent
const DEFAULT_KYC_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Authenticate user from Authorization Header
        const authHeader = req.headers.get('Authorization');
        let user: any = null;

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '').trim();
            if (token) {
                const { data: userData } = await supabase.auth.getUser(token);
                user = userData?.user || null;
            }
        }

        const body = await req.json().catch(() => ({}));
        const { action } = body;

        // 2. Fetch Payvessel Credentials securely from system_secrets, app_settings, and Deno.env
        const { data: systemSecrets } = await supabase.from('system_secrets').select('key, value');
        const { data: appSettings } = await supabase.from('app_settings').select('key, value');

        const allSecretsMap: Record<string, string> = {};
        if (appSettings) {
            appSettings.forEach((s: any) => {
                if (s.key && s.value) {
                    let v = s.value;
                    if (typeof v === 'string') {
                        try {
                            const parsed = JSON.parse(v);
                            if (parsed && typeof parsed === 'object') v = parsed.key || parsed.value || v;
                        } catch (_) {}
                    }
                    allSecretsMap[String(s.key).toUpperCase()] = String(v);
                }
            });
        }
        if (systemSecrets) {
            systemSecrets.forEach((s: any) => {
                if (s.key && s.value) {
                    let v = s.value;
                    if (typeof v === 'string') {
                        try {
                            const parsed = JSON.parse(v);
                            if (parsed && typeof parsed === 'object') v = parsed.key || parsed.value || v;
                        } catch (_) {}
                    }
                    allSecretsMap[String(s.key).toUpperCase()] = String(v);
                }
            });
        }

        const findSecret = (...keys: string[]): string => {
            for (const k of keys) {
                const upper = k.toUpperCase();
                if (allSecretsMap[upper] && allSecretsMap[upper].trim()) {
                    return allSecretsMap[upper].trim();
                }
                const env = Deno.env.get(k) || Deno.env.get(upper);
                if (env && env.trim()) return env.trim();
            }
            return '';
        };

        const apiKey = findSecret('PAYVESSEL_API_KEY', 'payvessel_api_key', 'PAYVESSEL_KEY', 'PAYBESSEL_API_KEY');
        const apiSecret = findSecret('PAYVESSEL_API_SECRET', 'payvessel_secret_key', 'PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET', 'payvessel_api_secret');
        const businessId = findSecret('PAYVESSEL_BUSINESS_ID', 'payvessel_business_id', 'PAYVESSEL_BUSINESS', 'PAYVESSEL_BIZ_ID');

        const usdExchangeRate = Number(findSecret('USD_EXCHANGE_RATE', 'usd_exchange_rate')) || 1600;
        const profitMarginUsd = Number(findSecret('VIRTUAL_CARD_PROFIT_MARGIN_USD', 'virtual_card_profit_margin_usd')) || 1.50;
        const isSandbox = apiKey.startsWith('pv_test_') || apiKey.startsWith('test_') || apiKey.startsWith('sb_') || findSecret('PAYVESSEL_ENV', 'payvessel_env').toLowerCase() === 'sandbox';
        const baseUrl = isSandbox ? 'https://sandbox.payvessel.com' : 'https://api.payvessel.com';

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET CONFIG
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_config') {
            const wholesaleUsd = 1.50;
            const retailFeeUSD = wholesaleUsd + profitMarginUsd;
            const retailFeeNGN = retailFeeUSD * usdExchangeRate;

            return new Response(JSON.stringify({
                status: true,
                configured: Boolean(apiKey && apiSecret),
                has_business_id: Boolean(businessId),
                wholesale_usd: wholesaleUsd,
                card_fee_usd: retailFeeUSD,
                card_fee_ngn: retailFeeNGN,
                usd_rate: usdExchangeRate,
                min_funding_usd: 1.00,
                billing_address: {
                    street: '1209 Orange Street, Suite 400',
                    city: 'Wilmington',
                    state: 'DE',
                    zip: '19801',
                    country: 'United States'
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET BUSINESS WALLET BALANCE (PayVessel Portal Balance)
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_business_balance') {
            if (!apiKey || !apiSecret) {
                return new Response(JSON.stringify({ status: false, error: 'PayVessel API keys not configured.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const balRes = await fetch(`${baseUrl}/pms/api/external/request/wallet/balance/`, {
                    method: 'GET',
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json'
                    }
                });
                const balData = await balRes.json().catch(() => ({}));
                return new Response(JSON.stringify({
                    status: balRes.ok && balData?.status !== false,
                    data: balData?.data || balData
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch (err: any) {
                return new Response(JSON.stringify({ status: false, error: err.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: TEST API CONNECTION (Diagnostics)
        // ════════════════════════════════════════════════════════════════
        if (action === 'test_connection') {
            if (!apiKey || !apiSecret) {
                return new Response(JSON.stringify({
                    status: false,
                    message: 'PayVessel API Key or API Secret is not configured in system_secrets or app_settings.'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            try {
                const testRes = await fetch(`${baseUrl}/pms/api/external/request/wallet/balance/`, {
                    method: 'GET',
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json'
                    }
                });

                const testData = await testRes.json().catch(() => ({}));
                return new Response(JSON.stringify({
                    status: testRes.ok,
                    api_key_masked: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
                    business_id: businessId || 'Not set',
                    http_status: testRes.status,
                    response: testData
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch (err: any) {
                return new Response(JSON.stringify({
                    status: false,
                    message: `PayVessel connection test failed: ${err.message}`
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // Require authenticated user for all financial card operations
        if (!user) {
            return new Response(JSON.stringify({ status: false, error: 'Unauthorized: Valid user token required.' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: CREATE CARD (100% Real API Call, Zero Mock / Demo Fallbacks)
        // ════════════════════════════════════════════════════════════════
        if (action === 'create_card') {
            const {
                card_name,
                currency = 'USD',
                brand = 'VISA',
                initial_funding = 0,
                kyc_data = {}
            } = body;

            // 1. Fetch user profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profile) {
                return new Response(JSON.stringify({ status: false, error: 'User profile not found.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (!apiKey || !apiSecret) {
                return new Response(JSON.stringify({
                    status: false,
                    error: 'PayVessel API credentials not configured. Please contact support.'
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const currentBalance = Number(profile.balance) || 0;
            const creationFeeUSD = 1.50 + profitMarginUsd; // $3.00 USD
            const creationFeeNGN = creationFeeUSD * usdExchangeRate;
            const fundingAmount = Math.max(0, Number(initial_funding) || 0);
            const fundingNGN = fundingAmount * usdExchangeRate;
            const totalRequiredNGN = creationFeeNGN + fundingNGN;

            if (currentBalance < totalRequiredNGN) {
                return new Response(JSON.stringify({
                    status: false,
                    error: `Insufficient wallet balance. Required: ₦${Math.ceil(totalRequiredNGN).toLocaleString()} (Creation Fee $${creationFeeUSD.toFixed(2)} + Pre-fund $${fundingAmount.toFixed(2)}). Current Balance: ₦${Math.floor(currentBalance).toLocaleString()}`
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // 2. Fetch verified BVN and NIN from profile or kyc_requests
            let userBVN = (kyc_data.bvn || profile.bvn || '').replace(/\D/g, '');
            let userNIN = (kyc_data.nin || profile.nin || '').replace(/\D/g, '');

            if ((!userBVN || userBVN.length < 10) || (!userNIN || userNIN.length < 10)) {
                const { data: kycs } = await supabase
                    .from('kyc_requests')
                    .select('document_number, document_type, admin_note, status')
                    .eq('user_id', user.id)
                    .in('document_type', ['bvn', 'nin'])
                    .order('created_at', { ascending: false });

                if (kycs) {
                    if (!userBVN || userBVN.length < 10) {
                        const bKyc = kycs.find((k: any) => k.document_type === 'bvn');
                        if (bKyc) userBVN = (bKyc.document_number || bKyc.admin_note?.match(/\d{11}/)?.[0] || '').replace(/\D/g, '');
                    }
                    if (!userNIN || userNIN.length < 10) {
                        const nKyc = kycs.find((k: any) => k.document_type === 'nin');
                        if (nKyc) userNIN = (nKyc.document_number || nKyc.admin_note?.match(/\d{11}/)?.[0] || '').replace(/\D/g, '');
                    }
                }
            }

            if (!userBVN || userBVN.length !== 11) {
                return new Response(JSON.stringify({
                    status: false,
                    error: 'Valid 11-digit BVN is required to issue a Virtual Dollar Card. Please complete your KYC verification first.'
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (!userNIN || userNIN.length !== 11) {
                return new Response(JSON.stringify({
                    status: false,
                    error: 'Valid 11-digit NIN is required to issue a Virtual Dollar Card. Please complete your KYC verification first.'
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Customer KYC details
            const fullNameParts = (kyc_data.name || profile.full_name || user.user_metadata?.full_name || '').trim().split(/\s+/);
            const firstName = (fullNameParts[0] || 'User').trim();
            const lastName = (fullNameParts.slice(1).join(' ') || fullNameParts[0] || 'Customer').trim();

            let phone = (kyc_data.phone || profile.phone || profile.phone_number || '').replace(/\D/g, '');
            if (phone.startsWith('234') && phone.length === 13) phone = '0' + phone.slice(3);
            if (!phone || phone.length < 10) {
                return new Response(JSON.stringify({
                    status: false,
                    error: 'A valid Nigerian phone number is required for card registration.'
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const dob = kyc_data.dob || profile.dob || '1995-05-15';
            const state = kyc_data.state || profile.state || 'Kano';
            const lga = kyc_data.lga || profile.lga || 'Nassarawa';
            const street = kyc_data.street || profile.address || 'Plot 40 Commercial District';
            const postalCode = kyc_data.postal_code || '700001';
            const cardBrand = (brand === 'MASTERCARD' || currency === 'NGN') ? 'MASTERCARD' : 'VISA';
            const kycImage = kyc_data.image || profile.avatar_url || DEFAULT_KYC_IMAGE;

            // 3. Official PayVessel Virtual Card API Call
            const pvPayload = {
                brand: cardBrand,
                currency: 'USD',
                first_name: firstName,
                last_name: lastName,
                email: user.email,
                phone: phone,
                bvn: userBVN,
                nin: userNIN,
                dob: dob,
                image: kycImage,
                state: state,
                lga: lga,
                street: street,
                postal_code: postalCode,
                prefund_amount: Math.max(1, fundingAmount),
                card_name: card_name || `ABU MAFHAL USD Card`,
                business_id: businessId || undefined
            };

            let payvesselResult: any = null;
            let pvStatus = 0;

            try {
                const pvRes = await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/`, {
                    method: 'POST',
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(pvPayload)
                });

                pvStatus = pvRes.status;
                payvesselResult = await pvRes.json().catch(() => ({}));
                console.log('[Payvessel Virtual Card Response]', pvStatus, JSON.stringify(payvesselResult));
            } catch (pvErr: any) {
                return new Response(JSON.stringify({
                    status: false,
                    error: `Network error connecting to PayVessel API: ${pvErr.message}`
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Strictly evaluate PayVessel response: Do NOT create fake demo cards if API fails!
            const isApiSuccess = (pvStatus === 200 || pvStatus === 201) &&
                (payvesselResult?.status === true || payvesselResult?.success === true) &&
                Boolean(payvesselResult?.data?.card_id || payvesselResult?.data?.id);

            if (!isApiSuccess) {
                let errMsg = payvesselResult?.message || payvesselResult?.error || '';
                if (!errMsg && Array.isArray(payvesselResult?.details)) {
                    errMsg = payvesselResult.details.map((d: any) => d.detail || d.message).join(', ');
                }
                if (!errMsg) {
                    errMsg = `Card issuance failed (HTTP ${pvStatus}). Please check PayVessel portal balance or KYC.`;
                }

                if (errMsg.toLowerCase().includes('insufficient') && errMsg.toLowerCase().includes('wallet')) {
                    errMsg = 'PayVessel Error: Insufficient USD balance in your PayVessel merchant wallet. Please fund your PayVessel USD wallet on the PayVessel portal to issue virtual cards.';
                }

                return new Response(JSON.stringify({
                    status: false,
                    error: errMsg,
                    raw: payvesselResult
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // 4. Extract Real Card Details Returned by PayVessel
            let cardData = payvesselResult.data;
            const remoteCardId = cardData.id || cardData.card_id;

            // Poll once for active card credentials if PayVessel initialized as PENDING
            if (!cardData.card_number && remoteCardId) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    const pollRes = await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/${remoteCardId}/`, {
                        method: 'GET',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        }
                    });
                    const pollData = await pollRes.json().catch(() => ({}));
                    if (pollData?.data?.card_number) {
                        cardData = { ...cardData, ...pollData.data };
                    }
                } catch (_) {}
            }

            const fullCardNumber = String(cardData.card_number || cardData.pan || '').replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
            const cleanDigits = fullCardNumber.replace(/\D/g, '');
            const cardSuffix = cleanDigits.slice(-4) || '••••';
            const maskedCardNumber = cleanDigits.length >= 8
                ? `${cleanDigits.slice(0, 4)} •••• •••• ${cardSuffix}`
                : fullCardNumber || `•••• ${cardSuffix}`;

            const cvv = String(cardData.cvv || '');
            const expiryMonth = String(cardData.expiry_month || cardData.expiry?.split('/')?.[0] || '12').padStart(2, '0');
            const expiryYear = String(cardData.expiry_year || cardData.expiry?.split('/')?.[1] || (new Date().getFullYear() + 3)).slice(-2);
            const cardStatus = (cardData.status || 'active').toLowerCase();

            // 5. Deduct User Main Wallet Balance only upon 100% verified API success
            const newWalletBalance = currentBalance - totalRequiredNGN;
            await supabase.from('profiles').update({ balance: newWalletBalance }).eq('id', user.id);

            // 6. Record Wallet Audit Transaction
            await supabase.from('transactions').insert({
                user_id: user.id,
                title: `${cardBrand} Virtual Card Issued`,
                description: `PayVessel USD Virtual Card (${maskedCardNumber}) creation ($${creationFeeUSD.toFixed(2)}) + Initial Fund ($${fundingAmount.toFixed(2)})`,
                amount: -totalRequiredNGN,
                status: 'completed',
                category: 'card_creation',
                reference: `CARD_ISSUE_${remoteCardId}`,
                created_at: new Date().toISOString()
            });

            // 7. Store Real Card in user_virtual_cards
            const cardRecord = {
                user_id: user.id,
                card_id: remoteCardId,
                card_name: card_name || `ABU MAFHAL USD Card`,
                card_number_masked: maskedCardNumber,
                card_number_full: fullCardNumber || undefined,
                cvv: cvv || undefined,
                expiry_month: expiryMonth,
                expiry_year: expiryYear,
                card_holder_name: `${firstName} ${lastName}`.toUpperCase(),
                currency: 'USD',
                card_type: cardBrand,
                balance: fundingAmount,
                status: cardStatus,
                spending_limit_monthly: 10000.00,
                spending_limit_transaction: 2500.00,
                online_payments_enabled: true,
                international_payments_enabled: true,
                contactless_payments_enabled: false,
                billing_address: cardData.billing_address || {
                    street: '1209 Orange Street, Suite 400',
                    city: 'Wilmington',
                    state: 'DE',
                    zip: '19801',
                    country: 'United States'
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: savedCard, error: dbErr } = await supabase
                .from('user_virtual_cards')
                .insert(cardRecord)
                .select()
                .single();

            if (dbErr) {
                console.error('[Payvessel Cards] DB save error:', dbErr);
            }

            // Dispatch Official Virtual Card Provisioning Email
            if (user?.email && user.email.includes('@')) {
                try {
                    const recipientName = profile?.full_name || 'Valued Client';
                    const cardHtml = renderAbuMafhalEmailTemplate({
                        recipientName,
                        headlineBadge: 'Virtual Card Ready',
                        headlineTitle: 'Virtual Card Activated! 💳',
                        headlineSubtitle: 'Your international USD card is ready for online shopping.',
                        greeting: `Hi ${recipientName} 👋`,
                        messageBody: `
                            Your new <strong>${cardBrand.toUpperCase()} Virtual Card</strong> has been successfully created and linked to your wallet.<br/><br/>
                            <div style="background: #F8FAFC; border-radius: 14px; border: 1.5px solid #E2E8F0; padding: 18px 20px; margin: 16px 0;">
                                <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #CA8A04; letter-spacing: 0.5px;">Global Virtual Card</div>
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13.5px; line-height: 2; margin-top: 8px;">
                                    <tr>
                                        <td style="color: #64748B;">Card Name:</td>
                                        <td align="right" style="font-weight: 800; color: #0A192F;">${cardData.card_name || 'Abu Mafhal Dollar Card'}</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748B;">Card Type:</td>
                                        <td align="right" style="font-weight: 700; color: #0A192F;">${cardBrand.toUpperCase()} (${cardType.toUpperCase()})</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #64748B;">Currency:</td>
                                        <td align="right" style="font-weight: 800; color: #10B981;">USD ($)</td>
                                    </tr>
                                </table>
                            </div>
                            <p style="font-size: 13px; color: #64748B; margin-top: 10px;">
                                You can view your CVV, full 16-digit card number, and manage card funding safely inside the Abu Mafhal Sub app.
                            </p>
                        `,
                        buttonText: 'Manage My Card &rarr;',
                        buttonUrl: 'https://abumafhal.com.ng'
                    });

                    sendEmail(
                        user.email,
                        `Your New Virtual Card is Ready! 💳 - ABU MAFHAL SUB`,
                        `Your Abu Mafhal Sub virtual card has been issued and is ready for international payments.`,
                        cardHtml,
                        supabase
                    ).catch(e => console.warn('[Payvessel Card Email Note]:', e));
                } catch (cardMailErr) {
                    console.warn('[Payvessel Card Email Prepare Note]:', cardMailErr);
                }
            }

            return new Response(JSON.stringify({
                status: true,
                message: 'Virtual card successfully provisioned via PayVessel API!',
                card: savedCard || cardRecord,
                wallet_balance: newWalletBalance
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: SYNC ALL USER CARDS FROM PAYVESSEL API
        // ════════════════════════════════════════════════════════════════
        if (action === 'sync_cards') {
            if (!apiKey || !apiSecret) {
                return new Response(JSON.stringify({ status: false, error: 'API credentials missing' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const pvRes = await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/`, {
                    method: 'GET',
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json'
                    }
                });

                const pvData = await pvRes.json().catch(() => ({}));
                const liveCards = pvData?.data || [];

                // Fetch local cards
                const { data: localCards } = await supabase
                    .from('user_virtual_cards')
                    .select('*')
                    .eq('user_id', user.id);

                return new Response(JSON.stringify({
                    status: true,
                    remote_count: Array.isArray(liveCards) ? liveCards.length : 0,
                    cards: localCards || []
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch (err: any) {
                return new Response(JSON.stringify({ status: false, error: err.message }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: SYNC SINGLE CARD DETAILS FROM PAYVESSEL
        // ════════════════════════════════════════════════════════════════
        if (action === 'sync_card') {
            const { card_id } = body;
            if (!card_id) {
                return new Response(JSON.stringify({ status: false, error: 'card_id required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: localCard } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .or(`id.eq.${card_id},card_id.eq.${card_id}`)
                .maybeSingle();

            const remoteCardId = localCard?.card_id || card_id;
            let syncData: any = null;

            if (apiKey && apiSecret && remoteCardId) {
                try {
                    const syncRes = await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/${remoteCardId}/`, {
                        method: 'GET',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        }
                    });

                    syncData = await syncRes.json().catch(() => ({}));
                    console.log('[Payvessel Sync Card Response]:', JSON.stringify(syncData));

                    const remote = syncData?.data || syncData;
                    if (remote && (remote.card_number || remote.status || remote.balance !== undefined)) {
                        const updates: any = {};
                        if (remote.balance !== undefined) updates.balance = Number(remote.balance);
                        if (remote.status) updates.status = String(remote.status).toLowerCase();
                        if (remote.card_number) {
                            const panClean = String(remote.card_number).replace(/\D/g, '');
                            updates.card_number_full = panClean.replace(/(\d{4})/g, '$1 ').trim();
                            if (panClean.length >= 8) {
                                updates.card_number_masked = `${panClean.slice(0, 4)} •••• •••• ${panClean.slice(-4)}`;
                            }
                        }
                        if (remote.cvv) updates.cvv = String(remote.cvv);
                        if (remote.expiry) {
                            const expParts = String(remote.expiry).split('/');
                            if (expParts.length === 2) {
                                updates.expiry_month = expParts[0].padStart(2, '0');
                                updates.expiry_year = expParts[1].slice(-2);
                            }
                        }
                        updates.updated_at = new Date().toISOString();

                        if (localCard) {
                            await supabase.from('user_virtual_cards').update(updates).eq('id', localCard.id);
                        }
                    }
                } catch (e: any) {
                    console.warn('[Payvessel Sync Notice]:', e);
                }
            }

            return new Response(JSON.stringify({
                status: true,
                data: syncData?.data || syncData
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: FUND CARD (PayVessel API)
        // ════════════════════════════════════════════════════════════════
        if (action === 'fund_card') {
            const { card_id, amount_usd } = body;
            const fundUSD = Number(amount_usd);
            if (!fundUSD || fundUSD <= 0) {
                return new Response(JSON.stringify({ status: false, error: 'Please enter a valid funding amount (min $1.00 USD).' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            const requiredNGN = fundUSD * usdExchangeRate;
            if ((Number(profile?.balance) || 0) < requiredNGN) {
                return new Response(JSON.stringify({
                    status: false,
                    error: `Insufficient wallet balance. Required: ₦${Math.ceil(requiredNGN).toLocaleString()} ($${fundUSD.toFixed(2)} USD). Current Balance: ₦${Math.floor(Number(profile?.balance) || 0).toLocaleString()}`
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { data: localCard } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .or(`id.eq.${card_id},card_id.eq.${card_id}`)
                .maybeSingle();

            const remoteCardId = localCard?.card_id || card_id;
            let apiFundSuccess = false;
            let apiFundMsg = '';

            if (apiKey && apiSecret && remoteCardId) {
                try {
                    const pvFundRes = await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/${remoteCardId}/fund/`, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            card_id: remoteCardId,
                            amount: fundUSD,
                            business_id: businessId || undefined
                        })
                    });

                    const pvFundData = await pvFundRes.json().catch(() => ({}));
                    if (pvFundRes.ok && (pvFundData?.status === true || pvFundData?.success === true)) {
                        apiFundSuccess = true;
                    } else {
                        apiFundMsg = pvFundData?.message || pvFundData?.error || 'PayVessel funding failed';
                    }
                } catch (e: any) {
                    apiFundMsg = e.message;
                }
            }

            if (!apiFundSuccess && apiFundMsg) {
                return new Response(JSON.stringify({
                    status: false,
                    error: `Funding failed: ${apiFundMsg}`
                }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const newCardBalance = (Number(localCard?.balance) || 0) + fundUSD;
            const newWallet = Number(profile.balance) - requiredNGN;

            await supabase.from('profiles').update({ balance: newWallet }).eq('id', user.id);
            if (localCard) {
                await supabase.from('user_virtual_cards').update({ balance: newCardBalance }).eq('id', localCard.id);
            }

            await supabase.from('transactions').insert({
                user_id: user.id,
                title: 'Virtual Card Top-up',
                description: `Funded $${fundUSD.toFixed(2)} into ${localCard?.card_name || 'USD Virtual Card'}`,
                amount: -requiredNGN,
                status: 'completed',
                category: 'card_funding',
                reference: `CARD_FUND_${Date.now()}`
            });

            return new Response(JSON.stringify({
                status: true,
                message: `Successfully topped up $${fundUSD.toFixed(2)}!`,
                new_card_balance: newCardBalance,
                new_wallet_balance: newWallet
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: FREEZE / UNFREEZE
        // ════════════════════════════════════════════════════════════════
        if (action === 'freeze' || action === 'unfreeze') {
            const { card_id } = body;
            const newStatus = action === 'freeze' ? 'frozen' : 'active';

            const { data: localCard } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .or(`id.eq.${card_id},card_id.eq.${card_id}`)
                .maybeSingle();

            const remoteCardId = localCard?.card_id || card_id;

            if (apiKey && apiSecret && remoteCardId) {
                try {
                    await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/${remoteCardId}/${action}/`, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ card_id: remoteCardId, business_id: businessId || undefined })
                    });
                } catch (e) {
                    console.warn('[Payvessel Cards] Freeze/Unfreeze API notice:', e);
                }
            }

            if (localCard) {
                await supabase.from('user_virtual_cards').update({ status: newStatus }).eq('id', localCard.id);
            }

            return new Response(JSON.stringify({ status: true, new_status: newStatus }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: TERMINATE CARD
        // ════════════════════════════════════════════════════════════════
        if (action === 'terminate') {
            const { card_id } = body;

            const { data: localCard } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .or(`id.eq.${card_id},card_id.eq.${card_id}`)
                .maybeSingle();

            const remoteCardId = localCard?.card_id || card_id;

            if (apiKey && apiSecret && remoteCardId) {
                try {
                    await fetch(`${baseUrl}/pms/api/external/request/virtual-cards/${remoteCardId}/terminate/`, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ card_id: remoteCardId, business_id: businessId || undefined })
                    });
                } catch (e) {
                    console.warn('[Payvessel Cards] Terminate API notice:', e);
                }
            }

            if (localCard) {
                await supabase.from('user_virtual_cards').update({ status: 'terminated' }).eq('id', localCard.id);
            }

            return new Response(JSON.stringify({ status: true, message: 'Card terminated' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET ALL CARDS (ADMIN ONLY)
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_all_cards_admin') {
            const { data: adminProf } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            const isAdmin = ['admin', 'super_admin', 'manager'].includes(adminProf?.role || '');
            if (!isAdmin) {
                return new Response(JSON.stringify({ status: false, error: 'Unauthorized: Admin privileges required.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: allCards, error: cardsErr } = await supabase
                .from('user_virtual_cards')
                .select('*, profiles(full_name, email, phone_number)')
                .order('created_at', { ascending: false });

            if (cardsErr) throw cardsErr;

            return new Response(JSON.stringify({ status: true, cards: allCards || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: PERMANENTLY DELETE CARD (ADMIN ONLY)
        // ════════════════════════════════════════════════════════════════
        if (action === 'delete_card') {
            const { card_id } = body;
            const { data: adminProf } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            const isAdmin = ['admin', 'super_admin', 'manager'].includes(adminProf?.role || '');
            if (!isAdmin) {
                return new Response(JSON.stringify({ status: false, error: 'Unauthorized: Admin privileges required.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (!card_id) {
                return new Response(JSON.stringify({ status: false, error: 'Missing card_id parameter.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: localCard } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .or(`id.eq.${card_id},card_id.eq.${card_id}`)
                .maybeSingle();

            if (localCard) {
                await supabase.from('card_transactions').delete().eq('card_id', localCard.id);
                const { error: delErr } = await supabase.from('user_virtual_cards').delete().eq('id', localCard.id);
                if (delErr) throw delErr;
            }

            return new Response(JSON.stringify({ status: true, message: 'Virtual card permanently deleted.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: PURGE MOCK & TEST CARDS (ADMIN ONLY)
        // ════════════════════════════════════════════════════════════════
        if (action === 'purge_mock_cards') {
            const { data: adminProf } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            const isAdmin = ['admin', 'super_admin', 'manager'].includes(adminProf?.role || '');
            if (!isAdmin) {
                return new Response(JSON.stringify({ status: false, error: 'Unauthorized: Admin privileges required.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: allCards } = await supabase.from('user_virtual_cards').select('id, card_id, card_name, card_number_masked');
            let deletedCount = 0;

            if (allCards && allCards.length > 0) {
                const mockIds = allCards.filter((c: any) => {
                    const cid = (c.card_id || '').toLowerCase();
                    const cname = (c.card_name || '').toLowerCase();
                    const cnum = (c.card_number_masked || '').replace(/\s/g, '');
                    return (
                        cid.startsWith('mock') || cid.startsWith('test') || cid.startsWith('demo') ||
                        cname.includes('mock') || cname.includes('test') || cname.includes('demo') || cname.includes('sample') ||
                        cnum.includes('1111') || cnum.includes('4111') || cnum.startsWith('4000') || cnum.startsWith('5555')
                    );
                }).map((c: any) => c.id);

                if (mockIds.length > 0) {
                    await supabase.from('card_transactions').delete().in('card_id', mockIds);
                    const { error: delErr } = await supabase.from('user_virtual_cards').delete().in('id', mockIds);
                    if (!delErr) deletedCount = mockIds.length;
                }
            }

            return new Response(JSON.stringify({
                status: true,
                message: `Purged ${deletedCount} mock / test virtual card(s).`,
                purged_count: deletedCount
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ status: false, error: `Unknown action: ${action}` }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ status: false, error: err.message || 'Internal server error' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
