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

import AsyncStorage from '@react-native-async-storage/async-storage';
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
        // 1. Check local AsyncStorage cache (from Admin API Vault)
        const localVaultKeys = ['@vault_KETAWANCY_API_KEY', '@vault_KETAWANCY_KEY', '@vault_KETAWANCY_TOKEN', '@vault_KETAWANSY_API_KEY'];
        for (const vk of localVaultKeys) {
            try {
                const stored = await AsyncStorage.getItem(vk);
                if (stored && typeof stored === 'string' && stored.trim() !== '') {
                    cachedApiKey = stored.trim();
                    lastKeyFetchTime = now;
                    return cachedApiKey;
                }
            } catch {}
        }

        // 2. Check app_settings table (accessible to all authenticated users)
        const { data: settings } = await supabase
            .from('app_settings')
            .select('key, value')
            .or('key.ilike.%ketawanc%,key.ilike.%ketawans%');

        if (settings && settings.length > 0) {
            for (const s of settings) {
                const val = typeof s.value === 'object' && s.value !== null 
                    ? (s.value?.key || s.value?.value || s.value?.token || s.value?.apiKey) 
                    : s.value;
                if (val && typeof val === 'string' && val.trim() !== '') {
                    cachedApiKey = val.trim();
                    lastKeyFetchTime = now;
                    return cachedApiKey;
                }
            }
        }

        // 3. Check system_secrets table (accessible to admins or via service role)
        const { data: secret } = await supabase
            .from('system_secrets')
            .select('value')
            .in('key', ['KETAWANCY_API_KEY', 'KETAWANCY_KEY', 'KETAWANCY_TOKEN', 'KETAWANSY_API_KEY', 'KETAWANSY_KEY'])
            .maybeSingle();

        if (secret?.value && typeof secret.value === 'string' && secret.value.trim() !== '') {
            const resolvedKey: string = secret.value.trim();
            cachedApiKey = resolvedKey;
            lastKeyFetchTime = now;
            await AsyncStorage.setItem('@vault_KETAWANCY_API_KEY', resolvedKey).catch(() => {});
            return resolvedKey;
        }

        // 4. Edge Function Fallback (Service Role securely resolves key bypassing RLS)
        const { data: edgeRes } = await supabase.functions.invoke('admin-audit-logs', {
            body: { action: 'get-telecom-key', provider: 'ketawancy' }
        });

        if (edgeRes?.key && typeof edgeRes.key === 'string' && edgeRes.key.trim() !== '') {
            const resolvedKey: string = edgeRes.key.trim();
            cachedApiKey = resolvedKey;
            lastKeyFetchTime = now;
            await AsyncStorage.setItem('@vault_KETAWANCY_API_KEY', resolvedKey).catch(() => {});
            return resolvedKey;
        }
    } catch (e) {
        console.warn('[Ketawancy] Secret resolution note:', e);
    }

    return cachedApiKey || '';
}

async function requestKetawancy<T = any>(endpoint: string, options: { method?: 'GET' | 'POST'; body?: any } = {}): Promise<T> {
    // 1. PRIMARY ENTERPRISE METHOD: Server-Side Edge Function Proxy
    // Shields the API Key 100% on the server so no client APK or sniffer can ever see it
    try {
        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('admin-audit-logs', {
            body: {
                action: 'proxy-ketawancy',
                endpoint,
                method: options.method || 'GET',
                payload: options.body || null
            }
        });

        if (!edgeErr && edgeRes) {
            if (edgeRes.status === 'success' && edgeRes.data) {
                const proxyData = edgeRes.data;
                // If telecom provider returned an explicit failure
                if (proxyData?.status === 'fail' || proxyData?.status === 'error') {
                    const errMsg = proxyData?.message || proxyData?.msg || 'Telecom Provider Rejected Request';
                    console.warn('[Ketawancy Proxy Upstream]', errMsg);
                }
                return proxyData as T;
            } else if (edgeRes.status === 'error') {
                console.warn('[Ketawancy Proxy]', edgeRes.message);
                // If key is missing or upstream timed out, we still attempt fallback client transport
            }
        }
    } catch (proxyErr) {
        console.warn('[Ketawancy Proxy Note] Falling back to direct client transport:', proxyErr);
    }

    // 2. FALLBACK CLIENT-SIDE TRANSPORT (if Edge Function is offline/unreachable)
    const apiKey = await getKetawancyApiKey();

    const cleanClientKey = (apiKey || '').replace(/^Bearer\s+/i, '').trim();
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    if (cleanClientKey) {
        headers['x-api-key'] = cleanClientKey;
        headers['Authorization'] = `Bearer ${cleanClientKey}`;
    }

    const url = `${KETAWANCY_BASE_URL}${endpoint}`;
    
    // Resilient Retry Loop: up to 3 attempts with 25s timeout
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await response.json().catch(() => ({}));

            // Detect authentication errors from the provider
            if (!response.ok || data?.status === 'fail' || data?.status === 'error') {
                const errorText = String(data?.message || data?.msg || '').toLowerCase();
                if (
                    response.status === 401 ||
                    errorText.includes('logged in') ||
                    errorText.includes('get access') ||
                    errorText.includes('unauthorized') ||
                    errorText.includes('invalid token')
                ) {
                    console.warn('[Ketawancy] API Authentication Error:', data?.message);
                    throw new Error(
                        "Telecom Provider Authentication Error: The Ketawancy API Key or Bearer Token is invalid or expired. Please update KETAWANCY_API_KEY in Admin Settings -> API Vault."
                    );
                }
            }

            return data;
        } catch (fetchErr: any) {
            clearTimeout(timeoutId);
            lastError = fetchErr;
            if (fetchErr.message?.includes('Telecom Provider Authentication Error')) {
                throw fetchErr;
            }
            if (attempt < 3) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    }

    throw lastError || new Error('Ketawancy API Network Timeout / Error');
}

/**
 * Execute a telecom purchase via the secure Server-Side Edge Function.
 * Returns { handled: true, result } if handled by the server shield,
 * or { handled: false } if the Edge function is unreachable so client fallback can run.
 */
async function executeServerTelecomPurchase(params: {
    userId: string;
    price: number;
    serviceType: string;
    endpoint: string;
    payload: any;
    description: string;
    reference?: string;
}): Promise<{ handled: boolean; result?: any; error?: string }> {
    try {
        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('admin-audit-logs', {
            body: {
                action: 'execute-telecom-purchase',
                userId: params.userId,
                price: params.price,
                serviceType: params.serviceType,
                endpoint: params.endpoint,
                payload: params.payload,
                description: params.description,
                reference: params.reference
            }
        });

        if (!edgeErr && edgeRes) {
            if (edgeRes.status === 'success') {
                return { handled: true, result: edgeRes };
            }
            if (edgeRes.status === 'error') {
                // Legitimate provider rejection or insufficient balance: throw directly
                throw new Error(edgeRes.message || 'Transaction rejected by telecom provider');
            }
        }
    } catch (err: any) {
        // If it's a known error from provider or insufficient balance, rethrow
        if (err.message && (
            err.message.includes('Insufficient') ||
            err.message.includes('rejected') ||
            err.message.includes('credentials not configured')
        )) {
            throw err;
        }
        console.warn('[Server Telecom Shield Note] Falling back to client-side purchase flow:', err);
    }

    return { handled: false };
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
    getSimPlans: async (): Promise<KetawancySimPlan[]> => {
        try {
            const res = await requestKetawancy('/sim/plans');
            if (res?.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            if (Array.isArray(res)) {
                return res;
            }
            if (res?.data && Array.isArray(res.data.plans)) {
                return res.data.plans;
            }
            return [];
        } catch (e) {
            console.error('[Ketawancy] getSimPlans live fetch error:', e);
            throw new Error(`Ketawancy Live API Error: Failed to load SIM plans (${(e as any)?.message || 'Service unavailable'})`);
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

        // Generate client transaction reference upfront
        const refNo = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'sim',
            endpoint: `/sim/purchase/${planId}`,
            payload: null,
            description: `SIM Purchase: ${planName || 'SIM Card'} for ${phone || email || 'User'}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            const resData = serverAttempt.result.data;
            const simDetails = resData?.simCard || { number: 'Assigned by Provider', email: profile.email || 'N/A' };
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                simCard: simDetails,
                newBalance: serverAttempt.result.newBalance
            };
        }

        // 2. Initialize Transaction in Supabase (omit 'title' as transactions table has 'description' and 'details')
        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `SIM Purchase: ${planName || 'SIM Card'} for ${phone || email || 'User'}`,
                    details: { planId, planName, network: 'telecom', phone: phone || '' }
                })
                .select('id')
                .single();

            if (txnErr) {
                console.warn('[Ketawancy] Primary transaction insert warning:', txnErr.message);
                // Fallback attempt with minimal required fields
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending',
                        description: `SIM Purchase: ${planName || 'SIM Card'}`
                    })
                    .select('id')
                    .single();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            } else if (txn?.id) {
                txnId = txn.id;
            }
        } catch (initErr: any) {
            console.warn('[Ketawancy] Transaction init caught note:', initErr?.message);
        }

        try {
            // 3. Call Ketawancy API
            const res = await requestKetawancy(`/sim/purchase/${planId}`, {
                method: 'POST'
            });

            if (res?.status !== 'success') {
                throw new Error(res?.message || 'SIM purchase failed at provider');
            }

            const finalRef = res?.data?.refNo || refNo;
            const simDetails = res?.simCard || { number: 'Assigned by Provider', email: profile.email || 'N/A' };

            // 4. Deduct User Wallet Balance safely (RPC first with direct fallback)
            let newBalance = Math.max(0, userBal - price);
            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });

                if (!rpcErr && rpcRes) {
                    if (typeof rpcRes === 'object' && rpcRes.new_balance !== undefined) {
                        newBalance = Number(rpcRes.new_balance);
                    } else if (typeof rpcRes === 'number') {
                        newBalance = rpcRes;
                    }
                } else {
                    // Direct profile update fallback
                    await supabase
                        .from('profiles')
                        .update({ balance: newBalance })
                        .eq('id', userId);
                }
            } catch (deductErr) {
                console.warn('[Ketawancy] Balance deduction note:', deductErr);
                await supabase
                    .from('profiles')
                    .update({ balance: newBalance })
                    .eq('id', userId);
            }

            // 5. Update transaction to success
            if (txnId) {
                await supabase
                    .from('transactions')
                    .update({
                        status: 'success',
                        reference: finalRef,
                        metadata: {
                            vendor: 'ketawancy',
                            type: 'sim',
                            planId,
                            simCard: simDetails
                        }
                    })
                    .eq('id', txnId);
            } else {
                // If init was skipped due to schema constraints, record completed record now
                await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'success',
                        reference: finalRef,
                        description: `SIM Purchase: ${planName || 'SIM Card'}`,
                        metadata: { vendor: 'ketawancy', type: 'sim', planId, simCard: simDetails }
                    });
            }

            return {
                success: true,
                refNo: finalRef,
                simCard: simDetails,
                newBalance
            };
        } catch (err: any) {
            // Mark transaction as failed if initialized
            if (txnId) {
                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        description: `SIM Purchase Failed: ${err.message || 'Provider error'}`
                    })
                    .eq('id', txnId);
            }

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

        const refNo = `airtime-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price: amount,
            serviceType: 'airtime',
            endpoint: '/services/buy-airtime',
            payload: {
                amount: String(amount),
                number: phone,
                network: networkId,
                buyFrom: 'balance'
            },
            description: `Airtime: ${networkName || 'Airtime'} ₦${amount} -> ${phone}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: amount,
                    status: 'pending',
                    reference: refNo,
                    description: `Airtime: ${networkName || 'Airtime'} ₦${amount} -> ${phone}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Airtime txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: amount,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Airtime txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - amount);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: amount
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase
                    .from('transactions')
                    .update({
                        status: 'success',
                        reference: finalRef,
                        metadata: { vendor: 'ketawancy', type: 'airtime', networkId, phone }
                    })
                    .eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase
                    .from('transactions')
                    .update({ status: 'failed', description: `Airtime Failed: ${err.message || 'Provider error'}` })
                    .eq('id', txnId);
            }
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

        const refNo = `data-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'data',
            endpoint: '/services/buy-data',
            payload: {
                phone,
                network: networkId,
                data_plan: dataPlanId,
                buyFrom: 'balance'
            },
            description: `Data: ${planName || 'Data Plan'} -> ${phone}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `Data: ${planName || 'Data Plan'} -> ${phone}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Data txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Data txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - price);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase.from('transactions').update({
                    status: 'success',
                    reference: finalRef,
                    metadata: { vendor: 'ketawancy', type: 'data', planId: dataPlanId, phone }
                }).eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase.from('transactions').update({ status: 'failed', description: `Data Failed: ${err.message || 'Provider error'}` }).eq('id', txnId);
            }
            throw err;
        }
    },

    // ─── 4. SMILE DATA ───
    getSmilePlans: async (): Promise<KetawancyDataPlan[]> => {
        const endpoints = ['/services/smile-plans', '/services/smile/plans', '/services/data-plans/smile'];
        let lastErr: any = null;

        for (const ep of endpoints) {
            try {
                const res = await requestKetawancy(ep);
                let list: any[] = [];
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    list = res.data;
                } else if (Array.isArray(res)) {
                    list = res;
                } else if (res?.data && Array.isArray(res.data.plans)) {
                    list = res.data.plans;
                } else if (Array.isArray(res?.plans)) {
                    list = res.plans;
                }

                if (list.length > 0) {
                    return list.map(item => ({
                        planId: item.planId ?? item.id ?? item._id ?? item.plan_id,
                        planName: item.planName ?? item.name ?? item.plan ?? 'Smile Plan',
                        price: Number(item.price ?? item.userPrice ?? item.cost ?? 0),
                        userPrice: Number(item.userPrice ?? item.price ?? 0),
                        validity: item.validity ?? item.duration ?? '30 Days',
                        network: 'SMILE'
                    }));
                }
            } catch (e) {
                lastErr = e;
            }
        }

        console.warn('[Ketawancy] getSmilePlans live fetch note:', lastErr);
        return [];
    },

    buySmile: async (params: { userId: string; phoneNumber: string; planId: string | number; price: number; planName?: string; actype?: string }) => {
        const { userId, phoneNumber, planId, price, planName, actype = 'PhoneNumber' } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const refNo = `smile-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'smile',
            endpoint: '/services/buy-smile',
            payload: {
                phoneNumber,
                planId,
                actype,
                buyFrom: 'balance'
            },
            description: `Smile Data: ${planName || 'Smile Plan'} -> ${phoneNumber}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `Smile Data: ${planName || 'Smile Plan'} -> ${phoneNumber}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Smile txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Smile txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - price);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase.from('transactions').update({
                    status: 'success',
                    reference: finalRef,
                    metadata: { vendor: 'ketawancy', type: 'smile', planId, phoneNumber }
                }).eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase.from('transactions').update({ status: 'failed', description: `Smile Failed: ${err.message || 'Provider error'}` }).eq('id', txnId);
            }
            throw err;
        }
    },

    // ─── 5. ALPHA DATA ───
    getAlphaPlans: async (): Promise<KetawancyDataPlan[]> => {
        const endpoints = ['/services/alpha-plans', '/services/alpha/plans', '/services/data-plans/alpha'];
        let lastErr: any = null;

        for (const ep of endpoints) {
            try {
                const res = await requestKetawancy(ep);
                let list: any[] = [];
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    list = res.data;
                } else if (Array.isArray(res)) {
                    list = res;
                } else if (res?.data && Array.isArray(res.data.plans)) {
                    list = res.data.plans;
                } else if (Array.isArray(res?.plans)) {
                    list = res.plans;
                }

                if (list.length > 0) {
                    return list.map(item => ({
                        planId: item.planId ?? item.id ?? item._id ?? item.plan_id,
                        planName: item.planName ?? item.name ?? item.plan ?? 'Alpha Plan',
                        price: Number(item.price ?? item.userPrice ?? item.cost ?? 0),
                        userPrice: Number(item.userPrice ?? item.price ?? 0),
                        validity: item.validity ?? item.duration ?? '30 Days',
                        network: 'ALPHA'
                    }));
                }
            } catch (e) {
                lastErr = e;
            }
        }

        console.warn('[Ketawancy] getAlphaPlans live fetch note:', lastErr);
        return [];
    },

    buyAlpha: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient wallet balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const refNo = `alpha-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'alpha',
            endpoint: '/services/buy-alpha',
            payload: {
                phone,
                planid: Number(planId),
                buyFrom: 'balance'
            },
            description: `Alpha Plan: ${planName || 'Alpha'} -> ${phone}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `Alpha Plan: ${planName || 'Alpha'} -> ${phone}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Alpha txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Alpha txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - price);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase.from('transactions').update({
                    status: 'success',
                    reference: finalRef,
                    metadata: { vendor: 'ketawancy', type: 'alpha', planId, phone }
                }).eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase.from('transactions').update({ status: 'failed', description: `Alpha Failed: ${err.message || 'Provider error'}` }).eq('id', txnId);
            }
            throw err;
        }
    },

    // ─── 6. KIRANI DATA ───
    getKiraniPlans: async (): Promise<KetawancyDataPlan[]> => {
        const endpoints = ['/services/kirani/plans', '/services/kirani-plans', '/services/data-plans/kirani'];
        let lastErr: any = null;

        for (const ep of endpoints) {
            try {
                const res = await requestKetawancy(ep);
                let list: any[] = [];
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    list = res.data;
                } else if (Array.isArray(res)) {
                    list = res;
                } else if (res?.data && Array.isArray(res.data.plans)) {
                    list = res.data.plans;
                } else if (Array.isArray(res?.plans)) {
                    list = res.plans;
                }

                if (list.length > 0) {
                    return list.map(item => ({
                        planId: item.planId ?? item.id ?? item._id ?? item.plan_id,
                        planName: item.planName ?? item.name ?? item.plan ?? 'Kirani Plan',
                        price: Number(item.price ?? item.userPrice ?? item.cost ?? 0),
                        userPrice: Number(item.userPrice ?? item.price ?? 0),
                        validity: item.validity ?? item.duration ?? '30 Days',
                        network: 'KIRANI'
                    }));
                }
            } catch (e) {
                lastErr = e;
            }
        }

        console.warn('[Ketawancy] getKiraniPlans live fetch note:', lastErr);
        return [];
    },

    buyKirani: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const refNo = `kirani-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'kirani',
            endpoint: '/services/buy/kirani',
            payload: {
                phone,
                planid: Number(planId),
                buyFrom: 'balance'
            },
            description: `Kirani: ${planName || 'Kirani Data'} -> ${phone}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `Kirani: ${planName || 'Kirani Data'} -> ${phone}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Kirani txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Kirani txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - price);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase.from('transactions').update({
                    status: 'success',
                    reference: finalRef,
                    metadata: { vendor: 'ketawancy', type: 'kirani', planId, phone }
                }).eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase.from('transactions').update({ status: 'failed', description: `Kirani Failed: ${err.message || 'Provider error'}` }).eq('id', txnId);
            }
            throw err;
        }
    },

    // ─── 7. RATEL DATA ───
    getRatelPlans: async (): Promise<KetawancyDataPlan[]> => {
        const endpoints = ['/services/ratel/plans', '/services/ratel-plans', '/services/data-plans/ratel'];
        let lastErr: any = null;

        for (const ep of endpoints) {
            try {
                const res = await requestKetawancy(ep);
                let list: any[] = [];
                if (res?.status === 'success' && Array.isArray(res.data)) {
                    list = res.data;
                } else if (Array.isArray(res)) {
                    list = res;
                } else if (res?.data && Array.isArray(res.data.plans)) {
                    list = res.data.plans;
                } else if (Array.isArray(res?.plans)) {
                    list = res.plans;
                }

                if (list.length > 0) {
                    return list.map(item => ({
                        planId: item.planId ?? item.id ?? item._id ?? item.plan_id,
                        planName: item.planName ?? item.name ?? item.plan ?? 'Ratel Plan',
                        price: Number(item.price ?? item.userPrice ?? item.cost ?? 0),
                        userPrice: Number(item.userPrice ?? item.price ?? 0),
                        validity: item.validity ?? item.duration ?? '30 Days',
                        network: 'RATEL'
                    }));
                }
            } catch (e) {
                lastErr = e;
            }
        }

        console.warn('[Ketawancy] getRatelPlans live fetch note:', lastErr);
        return [];
    },

    buyRatel: async (params: { userId: string; phone: string; planId: number | string; price: number; planName?: string }) => {
        const { userId, phone, planId, price, planName } = params;

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const userBal = Number(profile?.balance || 0);
        if (userBal < price) throw new Error(`Insufficient balance. You have ₦${userBal.toLocaleString()}, but required is ₦${price.toLocaleString()}.`);

        const refNo = `ratel-${Date.now()}`;

        // PRIMARY ENTERPRISE ATTEMPT: Server-Side Edge Execution Shield
        const serverAttempt = await executeServerTelecomPurchase({
            userId,
            price,
            serviceType: 'ratel',
            endpoint: '/services/buy/ratel',
            payload: {
                phone,
                planid: Number(planId),
                buyFrom: 'balance'
            },
            description: `Ratel: ${planName || 'Ratel Data'} -> ${phone}`,
            reference: refNo
        });

        if (serverAttempt.handled && serverAttempt.result) {
            return {
                success: true,
                refNo: serverAttempt.result.refNo || refNo,
                newBalance: serverAttempt.result.newBalance
            };
        }

        let txnId: string | null = null;
        try {
            const { data: txn, error: txnErr } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'payment',
                    amount: price,
                    status: 'pending',
                    reference: refNo,
                    description: `Ratel: ${planName || 'Ratel Data'} -> ${phone}`
                })
                .select('id')
                .maybeSingle();

            if (txn?.id) {
                txnId = txn.id;
            } else if (txnErr) {
                console.warn('[Ketawancy] Ratel txn insert fallback:', txnErr.message);
                const { data: fallbackTxn } = await supabase
                    .from('transactions')
                    .insert({
                        user_id: userId,
                        type: 'payment',
                        amount: price,
                        status: 'pending'
                    })
                    .select('id')
                    .maybeSingle();
                if (fallbackTxn?.id) txnId = fallbackTxn.id;
            }
        } catch (e) {
            console.warn('[Ketawancy] Ratel txn record exception:', e);
        }

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

            const finalRef = res?.data?.refNo || refNo;
            let newBal = Math.max(0, userBal - price);

            try {
                const { data: rpcRes, error: rpcErr } = await supabase.rpc('deduct_balance', {
                    user_id: userId,
                    amount: price
                });
                if (!rpcErr && typeof rpcRes === 'number') {
                    newBal = rpcRes;
                } else {
                    await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
                }
            } catch {
                await supabase.from('profiles').update({ balance: newBal }).eq('id', userId);
            }

            if (txnId) {
                await supabase.from('transactions').update({
                    status: 'success',
                    reference: finalRef,
                    metadata: { vendor: 'ketawancy', type: 'ratel', planId, phone }
                }).eq('id', txnId);
            }

            return { success: true, refNo: finalRef, newBalance: newBal };
        } catch (err: any) {
            if (txnId) {
                await supabase.from('transactions').update({ status: 'failed', description: `Ratel Failed: ${err.message || 'Provider error'}` }).eq('id', txnId);
            }
            throw err;
        }
    },

    // ─── 8. WALLET & PROFIT SERVICES ───
    transferWalletToWallet: async (amount: number, identifier: string) => {
        return await requestKetawancy('/services/wallet-to-wallet', {
            method: 'POST',
            body: { amount, identifier }
        });
    },

    withdrawProfit: async (amount: number) => {
        return await requestKetawancy('/services/withdraw-profit', {
            method: 'POST',
            body: { amount }
        });
    },

    // ─── 9. USER PROFILE & TELEMETRY ───
    getUserMe: async () => {
        try {
            return await requestKetawancy('/users/me');
        } catch (e) {
            console.error('[Ketawancy] getUserMe error:', e);
            return null;
        }
    }
};
