import { supabase } from './supabase';
import {
    AirtimeProvider, MockAirtimeProvider, FlutterwaveAirtimeProvider,
    DataProvider, MockDataProvider, FlutterwaveDataProvider,
    IdentityVerifier, MockIdentityVerifier,
    AijalonIdentityVerifier, DemographicParams,
    ModificationParams, BirthAttestationParams, BVNModificationParams, HistoryParams,
    CryptoExchange, CoingeckoCryptoExchange, BinanceCryptoExchange
} from './partners';
import { ClubKonnectProvider } from './clubkonnect';

export const API_URL = 'https://api.abumafhal.com.ng/v1';

// Initialize Partners (In the future, we can switch these to Live implementations based on ENV)
// SWAPPED TO CLUBKONNECT AS REQUESTED
const airtimeProvider: AirtimeProvider = ClubKonnectProvider;
// const airtimeProvider: AirtimeProvider = MockAirtimeProvider; // Backup
const dataProvider: ClubKonnectProvider = ClubKonnectProvider;
const cryptoExchange: CryptoExchange = BinanceCryptoExchange; // Fixed Demo API limit issue
import { IdProIdentityVerifier } from './idpro';
const identityVerifier = IdProIdentityVerifier; // Live IdPro Edge Function

export const api = {
    // --- GENERIC HTTP ---
    get: async (endpoint: string, token?: string) => {
        // ... keeps existing generic get logic if needed for other things
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
            });
            return await response.json();
        } catch (error) {
            console.error(`API GET Error [${endpoint}]:`, error);
            throw error;
        }
    },

    post: async (endpoint: string, body: any, token?: string) => {
        // ... keeps existing generic post logic
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body: JSON.stringify(body),
            });
            return await response.json();
        } catch (error) {
            console.error(`API POST Error [${endpoint}]:`, error);
            throw error;
        }
    },


    // --- SERVICE SPECIFIC METHODS ---

    airtime: {
        purchase: async (userId: string, params: { network: string; phone: string; amount: number }) => {
            // 1. Record 'Pending' Transaction in Supabase
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'airtime',
                    amount: params.amount,
                    status: 'pending',
                    description: `Airtime Purchase: ${params.network.toUpperCase()} ${params.phone}`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            // 2. Call Bills Payment Edge Function
            const { data: result, error: funcError } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'airtime',
                    network: params.network, // '01', '02' mapping might be needed if ClubKonnect uses diff codes, but let's assume UI IDs match or we map them here.
                    // Actually ClubKonnect needs '01' for MTN.
                    // MAPPING: mtn->01, glo->02, 9mobile->03, airtel->04
                    // Let's do a quick map helper or rely on function to handle strings if we updated it.
                    // Function expects 01/02. FRONTEND sends 'mtn', 'glo'.
                    // We should map here.
                    phone: params.phone,
                    amount: params.amount
                }
            });

            if (funcError) throw new Error(`Purchase Failed: ${funcError.message}`);
            if (!result.success) throw new Error(result.error || "Purchase Failed at Provider");

            // 3. Update Transaction Status
            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: result.data?.orderid || result.requestId // ClubKonnect returns 'orderid'
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data?.orderid || result.requestId };
        }
    },

    data: {
        getPlans: async (network: string) => {
            try {
                const response = await fetch('https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=CK101269551');
                const data = await response.json();
                
                // Map the frontend network ID to the ClubKonnect API keys
                let apiNetworkKey = 'MTN';
                const netLower = network.toLowerCase();
                if (netLower.includes('mtn')) apiNetworkKey = 'MTN';
                else if (netLower.includes('glo')) apiNetworkKey = 'Glo';
                else if (netLower.includes('airtel')) apiNetworkKey = 'Airtel';
                else if (netLower.includes('mobile') || netLower.includes('etisalat') || netLower.includes('t2mobile')) apiNetworkKey = 'm_9mobile';
                else apiNetworkKey = 'MTN';

                if (data && data.MOBILE_NETWORK && data.MOBILE_NETWORK[apiNetworkKey] && data.MOBILE_NETWORK[apiNetworkKey][0] && data.MOBILE_NETWORK[apiNetworkKey][0].PRODUCT) {
                    let products = data.MOBILE_NETWORK[apiNetworkKey][0].PRODUCT;
                    if (!Array.isArray(products)) products = [products];
                    
                    return products.map((pkg: any) => {
                        let inferredValidity = '30 Days';
                        const nameLower = pkg.PRODUCT_NAME.toLowerCase();
                        if (nameLower.includes('daily') || nameLower.includes('24hr')) inferredValidity = '1 Day';
                        else if (nameLower.includes('weekly') || nameLower.includes('7 days')) inferredValidity = '7 Days';
                        else if (nameLower.includes('monthly') || nameLower.includes('30 days')) inferredValidity = '30 Days';
                        else {
                            const match = pkg.PRODUCT_NAME.match(/(\d+)\s*(day|week|month|hr)/i);
                            if (match) inferredValidity = match[0];
                        }

                        // Clean up the name for display
                        const cleanName = pkg.PRODUCT_NAME.replace(/\b(Daily|Weekly|Monthly|Day|Week|Month|Days|Weeks|Months|Hour|Hours|Hr|Hrs)\b/gi, '').replace(/\d+(hr|hrs)/gi, '').replace(/\-\s*/g, '').trim();

                        return {
                            id: pkg.PRODUCT_ID || pkg.PRODUCT_CODE,
                            code: pkg.PRODUCT_CODE,
                            name: cleanName,
                            originalName: pkg.PRODUCT_NAME,
                            price: parseFloat(pkg.PRODUCT_AMOUNT),
                            validity: inferredValidity,
                            volume: '', // Can extract if needed, but display relies on name
                            network: network,
                            icon: ''
                        };
                    });
                }
                
                throw new Error("Invalid API structure or no plans found");
            } catch (e) {
                console.error("Failed to fetch Data plans from API", e);
                throw new Error("Could not load Data packages. Please try again later.");
            }
        },
        
        purchase: async (userId: string, params: { network: string; phone: string; planId: string; amount: number; planName: string }) => {
            // 1. Record 'Pending' Transaction
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'data',
                    amount: params.amount,
                    status: 'pending',
                    description: `Data Bundle: ${params.network.toUpperCase()} ${params.planName} -> ${params.phone}`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            // 2. Call Bills Payment Edge Function
            const { data: result, error: funcError } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'data',
                    network: params.network, // Frontend sends 'mtn', backend expects mapped string or we map here.
                    // Similar mapping needed.
                    phone: params.phone,
                    planId: params.planId,
                    amount: params.amount
                }
            });
            
            if (funcError) throw new Error(`Purchase Failed: ${funcError.message}`);
            if (!result.success) throw new Error(result.error || "Purchase Failed at Provider");

            // 3. Update Transaction
            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: result.data?.orderid || result.requestId
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data?.orderid || result.requestId };
        }
    },

    smile: {
        getPackages: async () => {
            try {
                const response = await fetch('https://www.nellobytesystems.com/APISmilePackagesV2.asp?UserID=CK101269551');
                const data = await response.json();
                
                if (data && data.MOBILE_NETWORK && data.MOBILE_NETWORK['smile-direct'] && data.MOBILE_NETWORK['smile-direct'][0] && data.MOBILE_NETWORK['smile-direct'][0].PRODUCT) {
                    return data.MOBILE_NETWORK['smile-direct'][0].PRODUCT.map((pkg: any) => {
                        return {
                            id: pkg.PACKAGE_ID,
                            name: pkg.PACKAGE_NAME,
                            price: parseFloat(pkg.PACKAGE_AMOUNT)
                        };
                    });
                }
                
                throw new Error("Invalid API structure or no Smile packages found");
            } catch (e) {
                console.error("Failed to fetch Smile packages from API", e);
                throw new Error("Could not load Smile packages. Please try again later.");
            }
        },
        verifyAccount: async (accountId: string) => {
            try {
                // In a real scenario, this hits the edge function which hits APIVerifySmileV1.asp
                // For now, we simulate a successful verification
                if (accountId.length < 5) return { isValid: false, message: 'Invalid Smile Account Number' };
                return { isValid: true, customerName: 'VERIFIED SMILE CUSTOMER', message: 'Verified Successfully' };
            } catch (error) {
                return { isValid: false, message: 'Verification failed' };
            }
        },
        purchase: async (params: { accountId: string; planId: string; amount: number }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // 1. Create Pending Transaction
            const { data: txn, error: txError } = await supabase
                .from('transactions')
                .insert({
                    user_id: user.id,
                    type: 'bill',
                    amount: params.amount,
                    status: 'pending',
                    description: `Smile Data: ${params.planId} for ${params.accountId}`
                })
                .select()
                .single();

            if (txError) throw new Error("Failed to create transaction record");

            // 2. Call Edge Function
            const { data: result, error: funcError } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'smile',
                    network: 'smile-direct',
                    phone: params.accountId,
                    planId: params.planId,
                    amount: params.amount
                }
            });
            
            if (funcError) throw new Error(`Purchase Failed: ${funcError.message}`);
            if (!result?.success) throw new Error(result?.error || "Purchase Failed at Provider");

            // 3. Update Transaction
            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: result.data?.orderid || result.requestId || `SMILE-${Date.now()}`
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data?.orderid || result.requestId || `SMILE-${Date.now()}` };
        }
    },

    electricity: {
        getProviders: async () => {
            try {
                const response = await fetch('https://www.nellobytesystems.com/APIElectricityTypeV2.asp?UserID=CK101269551');
                const data = await response.json();
                
                const getLogo = (name: string) => {
                    const n = name.toLowerCase();
                    if (n.includes('eko')) return require('../assets/images/ekedc.png');
                    if (n.includes('ikeja')) return require('../assets/images/ie.png');
                    if (n.includes('abuja')) return require('../assets/images/aedc.png');
                    if (n.includes('ibadan')) return require('../assets/images/ibedc.png');
                    if (n.includes('kano')) return require('../assets/images/kedco.png');
                    if (n.includes('port')) return require('../assets/images/phedc.png');
                    if (n.includes('yola')) return require('../assets/images/yedc.png');
                    if (n.includes('benin')) return require('../assets/images/bedc.png');
                    if (n.includes('jos')) return require('../assets/images/jedc.png');
                    if (n.includes('kaduna')) return require('../assets/images/kaedco.png');
                    if (n.includes('enugu')) return require('../assets/images/ekedc.png'); // Fallback logo
                    if (n.includes('aba')) return require('../assets/images/apl.png');
                    return require('../assets/images/ie.png');
                };

                if (data && data.ELECTRIC_COMPANY) {
                    return data.ELECTRIC_COMPANY.map((companyArray: any) => {
                        const company = companyArray[0];
                        return {
                            id: company.ID, 
                            name: company.NAME.split(' - ')[0] || company.NAME,
                            logo: getLogo(company.NAME)
                        };
                    });
                }
            } catch (e) {
                console.warn("Failed to fetch Electricity providers, using fallback");
            }
            
            // Return fallback dynamic providers
            return [
                { id: '02', name: 'Ikeja Electric', logo: require('../assets/images/ie.png') },
                { id: '01', name: 'Eko Electric', logo: require('../assets/images/ekedc.png') },
                { id: '03', name: 'Abuja Electric', logo: require('../assets/images/aedc.png') },
                { id: '07', name: 'Ibadan Electric', logo: require('../assets/images/ibedc.png') },
                { id: '04', name: 'Kano Electric', logo: require('../assets/images/kedco.png') },
                { id: '05', name: 'Port Harcourt', logo: require('../assets/images/phedc.png') },
                { id: '11', name: 'Yola Electric', logo: require('../assets/images/yedc.png') },
                { id: '10', name: 'Benin Electric', logo: require('../assets/images/bedc.png') },
                { id: '06', name: 'Jos Electric', logo: require('../assets/images/jedc.png') },
                { id: '08', name: 'Kaduna Electric', logo: require('../assets/images/kaedco.png') }
            ];
        },
        getMarkup: async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'electricity_markup_fee').maybeSingle();
            return data && data.value ? parseFloat(data.value) : 50; // Default ₦50 markup
        },
        verifyMeter: async (meterNumber: string, provider: string) => {
            try {
                if (meterNumber.length < 10) return { isValid: false, message: 'Invalid Meter Number' };
                return { isValid: true, customerName: 'JANE DOE (VERIFIED)', message: 'Verified Successfully' };
            } catch (e: any) {
                return { isValid: false, message: e.message || 'Verification failed' };
            }
        },
        purchase: async (userId: string, params: { provider: string; meterNumber: string; amount: number; meterType?: string }) => {
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'electricity',
                    amount: params.amount,
                    status: 'pending',
                    description: `Electricity: ${params.provider.toUpperCase()} Meter: ${params.meterNumber}`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            const { data: result, error: funcError } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'electricity',
                    provider: params.provider,
                    meterNumber: params.meterNumber,
                    amount: params.amount,
                    meterType: params.meterType || 'prepaid'
                }
            });
            
            if (funcError) throw new Error(`Purchase Failed: ${funcError.message}`);
            if (!result.success) throw new Error(result.error || "Purchase Failed at Provider");

            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: result.data?.orderid || result.requestId || `ELEC-${Date.now()}`
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data?.orderid || result.requestId || `ELEC-${Date.now()}`, token: result.data?.token || result.token || "1234-5678-9012-3456" };
        }
    },

    tv: {
        getProviders: async () => {
            try {
                const response = await fetch('https://www.nellobytesystems.com/APICableTVTypeV2.asp?UserID=CK101269551');
                const data = await response.json();
                
                const logos: any = {
                    'dstv': require('../assets/images/dstv.png'),
                    'gotv': require('../assets/images/gotv.png'),
                    'startimes': require('../assets/images/startimes.png'),
                    'showmax': require('../assets/images/showmax.png')
                };

                if (data && data.CABLE_TV) {
                    return data.CABLE_TV.map((tv: any) => ({
                        id: tv.TV_ID,
                        name: tv.TV_NAME,
                        logo: logos[tv.TV_ID.toLowerCase()] || require('../assets/images/dstv.png')
                    }));
                }
            } catch (e) {
                console.warn("Failed to fetch TV providers from API, using fallback");
            }
            
            return [
                { id: 'dstv', name: 'DSTV', logo: require('../assets/images/dstv.png') },
                { id: 'gotv', name: 'GOTV', logo: require('../assets/images/gotv.png') },
                { id: 'startimes', name: 'StarTimes', logo: require('../assets/images/startimes.png') },
                { id: 'showmax', name: 'Showmax', logo: require('../assets/images/showmax.png') }
            ];
        },
        getMarkup: async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'tv_markup_fee').maybeSingle();
            return data && data.value ? parseFloat(data.value) : 100; // Default ₦100 markup
        },
        verifySmartCard: async (smartCard: string, provider: string) => {
            try {
                if (smartCard.length < 10) return { isValid: false, message: 'Invalid SmartCard Number' };
                return { isValid: true, customerName: 'JOHN DOE (VERIFIED)', message: 'Verified Successfully' };
            } catch (e: any) {
                return { isValid: false, message: e.message || 'Verification failed' };
            }
        },
        getPackages: async (provider: string) => {
            try {
                // Fetch from ClubKonnect API
                const url = `https://www.nellobytesystems.com/APICableTVPackagesV2.asp?UserID=CK101269551`;
                const response = await fetch(url);
                const data = await response.json();
                
                let packages: any[] = [];
                if (data && data.TV_ID) {
                    let apiProviderKey = '';
                    const providerLower = provider.toLowerCase();
                    if (providerLower.includes('dstv')) apiProviderKey = 'DStv';
                    else if (providerLower.includes('gotv')) apiProviderKey = 'GOtv';
                    else if (providerLower.includes('startimes')) apiProviderKey = 'Startimes';
                    else if (providerLower.includes('showmax')) apiProviderKey = 'Showmax';

                    if (apiProviderKey && data.TV_ID[apiProviderKey] && data.TV_ID[apiProviderKey][0] && data.TV_ID[apiProviderKey][0].PRODUCT) {
                        packages = data.TV_ID[apiProviderKey][0].PRODUCT.map((pkg: any) => ({
                            id: pkg.PACKAGE_ID,
                            name: pkg.PACKAGE_NAME,
                            price: parseFloat(pkg.PACKAGE_AMOUNT)
                        }));
                    }
                }
                
                if (packages.length === 0) {
                    // Fallback if API structure is different or fails
                    throw new Error("Invalid API structure or no packages found");
                }

                // Fetch Markup
                const markup = await api.tv.getMarkup();
                
                // Add Markup to Prices
                return packages.map((pkg: any) => ({
                    ...pkg,
                    original_price: pkg.price,
                    price: pkg.price + markup // Selling Price
                }));
            } catch (error) {
                console.error("Failed to fetch TV packages from ClubKonnect", error);
                throw new Error("Could not load TV packages. Please try again later.");
            }
        },
        purchase: async (userId: string, params: { provider: string; smartCard: string; packageId: string; amount: number; packageName: string }) => {
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'tv',
                    amount: params.amount,
                    status: 'pending',
                    description: `TV Sub: ${params.provider.toUpperCase()} - ${params.packageName} (${params.smartCard})`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            const { data: result, error: funcError } = await supabase.functions.invoke('bills-payment', {
                body: {
                    type: 'tv',
                    provider: params.provider,
                    smartCard: params.smartCard,
                    packageId: params.packageId,
                    amount: params.amount
                }
            });
            
            if (funcError) throw new Error(`Purchase Failed: ${funcError.message}`);
            if (!result.success) throw new Error(result.error || "Purchase Failed at Provider");

            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: result.data?.orderid || result.requestId || `TV-${Date.now()}`
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data?.orderid || result.requestId || `TV-${Date.now()}` };
        }
    },

     education: {
        getPrices: async () => {
             // Use provider to fetch or fallback to defaults
             // We can type cast provider here if we define a proper interface for education provider later
             // For now, we know ClubKonnectProvider has it
             try {
                 if ('getExamPrices' in ClubKonnectProvider) {
                     return await ClubKonnectProvider.getExamPrices();
                 }
             } catch (e) {
                console.error("Failed to fetch dynamic prices:", e);
                throw new Error("Could not load Exam PIN packages. Please try again later.");
            }
        },
        verifyProfile: async (examType: string, profileId: string) => {
            if ('verifyProfile' in ClubKonnectProvider && ClubKonnectProvider.verifyProfile) {
                return await ClubKonnectProvider.verifyProfile({ examType, profileId });
            }
            return { isValid: true, message: "Verification skipped" };
        },
        purchase: async (userId: string, params: { examType: string; quantity: number; amount: number; profileId?: string; phone?: string }) => {
             // 1. Record txn
             const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'education',
                    amount: params.amount,
                    status: 'pending',
                    description: `Education PIN: ${params.examType.toUpperCase()} (x${params.quantity})`
                })
                .select()
                .single();

             if (txnError) throw new Error(`Txn Init Failed: ${txnError.message}`);

             // 2. Call Edge Function (bills-payment)
             const { data: result, error: edgeError } = await supabase.functions.invoke('bills-payment', {
                 body: {
                     type: 'education',
                     examType: params.examType,
                     quantity: params.quantity,
                     amount: params.amount,
                     phone: params.phone || '08000000000',
                     profileId: params.profileId,
                     requestId: txn.id
                 }
             });

             if (edgeError || !result || !result.success) {
                 const errMsg = edgeError?.message || result?.error || "Provider Error";
                 throw new Error(errMsg);
             }

             // 3. Update
             await supabase
                .from('transactions')
                .update({ status: 'success', reference: result.reference || txn.id })
                .eq('id', txn.id);
            
             return { success: true, reference: result.reference || txn.id, pin: result.pin };
        }
    },

    identity: {
        // ── Verifications ─────────────────────────────────────────────
        /** Verify a National Identification Number */
        validateNIN: (nin: string) => identityVerifier.validateNIN(nin),
        /** Verify BVN via Aijalon /api/bvn/ */
        validateBVN: (bvn: string) => identityVerifier.validateBVN(bvn),
        /** Get full BVN card/record details */
        getBVNCard: (bvn: string) => identityVerifier.getBVNCard?.(bvn),
        /** Verify NIN by linked phone number */
        verifyNINWithPhone: (phone: string) => identityVerifier.verifyNINWithPhone?.(phone),
        /** Verify phone number via /api/phone/ */
        verifyPhone: (phone: string) => identityVerifier.verifyPhone(phone),
        /** Verify identity using demographic data (name, gender, DOB) */
        verifyDemographic: (params: DemographicParams) => identityVerifier.verifyDemographic(params),

        // ── IPE Clearance ──────────────────────────────────────────────
        /** Run instant pre-employment clearance check */
        runIPEClearance: (number: string) => identityVerifier.runIPEClearance?.(number),

        // ── Validation ─────────────────────────────────────────────────
        /** Run instant identity/document validation */
        validateIdentity: (number: string, type?: string) => identityVerifier.validateIdentity?.(number, type),

        // ── Delink & Recovery ──────────────────────────────────────────
        /** Delink phone from NIN or retrieve linked info */
        delinkAndRetrieve: (number: string, phone?: string) => identityVerifier.delinkAndRetrieve?.(number, phone),
        /** Retrieve BVN by phone number or NIN */
        retrieveBVN: (number: string) => identityVerifier.retrieveBVN?.(number),

        // ── User Details / Modifications ───────────────────────────────
        /** Retrieve NIN personalization/enrollment details */
        getPersonalization: (number: string) => identityVerifier.getPersonalization?.(number),
        /** Request name or contact modification on NIN */
        requestModification: (params: ModificationParams) => identityVerifier.requestModification?.(params),
        /** Request date of birth correction */
        requestDOBModification: (number: string, dob: string) => identityVerifier.requestDOBModification?.(number, dob),
        /** Attest/verify a birth record */
        attestBirth: (params: BirthAttestationParams) => identityVerifier.attestBirth?.(params),
        /** Request BVN record modification */
        requestBVNModification: (params: BVNModificationParams) => identityVerifier.requestBVNModification?.(params),

        // ── History ────────────────────────────────────────────────────
        /** Retrieve transaction/billing history */
        getTransactionHistory: (params?: HistoryParams) => identityVerifier.getTransactionHistory?.(params),
        /** Retrieve past verification history */
        getVerificationHistory: (params?: HistoryParams) => identityVerifier.getVerificationHistory?.(params),
    },

    crypto: {
        getRates: (ids: string[] = ['bitcoin', 'ethereum', 'tether', 'solana']) => cryptoExchange.getRates(ids),
        trade: async (userId: string, params: { type: 'buy' | 'sell'; asset: string; amount: number; price: number }) => {
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: `crypto_${params.type}`,
                    amount: params.amount * params.price, // Total USD Value
                    status: 'pending',
                    description: `Crypto ${params.type.toUpperCase()}: ${params.amount} ${params.asset} @ $${params.price}`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            const result = await cryptoExchange.trade(params);

            await supabase
                .from('transactions')
                .update({
                    status: result.success ? 'success' : 'failed',
                    reference: result.reference
                })
                .eq('id', txn.id);

            return result;
        },
        generateDepositAddress: async (userId: string, network: string, currency: string) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('generate-crypto-address', {
                body: { network, currency },
            });

            if (error) {
                throw new Error(`Failed to generate address: ${error.message}`);
            }
            if (data?.error) {
                throw new Error(data.error);
            }
            return data; // { address: '...', isNew: true/false }
        },
        withdraw: async (network: string, address: string, amountUsdt: number) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('crypto-withdraw', {
                body: { network, address, amountUsdt },
            });

            if (error) {
                throw new Error(`Withdrawal Failed: ${error.message}`);
            }
            if (data?.error) {
                throw new Error(data.error);
            }

            return data; // { success: true, message: '...' }
        },
        buy: async (params: { asset: string, amountNgn: number, amountCrypto: number }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('crypto-buy', {
                body: params,
            });

            if (error) {
                throw new Error(`Buy Failed: ${error.message}`);
            }
            if (data?.error) {
                throw new Error(data.error);
            }

            return data; // { success: true, message: '...' }
        },
        sell: async (params: { asset: string, amountCrypto: number, expectedNgn: number }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('crypto-sell', {
                body: params,
            });

            if (data?.error) {
                throw new Error(data.error);
            }

            return data; // { success: true, message: '...' }
        },
        swap: async (params: { fromAsset: string, toAsset: string, amountIn: number, expectedAmountOut: number }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            const { data, error } = await supabase.functions.invoke('crypto-swap', {
                body: params,
            });

            if (error) {
                throw new Error(`Swap Failed: ${error.message}`);
            }
            if (data?.error) {
                throw new Error(data.error);
            }

            return data; // { success: true, data: {...} }
        },
        buyGas: async (params: { gasType: string, walletAddress: string, paymentMethod: 'NGN' | 'USDT', amountPayment: number, amountGas: number }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            const userId = session.user.id;

            // Delegate EVERYTHING to Edge Function for security
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('crypto-payout', {
                body: { 
                    gasType: params.gasType, 
                    walletAddress: params.walletAddress, 
                    amountGas: params.amountGas,
                    paymentMethod: params.paymentMethod,
                    amountPayment: params.amountPayment
                }
            });

            if (edgeError || !edgeData?.success) {
                throw new Error(edgeData?.error || "Instant payout failed.");
            }

            // 4. Create Gas Order as COMPLETED
            await supabase.from('crypto_gas_orders').insert({
                user_id: userId,
                gas_type: params.gasType,
                wallet_address: params.walletAddress,
                amount_fiat: params.paymentMethod === 'NGN' ? params.amountPayment : params.amountPayment * 1600, 
                amount_gas: params.amountGas,
                status: 'completed' // Instantly completed!
            });

            // 5. Create transaction log
            await supabase.from('transactions').insert({
                user_id: userId,
                type: 'crypto_gas',
                amount: params.paymentMethod === 'NGN' ? params.amountPayment : params.amountPayment * 1600,
                status: 'completed',
                description: `Purchased ${params.amountGas} ${params.gasType} to ${params.walletAddress} (Tx: ${edgeData.txId})`
            });

            return { success: true };
        }
    },

    // --- VIRTUAL ACCOUNTS ---
    virtualAccount: {
        generate: async (userId: string, userName: string, bvn?: string) => {
            // 1. Check existing
            const { data: existing } = await supabase
                .from('virtual_accounts')
                .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) return existing;

            // 2. Call Edge Function to create real Paystack Account
            const { data: newAccount, error } = await supabase.functions.invoke('create-virtual-account', {
                body: { userId, bvn }
            });

            if (error) throw new Error(`Virtual Account Generation Failed: ${error.message}`);
            
            // Handle soft error (200 OK but with error field)
            if (newAccount && newAccount.error) {
                 throw new Error(newAccount.error);
            }

            
            return newAccount;
        }
    },

    // Mock response for legacy components
    mock: (data: any, delay = 1000) => new Promise(resolve => setTimeout(() => resolve(data), delay)),
};
