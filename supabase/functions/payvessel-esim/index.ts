import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback curated regions & popular travel destinations for Nigerian users (Hajj/Umrah, Business, Study, Vacations)
const CURATED_POPULAR_REGIONS = [
    { code: 'SA', name: 'Saudi Arabia (Hajj & Umrah)', flag: '🇸🇦', currency: 'SAR', popular: true },
    { code: 'AE', name: 'United Arab Emirates (Dubai)', flag: '🇦🇪', currency: 'AED', popular: true },
    { code: 'GB', name: 'United Kingdom (UK)', flag: '🇬🇧', currency: 'GBP', popular: true },
    { code: 'US', name: 'United States of America', flag: '🇺🇸', currency: 'USD', popular: true },
    { code: 'TR', name: 'Turkey (Türkiye)', flag: '🇹🇷', currency: 'TRY', popular: true },
    { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'EGP', popular: true },
    { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', popular: true },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', popular: true },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', popular: true },
    { code: 'DE', name: 'Germany (Europe Roam)', flag: '🇩🇪', currency: 'EUR', popular: true },
    { code: 'FR', name: 'France (Europe Roam)', flag: '🇫🇷', currency: 'EUR', popular: true },
    { code: 'CN', name: 'China', flag: '🇨🇳', currency: 'CNY', popular: false },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾', currency: 'MYR', popular: false },
    { code: 'QA', name: 'Qatar', flag: '🇶🇦', currency: 'QAR', popular: false },
    { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF', popular: false },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', popular: false },
    { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', popular: false },
];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Authenticate user from Authorization Header if present
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
                const envVal = Deno.env.get(upper);
                if (envVal && envVal.trim()) return envVal.trim();
            }
            return '';
        };

        const apiKey = findSecret('PAYVESSEL_API_KEY', 'payvessel_api_key', 'PAYVESSEL_KEY');
        const apiSecret = findSecret('PAYVESSEL_API_SECRET', 'payvessel_secret_key', 'PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET');
        const businessId = findSecret('PAYVESSEL_BUSINESS_ID', 'payvessel_business_id');
        const usdExchangeRate = Number(findSecret('USD_EXCHANGE_RATE', 'usd_exchange_rate')) || 1650;
        const profitMarginPercent = Number(findSecret('ESIM_PROFIT_MARGIN_PERCENT', 'esim_profit_margin_percent')) || 15; // 15% profit margin

        const baseUrl = 'https://api.payvessel.com';

        // ════════════════════════════════════════════════════════════════
        // ACTION: TEST CONNECTION / DIAGNOSTIC
        // ════════════════════════════════════════════════════════════════
        if (action === 'test_connection') {
            if (!apiKey || !apiSecret) {
                return new Response(JSON.stringify({
                    status: false,
                    message: 'PayVessel API credentials not configured.'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            try {
                const res = await fetch(`${baseUrl}/vaas/api/v1/esim/regions`, {
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json'
                    }
                });

                const data = await res.json().catch(() => null);
                return new Response(JSON.stringify({
                    status: res.ok,
                    http_status: res.status,
                    api_key_masked: apiKey.substring(0, 6) + '...' + apiKey.slice(-4),
                    business_id: businessId || 'N/A',
                    message: res.ok ? 'PayVessel eSIM API Connected 🟢' : (data?.message || 'Connection failed'),
                    data: data
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch (err: any) {
                return new Response(JSON.stringify({
                    status: false,
                    error: err.message
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET REGIONS / COUNTRIES
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_regions') {
            let regionsList = [...CURATED_POPULAR_REGIONS];

            if (apiKey && apiSecret) {
                try {
                    const res = await fetch(`${baseUrl}/vaas/api/v1/esim/regions`, {
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (res.ok) {
                        const apiData = await res.json().catch(() => null);
                        const fetchedRegions = apiData?.data || apiData?.regions || (Array.isArray(apiData) ? apiData : null);
                        if (Array.isArray(fetchedRegions) && fetchedRegions.length > 0) {
                            // Merge fetched regions
                            const formatted = fetchedRegions.map((r: any) => ({
                                code: r.code || r.location_code || r.id,
                                name: r.name || r.location_name || r.country_name,
                                flag: r.flag || '🌐',
                                currency: r.currency || 'USD',
                                popular: ['SA', 'AE', 'GB', 'US', 'TR', 'EG'].includes(r.code || r.location_code)
                            }));
                            if (formatted.length > 0) {
                                regionsList = formatted;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[eSIM] Failed fetching dynamic regions, using curated list:', e);
                }
            }

            return new Response(JSON.stringify({
                status: true,
                regions: regionsList,
                usd_rate: usdExchangeRate
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET PACKAGES FOR A COUNTRY / REGION
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_packages') {
            const countryCode = String(body.country_code || 'SA').toUpperCase();
            let packages: any[] = [];

            if (apiKey && apiSecret) {
                try {
                    const res = await fetch(`${baseUrl}/vaas/api/v1/esim/packages?location_code=${countryCode}&package_type=BASE`, {
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (res.ok) {
                        const pkgData = await res.json().catch(() => null);
                        const rawPkgs = pkgData?.data || pkgData?.packages || (Array.isArray(pkgData) ? pkgData : []);
                        if (Array.isArray(rawPkgs) && rawPkgs.length > 0) {
                            packages = rawPkgs.map((p: any) => {
                                const baseUsd = Number(p.price || p.amount || p.retail_price || 3.00);
                                const retailUsd = baseUsd * (1 + (profitMarginPercent / 100));
                                const retailNgn = Math.round(retailUsd * usdExchangeRate);
                                return {
                                    package_code: p.package_code || p.code || p.id,
                                    name: p.name || `${p.data_amount || '1 GB'} - ${p.validity_days || 7} Days`,
                                    data_amount: p.data_amount || p.volume || '1 GB',
                                    validity_days: Number(p.validity_days || p.duration || 7),
                                    price_usd: Number(retailUsd.toFixed(2)),
                                    price_ngn: retailNgn,
                                    wholesale_usd: baseUsd,
                                    location_code: countryCode
                                };
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`[eSIM] PayVessel packages error for ${countryCode}:`, e);
                }
            }

            // Fallback packages if remote returned empty
            if (packages.length === 0) {
                const sampleCatalog = [
                    { data_amount: '1 GB', validity_days: 7, baseUsd: 2.50 },
                    { data_amount: '3 GB', validity_days: 15, baseUsd: 5.50 },
                    { data_amount: '5 GB', validity_days: 30, baseUsd: 8.50 },
                    { data_amount: '10 GB', validity_days: 30, baseUsd: 14.50 },
                    { data_amount: '20 GB', validity_days: 30, baseUsd: 24.00 },
                ];

                packages = sampleCatalog.map((item, idx) => {
                    const retailUsd = item.baseUsd * (1 + (profitMarginPercent / 100));
                    const retailNgn = Math.round(retailUsd * usdExchangeRate);
                    return {
                        package_code: `${countryCode}_${item.data_amount.replace(/\s+/g, '')}_${item.validity_days}D_${idx + 1}`,
                        name: `${item.data_amount} Travel Data (${item.validity_days} Days)`,
                        data_amount: item.data_amount,
                        validity_days: item.validity_days,
                        price_usd: Number(retailUsd.toFixed(2)),
                        price_ngn: retailNgn,
                        wholesale_usd: item.baseUsd,
                        location_code: countryCode
                    };
                });
            }

            return new Response(JSON.stringify({
                status: true,
                country_code: countryCode,
                packages: packages,
                usd_rate: usdExchangeRate
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: ORDER / PURCHASE ESIM
        // ════════════════════════════════════════════════════════════════
        if (action === 'order_esim') {
            if (!user) {
                return new Response(JSON.stringify({ status: false, error: 'Unauthorized. Please sign in.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const {
                package_code,
                country_code,
                country_name,
                data_amount,
                validity_days,
                price_ngn,
                price_usd
            } = body;

            if (!package_code || !price_ngn) {
                return new Response(JSON.stringify({ status: false, error: 'Incomplete package parameters.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const costNgn = Number(price_ngn);
            const costUsd = Number(price_usd) || Number((costNgn / usdExchangeRate).toFixed(2));

            // 1. Check user wallet balance
            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('balance, email, full_name')
                .eq('id', user.id)
                .single();

            if (profErr || !profile) {
                return new Response(JSON.stringify({ status: false, error: 'Could not fetch user wallet balance.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const currentBalance = Number(profile.balance) || 0;
            if (currentBalance < costNgn) {
                return new Response(JSON.stringify({
                    status: false,
                    error: `Insufficient wallet balance. You need ₦${costNgn.toLocaleString()} but currently have ₦${currentBalance.toLocaleString()}. Please fund your wallet.`
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 2. Atomically deduct balance
            const { data: deductedBal, error: deductErr } = await supabase.rpc('deduct_balance', {
                user_id: user.id,
                amount: costNgn
            });

            if (deductErr) {
                return new Response(JSON.stringify({
                    status: false,
                    error: deductErr.message || 'Failed to debit wallet balance.'
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 3. Dispatch to PayVessel eSIM API
            const orderRef = `ESIM_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            let esimProfile: any = null;
            let orderError: string | null = null;

            if (apiKey && apiSecret) {
                try {
                    const orderRes = await fetch(`${baseUrl}/vaas/api/v1/esim/orders`, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            reference: orderRef,
                            package_code: package_code,
                            quantity: 1
                        })
                    });

                    const orderData = await orderRes.json().catch(() => null);

                    if (orderRes.ok && (orderData?.status || orderData?.data)) {
                        const details = orderData.data || orderData;
                        esimProfile = {
                            iccid: details.iccid || details.sim_iccid || '89852' + Math.floor(100000000000000 + Math.random() * 900000000000000),
                            qr_code_url: details.qr_code_url || details.qrcode_url || details.qr_code,
                            lpa_activation_code: details.lpa_activation_code || details.matching_id || details.activation_code,
                            smdp_address: details.smdp_address || 'rsp.truphone.com',
                            activation_code: details.activation_code || details.matching_id
                        };
                    } else {
                        orderError = orderData?.message || orderData?.error || `PayVessel order failed (HTTP ${orderRes.status})`;
                    }
                } catch (e: any) {
                    orderError = e.message || 'Failed connecting to PayVessel eSIM server.';
                }
            } else {
                orderError = 'PayVessel API credentials not configured.';
            }

            // 4. Handle failure & auto-refund
            if (orderError || !esimProfile) {
                console.error(`[eSIM] Order failed for user ${user.id}: ${orderError}. Refunding ₦${costNgn}`);
                await supabase.rpc('credit_balance', {
                    user_id: user.id,
                    amount: costNgn
                });

                return new Response(JSON.stringify({
                    status: false,
                    error: `eSIM provisioning error: ${orderError}. Your wallet balance of ₦${costNgn.toLocaleString()} has been fully refunded.`
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Ensure LPA string format
            const lpaString = esimProfile.lpa_activation_code || `LPA:1$${esimProfile.smdp_address || 'rsp.truphone.com'}$${esimProfile.activation_code || esimProfile.iccid}`;
            const qrUrl = esimProfile.qr_code_url || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lpaString)}`;

            // 5. Store eSIM in public.user_esims
            const { data: savedEsim, error: saveErr } = await supabase.from('user_esims').insert({
                user_id: user.id,
                order_reference: orderRef,
                package_code: package_code,
                country_code: country_code || 'GLOBAL',
                country_name: country_name || 'International',
                data_amount: data_amount || '1 GB',
                validity_days: Number(validity_days) || 30,
                iccid: esimProfile.iccid,
                qr_code_url: qrUrl,
                lpa_activation_code: lpaString,
                smdp_address: esimProfile.smdp_address || 'rsp.truphone.com',
                activation_code: esimProfile.activation_code || esimProfile.iccid,
                status: 'ACTIVE',
                cost_ngn: costNgn,
                cost_usd: costUsd,
                raw_response: esimProfile
            }).select('*').single();

            if (saveErr) console.error('[eSIM] Error saving user_esims record:', saveErr);

            // 6. Record transaction in public.transactions
            try {
                await supabase.from('transactions').insert({
                    user_id: user.id,
                    type: 'DEBIT',
                    amount: costNgn,
                    category: 'ESIM',
                    status: 'COMPLETED',
                    description: `eSIM Purchase: ${country_name || 'Global'} (${data_amount || '1 GB'})`,
                    reference: orderRef,
                    metadata: {
                        esim_id: savedEsim?.id,
                        package_code: package_code,
                        country_code: country_code,
                        iccid: esimProfile.iccid
                    }
                });
            } catch (tErr) {
                console.warn('[eSIM] Non-fatal transaction record warning:', tErr);
            }

            // 7. Notification
            try {
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title: 'eSIM Activated! 🌐',
                    message: `Your ${country_name || 'Global'} eSIM (${data_amount}) is ready. Scan your QR code to activate roaming data.`,
                    type: 'SUCCESS'
                });
            } catch (_) {}

            return new Response(JSON.stringify({
                status: true,
                message: 'eSIM provisioned successfully!',
                esim: savedEsim || {
                    order_reference: orderRef,
                    package_code: package_code,
                    country_name: country_name,
                    data_amount: data_amount,
                    validity_days: validity_days,
                    iccid: esimProfile.iccid,
                    qr_code_url: qrUrl,
                    lpa_activation_code: lpaString,
                    smdp_address: esimProfile.smdp_address || 'rsp.truphone.com',
                    activation_code: esimProfile.activation_code || esimProfile.iccid,
                    status: 'ACTIVE',
                    cost_ngn: costNgn
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ════════════════════════════════════════════════════════════════
        // ACTION: GET USER ESIMS
        // ════════════════════════════════════════════════════════════════
        if (action === 'get_my_esims') {
            if (!user) {
                return new Response(JSON.stringify({ status: false, error: 'Unauthorized.' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { data: myEsims, error: fetchErr } = await supabase
                .from('user_esims')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (fetchErr) throw fetchErr;

            return new Response(JSON.stringify({
                status: true,
                esims: myEsims || []
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ status: false, error: `Unknown action: ${action}` }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ status: false, error: err.message || 'Server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
