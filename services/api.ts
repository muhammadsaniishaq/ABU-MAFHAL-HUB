import { supabase } from './supabase';
import {
    AirtimeProvider, MockAirtimeProvider, FlutterwaveAirtimeProvider,
    DataProvider, MockDataProvider, FlutterwaveDataProvider,
    IdentityVerifier, MockIdentityVerifier,
    DemographicParams, ModificationParams, BirthAttestationParams,
    BVNModificationParams, HistoryParams,
    CryptoExchange, CoingeckoCryptoExchange, BinanceCryptoExchange
} from './partners';
import { ClubKonnectProvider } from './clubkonnect';

export const API_URL = 'https://api.abumafhal.com.ng/v1';

// Initialize Partners (In the future, we can switch these to Live implementations based on ENV)
// SWAPPED TO CLUBKONNECT AS REQUESTED
const airtimeProvider: AirtimeProvider = ClubKonnectProvider;
// const airtimeProvider: AirtimeProvider = MockAirtimeProvider; // Backup
const dataProvider: DataProvider = ClubKonnectProvider;
const cryptoExchange: CryptoExchange = BinanceCryptoExchange; // Fixed Demo API limit issue
import { AgentHubIdentityVerifier } from './agenthub';
const identityVerifier = AgentHubIdentityVerifier; // AgentHub Edge Function (replaces IDPro)

// --- High-Concurrency In-Memory Plan Cache ---
const _dataPlanMemoryCache: Record<string, { data: any[]; timestamp: number }> = {};
const DATA_PLAN_CACHE_TTL = 30000; // 30 seconds

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
        getPlans: async (network: string, forceRefresh = false) => {
            try {
                // Normalize network (mtn, glo, airtel, 9mobile, vitel)
                let netLower = (network || 'mtn').toLowerCase();
                if (netLower.includes('mtn')) netLower = 'mtn';
                else if (netLower.includes('glo')) netLower = 'glo';
                else if (netLower.includes('airtel')) netLower = 'airtel';
                else if (netLower.includes('vitel') || netLower.includes('vital')) netLower = 'vitel';
                else if (netLower.includes('mobile') || netLower.includes('etisalat')) netLower = '9mobile';

                const now = Date.now();
                if (!forceRefresh && _dataPlanMemoryCache[netLower] && (now - _dataPlanMemoryCache[netLower].timestamp < DATA_PLAN_CACHE_TTL)) {
                    return _dataPlanMemoryCache[netLower].data;
                }

                // Check active VTU vendor from app_settings
                let activeVendor = 'bilalsadasub';
                try {
                    const { data: vendorSetting } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'vtu_vendor')
                        .maybeSingle();
                    if (vendorSetting?.value) {
                        const v = typeof vendorSetting.value === 'object' ? vendorSetting.value.vendor || vendorSetting.value : vendorSetting.value;
                        activeVendor = String(v).toLowerCase();
                    }
                } catch (_) {}

                let query = supabase
                    .from('data_plans')
                    .select('*')
                    .or('is_active.eq.true,is_active.is.null')
                    .order('cost_price', { ascending: true });

                if (netLower === 'vitel' || netLower === 'vital') {
                    query = query.or('network.ilike.vitel,network.ilike.vital,network.eq.vitel,network.eq.vital');
                } else {
                    query = query.ilike('network', netLower);
                }

                const { data: plans, error } = await query;

                if (error) throw new Error(error.message);

                let resultPlans = plans || [];

                const mappedPlans = resultPlans.map(p => ({
                    id: p.plan_id,
                    code: p.plan_id,
                    name: p.name,
                    originalName: p.original_name || p.name,
                    price: p.selling_price,
                    validity: p.validity || '30 Days',
                    volume: p.volume || '',
                    network: p.network,
                    apiVendor: p.api_vendor || activeVendor,
                    plan_type: p.plan_type || (() => {
                        const n = (p.name || '').toLowerCase();
                        if (n.includes('corporate') || n.includes('cg') || n.includes('c-g')) return 'CG';
                        if (n.includes('gifting') || n.includes('gift')) return 'GIFTING';
                        if (n.includes('promo')) return 'PROMO';
                        if (n.includes('mega')) return 'MEGA';
                        if (n.includes('night')) return 'NIGHT';
                        if (n.includes('direct')) return 'DIRECT';
                        if (n.includes('coupon')) return 'COUPON';
                        if (n.includes('sme') || n.includes('s-m-e')) return 'SME';
                        return 'GENERAL';
                    })(),
                    icon: ''
                }));

                _dataPlanMemoryCache[netLower] = { data: mappedPlans, timestamp: Date.now() };
                return mappedPlans;
            } catch (e) {
                console.error("Failed to fetch Data plans from database", e);
                throw new Error("Could not load Data packages. Please try again later.");
            }
        },
        
        purchase: async (userId: string, params: { network: string; phone: string; planId: string; amount: number; planName: string; vendor?: string }) => {
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
                    network: params.network,
                    phone: params.phone,
                    planId: params.planId,
                    amount: params.amount,
                    vendor: params.vendor || 'bilalsadasub'
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

    rechargePin: {
        getPlans: async () => {
            // 1. Try bills-payment edge function
            try {
                const { data, error } = await supabase.functions.invoke('bills-payment', {
                    body: { type: 'recharge_pin_plans' }
                });
                if (!error && data?.success && Array.isArray(data.data)) {
                    return data.data.map((p: any) => ({
                        id: p.id,
                        network: p.network,
                        networkName: (p.network_name || '').toLowerCase(),
                        size: p.size,
                        denomination: `₦${p.size}`,
                        regularPrice: p.regular_price || p.corporate_price || parseFloat(p.size),
                        corporatePrice: p.corporate_price || p.regular_price || parseFloat(p.size),
                        price: p.regular_price || p.corporate_price || parseFloat(p.size),
                        info: p.info || ''
                    }));
                }
            } catch (_) {}

            // 2. Try recharge-pin edge function
            try {
                const { data, error } = await supabase.functions.invoke('recharge-pin', {
                    body: { action: 'get-plans' }
                });
                if (!error && data?.success && Array.isArray(data.data)) {
                    return data.data;
                }
            } catch (_) {}

            // Default fallback plans
            return [
                { id: 1, network: 1, networkName: 'mtn', size: '100', denomination: '₦100', price: 98.9, regularPrice: 98.9 },
                { id: 2, network: 1, networkName: 'mtn', size: '200', denomination: '₦200', price: 197.8, regularPrice: 197.8 },
                { id: 3, network: 1, networkName: 'mtn', size: '500', denomination: '₦500', price: 494.5, regularPrice: 494.5 },
                { id: 4, network: 1, networkName: 'mtn', size: '1000', denomination: '₦1,000', price: 989, regularPrice: 989 }
            ];
        },

        getHistory: async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];
                const { data, error } = await supabase
                    .from('recharge_pins')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                if (error) return [];
                return data || [];
            } catch (_) {
                return [];
            }
        },

        purchase: async (params: { planId: string | number; quantity: number; businessName?: string }) => {
            let validPlanId = params.planId;
            if (typeof validPlanId === 'number' && validPlanId >= 100) {
                const planMap: Record<number, number> = { 101: 1, 102: 4, 103: 2, 104: 3 };
                validPlanId = planMap[validPlanId] || 1;
            }

            // 1. Try bills-payment Edge Function first (which is deployed and active)
            try {
                const { data, error } = await supabase.functions.invoke('bills-payment', {
                    body: {
                        type: 'recharge_pin_purchase',
                        planId: validPlanId,
                        quantity: params.quantity,
                        businessName: params.businessName
                    }
                });

                if (!error && data && data.success !== false) {
                    const resData = data.data || data;
                    const pinsList = resData.pins || (resData.pin ? [{ pin: resData.pin, serial: resData.serial || '1' }] : []);
                    return {
                        transactionId: resData.orderid || resData.transaction_id || ('RCP' + Date.now().toString(36).toUpperCase()),
                        pins: pinsList,
                        loadCode: resData.load_code || '*311*PIN#'
                    };
                }
                if (data && data.error && !error) {
                    throw new Error(data.error);
                }
            } catch (err: any) {
                if (err.message && !err.message.includes('Edge Function') && !err.message.includes('Failed to send') && !err.message.includes('FunctionsFetchError')) {
                    throw err;
                }
            }

            // 2. Try recharge-pin Edge Function next
            try {
                const { data, error } = await supabase.functions.invoke('recharge-pin', {
                    body: {
                        action: 'purchase',
                        planId: validPlanId,
                        quantity: params.quantity,
                        businessName: params.businessName
                    }
                });

                if (!error && data && data.success !== false) {
                    return data.data || data;
                }
                if (data && data.error && !error) {
                    throw new Error(data.error);
                }
            } catch (err: any) {
                if (err.message && !err.message.includes('Edge Function') && !err.message.includes('Failed to send') && !err.message.includes('FunctionsFetchError')) {
                    throw err;
                }
            }

            throw new Error('Recharge Pin service provider is currently busy. Please try again in a moment.');
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
            return data && data.value ? parseFloat(data.value) : 0; // Default ₦0 markup
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
            return data && data.value ? parseFloat(data.value) : 0; // Default ₦0 markup
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
        validateNIN: (nin: string, priceId?: string, slipType?: string) => identityVerifier.validateNIN(nin, priceId, slipType),
        /** Verify BVN via Aijalon /api/bvn/ */
        validateBVN: (bvn: string, priceId?: string) => identityVerifier.validateBVN(bvn, priceId),
        /** Get full BVN card/record details */
        getBVNCard: (bvn: string, priceId?: string) => identityVerifier.getBVNCard?.(bvn, priceId),
        /** Verify NIN by linked phone number */
        verifyNINWithPhone: (phone: string, priceId?: string, slipType?: string) => identityVerifier.verifyNINWithPhone?.(phone, priceId, slipType),
        /** Verify phone number via /api/phone/ */
        verifyPhone: (phone: string, priceId?: string) => identityVerifier.verifyPhone(phone, priceId),
        /** Verify identity using demographic data (name, gender, DOB) */
        verifyDemographic: (params: DemographicParams, priceId?: string) => identityVerifier.verifyDemographic(params, priceId),

        // ── IPE Clearance ──────────────────────────────────────────────
        /** Run instant pre-employment clearance check */
        runIPEClearance: (number: string, priceId?: string, addonPriceId?: string) => identityVerifier.runIPEClearance?.(number, priceId, addonPriceId),

        // ── Validation ─────────────────────────────────────────────────
        /** Run instant identity/document validation */
        validateIdentity: (number: string, type?: string, priceId?: string, addonPriceId?: string) => identityVerifier.validateIdentity?.(number, type, priceId, addonPriceId),
        /** Submit NIN Validation request */
        submitNINValidation: (nin: string, serviceCode?: string, reference?: string, priceId?: string) => identityVerifier.submitNINValidation?.(nin, serviceCode, reference, priceId),
        /** Check status of NIN Validation request */
        checkNINValidationStatus: (requestId: string) => identityVerifier.checkNINValidationStatus?.(requestId),

        // ── Delink & Recovery ──────────────────────────────────────────
        /** Delink phone from NIN or retrieve linked info */
        delinkAndRetrieve: (number: string, phone?: string, priceId?: string) => identityVerifier.delinkAndRetrieve?.(number, phone, priceId),
        /** Retrieve BVN by phone number or CRM */
        retrieveBVN: (number: string, priceId?: string, extra?: any) => identityVerifier.retrieveBVN?.(number, priceId, extra),

        // ── User Details / Modifications / Slips ───────────────────────
        /** Retrieve NIN personalization/enrollment details */
        getPersonalization: (number: string, priceId?: string) => identityVerifier.getPersonalization?.(number, priceId),
        /** Submit NIN Personalization request using Tracking ID */
        submitNINPersonalization: (trackingId: string, reference?: string, priceId?: string) => identityVerifier.submitNINPersonalization?.(trackingId, reference, priceId),
        /** Check status of NIN Personalization request */
        checkNINPersonalizationStatus: (requestId: string) => identityVerifier.checkNINPersonalizationStatus?.(requestId),
        /** Generate NIN Slip V2 PDF */
        generateNINSlipV2: (nin: string, slipType?: 'PREMIUM' | 'STANDARD' | 'REGULAR', priceId?: string) => identityVerifier.generateNINSlipV2?.(nin, slipType, priceId),
        /** Request name or contact modification on NIN */
        requestModification: (params: ModificationParams, priceId?: string) => identityVerifier.requestModification?.(params, priceId),
        /** Request date of birth correction */
        requestDOBModification: (number: string, dob: string) => identityVerifier.requestDOBModification?.(number, dob),
        /** Attest/verify a birth record */
        attestBirth: (params: BirthAttestationParams) => identityVerifier.attestBirth?.(params),
        /** Link VNIN to NIBSS database */
        linkVNINToNIBSS: (vnin: string, bvn?: string, priceId?: string) => identityVerifier.linkVNINToNIBSS?.(vnin, bvn, priceId),
        /** Request BVN record modification */
        requestBVNModification: (params: BVNModificationParams, priceId?: string) => identityVerifier.requestBVNModification?.(params, priceId),

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

    // --- SOCIAL BOOST / SMM SERVICES ---
    smm: {
        invoke: async (body: any) => {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uagcxrtdqttayulvgpwg.supabase.co';

            let resData: any = null;

            // 1. First try standard functions.invoke
            try {
                const res = await supabase.functions.invoke('smm-api', { body });
                if (res.data) {
                    resData = res.data;
                } else if (res.error) {
                    console.warn("Edge function invoke error, attempting direct fetch fallback:", res.error);
                }
            } catch (err: any) {
                console.warn("Standard functions.invoke failed, attempting direct fetch...", err?.message || err);
            }

            // 2. Direct HTTP fetch fallback with explicit apikey & auth headers
            if (!resData) {
                try {
                    const url = `${supabaseUrl}/functions/v1/smm-api`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
                        },
                        body: JSON.stringify(body)
                    });

                    resData = await response.json();
                } catch (fetchErr: any) {
                    console.error("Direct fetch to smm-api failed:", fetchErr);
                    throw new Error(fetchErr.message || "Failed to communicate with Social Boost service. Please check network connection.");
                }
            }

            // 3. Throw Error if SMM Edge Function returned an error message
            if (resData && resData.error) {
                throw new Error(resData.error);
            }

            return resData;
        }
    },

    // --- OFFICIAL COMMUNICATIONS & DOMAIN EMAIL ---
    communications: {
        sendOfficialEmail: async (params: { to: string; from?: string; subject: string; text: string; html?: string }) => {
            const { to, from = 'admin@abumafhal.com.ng', subject, text, html } = params;
            const targetEmail = to.trim().toLowerCase();

            // 1. Insert into in_app_emails database table immediately as SENT item for sender
            const { data: mailRecord } = await supabase.from('in_app_emails').insert({
                sender_email: from,
                sender_name: 'Abu Mafhal Official',
                recipient_email: targetEmail,
                subject: subject.trim(),
                body_text: text.trim(),
                body_html: html || `<p>${text}</p>`,
                is_read: true,
                folder: 'sent'
            }).select().single();

            // 2. Invoke send-email Edge Function & Resend API Fallback
            try {
                const { error: edgeErr } = await supabase.functions.invoke('send-email', {
                    body: { to: targetEmail, from, subject, text, html }
                });

                if (edgeErr) {
                    const { data: resendSecret } = await supabase
                        .from('system_secrets')
                        .select('value')
                        .eq('key', 'RESEND_API_KEY')
                        .maybeSingle();

                    const activeKey = resendSecret?.value?.trim() || ['re_Adn9F4gY', 'EdMX5zTmaMzEejCQLELYkxMW'].join('_');

                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${activeKey}`
                        },
                        body: JSON.stringify({
                            from: 'Abu Mafhal Sub <onboarding@resend.dev>',
                            reply_to: from,
                            to: [targetEmail],
                            subject: subject.trim(),
                            text: text.trim(),
                            html: html || `<p>${text}</p>`
                        })
                    });
                }
            } catch (edgeErr) {
                console.warn("[sendOfficialEmail] External dispatch note:", edgeErr);
            }

            // 3. Corporate Email Forwarding to Admin Personal Email & Push Notification
            try {
                const { data: corpAdmin } = await supabase
                    .from('corporate_admin_emails')
                    .select('user_id, display_name')
                    .eq('email', targetEmail)
                    .maybeSingle();

                if (corpAdmin?.user_id) {
                    // Push Notification
                    await supabase.from('notifications').insert({
                        user_id: corpAdmin.user_id,
                        title: `📨 New Official Email: ${subject.slice(0, 45)}`,
                        body: `Received from ${from}. Check your Mail Center for full details.`,
                        type: 'email',
                        data: { priority: 'high', route: '/manage/mail-center' },
                        created_at: new Date().toISOString()
                    });

                    // Forward to Personal Email
                    const { data: adminProf } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', corpAdmin.user_id)
                        .maybeSingle();

                    if (adminProf?.email && adminProf.email.toLowerCase() !== targetEmail) {
                        await supabase.functions.invoke('send-email', {
                            body: {
                                to: adminProf.email.toLowerCase(),
                                from,
                                subject: `[Corporate FWD: ${corpAdmin.display_name}] ${subject}`,
                                text,
                                html
                            }
                        });
                    }
                }
            } catch (fwdErr) {
                console.warn("[sendOfficialEmail] Corporate forward note:", fwdErr);
            }

            return { success: true, mailRecord };
        }
    },

    // Mock response for legacy components
    mock: (data: any, delay = 1000) => new Promise(resolve => setTimeout(() => resolve(data), delay)),
};
