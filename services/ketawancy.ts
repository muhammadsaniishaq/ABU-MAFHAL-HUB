/**
 * Ketawancy Telecom & SIM API Service
 * Base URL: https://myapi.ketawancy.com/api/v1
 * Supports:
 * - SIM Cards: /sim/plans, /sim/purchase/:id
 * - Data: /services/data-plans/:networkId, /services/buy-data
 * - Smile: /services/smile-plans, /services/buy-smile
 * - Alpha: /services/alpha-plans, /services/buy-alpha
 * - Kirani: /services/kirani/plans, /services/buy/kirani
 * - Ratel: /services/ratel/plans, /services/buy/ratel
 * - Airtime: /services/buy-airtime
 * - User/Account: /users/me, /services/get-user-transactions
 */

import { supabase } from './supabase';

const KETAWANCY_BASE_URL = 'https://myapi.ketawancy.com/api/v1';

// Default / fallback API Key (can be configured in Settings -> API Vault as KETAWANCY_API_KEY)
let cachedApiKey: string | null = null;
let lastKeyFetchTime = 0;

export async function getKetawancyApiKey(): Promise<string> {
    const now = Date.now();
    if (cachedApiKey && (now - lastKeyFetchTime < 60000)) {
        return cachedApiKey;
    }

    try {
        // 1. Check system_secrets table
        const { data: secret } = await supabase
            .from('system_secrets')
            .select('value')
            .in('key', ['KETAWANCY_API_KEY', 'KETAWANCY_KEY', 'KETAWANCY_TOKEN'])
            .maybeSingle();

        if (secret?.value && typeof secret.value === 'string' && secret.value.trim() !== '') {
            cachedApiKey = secret.value.trim();
            lastKeyFetchTime = now;
            return cachedApiKey;
        }

        // 2. Check app_settings table
        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .in('key', ['KETAWANCY_API_KEY', 'ketawancy_api_key', 'ketawancy_key'])
            .maybeSingle();

        if (setting?.value) {
            const val = typeof setting.value === 'object' ? setting.value?.key || setting.value?.value : setting.value;
            if (val && typeof val === 'string' && val.trim() !== '') {
                cachedApiKey = val.trim();
                lastKeyFetchTime = now;
                return cachedApiKey;
            }
        }
    } catch (e) {
        console.warn('[Ketawancy] Secret resolution note:', e);
    }

    // Default fallback or prompt admin
    return cachedApiKey || '';
}

async function requestKetawancy<T = any>(endpoint: string, options: { method?: 'GET' | 'POST'; body?: any } = {}): Promise<T> {
    const apiKey = await getKetawancyApiKey();
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    const url = `${KETAWANCY_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();
    return data;
}

export interface KetawancySimPlan {
    _id: string;
    name: string;
    price: number;
    status: 'on' | 'off' | string;
    description?: string;
    network?: string;
}

export interface KetawancyDataPlan {
    planId: number | string;
    planName: string;
    userPrice?: number;
    price?: number;
    validity?: string;
    network?: string;
}

export const KetawancyService = {
    // ─── 1. SIM CARDS ───
    getSimPlans: async (): Promise<KetawancySimPlan[]> => {
        try {
            const res = await requestKetawancy('/sim/plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            // Fallback plans if API hasn't populated yet
            return [
                { _id: 'kirani-sim-1', name: 'Kirani SIM Card', price: 1500, status: 'on', description: 'Kirani 4G/LTE Physical SIM card with instant activation' },
                { _id: 'smile-sim-1', name: 'Smile 4G SIM Card', price: 1000, status: 'on', description: 'Smile 4G LTE SIM with high speed broadband access' },
                { _id: 'alpha-sim-1', name: 'Alpha SIM Card', price: 1200, status: 'on', description: 'Alpha Network SIM Card for voice and data' },
                { _id: 'ratel-sim-1', name: 'Ratel SIM Card', price: 1500, status: 'on', description: 'Ratel Telecom SIM Card' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getSimPlans error:', e);
            return [
                { _id: 'kirani-sim-1', name: 'Kirani SIM Card', price: 1500, status: 'on', description: 'Kirani 4G/LTE Physical SIM card' },
                { _id: 'smile-sim-1', name: 'Smile 4G SIM Card', price: 1000, status: 'on', description: 'Smile 4G LTE SIM' },
                { _id: 'alpha-sim-1', name: 'Alpha SIM Card', price: 1200, status: 'on', description: 'Alpha Network SIM Card' },
                { _id: 'ratel-sim-1', name: 'Ratel SIM Card', price: 1500, status: 'on', description: 'Ratel Telecom SIM Card' },
            ];
        }
    },

    purchaseSim: async (params: { userId: string; planId: string; phone?: string; email?: string; planName?: string; price: number }) => {
        const { userId, planId, phone, email, planName, price } = params;

        // 1. Verify User Balance
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('balance, email, phone')
            .eq('id', userId)
            .single();

        if (profErr || !profile) throw new Error("Could not retrieve user wallet balance");
        const userBal = Number(profile.balance || 0);
        if (userBal < price) {
            throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but SIM cost is ₦${price.toLocaleString()}. Please fund your wallet.`);
        }

        // 2. Initialize Transaction in Supabase
        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `SIM Purchase: ${planName || 'SIM Card'}`,
                description: `Purchase of ${planName || 'SIM Card'} for ${phone || email || 'User'}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            // 3. Call Ketawancy API
            const res = await requestKetawancy(`/sim/purchase/${planId}`, {
                method: 'POST',
                body: {
                    phone: phone || profile.phone,
                    email: email || profile.email,
                    buyFrom: 'balance'
                }
            });

            const isSuccess = res?.status === 'success' || res?.data?.refNo;
            const refNo = res?.data?.refNo || `sim-${Date.now()}`;
            const simDetails = res?.simCard || { number: phone || 'Generated', email: email || profile.email };

            // 4. Deduct User Wallet Balance safely
            const newBalance = userBal - price;
            await supabase
                .from('profiles')
                .update({ balance: newBalance })
                .eq('id', userId);

            // 5. Update transaction to success
            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: refNo,
                    metadata: {
                        vendor: 'ketawancy',
                        type: 'sim',
                        planId,
                        simCard: simDetails
                    }
                })
                .eq('id', txn.id);

            return {
                success: true,
                refNo,
                simCard: simDetails,
                newBalance
            };
        } catch (err: any) {
            // Mark transaction as failed
            await supabase
                .from('transactions')
                .update({
                    status: 'failed',
                    description: `SIM Purchase Failed: ${err.message || 'Provider error'}`
                })
                .eq('id', txn.id);

            throw err;
        }
    },

    // ─── 2. AIRTIME (MTN=1, Airtel=2, Glo=3, 9Mobile=4) ───
    buyAirtime: async (params: { userId: string; networkId: number; phone: string; amount: number; networkName?: string }) => {
        const { userId, networkId, phone, amount, networkName } = params;

        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        if (profErr || !profile) throw new Error("Could not retrieve user wallet balance");
        const userBal = Number(profile.balance || 0);
        if (userBal < amount) {
            throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but required amount is ₦${amount.toLocaleString()}.`);
        }

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: amount,
                status: 'pending',
                title: `Airtime: ${networkName || 'Network'} ₦${amount}`,
                description: `Airtime recharge of ₦${amount} to ${phone}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy-airtime', {
                method: 'POST',
                body: {
                    amount: String(amount),
                    number: phone,
                    network: networkId,
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Airtime purchase failed at Ketawancy provider');
            }

            const refNo = res?.data?.refNo || `airtime-${Date.now()}`;
            const newBal = userBal - amount;

            await supabase
                .from('profiles')
                .update({ balance: newBal })
                .eq('id', userId);

            await supabase
                .from('transactions')
                .update({
                    status: 'success',
                    reference: refNo,
                    metadata: { vendor: 'ketawancy', type: 'airtime', networkId, phone }
                })
                .eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase
                .from('transactions')
                .update({ status: 'failed', description: `Airtime Failed: ${err.message || 'Provider error'}` })
                .eq('id', txn.id);
            throw err;
        }
    },

    // ─── 3. STANDARD DATA (MTN=1, Airtel=2, Glo=3, 9Mobile=4) ───
    getDataPlans: async (networkId: number | string): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy(`/services/data-plans/${networkId}`);
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [];
        } catch (e) {
            console.error(`[Ketawancy] getDataPlans error for network ${networkId}:`, e);
            return [];
        }
    },

    buyData: async (params: { userId: string; networkId: number; dataPlanId: number | string; phone: string; price: number; planName?: string }) => {
        const { userId, networkId, dataPlanId, phone, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) {
            throw new Error(`Insufficient balance. Wallet: ₦${userBal.toLocaleString()}, Plan Cost: ₦${price.toLocaleString()}.`);
        }

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `Data: ${planName || 'Data Plan'}`,
                description: `Data purchase for ${phone}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy-data', {
                method: 'POST',
                body: {
                    phone,
                    network: networkId,
                    data_plan: dataPlanId,
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Data purchase failed at provider');
            }

            const refNo = res?.data?.refNo || `data-${Date.now()}`;
            const newBal = userBal - price;

            await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            await supabase.from('transactions').update({
                status: 'success',
                reference: refNo,
                metadata: { vendor: 'ketawancy', type: 'data', planId: dataPlanId, phone }
            }).eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase.from('transactions').update({ status: 'failed', description: `Data Failed: ${err.message || 'Provider error'}` }).eq('id', txn.id);
            throw err;
        }
    },

    // ─── 4. SMILE DATA ───
    getSmilePlans: async (): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy('/services/smile-plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [
                { planId: 624, planName: '1GB flexidaily', price: 330, validity: '1 day' },
                { planId: 625, planName: '2.5GB flexidaily', price: 550, validity: '2 days' },
                { planId: 626, planName: '5GB flexiweekly', price: 1600, validity: '7 days' },
                { planId: 627, planName: '10GB Bigga', price: 3300, validity: '30 days' },
                { planId: 628, planName: '15GB Bigga', price: 4400, validity: '30 days' },
                { planId: 629, planName: '20GB Bigga', price: 5500, validity: '30 days' },
                { planId: 630, planName: '40GB Bigga', price: 11000, validity: '30 days' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getSmilePlans error:', e);
            return [
                { planId: 624, planName: '1GB flexidaily', price: 330, validity: '1 day' },
                { planId: 625, planName: '2.5GB flexidaily', price: 550, validity: '2 days' },
                { planId: 626, planName: '5GB flexiweekly', price: 1600, validity: '7 days' },
                { planId: 627, planName: '10GB Bigga', price: 3300, validity: '30 days' },
            ];
        }
    },

    buySmile: async (params: { userId: string; phoneNumber: string; planId: string | number; price: number; planName?: string; actype?: string }) => {
        const { userId, phoneNumber, planId, price, planName, actype = 'PhoneNumber' } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `Smile Data: ${planName || 'Smile Plan'}`,
                description: `Smile 4G recharge for ${phoneNumber}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy-smile', {
                method: 'POST',
                body: {
                    phoneNumber,
                    planId: String(planId),
                    actype,
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Smile data recharge failed at provider');
            }

            const refNo = res?.data?.refNo || `smile-${Date.now()}`;
            const newBal = userBal - price;

            await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            await supabase.from('transactions').update({
                status: 'success',
                reference: refNo,
                metadata: { vendor: 'ketawancy', type: 'smile', planId, phoneNumber }
            }).eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase.from('transactions').update({ status: 'failed', description: `Smile Failed: ${err.message || 'Provider error'}` }).eq('id', txn.id);
            throw err;
        }
    },

    // ─── 5. ALPHA DATA ───
    getAlphaPlans: async (): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy('/services/alpha-plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [
                { planId: 9, planName: 'Alpha N600', price: 610, validity: '30 days' },
                { planId: 10, planName: 'Alpha N1000', price: 1010, validity: '30 days' },
                { planId: 11, planName: 'Alpha N2000', price: 2020, validity: '30 days' },
                { planId: 12, planName: 'Alpha N5000', price: 5050, validity: '30 days' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getAlphaPlans error:', e);
            return [
                { planId: 9, planName: 'Alpha N600', price: 610, validity: '30 days' },
                { planId: 10, planName: 'Alpha N1000', price: 1010, validity: '30 days' },
            ];
        }
    },

    buyAlpha: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `Alpha Plan: ${planName || 'Alpha'}`,
                description: `Alpha recharge for ${phone}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy-alpha', {
                method: 'POST',
                body: {
                    phone,
                    planid: Number(planId),
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Alpha purchase failed at provider');
            }

            const refNo = res?.data?.refNo || `alpha-${Date.now()}`;
            const newBal = userBal - price;

            await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            await supabase.from('transactions').update({
                status: 'success',
                reference: refNo,
                metadata: { vendor: 'ketawancy', type: 'alpha', planId, phone }
            }).eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase.from('transactions').update({ status: 'failed', description: `Alpha Failed: ${err.message || 'Provider error'}` }).eq('id', txn.id);
            throw err;
        }
    },

    // ─── 6. KIRANI DATA ───
    getKiraniPlans: async (): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy('/services/kirani/plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [
                { planId: 1, planName: 'Kirani 1GB', price: 500, validity: '30 Days' },
                { planId: 2, planName: 'Kirani 2GB', price: 950, validity: '30 Days' },
                { planId: 3, planName: 'Kirani 3GB', price: 1400, validity: '30 Days' },
                { planId: 5, planName: 'Kirani 5GB', price: 2300, validity: '30 Days' },
                { planId: 10, planName: 'Kirani 10GB', price: 4500, validity: '30 Days' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getKiraniPlans error:', e);
            return [
                { planId: 1, planName: 'Kirani 1GB', price: 500, validity: '30 Days' },
                { planId: 2, planName: 'Kirani 2GB', price: 950, validity: '30 Days' },
                { planId: 5, planName: 'Kirani 5GB', price: 2300, validity: '30 Days' },
            ];
        }
    },

    buyKirani: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `Kirani: ${planName || 'Kirani Data'}`,
                description: `Kirani data for ${phone}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy/kirani', {
                method: 'POST',
                body: {
                    phone,
                    planid: Number(planId),
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Kirani purchase failed at provider');
            }

            const refNo = res?.data?.refNo || `kirani-${Date.now()}`;
            const newBal = userBal - price;

            await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            await supabase.from('transactions').update({
                status: 'success',
                reference: refNo,
                metadata: { vendor: 'ketawancy', type: 'kirani', planId, phone }
            }).eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase.from('transactions').update({ status: 'failed', description: `Kirani Failed: ${err.message || 'Provider error'}` }).eq('id', txn.id);
            throw err;
        }
    },

    // ─── 7. RATEL DATA ───
    getRatelPlans: async (): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy('/services/ratel/plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [
                { planId: 1, planName: 'Ratel 1GB', price: 500, validity: '30 Days' },
                { planId: 2, planName: 'Ratel 2GB', price: 950, validity: '30 Days' },
                { planId: 3, planName: 'Ratel 3GB', price: 1400, validity: '30 Days' },
                { planId: 5, planName: 'Ratel 5GB', price: 2300, validity: '30 Days' },
                { planId: 10, planName: 'Ratel 10GB', price: 4500, validity: '30 Days' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getRatelPlans error:', e);
            return [
                { planId: 1, planName: 'Ratel 1GB', price: 500, validity: '30 Days' },
                { planId: 2, planName: 'Ratel 2GB', price: 950, validity: '30 Days' },
            ];
        }
    },

    buyRatel: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const { data: txn, error: txnErr } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                type: 'debit',
                amount: price,
                status: 'pending',
                title: `Ratel: ${planName || 'Ratel Data'}`,
                description: `Ratel data for ${phone}`
            })
            .select('id')
            .single();

        if (txnErr) throw new Error("Could not initialize transaction record");

        try {
            const res = await requestKetawancy('/services/buy/ratel', {
                method: 'POST',
                body: {
                    phone,
                    planid: Number(planId),
                    buyFrom: 'balance'
                }
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'Ratel purchase failed at provider');
            }

            const refNo = res?.data?.refNo || `ratel-${Date.now()}`;
            const newBal = userBal - price;

            await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            await supabase.from('transactions').update({
                status: 'success',
                reference: refNo,
                metadata: { vendor: 'ketawancy', type: 'ratel', planId, phone }
            }).eq('id', txn.id);

            return { success: true, refNo, newBalance: newBal };
        } catch (err: any) {
            await supabase.from('transactions').update({ status: 'failed', description: `Ratel Failed: ${err.message || 'Provider error'}` }).eq('id', txn.id);
            throw err;
        }
    },

    // ─── 8. USER PROFILE & TELEMETRY ───
    getUserMe: async () => {
        try {
            return await requestKetawancy('/users/me');
        } catch (e) {
            console.error('[Ketawancy] getUserMe error:', e);
            return null;
        }
    }
};
