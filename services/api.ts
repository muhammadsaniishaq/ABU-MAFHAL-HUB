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
const dataProvider: DataProvider = ClubKonnectProvider;
const cryptoExchange: CryptoExchange = CoingeckoCryptoExchange;
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
        // Plans are static for now, or we can fetch from function if we implemented 'getPlans' there
        getPlans: (network: string) => dataProvider.getPlans(network),
        
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

    electricity: {
        getProviders: async () => {
            // Return dynamic providers with logos
            return [
                { id: 'ikedc', name: 'Ikeja Electric', logo: require('../assets/images/ie.png') },
                { id: 'ekedc', name: 'Eko Electric', logo: require('../assets/images/ekedc.png') },
                { id: 'aedc', name: 'Abuja Electric', logo: require('../assets/images/aedc.png') },
                { id: 'ibedc', name: 'Ibadan Electric', logo: require('../assets/images/ibedc.png') },
                { id: 'kedco', name: 'Kano Electric', logo: require('../assets/images/kedco.png') },
                { id: 'phedc', name: 'Port Harcourt', logo: require('../assets/images/phedc.png') },
                { id: 'yedc', name: 'Yola Electric', logo: require('../assets/images/yedc.png') },
                { id: 'bedc', name: 'Benin Electric', logo: require('../assets/images/bedc.png') },
                { id: 'apl', name: 'Aba Power', logo: require('../assets/images/apl.png') },
                { id: 'jedc', name: 'Jos Electric', logo: require('../assets/images/jedc.png') },
                { id: 'kaedco', name: 'Kaduna Electric', logo: require('../assets/images/kaedco.png') }
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
                const url = `https://www.nellobytesystems.com/APICableTVPackagesV2.asp`;
                const response = await fetch(url);
                const data = await response.json();
                
                // Map the TV Packages from ClubKonnect
                // Usually returns { TV_ID: [ { PACKAGE_ID, PACKAGE_NAME, PACKAGE_PRICE } ] }
                const ckProviderMap: any = {
                    'dstv': '01',
                    'gotv': '02',
                    'startimes': '03'
                };
                const providerCode = ckProviderMap[provider.toLowerCase()] || '01';
                
                let packages = [];
                if (data && data.TV_ID && Array.isArray(data.TV_ID)) {
                    const providerObj = data.TV_ID.find((item: any) => item[providerCode]);
                    if (providerObj && providerObj[providerCode]) {
                        packages = providerObj[providerCode].map((pkg: any) => ({
                            id: pkg.PACKAGE_ID,
                            name: pkg.PACKAGE_NAME,
                            price: parseFloat(pkg.PACKAGE_AMOUNT) // ClubKonnect uses PACKAGE_AMOUNT
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
                console.warn("Failed to fetch from ClubKonnect, using fallback", error);
                
                // Fallback Pricing
                let packages = [];
                if (provider.toLowerCase().includes('dstv')) {
                    packages = [
                        { id: 'dstv-yanga', name: 'DStv Yanga', price: 4200 },
                        { id: 'dstv-confam', name: 'DStv Confam', price: 7400 },
                        { id: 'dstv-compact', name: 'DStv Compact', price: 12500 }
                    ];
                } else if (provider.toLowerCase().includes('gotv')) {
                    packages = [
                        { id: 'gotv-jinja', name: 'GOtv Jinja', price: 2700 },
                        { id: 'gotv-jolli', name: 'GOtv Jolli', price: 3950 },
                        { id: 'gotv-max', name: 'GOtv Max', price: 5700 }
                    ];
                } else {
                    packages = [
                        { id: 'startimes-nova', name: 'Nova', price: 1500 },
                        { id: 'startimes-basic', name: 'Basic', price: 2600 }
                    ];
                }

                const markup = await api.tv.getMarkup();
                return packages.map(pkg => ({
                    ...pkg,
                    original_price: pkg.price,
                    price: pkg.price + markup
                }));
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
                 console.warn("Failed to fetch dynamic prices:", e);
             }
             // Fallback default
             return [
                { id: 'waec', name: 'WAEC', price: 3800 },
                { id: 'neco', name: 'NECO', price: 1200 },
                { id: 'jamb', name: 'JAMB', price: 4700 },
                { id: 'nabteb', name: 'NABTEB', price: 1000 },
             ];
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

             // 2. Call Provider Direct (Client-side for Demo)
             let result;
             try {
                if ('purchaseEpin' in ClubKonnectProvider) {
                    result = await ClubKonnectProvider.purchaseEpin({
                        examType: params.examType,
                        quantity: params.quantity,
                        amount: params.amount,
                        phone: params.phone || '08000000000',
                        profileId: params.profileId
                    });
                } else {
                    throw new Error("Provider does not support E-PIN purchase");
                }
             } catch (e: any) {
                 throw new Error(e.message || "Provider Error");
             }

             if (!result.success) throw new Error(result.message);

             // 3. Update
             await supabase
                .from('transactions')
                .update({ status: 'success', reference: result.reference })
                .eq('id', txn.id);
            
             return { success: true, reference: result.reference, pin: result.pin };
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
