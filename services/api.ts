// Base API configuration
import { supabase } from './supabase';
import {
    AirtimeProvider, MockAirtimeProvider, FlutterwaveAirtimeProvider,
    DataProvider, MockDataProvider,
    IdentityVerifier, MockIdentityVerifier,
    CryptoExchange, CoingeckoCryptoExchange
} from './partners';

export const API_URL = 'https://api.abumafhal.com/v1';

// Initialize Partners (In the future, we can switch these to Live implementations based on ENV)
const airtimeProvider: AirtimeProvider = FlutterwaveAirtimeProvider;
// const airtimeProvider: AirtimeProvider = MockAirtimeProvider; // Backup
const dataProvider: DataProvider = MockDataProvider;
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

    // --- SERVICE SPECIFIC METHHODS ---

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

            // 2. Call Partner API
            const result = await airtimeProvider.purchase(params);

            // 3. Update Transaction Status
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

    data: {
        getPlans: (network: string) => dataProvider.getPlans(network),
        purchase: async (userId: string, params: { network: string; phone: string; planId: string; amount: number; planName: string }) => {
            // 1. Record 'Pending' Transaction
            const { data: txn, error: txnError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'data',
                    amount: params.amount, // Note: We need amount passed in or looked up
                    status: 'pending',
                    description: `Data Bundle: ${params.network.toUpperCase()} ${params.planName} -> ${params.phone}`
                })
                .select()
                .single();

            if (txnError) throw new Error(`Transaction Init Failed: ${txnError.message}`);

            // 2. Call Partner API
            const result = await dataProvider.purchase({
                network: params.network,
                phone: params.phone,
                planId: params.planId
            });

            // 3. Update Transaction
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

    // Mock response for legacy components
    mock: (data: any, delay = 1000) => new Promise(resolve => setTimeout(() => resolve(data), delay)),
};
