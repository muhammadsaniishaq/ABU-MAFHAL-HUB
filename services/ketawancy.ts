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
            // Fallback / Live mapped plans from Ketawancy Documentation
            return [
                { _id: '67c31cc8f3f0f520426fe893', name: 'Ratel SIM Card', price: 3000, status: 'on', network: 'ratel', description: 'Ratel Telecom Physical SIM Card with instant activation' },
                { _id: '67c32387927afc9fa58e0595', name: 'Kirani SIM Card', price: 5900, status: 'on', network: 'kirani', description: 'Kirani 4G/LTE Physical SIM card with fast broadband' },
                { _id: '67c32391927afc9fa58e0599', name: 'Alpha SIM Card', price: 2750, status: 'on', network: 'alpha', description: 'Alpha Network SIM Card for voice & high-speed data' },
                { _id: '67d204183bd4d1bd7d1a8fd', name: 'Smile 4G SIM Card', price: 5000, status: 'on', network: 'smile', description: 'Smile 4G LTE High-speed broadband SIM Card' },
                { _id: '6a9e0d7ec7aba8077b3266e2', name: 'Sahal SIM Card', price: 4500, status: 'on', network: 'sahal', description: 'Sahal Telecom Physical SIM Card' },
                { _id: '6a9e0da1c7aba8077b3266ec', name: 'Vitel SIM Card', price: 3500, status: 'on', network: 'vitel', description: 'Vitel Telecom SIM Card' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getSimPlans error:', e);
            return [
                { _id: '67c31cc8f3f0f520426fe893', name: 'Ratel SIM Card', price: 3000, status: 'on', network: 'ratel', description: 'Ratel Telecom Physical SIM Card' },
                { _id: '67c32387927afc9fa58e0595', name: 'Kirani SIM Card', price: 5900, status: 'on', network: 'kirani', description: 'Kirani 4G/LTE Physical SIM card' },
                { _id: '67c32391927afc9fa58e0599', name: 'Alpha SIM Card', price: 2750, status: 'on', network: 'alpha', description: 'Alpha Network SIM Card' },
                { _id: '67d204183bd4d1bd7d1a8fd', name: 'Smile 4G SIM Card', price: 5000, status: 'on', network: 'smile', description: 'Smile 4G LTE SIM' },
                { _id: '6a9e0d7ec7aba8077b3266e2', name: 'Sahal SIM Card', price: 4500, status: 'on', network: 'sahal', description: 'Sahal Telecom Physical SIM Card' },
                { _id: '6a9e0da1c7aba8077b3266ec', name: 'Vitel SIM Card', price: 3500, status: 'on', network: 'vitel', description: 'Vitel Telecom SIM Card' },
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
    // ─── 4. SMILE DATA ───
    getSmilePlans: async (): Promise<KetawancyDataPlan[]> => {
        try {
            const res = await requestKetawancy('/services/smile/plans');
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            return [
                { planId: 4, planName: 'SmileVoice ONLY 65', price: 900, validity: '30 Days' },
                { planId: 9, planName: 'SmileVoice ONLY 135', price: 1850, validity: '30 Days' },
                { planId: 16, planName: 'SmileVoice ONLY 175', price: 3600, validity: '90 Days' },
                { planId: 20, planName: 'SmileVoice ONLY 430', price: 5700, validity: '30 Days' },
                { planId: 23, planName: 'SmileVoice ONLY 450', price: 7200, validity: '60 Days' },
                { planId: 24, planName: 'SmileVoice ONLY 500', price: 9000, validity: '90 Days' },
                { planId: 13, planName: 'SmileVoice ONLY 150', price: 2700, validity: '60 Days' },
                { planId: 1, planName: 'SmileMINI 1GB', price: 450, validity: '1 Day' },
                { planId: 2, planName: 'Smile MINI 2.5GB', price: 750, validity: '1 Day' },
                { planId: 3, planName: 'Smile MINI 1GB', price: 750, validity: '7 Days' },
                { planId: 5, planName: 'Smile MINI 1.5GB', price: 1300, validity: '30 Days' },
                { planId: 6, planName: 'Smile MINI 2.GB', price: 1500, validity: '30 Days' },
                { planId: 7, planName: 'Smile MINI 3GB', price: 1700, validity: '2 Days' },
                { planId: 8, planName: 'Smile MINI 3.5GB', price: 1500, validity: '7 Days' },
                { planId: 10, planName: 'Smile MIDI 3GB', price: 2000, validity: '30 Days' },
                { planId: 11, planName: 'Smile MINI 5GB', price: 2500, validity: '7 Days' },
                { planId: 12, planName: 'Smile MINI 6GB', price: 2300, validity: '2 Days' },
                { planId: 14, planName: 'Smile MIDI 6GB', price: 3000, validity: '30 Days' },
                { planId: 15, planName: 'Smile MIDI 8GB', price: 3500, validity: '30 Days' },
                { planId: 17, planName: 'Smile MIDI 10GB', price: 4000, validity: '30 Days' },
                { planId: 18, planName: 'Smile MIDI 13GB', price: 5000, validity: '30 Days' },
                { planId: 19, planName: 'Freedom Mobile Plan', price: 5000, validity: '30 Days' },
                { planId: 21, planName: 'Smile MIDI 18GB', price: 6000, validity: '30 Days' },
                { planId: 22, planName: 'Smile MIDI 20GB', price: 7000, validity: '30 Days' },
                { planId: 25, planName: 'Smile MIDI 25GB', price: 9000, validity: '30 Days' },
                { planId: 26, planName: 'Smile MIDI 40GB', price: 12500, validity: '30 Days' },
                { planId: 27, planName: 'Smile ANNUAL 20GB', price: 14000, validity: '365 Days' },
                { planId: 28, planName: 'Smile MAXI Lite', price: 15000, validity: '30 Days' },
                { planId: 29, planName: 'Smile MIDI 65GB', price: 15000, validity: '30 Days' },
                { planId: 30, planName: 'Smile MIDI 100GB', price: 20000, validity: '30 Days' },
                { planId: 31, planName: 'Smile MIDI 130GB', price: 25000, validity: '30 Days' },
                { planId: 32, planName: 'Smile JUMBO 90GB', price: 25000, validity: '60 Days' },
                { planId: 33, planName: 'Smile MAXI Essential', price: 27700, validity: '30 Days' },
                { planId: 34, planName: 'Smile ANNUAL 50GB', price: 29000, validity: '365 Days' },
                { planId: 35, planName: 'Smile Maxi Home', price: 38500, validity: '30 Days' },
                { planId: 36, planName: 'Smile MIDI 210GB', price: 40000, validity: '30 Days' },
                { planId: 37, planName: 'Smile MAXI Office', price: 45000, validity: '30 Days' },
                { planId: 38, planName: 'Smile ANNUAL 120GB', price: 49500, validity: '365 Days' },
                { planId: 39, planName: 'Smile JUMBO 300GB', price: 50000, validity: '90 Days' },
                { planId: 40, planName: 'Smile JUMBO 350GB', price: 60000, validity: '120 Days' },
                { planId: 41, planName: 'Smile MAXI DataFlux', price: 61500, validity: '30 Days' },
                { planId: 42, planName: 'Smile JUMBO 500GB', price: 77000, validity: '180 Days' },
                { planId: 43, planName: 'Smile ANNUAL 250GB', price: 77000, validity: '365 Days' },
                { planId: 44, planName: 'Smile ANNUAL 450GB', price: 107000, validity: '365 Days' },
                { planId: 45, planName: 'Smile ANNUAL 700GB', price: 154000, validity: '365 Days' },
                { planId: 46, planName: 'Smile ANNUAL 1TB', price: 180000, validity: '365 Days' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getSmilePlans error:', e);
            return [
                { planId: 1, planName: 'SmileMINI 1GB', price: 450, validity: '1 Day' },
                { planId: 2, planName: 'Smile MINI 2.5GB', price: 750, validity: '1 Day' },
                { planId: 5, planName: 'Smile MINI 1.5GB', price: 1300, validity: '30 Days' },
                { planId: 10, planName: 'Smile MIDI 3GB', price: 2000, validity: '30 Days' },
                { planId: 14, planName: 'Smile MIDI 6GB', price: 3000, validity: '30 Days' },
                { planId: 17, planName: 'Smile MIDI 10GB', price: 4000, validity: '30 Days' },
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
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            return [
                { planId: 2, planName: 'Alpha N750', price: 888, validity: 'Unlimited' },
                { planId: 3, planName: 'Alpha N1000', price: 1100, validity: 'Unlimited' },
                { planId: 4, planName: 'Alpha N1500', price: 1600, validity: 'Unlimited' },
                { planId: 5, planName: 'Alpha N2000', price: 2110, validity: 'Unlimited' },
                { planId: 50, planName: 'Alpha 2,500', price: 2650, validity: 'Unlimited' },
                { planId: 14, planName: 'Alpha N2900', price: 3050, validity: 'Unlimited' },
                { planId: 6, planName: 'Alpha N3000', price: 3120, validity: 'Unlimited' },
                { planId: 7, planName: 'Alpha N5000', price: 5150, validity: 'Unlimited' },
                { planId: 8, planName: 'Alpha N7500', price: 7700, validity: 'Unlimited' },
                { planId: 9, planName: 'Alpha N9000', price: 9150, validity: 'Unlimited' },
                { planId: 10, planName: 'Alpha N10000', price: 10250, validity: 'Unlimited' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getAlphaPlans error:', e);
            return [
                { planId: 2, planName: 'Alpha N750', price: 888, validity: 'Unlimited' },
                { planId: 3, planName: 'Alpha N1000', price: 1100, validity: 'Unlimited' },
                { planId: 4, planName: 'Alpha N1500', price: 1600, validity: 'Unlimited' },
                { planId: 5, planName: 'Alpha N2000', price: 2110, validity: 'Unlimited' },
                { planId: 50, planName: 'Alpha 2,500', price: 2650, validity: 'Unlimited' },
                { planId: 14, planName: 'Alpha N2900', price: 3050, validity: 'Unlimited' },
                { planId: 6, planName: 'Alpha N3000', price: 3120, validity: 'Unlimited' },
                { planId: 7, planName: 'Alpha N5000', price: 5150, validity: 'Unlimited' },
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
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            return [
                { planId: 18, planName: 'Kirani 30 minutes', price: 480, validity: '—' },
                { planId: 17, planName: 'Kirani 50 Minutes', price: 790, validity: '—' },
                { planId: 5, planName: 'Kirani 70 Minutes', price: 1080, validity: '—' },
                { planId: 16, planName: 'Kirani 100 Minutes', price: 1540, validity: '—' },
                { planId: 8, planName: 'Kirani 150 Minutes', price: 2350, validity: '—' },
                { planId: 15, planName: 'Kirani 200 Minutes', price: 3100, validity: '—' },
                { planId: 7, planName: 'Kirani 250 Minutes', price: 3900, validity: '—' },
                { planId: 14, planName: 'Kirani 300 Minutes', price: 4650, validity: '—' },
                { planId: 60, planName: 'Kirani Standard', price: 5000, validity: '—' },
                { planId: 6, planName: 'Kirani 350 Minutes (Standard)', price: 5300, validity: '—' },
                { planId: 3, planName: 'Kirani 350 Minutes (Premium)', price: 5420, validity: '—' },
                { planId: 13, planName: 'Kirani 400 Minutes', price: 6050, validity: '—' },
                { planId: 9, planName: 'Kirani 450 Minutes (Standard)', price: 6530, validity: '—' },
                { planId: 2, planName: 'Kirani 450 Minutes (Premium)', price: 6700, validity: '—' },
                { planId: 12, planName: 'Kirani 500 Minutes', price: 7500, validity: '—' },
                { planId: 1, planName: 'Kirani 550 Minutes', price: 8200, validity: '—' },
                { planId: 19, planName: 'Kirani 700 Minutes', price: 10500, validity: '—' },
                { planId: 10, planName: 'Kirani 800 Minutes', price: 12050, validity: '—' },
                { planId: 4, planName: 'Kirani 900 Minutes', price: 13830, validity: '—' },
                { planId: 11, planName: 'Kirani 1000 Minutes', price: 15000, validity: '—' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getKiraniPlans error:', e);
            return [
                { planId: 18, planName: 'Kirani 30 minutes', price: 480, validity: '—' },
                { planId: 17, planName: 'Kirani 50 Minutes', price: 790, validity: '—' },
                { planId: 5, planName: 'Kirani 70 Minutes', price: 1080, validity: '—' },
                { planId: 16, planName: 'Kirani 100 Minutes', price: 1540, validity: '—' },
                { planId: 8, planName: 'Kirani 150 Minutes', price: 2350, validity: '—' },
                { planId: 15, planName: 'Kirani 200 Minutes', price: 3100, validity: '—' },
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
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            return [
                { planId: 5, planName: 'Ratel N1000. Unlimited', price: 1190, validity: 'Unlimited' },
                { planId: 6, planName: 'Ratel N2000. Unlimited', price: 2350, validity: 'Unlimited' },
                { planId: 7, planName: 'Ratel N3000. Unlimited', price: 3550, validity: 'Unlimited' },
                { planId: 8, planName: 'Ratel N5000. Unlimited', price: 5900, validity: 'Unlimited' },
                { planId: 9, planName: 'Ratel N9000 Unlimited', price: 10200, validity: 'Unlimited' },
                { planId: 10, planName: 'Ratel N10000. Unlimited', price: 11200, validity: 'Unlimited' },
                { planId: 40, planName: 'Ratel 2,500. Unlimited', price: 2800, validity: 'Unlimited' },
                { planId: 39, planName: 'Ratel. 1,500. Unlimited', price: 1800, validity: 'Unlimited' },
                { planId: 38, planName: 'Ratel. 3,500. Unlimited', price: 4000, validity: 'Unlimited' },
                { planId: 4, planName: 'Ratel 1500', price: 1700, validity: 'Unlimited' },
            ];
        } catch (e) {
            console.error('[Ketawancy] getRatelPlans error:', e);
            return [
                { planId: 5, planName: 'Ratel N1000. Unlimited', price: 1190, validity: 'Unlimited' },
                { planId: 6, planName: 'Ratel N2000. Unlimited', price: 2350, validity: 'Unlimited' },
                { planId: 7, planName: 'Ratel N3000. Unlimited', price: 3550, validity: 'Unlimited' },
                { planId: 8, planName: 'Ratel N5000. Unlimited', price: 5900, validity: 'Unlimited' },
                { planId: 9, planName: 'Ratel N9000 Unlimited', price: 10200, validity: 'Unlimited' },
                { planId: 10, planName: 'Ratel N10000. Unlimited', price: 11200, validity: 'Unlimited' },
                { planId: 40, planName: 'Ratel 2,500. Unlimited', price: 2800, validity: 'Unlimited' },
                { planId: 39, planName: 'Ratel. 1,500. Unlimited', price: 1800, validity: 'Unlimited' },
                { planId: 38, planName: 'Ratel. 3,500. Unlimited', price: 4000, validity: 'Unlimited' },
                { planId: 4, planName: 'Ratel 1500', price: 1700, validity: 'Unlimited' },
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
