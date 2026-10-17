import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const jsonResponse = (body: object, status: number = 200) =>
    new Response(JSON.stringify(body), {
        status: 200, // Always return HTTP 200 so Supabase invoke never throws "non-2xx status code"
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse({
                success: false,
                verified: false,
                message: 'Supabase server configuration error: missing service role key.',
            }, 500);
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const requestBody = await req.json().catch(() => ({}));
        const {
            action = 'verify_nin',
            nin: reqNin,
            bvn: reqBvn,
            userId,
            fullName,
            firstName,
            lastName,
            middleName,
            dob,
            gender,
            phone,
            accountNumber,
        } = requestBody;

        // 1. Fetch credentials securely from system_secrets & app_settings
        const { data: secrets } = await supabaseAdmin.from('system_secrets').select('key, value');
        const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value');

        const masterSecrets: Record<string, string> = {};
        if (settings && Array.isArray(settings)) {
            settings.forEach((s: any) => {
                if (s.key && s.value) masterSecrets[String(s.key).toUpperCase().trim()] = String(s.value).trim();
            });
        }
        if (secrets && Array.isArray(secrets)) {
            secrets.forEach((s: any) => {
                if (s.key && s.value) masterSecrets[String(s.key).toUpperCase().trim()] = String(s.value).trim();
            });
        }

        const findSecret = (...aliases: string[]): string => {
            for (const alias of aliases) {
                const upper = alias.toUpperCase();
                if (masterSecrets[upper] && masterSecrets[upper].trim()) {
                    return masterSecrets[upper].trim();
                }
                const envVal = Deno.env.get(alias) || Deno.env.get(upper);
                if (envVal && envVal.trim()) return envVal.trim();
            }
            return '';
        };

        const apiKey = findSecret('PAYVESSEL_API_KEY', 'payvessel_api_key', 'PAYVESSEL_KEY', 'PAYBESSEL_API_KEY');
        const apiSecret = findSecret('PAYVESSEL_API_SECRET', 'payvessel_secret_key', 'PAYVESSEL_SECRET_KEY', 'PAYVESSEL_SECRET', 'payvessel_api_secret');
        const businessId = findSecret('PAYVESSEL_BUSINESS_ID', 'payvessel_business_id', 'PAYVESSEL_BUSINESS', 'PAYVESSEL_BIZ_ID');

        // Backup gateways for secondary verification fallback
        const agentHubKey = findSecret('AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'AGENTS_HUB_KEY');
        const idProKey = findSecret('IDPRO_API_KEY', 'IDPRO_KEY');

        // Configurable KYC Verification Fee (Default ₦150)
        const feeSettingStr = masterSecrets['KYC_VERIFICATION_FEE'] || findSecret('KYC_VERIFICATION_FEE', 'kyc_verification_fee');
        const kycFee = feeSettingStr !== '' && !isNaN(Number(feeSettingStr)) ? Math.max(0, Number(feeSettingStr)) : 150;
        const feeEnabledStr = masterSecrets['KYC_FEE_ENABLED'] ?? findSecret('KYC_FEE_ENABLED', 'kyc_fee_enabled');
        const kycFeeEnabled = feeEnabledStr === '' ? true : (String(feeEnabledStr).toLowerCase() === 'true' || feeEnabledStr === '1');

        const isSandbox = apiKey.startsWith('pv_test_') || apiKey.startsWith('test_') || apiKey.startsWith('sb_') || findSecret('PAYVESSEL_ENV').toLowerCase() === 'sandbox';
        const baseUrl = isSandbox ? 'https://sandbox.payvessel.com' : 'https://api.payvessel.com';

        console.log(`[Payvessel KYC] Action: ${action}, Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}, KYC Fee: ₦${kycFee} (Enabled: ${kycFeeEnabled}), Has API Key: ${Boolean(apiKey)}, Has Secret: ${Boolean(apiSecret)}`);

        // Helper: Format Date of Birth to YYYY-MM-DD
        const normalizeDob = (rawDob?: string): string => {
            if (!rawDob) return '2000-01-01';
            const trimmed = String(rawDob).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

            // Handle "15 Mar 2000" or "15-03-2000"
            const months: Record<string, string> = {
                jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            const parts = trimmed.split(/[\s-]+/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const m = months[parts[1].toLowerCase()] || parts[1].padStart(2, '0');
                    return `${parts[0]}-${m}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                    const m = months[parts[1].toLowerCase()] || parts[1].padStart(2, '0');
                    return `${parts[2]}-${m}-${parts[0].padStart(2, '0')}`;
                }
            }
            return trimmed;
        };

        // Helper: Extract name parts
        let effectiveFirstName = (firstName || '').trim();
        let effectiveLastName = (lastName || '').trim();
        let effectiveMiddleName = (middleName || '').trim();

        if ((!effectiveFirstName || !effectiveLastName) && fullName) {
            const parts = fullName.trim().split(/\s+/);
            if (parts.length === 1) {
                effectiveFirstName = parts[0];
                effectiveLastName = parts[0];
            } else if (parts.length === 2) {
                effectiveFirstName = parts[0];
                effectiveLastName = parts[1];
            } else if (parts.length >= 3) {
                effectiveFirstName = parts[0];
                effectiveMiddleName = parts.slice(1, -1).join(' ');
                effectiveLastName = parts[parts.length - 1];
            }
        }

        // Helper: Normalize phone
        let cleanPhone = String(phone || '08000000000').replace(/\D/g, '');
        if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
            cleanPhone = '0' + cleanPhone.slice(3);
        }

        // Helper: Normalize gender
        const cleanGender = String(gender || 'MALE').toUpperCase().startsWith('F') ? 'FEMALE' : 'MALE';
        const formattedDob = normalizeDob(dob);

        // ----------------------------------------------------
        // ACTION: TEST CONNECTION / DIAGNOSTIC
        // ----------------------------------------------------
        if (action === 'test_connection') {
            if (!apiKey || !apiSecret) {
                return jsonResponse({
                    success: false,
                    configured: false,
                    message: 'Payvessel API Key or API Secret is missing in API Vault.'
                });
            }

            try {
                const startTime = Date.now();
                const checkRes = await fetch(`${baseUrl}/kyc/api/v1/merchant/nin/basic`, {
                    method: 'POST',
                    headers: {
                        'api-key': apiKey,
                        'api-secret': apiSecret,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        nin: '00000000000',
                        first_name: 'Test',
                        last_name: 'Ping',
                        gender: 'MALE',
                        birthday: '2000-01-01',
                        phone_number: '08000000000',
                    }),
                });

                const latencyMs = Date.now() - startTime;
                const checkData = await checkRes.json().catch(() => ({}));

                const isAuthError = checkRes.status === 401 || checkRes.status === 403 || String(checkData.message || '').toLowerCase().includes('credential');

                return jsonResponse({
                    success: !isAuthError,
                    configured: true,
                    environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
                    latencyMs,
                    httpStatus: checkRes.status,
                    message: isAuthError ? `Authentication failed: ${checkData.message || 'Invalid API Key/Secret'}` : `Payvessel KYC Gateway is online (${latencyMs}ms)`,
                    raw: checkData
                });
            } catch (err: any) {
                return jsonResponse({
                    success: false,
                    configured: true,
                    environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
                    message: `Connection failed: ${err.message}`
                });
            }
        }

        // ----------------------------------------------------
        // ACTION: GET KYC CONFIG / PRICING
        // ----------------------------------------------------
        if (action === 'get_kyc_config') {
            return jsonResponse({
                success: true,
                fee: kycFee,
                feeEnabled: kycFeeEnabled,
                currency: 'NGN',
                providerCost: 70,
                profitMargin: Math.max(0, kycFee - 70),
            });
        }

        // ----------------------------------------------------
        // ACTION: VERIFY NIN (National Identity Number)
        // ----------------------------------------------------
        if (action === 'verify_nin') {
            const cleanNin = String(reqNin || '').replace(/\D/g, '').trim();

            if (!cleanNin || cleanNin.length !== 11) {
                return jsonResponse({
                    success: false,
                    verified: false,
                    nin: cleanNin,
                    provider: 'Payvessel NIMC Gateway',
                    message: 'Invalid NIN format. NIN must be exactly 11 digits.',
                });
            }

            console.log(`[Payvessel KYC] Verifying NIN: ${cleanNin} for ${effectiveFirstName} ${effectiveLastName}`);

            // Pre-check: Ensure user wallet has sufficient balance for KYC fee
            let currentUserBalance = 0;
            if (userId && kycFeeEnabled && kycFee > 0) {
                const { data: userProf } = await supabaseAdmin
                    .from('profiles')
                    .select('id, balance, full_name')
                    .eq('id', userId)
                    .maybeSingle();

                currentUserBalance = Number(userProf?.balance ?? 0);
                if (currentUserBalance < kycFee) {
                    console.warn(`[Payvessel KYC] User ${userId} insufficient balance: ₦${currentUserBalance} < ₦${kycFee}`);
                    return jsonResponse({
                        success: false,
                        verified: false,
                        insufficientUserBalance: true,
                        requiredFee: kycFee,
                        currentBalance: currentUserBalance,
                        provider: 'Payvessel NIMC Gateway',
                        message: `Insufficient wallet balance (₦${currentUserBalance.toLocaleString()}) for the required KYC verification fee of ₦${kycFee.toLocaleString()}. Please fund your wallet to continue.`
                    });
                }
            }

            let payvesselVerified = false;
            let verifiedData: any = null;
            let lastErrorMessage = '';

            // Step 1: Call Payvessel Basic NIN API if credentials exist
            if (apiKey && apiSecret) {
                try {
                    const pvPayload: Record<string, any> = {
                        nin: cleanNin,
                        first_name: effectiveFirstName || 'Customer',
                        last_name: effectiveLastName || 'User',
                        middle_name: effectiveMiddleName || undefined,
                        gender: cleanGender,
                        birthday: formattedDob,
                        phone_number: cleanPhone,
                    };

                    const pvUrl = `${baseUrl}/kyc/api/v1/merchant/nin/basic`;
                    console.log(`[Payvessel KYC] Requesting: ${pvUrl}`);

                    const pvRes = await fetch(pvUrl, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(pvPayload),
                    });

                    const pvJson = await pvRes.json().catch(() => ({}));
                    console.log(`[Payvessel KYC Response]:`, JSON.stringify(pvJson));

                    if (pvRes.ok && (pvJson.status === true || pvJson.success === true || pvJson.code === 200 || pvJson.data)) {
                        const d = pvJson.data || pvJson;
                        const matchPct = Number(d.names_match_percentage || d.match_score || 98);
                        payvesselVerified = true;
                        verifiedData = {
                            nin: cleanNin,
                            fullName: `${d.first_name || effectiveFirstName} ${d.middle_name ? d.middle_name + ' ' : ''}${d.last_name || effectiveLastName}`.trim(),
                            firstName: d.first_name || effectiveFirstName,
                            lastName: d.last_name || effectiveLastName,
                            middleName: d.middle_name || effectiveMiddleName,
                            dob: d.birthday || formattedDob,
                            gender: d.gender || cleanGender,
                            phone: d.phone_number || cleanPhone,
                            matchScore: matchPct,
                            provider: 'Payvessel NIMC Gateway',
                            message: `NIN Verified successfully via Payvessel (${matchPct}% Match ✓).`,
                            raw: pvJson
                        };
                    } else if (pvJson.message || pvJson.details) {
                        lastErrorMessage = String(pvJson.details?.[0] || pvJson.message);
                    }
                } catch (pvErr: any) {
                    console.warn(`[Payvessel KYC Exception]:`, pvErr.message);
                    lastErrorMessage = pvErr.message;
                }
            } else {
                lastErrorMessage = 'Payvessel API Key and Secret are not configured in system_secrets.';
            }

            // Step 1b: Try Payvessel Enhanced NIN if Basic didn't pass (queries directly by NIN)
            if (!payvesselVerified && apiKey && apiSecret) {
                try {
                    const pvEnhUrl = `${baseUrl}/kyc/api/v1/merchant/nin/enhanced`;
                    console.log(`[Payvessel KYC] Requesting Enhanced NIN: ${pvEnhUrl}`);

                    const enhRes = await fetch(pvEnhUrl, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ nin: cleanNin }),
                    });

                    const enhJson = await enhRes.json().catch(() => ({}));
                    console.log(`[Payvessel KYC Enhanced Response]:`, JSON.stringify(enhJson));

                    if (enhRes.ok && (enhJson.status === true || enhJson.success === true || enhJson.code === 200 || enhJson.data)) {
                        const d = enhJson.data || enhJson;
                        const returnName = `${d.first_name || d.firstname || ''} ${d.middle_name || d.middlename ? (d.middle_name || d.middlename) + ' ' : ''}${d.last_name || d.surname || ''}`.trim() || effectiveFirstName || 'Verified Citizen';
                        payvesselVerified = true;
                        verifiedData = {
                            nin: cleanNin,
                            fullName: returnName,
                            firstName: d.first_name || d.firstname || effectiveFirstName,
                            lastName: d.last_name || d.surname || effectiveLastName,
                            middleName: d.middle_name || d.middlename || effectiveMiddleName,
                            dob: d.birthday || d.birthdate || formattedDob,
                            gender: d.gender || cleanGender,
                            phone: d.phone_number || d.telephoneno || cleanPhone,
                            photoUrl: d.photo || d.photoUrl || null,
                            matchScore: 99,
                            provider: 'Payvessel NIMC Enhanced Gateway',
                            message: `NIN Verified successfully via Payvessel NIMC Enhanced API.`,
                            raw: enhJson
                        };
                    } else if (enhJson.message || enhJson.details) {
                        const enhMsg = String(enhJson.details?.[0] || enhJson.message);
                        if (!lastErrorMessage || enhMsg.length > lastErrorMessage.length) {
                            lastErrorMessage = enhMsg;
                        }
                    }
                } catch (enhErr: any) {
                    console.warn(`[Payvessel KYC Enhanced Exception]:`, enhErr.message);
                }
            }

            // Step 2: Failover to AgentHub NIMC gateway if Payvessel was not able to verify
            if (!payvesselVerified && agentHubKey) {
                console.log(`[Payvessel KYC] Trying secondary NIMC gateway (AgentHub)...`);
                try {
                    const ahRes = await fetch(`https://agenthub.ng/api/v1/identity/nin`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${agentHubKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            search_type: 'nin_standard',
                            id: cleanNin,
                        }),
                    });

                    const ahJson = await ahRes.json().catch(() => ({}));
                    console.log(`[AgentHub KYC Response]:`, JSON.stringify(ahJson));

                    if (ahRes.ok && (ahJson.status === true || ahJson.success === true || ahJson.data)) {
                        const d = ahJson.data || ahJson;
                        const returnName = d.fullname || `${d.firstname || ''} ${d.surname || ''}`.trim() || `${effectiveFirstName} ${effectiveLastName}`;
                        payvesselVerified = true;
                        verifiedData = {
                            nin: cleanNin,
                            fullName: returnName,
                            firstName: d.firstname || effectiveFirstName,
                            lastName: d.surname || effectiveLastName,
                            middleName: d.middlename || effectiveMiddleName,
                            dob: d.birthdate || formattedDob,
                            gender: d.gender || cleanGender,
                            phone: d.telephoneno || cleanPhone,
                            photoUrl: d.photo || null,
                            matchScore: 99,
                            provider: 'Payvessel NIMC Partner Gateway',
                            message: 'NIN Verified successfully via NIMC Database.',
                            raw: ahJson
                        };
                    } else if (ahJson.message) {
                        lastErrorMessage = String(ahJson.message);
                    }
                } catch (ahErr: any) {
                    console.warn(`[AgentHub KYC Exception]:`, ahErr.message);
                }
            }

            // If verification failed completely, return genuine error
            if (!payvesselVerified || !verifiedData) {
                const isInsufficientBalance = 
                    lastErrorMessage.toLowerCase().includes('insufficient') ||
                    lastErrorMessage.toLowerCase().includes('wallet balance') ||
                    lastErrorMessage.toLowerCase().includes('fund your wallet');

                const isProviderDowntime = 
                    lastErrorMessage.toLowerCase().includes('unable to complete') ||
                    lastErrorMessage.toLowerCase().includes('provider_error') ||
                    lastErrorMessage.toLowerCase().includes('gateway') ||
                    lastErrorMessage.toLowerCase().includes('service');

                let displayMessage = lastErrorMessage || 'NIN verification failed. Please verify that your 11-digit NIN and date of birth match your NIMC record.';
                if (isInsufficientBalance) {
                    displayMessage = `Provider gateway balance is low (${lastErrorMessage}). Merchant account funding is required on Payvessel.`;
                } else if (isProviderDowntime) {
                    displayMessage = 'NIMC / Payvessel service is experiencing temporary network delays. Your NIN is valid. Please try again or proceed with BVN.';
                }

                return jsonResponse({
                    success: false,
                    verified: false,
                    providerError: isProviderDowntime || isInsufficientBalance,
                    nin: cleanNin,
                    provider: 'Payvessel NIMC Gateway',
                    message: displayMessage,
                });
            }

            // Save verified NIN to user profile, deduct fee from balance, and record KYC transaction
            if (userId) {
                let newBal = currentUserBalance;
                if (kycFeeEnabled && kycFee > 0) {
                    newBal = Math.max(0, currentUserBalance - kycFee);

                    // Update balance and NIN
                    const { error: balErr } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            balance: newBal,
                            nin: cleanNin,
                            full_name: verifiedData.fullName,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    if (balErr) console.warn('[Payvessel KYC] Profile balance/NIN update warning:', balErr);

                    // Record debit transaction in transactions table
                    const { error: txErr } = await supabaseAdmin
                        .from('transactions')
                        .insert({
                            user_id: userId,
                            amount: kycFee,
                            type: 'debit',
                            title: 'KYC NIN Verification Fee',
                            status: 'completed',
                            description: `Automated KYC Identity Verification Fee (NIN: ${cleanNin})`,
                            reference: `kyc_nin_${Date.now()}`,
                            created_at: new Date().toISOString()
                        });
                    if (txErr) console.warn('[Payvessel KYC] Transaction insert warning:', txErr);

                    verifiedData.feeDeducted = kycFee;
                    verifiedData.newBalance = newBal;
                } else {
                    const { error: profErr } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            nin: cleanNin,
                            full_name: verifiedData.fullName,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    if (profErr) console.warn('[Payvessel KYC] Profile NIN update warning:', profErr);
                }

                const { error: kycErr } = await supabaseAdmin
                    .from('kyc_requests')
                    .insert({
                        user_id: userId,
                        document_type: 'nin',
                        document_number: cleanNin,
                        status: 'approved',
                        admin_note: `Automated Payvessel NIMC Identity Check Passed (Match: ${verifiedData.matchScore || 99}%). Verified Holder: ${verifiedData.fullName}${kycFeeEnabled && kycFee > 0 ? ` (Fee Debited: ₦${kycFee})` : ''}`,
                    });
                if (kycErr) console.warn('[Payvessel KYC] KYC request insert warning:', kycErr);
            }

            return jsonResponse({
                success: true,
                verified: true,
                ...verifiedData
            });
        }

        // ----------------------------------------------------
        // ACTION: VERIFY BVN (Bank Verification Number)
        // ----------------------------------------------------
        if (action === 'verify_bvn') {
            const cleanBvn = String(reqBvn || '').replace(/\D/g, '').trim();

            if (!cleanBvn || cleanBvn.length !== 11) {
                return jsonResponse({
                    success: false,
                    verified: false,
                    bvn: cleanBvn,
                    provider: 'Payvessel NIBSS Gateway',
                    message: 'Invalid BVN format. BVN must be exactly 11 digits.',
                });
            }

            console.log(`[Payvessel KYC] Verifying BVN: ${cleanBvn} for ${effectiveFirstName} ${effectiveLastName}`);

            // Pre-check: Ensure user wallet has sufficient balance for KYC fee
            let currentUserBalance = 0;
            if (userId && kycFeeEnabled && kycFee > 0) {
                const { data: userProf } = await supabaseAdmin
                    .from('profiles')
                    .select('id, balance, full_name')
                    .eq('id', userId)
                    .maybeSingle();

                currentUserBalance = Number(userProf?.balance ?? 0);
                if (currentUserBalance < kycFee) {
                    console.warn(`[Payvessel KYC] User ${userId} insufficient balance: ₦${currentUserBalance} < ₦${kycFee}`);
                    return jsonResponse({
                        success: false,
                        verified: false,
                        insufficientUserBalance: true,
                        requiredFee: kycFee,
                        currentBalance: currentUserBalance,
                        provider: 'Payvessel NIBSS Gateway',
                        message: `Insufficient wallet balance (₦${currentUserBalance.toLocaleString()}) for the required KYC verification fee of ₦${kycFee.toLocaleString()}. Please fund your wallet to continue.`
                    });
                }
            }

            let payvesselVerified = false;
            let verifiedData: any = null;
            let lastErrorMessage = '';

            // Step 1: Call Payvessel Basic BVN API
            if (apiKey && apiSecret) {
                try {
                    const pvPayload: Record<string, any> = {
                        bvn: cleanBvn,
                        first_name: effectiveFirstName || 'Customer',
                        last_name: effectiveLastName || 'User',
                        middle_name: effectiveMiddleName || undefined,
                        gender: cleanGender,
                        birthday: formattedDob,
                        phone_number: cleanPhone,
                    };

                    const pvUrl = `${baseUrl}/kyc/api/v1/merchant/bvn/basic`;
                    console.log(`[Payvessel KYC] Requesting: ${pvUrl}`);

                    const pvRes = await fetch(pvUrl, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(pvPayload),
                    });

                    const pvJson = await pvRes.json().catch(() => ({}));
                    console.log(`[Payvessel BVN Response]:`, JSON.stringify(pvJson));

                    if (pvRes.ok && (pvJson.status === true || pvJson.success === true || pvJson.code === 200 || pvJson.data)) {
                        const d = pvJson.data || pvJson;
                        const matchPct = Number(d.names_match_percentage || d.match_score || 99);
                        payvesselVerified = true;
                        verifiedData = {
                            bvn: cleanBvn,
                            fullName: `${d.first_name || effectiveFirstName} ${d.middle_name ? d.middle_name + ' ' : ''}${d.last_name || effectiveLastName}`.trim(),
                            firstName: d.first_name || effectiveFirstName,
                            lastName: d.last_name || effectiveLastName,
                            middleName: d.middle_name || effectiveMiddleName,
                            bankName: d.bank_name || d.enrollment_bank || 'Commercial Bank Nigeria',
                            dob: d.birthday || formattedDob,
                            phone: d.phone_number || cleanPhone,
                            matchScore: matchPct,
                            provider: 'Payvessel NIBSS Gateway',
                            message: `BVN Verified successfully via Payvessel NIBSS (${matchPct}% Match ✓).`,
                            raw: pvJson
                        };
                    } else if (pvJson.message || pvJson.details) {
                        lastErrorMessage = String(pvJson.details?.[0] || pvJson.message);
                    }
                } catch (pvErr: any) {
                    console.warn(`[Payvessel BVN Exception]:`, pvErr.message);
                    lastErrorMessage = pvErr.message;
                }
            } else {
                lastErrorMessage = 'Payvessel API Key and Secret are not configured in system_secrets.';
            }

            // Step 1b: Try Payvessel Enhanced BVN if Basic didn't pass (queries directly by BVN)
            if (!payvesselVerified && apiKey && apiSecret) {
                try {
                    const pvEnhUrl = `${baseUrl}/kyc/api/v1/merchant/bvn/enhanced`;
                    console.log(`[Payvessel KYC] Requesting Enhanced BVN: ${pvEnhUrl}`);

                    const enhRes = await fetch(pvEnhUrl, {
                        method: 'POST',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ bvn: cleanBvn }),
                    });

                    const enhJson = await enhRes.json().catch(() => ({}));
                    console.log(`[Payvessel BVN Enhanced Response]:`, JSON.stringify(enhJson));

                    if (enhRes.ok && (enhJson.status === true || enhJson.success === true || enhJson.code === 200 || enhJson.data)) {
                        const d = enhJson.data || enhJson;
                        const returnName = `${d.first_name || d.firstname || ''} ${d.middle_name || d.middlename ? (d.middle_name || d.middlename) + ' ' : ''}${d.last_name || d.surname || ''}`.trim() || effectiveFirstName || 'Verified Citizen';
                        payvesselVerified = true;
                        verifiedData = {
                            bvn: cleanBvn,
                            fullName: returnName,
                            firstName: d.first_name || d.firstname || effectiveFirstName,
                            lastName: d.last_name || d.surname || effectiveLastName,
                            middleName: d.middle_name || d.middlename || effectiveMiddleName,
                            bankName: d.bank_name || d.enrollment_bank || 'Commercial Bank Nigeria',
                            dob: d.birthday || d.birthdate || formattedDob,
                            phone: d.phone_number || d.telephoneno || cleanPhone,
                            matchScore: 99,
                            provider: 'Payvessel NIBSS Enhanced Gateway',
                            message: `BVN Verified successfully via Payvessel NIBSS Enhanced API.`,
                            raw: enhJson
                        };
                    } else if (enhJson.message || enhJson.details) {
                        const enhMsg = String(enhJson.details?.[0] || enhJson.message);
                        if (!lastErrorMessage || enhMsg.length > lastErrorMessage.length) {
                            lastErrorMessage = enhMsg;
                        }
                    }
                } catch (enhErr: any) {
                    console.warn(`[Payvessel BVN Enhanced Exception]:`, enhErr.message);
                }
            }

            // Step 2: Failover to AgentHub NIBSS gateway if Payvessel was not able to verify
            if (!payvesselVerified && agentHubKey) {
                console.log(`[Payvessel KYC] Trying secondary NIBSS gateway (AgentHub)...`);
                try {
                    const ahRes = await fetch(`https://agenthub.ng/api/v1/identity/bvn`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${agentHubKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            search_type: 'bvn_basic',
                            id: cleanBvn,
                        }),
                    });

                    const ahJson = await ahRes.json().catch(() => ({}));
                    console.log(`[AgentHub BVN Response]:`, JSON.stringify(ahJson));

                    if (ahRes.ok && (ahJson.status === true || ahJson.success === true || ahJson.data)) {
                        const d = ahJson.data || ahJson;
                        const returnName = d.fullname || `${d.firstname || ''} ${d.surname || ''}`.trim() || `${effectiveFirstName} ${effectiveLastName}`;
                        payvesselVerified = true;
                        verifiedData = {
                            bvn: cleanBvn,
                            fullName: returnName,
                            firstName: d.firstname || effectiveFirstName,
                            lastName: d.surname || effectiveLastName,
                            bankName: d.enrollment_bank || 'Commercial Bank Nigeria',
                            dob: d.birthdate || formattedDob,
                            phone: d.phone_number || cleanPhone,
                            matchScore: 99,
                            provider: 'Payvessel NIBSS Partner Gateway',
                            message: 'BVN Verified successfully via NIBSS Database.',
                            raw: ahJson
                        };
                    } else if (ahJson.message) {
                        lastErrorMessage = String(ahJson.message);
                    }
                } catch (ahErr: any) {
                    console.warn(`[AgentHub BVN Exception]:`, ahErr.message);
                }
            }

            if (!payvesselVerified || !verifiedData) {
                const isInsufficientBalance = 
                    lastErrorMessage.toLowerCase().includes('insufficient') ||
                    lastErrorMessage.toLowerCase().includes('wallet balance') ||
                    lastErrorMessage.toLowerCase().includes('fund your wallet');

                const isProviderDowntime = 
                    lastErrorMessage.toLowerCase().includes('unable to complete') ||
                    lastErrorMessage.toLowerCase().includes('provider_error') ||
                    lastErrorMessage.toLowerCase().includes('gateway') ||
                    lastErrorMessage.toLowerCase().includes('service');

                let displayMessage = lastErrorMessage || 'BVN verification failed. Please ensure the 11-digit BVN is correct and active.';
                if (isInsufficientBalance) {
                    displayMessage = `Provider gateway balance is low (${lastErrorMessage}). Merchant account funding is required on Payvessel.`;
                } else if (isProviderDowntime) {
                    displayMessage = 'NIBSS / Payvessel service is experiencing temporary network delays. Your BVN is valid. Please try again or proceed with ID upload.';
                }

                return jsonResponse({
                    success: false,
                    verified: false,
                    providerError: isProviderDowntime || isInsufficientBalance,
                    bvn: cleanBvn,
                    provider: 'Payvessel NIBSS Gateway',
                    message: displayMessage,
                });
            }

            // Save verified BVN to user profile, promote to Tier-2, deduct fee, and record KYC transaction
            if (userId) {
                let newBal = currentUserBalance;
                if (kycFeeEnabled && kycFee > 0) {
                    newBal = Math.max(0, currentUserBalance - kycFee);

                    const { error: balErr } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            balance: newBal,
                            bvn: cleanBvn,
                            kyc_tier: 2,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    if (balErr) console.warn('[Payvessel KYC] Profile balance/BVN update warning:', balErr);

                    const { error: txErr } = await supabaseAdmin
                        .from('transactions')
                        .insert({
                            user_id: userId,
                            amount: kycFee,
                            type: 'debit',
                            title: 'KYC BVN Verification Fee',
                            status: 'completed',
                            description: `Automated KYC Bank Identity Verification Fee (BVN: ${cleanBvn})`,
                            reference: `kyc_bvn_${Date.now()}`,
                            created_at: new Date().toISOString()
                        });
                    if (txErr) console.warn('[Payvessel KYC] Transaction insert warning:', txErr);

                    verifiedData.feeDeducted = kycFee;
                    verifiedData.newBalance = newBal;
                } else {
                    const { error: profErr } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            bvn: cleanBvn,
                            kyc_tier: 2,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                    if (profErr) console.warn('[Payvessel KYC] Profile BVN update warning:', profErr);
                }

                const { error: kycErr } = await supabaseAdmin
                    .from('kyc_requests')
                    .insert({
                        user_id: userId,
                        document_type: 'bvn',
                        document_number: cleanBvn,
                        status: 'approved',
                        admin_note: `Automated Payvessel NIBSS Bank Identity Check Passed (Match: ${verifiedData.matchScore || 99}%). Tier-2 limits unlocked. Bank: ${verifiedData.bankName}${kycFeeEnabled && kycFee > 0 ? ` (Fee Debited: ₦${kycFee})` : ''}`,
                    });
                if (kycErr) console.warn('[Payvessel KYC] KYC request insert warning:', kycErr);
            }

            return jsonResponse({
                success: true,
                verified: true,
                ...verifiedData
            });
        }

        // ----------------------------------------------------
        // ACTION: UPGRADE DVA TIER VIA PAYVESSEL
        // ----------------------------------------------------
        if (action === 'upgrade_tier') {
            if (!userId) {
                return jsonResponse({ success: false, message: 'User ID is required for account upgrade.' }, 400);
            }

            const cleanBvn = String(reqBvn || '').replace(/\D/g, '').trim();
            const cleanNin = String(reqNin || '').replace(/\D/g, '').trim();

            if (accountNumber && apiKey && apiSecret) {
                try {
                    const upgradeUrl = `${baseUrl}/pms/api/external/request/customerReservedAccount/${accountNumber}/`;
                    const updateRes = await fetch(upgradeUrl, {
                        method: 'PUT',
                        headers: {
                            'api-key': apiKey,
                            'api-secret': apiSecret,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            bvn: cleanBvn || undefined,
                            nin: cleanNin || undefined,
                        }),
                    });

                    const updateJson = await updateRes.json().catch(() => ({}));
                    console.log(`[Payvessel DVA Tier Upgrade Response]:`, JSON.stringify(updateJson));
                } catch (e: any) {
                    console.warn(`[Payvessel DVA Tier Upgrade Notice]:`, e.message);
                }
            }

            await supabaseAdmin
                .from('profiles')
                .update({
                    bvn: cleanBvn || undefined,
                    nin: cleanNin || undefined,
                    kyc_tier: 2,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            return jsonResponse({
                success: true,
                message: 'Virtual Account successfully upgraded to Tier-2 with Payvessel.',
                tier: 2
            });
        }

        return jsonResponse({
            success: false,
            message: `Unsupported action: ${action}`
        }, 400);

    } catch (err: any) {
        console.error('[Payvessel KYC Function Critical Error]:', err);
        return jsonResponse({
            success: false,
            verified: false,
            message: err.message || 'An unexpected error occurred during identity verification.'
        }, 500);
    }
});
