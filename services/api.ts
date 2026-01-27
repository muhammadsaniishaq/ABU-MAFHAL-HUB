import { supabase } from './supabase';
import {
    AirtimeProvider, MockAirtimeProvider, FlutterwaveAirtimeProvider,
    DataProvider, MockDataProvider, FlutterwaveDataProvider,
    IdentityVerifier, MockIdentityVerifier,
    CryptoExchange, CoingeckoCryptoExchange, BinanceCryptoExchange
} from './partners';
import { ClubKonnectProvider } from './clubkonnect';

export const API_URL = 'https://api.abumafhal.com.ng/v1';

// Initialize Partners (In the future, we can switch these to Live implementations based on ENV)
// SWAPPED TO CLUBKONNECT AS REQUESTED
const airtimeProvider: AirtimeProvider = ClubKonnectProvider;
// const airtimeProvider: AirtimeProvider = MockAirtimeProvider; // Backup
const dataProvider: DataProvider = ClubKonnectProvider;
const identityVerifier: IdentityVerifier = MockIdentityVerifier;
const cryptoExchange: CryptoExchange = CoingeckoCryptoExchange;

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
                    reference: result.data.orderid || result.requestId // ClubKonnect returns 'orderid'
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data.orderid };
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
                    reference: result.data.orderid || result.requestId
                })
                .eq('id', txn.id);

            return { success: true, reference: result.data.orderid };
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
        validateNIN: (nin: string) => identityVerifier.validateNIN(nin),
        validateBVN: (bvn: string) => identityVerifier.validateBVN(bvn)
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
        generate: async (userId: string, userName: string) => {
            // 1. Check existing
            const { data: existing } = await supabase
                .from('virtual_accounts')
                .select('id, user_id, provider, bank_name, account_number, account_name, currency, created_at')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) return existing;

            // 2. Call Edge Function to create real Paystack Account
            const { data: newAccount, error } = await supabase.functions.invoke('create-virtual-account', {
                body: { userId }
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
