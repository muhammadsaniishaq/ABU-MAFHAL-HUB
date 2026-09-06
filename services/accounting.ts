import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface ExpenseRecord {
    id: string;
    title: string;
    category: string;
    amount: number;
    expense_date: string;
    payment_method: string;
    notes?: string | null;
    receipt_url?: string | null;
    created_by?: string | null;
    created_at?: string;
}

export interface ServiceProfitSummary {
    serviceName: string;
    type: string;
    revenue: number;
    cost: number;
    profit: number;
    marginPercent: number;
    transactionCount: number;
}

export interface UserLiquidityMetrics {
    totalUserBalances: number;
    totalUserCount: number;
    fundedUserCount: number;
    averageUserBalance: number;
    topHolders: {
        id: string;
        name: string;
        email: string;
        balance: number;
    }[];
}

export interface AccountingMetrics {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    successfulTransactionsCount: number;
    expensesCount: number;
    serviceBreakdown: Record<string, ServiceProfitSummary>;
    categoryExpenseBreakdown: Record<string, number>;
    recentTransactions: any[];
    recentExpenses: ExpenseRecord[];
    userLiquidity: UserLiquidityMetrics;
    dailyRunRate: number;
    projectedMonthlyProfit: number;
}

export const EXPENSE_CATEGORIES = [
    { id: 'api_funding', label: 'API Wallet Top-up', icon: 'wallet', color: '#F59E0B' },
    { id: 'server_hosting', label: 'Servers & Hosting', icon: 'server', color: '#3B82F6' },
    { id: 'marketing', label: 'Marketing & Ads', icon: 'megaphone', color: '#EC4899' },
    { id: 'salaries', label: 'Salaries & Staff', icon: 'people', color: '#8B5CF6' },
    { id: 'maintenance', label: 'App Maintenance & Dev', icon: 'construct', color: '#10B981' },
    { id: 'office_supplies', label: 'Office & Utilities', icon: 'business', color: '#64748B' },
    { id: 'refunds', label: 'User Refunds', icon: 'return-down-back', color: '#EF4444' },
    { id: 'other', label: 'Other Expenses', icon: 'receipt', color: '#D97706' },
];

export const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'cash', label: 'Cash / Hand' },
    { id: 'wallet', label: 'Admin Wallet' },
    { id: 'crypto', label: 'Cryptocurrency' },
];

const LOCAL_EXPENSES_KEY = 'abu_mafhal_local_expenses_v1';

// Hermes-safe currency formatter
export const formatNaira = (val: any): string => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₦0.00';
    return '₦' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// Hermes-safe date formatter
export const formatAccountingDate = (dateStr: any, withTime = false): string => {
    try {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()] || '';
        const day = d.getDate();
        const year = d.getFullYear();
        if (!withTime) return `${month} ${day}, ${year}`;
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${month} ${day}, ${year} ${hours}:${mins}`;
    } catch {
        return '';
    }
};

/**
 * Check if the currently logged-in user is Super Admin or explicitly permitted to view profits.
 */
export const checkProfitAccessClearance = async (): Promise<{ authorized: boolean; role: string; email: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { authorized: false, role: 'guest', email: '' };

        const userEmail = (user.email || '').toLowerCase().trim();
        const masterAdminEmails = [
            'sale.abumafhal@gmail.com',
            'abumafhal@gmail.com',
        ];

        // 1. Check known master emails
        if (masterAdminEmails.includes(userEmail)) {
            return { authorized: true, role: 'super_admin', email: userEmail };
        }

        // 2. Fetch profile role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, email')
            .eq('id', user.id)
            .maybeSingle();

        const role = profile?.role || user.user_metadata?.role || 'user';
        if (role === 'super_admin') {
            return { authorized: true, role: 'super_admin', email: userEmail };
        }

        // 3. Check if explicitly added in app_settings whitelist
        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'authorized_profit_admins')
            .maybeSingle();

        if (setting?.value) {
            const allowed = Array.isArray(setting.value) 
                ? setting.value.map((e: string) => String(e).toLowerCase().trim())
                : String(setting.value).toLowerCase().split(',').map(s => s.trim());
            
            if (allowed.includes(userEmail) || allowed.includes(user.id)) {
                return { authorized: true, role: 'authorized_admin', email: userEmail };
            }
        }

        return { authorized: false, role, email: userEmail };
    } catch (err) {
        console.error('[Accounting Security] Error checking clearance:', err);
        return { authorized: false, role: 'error', email: '' };
    }
};

/**
 * Fetch all expenses from Supabase (with automatic offline cache sync).
 */
export const fetchExpenses = async (startDate?: Date, endDate?: Date): Promise<ExpenseRecord[]> => {
    let remoteExpenses: ExpenseRecord[] = [];
    let tableExists = true;

    try {
        let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
        
        if (startDate) {
            query = query.gte('expense_date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
            query = query.lte('expense_date', endDate.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (!error && data) {
            remoteExpenses = data.map(item => ({
                id: item.id,
                title: item.title,
                category: item.category,
                amount: parseFloat(item.amount || 0),
                expense_date: item.expense_date,
                payment_method: item.payment_method || 'bank_transfer',
                notes: item.notes,
                receipt_url: item.receipt_url,
                created_by: item.created_by,
                created_at: item.created_at
            }));

            // Sync with local cache
            await AsyncStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(remoteExpenses));
            return remoteExpenses;
        } else if (error) {
            console.warn('[Accounting] Supabase expenses fetch warning:', error.message);
            tableExists = false;
        }
    } catch (err) {
        console.warn('[Accounting] Network error fetching expenses:', err);
        tableExists = false;
    }

    // Fallback to local cache if remote table is not yet deployed or error
    try {
        const cached = await AsyncStorage.getItem(LOCAL_EXPENSES_KEY);
        if (cached) {
            let list: ExpenseRecord[] = JSON.parse(cached);
            if (startDate) {
                const sStr = startDate.toISOString().split('T')[0];
                list = list.filter(e => e.expense_date >= sStr);
            }
            if (endDate) {
                const eStr = endDate.toISOString().split('T')[0];
                list = list.filter(e => e.expense_date <= eStr);
            }
            return list;
        }
    } catch (_) {}

    return remoteExpenses;
};

/**
 * Record a new operational expense.
 */
export const recordExpense = async (expense: {
    title: string;
    category: string;
    amount: number;
    expense_date?: string;
    payment_method?: string;
    notes?: string;
}): Promise<{ success: boolean; data?: ExpenseRecord; error?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            title: expense.title.trim(),
            category: expense.category,
            amount: parseFloat(expense.amount.toString()),
            expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
            payment_method: expense.payment_method || 'bank_transfer',
            notes: expense.notes?.trim() || null,
            created_by: user?.id || null,
        };

        // 1. Try inserting to Supabase
        const { data, error } = await supabase
            .from('expenses')
            .insert(payload)
            .select()
            .single();

        let newRecord: ExpenseRecord;
        if (!error && data) {
            newRecord = {
                id: data.id,
                title: data.title,
                category: data.category,
                amount: parseFloat(data.amount),
                expense_date: data.expense_date,
                payment_method: data.payment_method,
                notes: data.notes,
                created_by: data.created_by,
                created_at: data.created_at
            };
        } else {
            // Local fallback with generated ID
            newRecord = {
                id: 'loc_' + Date.now(),
                ...payload,
                created_at: new Date().toISOString()
            };
        }

        // 2. Update local cache
        const cached = await AsyncStorage.getItem(LOCAL_EXPENSES_KEY);
        const currentList: ExpenseRecord[] = cached ? JSON.parse(cached) : [];
        const updatedList = [newRecord, ...currentList];
        await AsyncStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(updatedList));

        return { success: true, data: newRecord };
    } catch (err: any) {
        console.error('[Accounting] Record expense failure:', err);
        return { success: false, error: err.message || 'Failed to record expense.' };
    }
};

/**
 * Delete an expense by ID.
 */
export const deleteExpense = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
        // Attempt deleting from Supabase
        await supabase.from('expenses').delete().eq('id', id);

        // Remove from local cache
        const cached = await AsyncStorage.getItem(LOCAL_EXPENSES_KEY);
        if (cached) {
            const list: ExpenseRecord[] = JSON.parse(cached);
            const filtered = list.filter(e => e.id !== id);
            await AsyncStorage.setItem(LOCAL_EXPENSES_KEY, JSON.stringify(filtered));
        }

        return { success: true };
    } catch (err: any) {
        console.error('[Accounting] Delete expense error:', err);
        return { success: false, error: err.message || 'Failed to delete expense.' };
    }
};

/**
 * Master Profit Computation Engine across all live transactions.
 */
export const calculateAccountingMetrics = async (
    startDate?: Date,
    endDate?: Date
): Promise<AccountingMetrics> => {
    // 1. Query live successful transactions
    let txQuery = supabase
        .from('transactions')
        .select('*')
        .in('status', ['success', 'completed'])
        .order('created_at', { ascending: false });

    if (startDate) {
        txQuery = txQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        txQuery = txQuery.lte('created_at', endDate.toISOString());
    }

    const { data: rawTxns } = await txQuery;
    const transactions = rawTxns || [];

    // 2. Pre-fetch Data Plans to calculate exact data margins
    const { data: dataPlans } = await supabase
        .from('data_plans')
        .select('plan_id, name, network, cost_price, selling_price, plan_type');
    
    // Create lookup map for data plans
    const dataPlanMap = new Map<string, { cost: number; sell: number; margin: number }>();
    let totalDataCostSum = 0;
    let totalDataSellSum = 0;
    if (dataPlans && dataPlans.length > 0) {
        for (const p of dataPlans) {
            const cost = parseFloat(p.cost_price || '0');
            const sell = parseFloat(p.selling_price || '0');
            const margin = sell > cost ? sell - cost : 0;
            if (p.plan_id) dataPlanMap.set(String(p.plan_id), { cost, sell, margin });
            if (p.name) dataPlanMap.set(p.name.toLowerCase().trim(), { cost, sell, margin });
            totalDataCostSum += cost;
            totalDataSellSum += sell;
        }
    }
    const defaultDataMarginPercent = totalDataSellSum > 0 
        ? ((totalDataSellSum - totalDataCostSum) / totalDataSellSum) 
        : 0.065; // Default ~6.5% profit margin

    // 3. Pre-fetch Airtime configs for discount margins
    const { data: airtimeConfigs } = await supabase
        .from('airtime_configs')
        .select('network, sell_percentage, cost_percentage');
    
    const airtimeMarginMap = new Map<string, number>();
    if (airtimeConfigs && airtimeConfigs.length > 0) {
        for (const c of airtimeConfigs) {
            const costDisc = parseFloat(c.cost_percentage || '3.0');
            const sellDisc = parseFloat(c.sell_percentage || '1.5');
            const margin = (costDisc - sellDisc) / 100;
            airtimeMarginMap.set((c.network || '').toUpperCase(), margin > 0 ? margin : 0.015);
        }
    }

    // 4. Fetch Expenses for the same period
    const expenses = await fetchExpenses(startDate, endDate);

    // 5. Query User Accounts & Total Balances (Total User Balances / Platform Liabilities)
    const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, balance')
        .order('balance', { ascending: false });

    let totalUserBalances = 0;
    let fundedUserCount = 0;
    const topHolders: { id: string; name: string; email: string; balance: number }[] = [];
    const userMap = new Map<string, { name: string; email: string }>();

    if (profilesData && profilesData.length > 0) {
        for (const p of profilesData) {
            const bal = parseFloat(p.balance || '0');
            userMap.set(p.id, {
                name: p.full_name || 'Customer',
                email: p.email || 'N/A'
            });
            if (bal > 0) {
                totalUserBalances += bal;
                fundedUserCount += 1;
                if (topHolders.length < 6) {
                    topHolders.push({
                        id: p.id,
                        name: p.full_name || 'Anonymous User',
                        email: p.email || 'N/A',
                        balance: bal,
                    });
                }
            }
        }
    }
    const totalUserCount = profilesData ? profilesData.length : 0;
    const averageUserBalance = fundedUserCount > 0 ? (totalUserBalances / fundedUserCount) : 0;

    // 6. Comprehensive Service Profit Matrix
    let totalRevenue = 0;
    let totalCost = 0;
    let grossProfit = 0;

    const serviceBreakdown: Record<string, ServiceProfitSummary> = {
        'data': { serviceName: 'Data Bundles', type: 'data', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'airtime': { serviceName: 'Airtime VTU', type: 'airtime', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'social_boost': { serviceName: 'Social Media Boost / SMM', type: 'social_boost', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'cac': { serviceName: 'CAC Business Services', type: 'cac', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'bvn': { serviceName: 'BVN Validation & Slips', type: 'bvn', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'nin': { serviceName: 'NIN Verification & Slips', type: 'nin', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'electricity': { serviceName: 'Electricity Bills (Disco)', type: 'electricity', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'tv': { serviceName: 'Cable TV (DSTV/GOTV)', type: 'tv', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'education': { serviceName: 'Exam PINs (WAEC/NECO/JAMB)', type: 'education', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'airtime_to_cash': { serviceName: 'Airtime to Cash', type: 'airtime_to_cash', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'virtual_cards': { serviceName: 'Virtual Cards (USD & NGN)', type: 'virtual_cards', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'crypto': { serviceName: 'Crypto Assets (USDT/BTC)', type: 'crypto', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'bulk_sms': { serviceName: 'Bulk SMS Messaging', type: 'bulk_sms', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'smile': { serviceName: 'Smile 4G Data & Voice', type: 'smile', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'recharge_pin': { serviceName: 'Recharge Card Printing', type: 'recharge_pin', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'transfer': { serviceName: 'Transfers & Agency Banking', type: 'transfer', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'funding_fee': { serviceName: 'Gateway & Top-up Fees', type: 'funding_fee', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
        'other': { serviceName: 'Other Services', type: 'other', revenue: 0, cost: 0, profit: 0, marginPercent: 0, transactionCount: 0 },
    };

    const enrichedTxns: any[] = [];

    for (const tx of transactions) {
        const amt = parseFloat(tx.amount || 0);
        if (amt <= 0) continue;

        const typeLower = (tx.type || '').toLowerCase();
        const descLower = (tx.description || '').toLowerCase();

        let itemRevenue = amt;
        let itemProfit = 0;
        let itemCost = 0;
        let categoryKey = 'other';

        if (typeLower === 'social_boost' || typeLower === 'social' || descLower.includes('social boost') || descLower.includes('followers') || descLower.includes('likes') || descLower.includes('views') || descLower.includes('smm') || descLower.includes('nineboost')) {
            categoryKey = 'social_boost';
            itemProfit = amt * 0.28; // ~28% SMM markup margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'cac' || typeLower === 'cac_registration' || descLower.includes('cac') || descLower.includes('business registration') || descLower.includes('corporate affairs') || descLower.includes('incorporation')) {
            categoryKey = 'cac';
            itemProfit = amt * 0.35; // ~35% Corporate Services margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'bvn' || typeLower === 'bvn_verification' || descLower.includes('bvn')) {
            categoryKey = 'bvn';
            itemProfit = amt * 0.50; // ~50% BVN margin (e.g. ₦150 cost, ₦300-₦500 charged)
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'nin' || typeLower === 'nin_verification' || descLower.includes('nin') || descLower.includes('nimc') || descLower.includes('ipe')) {
            categoryKey = 'nin';
            itemProfit = amt * 0.50; // ~50% NIN margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'airtime_to_cash' || descLower.includes('airtime to cash') || descLower.includes('a2c')) {
            categoryKey = 'airtime_to_cash';
            itemProfit = amt * 0.10; // ~10% conversion spread
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'card_creation' || typeLower === 'card_funding' || descLower.includes('virtual card') || descLower.includes('card creation') || descLower.includes('card funding')) {
            categoryKey = 'virtual_cards';
            itemProfit = amt * 0.05; // 5% creation / funding FX spread
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'bulk_sms' || descLower.includes('bulk sms') || descLower.includes('sms units')) {
            categoryKey = 'bulk_sms';
            itemProfit = amt * 0.30; // ~30% SMS gateway margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'smile' || descLower.includes('smile')) {
            categoryKey = 'smile';
            itemProfit = amt * 0.04; // 4% Smile margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'recharge_pin' || typeLower === 'recharge_pin_purchase' || descLower.includes('recharge pin') || descLower.includes('e-pin')) {
            categoryKey = 'recharge_pin';
            itemProfit = amt * 0.02; // ~2% pin printing margin
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'data' || descLower.includes('data bundle') || descLower.includes('sme') || descLower.includes('gifting')) {
            categoryKey = 'data';
            let matchedMargin = 0;
            for (const [key, plan] of dataPlanMap.entries()) {
                if (descLower.includes(key)) {
                    matchedMargin = plan.margin;
                    break;
                }
            }
            itemProfit = matchedMargin > 0 ? matchedMargin : (amt * defaultDataMarginPercent);
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'airtime' || descLower.includes('airtime') || descLower.includes('vtu')) {
            categoryKey = 'airtime';
            let marginRate = 0.02;
            if (descLower.includes('mtn')) marginRate = airtimeMarginMap.get('MTN') || 0.015;
            else if (descLower.includes('glo')) marginRate = airtimeMarginMap.get('GLO') || 0.04;
            else if (descLower.includes('airtel')) marginRate = airtimeMarginMap.get('AIRTEL') || 0.025;
            else if (descLower.includes('9mobile')) marginRate = airtimeMarginMap.get('9MOBILE') || 0.045;
            
            itemProfit = amt * marginRate;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'electricity' || descLower.includes('electric') || descLower.includes('disco') || descLower.includes('meter')) {
            categoryKey = 'electricity';
            itemProfit = 100;
            if (itemProfit > amt) itemProfit = amt * 0.02;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'tv' || descLower.includes('dstv') || descLower.includes('gotv') || descLower.includes('startimes') || descLower.includes('showmax') || descLower.includes('cable')) {
            categoryKey = 'tv';
            itemProfit = 100;
            if (itemProfit > amt) itemProfit = amt * 0.015;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'education' || descLower.includes('waec') || descLower.includes('neco') || descLower.includes('nabteb') || descLower.includes('jamb')) {
            categoryKey = 'education';
            itemProfit = 350;
            if (itemProfit > amt) itemProfit = amt * 0.08;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower.startsWith('crypto') || descLower.includes('crypto') || descLower.includes('usdt') || descLower.includes('btc') || descLower.includes('swap')) {
            categoryKey = 'crypto';
            itemProfit = amt * 0.015;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        } else if (typeLower === 'fee' || descLower.includes('deposit fee') || descLower.includes('monnify fee') || descLower.includes('gateway fee')) {
            categoryKey = 'funding_fee';
            itemProfit = amt;
            itemCost = 0;
        } else if (typeLower === 'transfer_fee' || descLower.includes('transfer fee') || descLower.includes('interbank fee')) {
            categoryKey = 'transfer';
            itemProfit = amt;
            itemCost = 0;
        } else if (typeLower === 'deposit' || typeLower === 'transfer') {
            continue;
        } else {
            categoryKey = 'other';
            itemProfit = amt * 0.05;
            itemCost = Math.max(0, itemRevenue - itemProfit);
        }

        totalRevenue += itemRevenue;
        totalCost += itemCost;
        grossProfit += itemProfit;

        if (serviceBreakdown[categoryKey]) {
            serviceBreakdown[categoryKey].revenue += itemRevenue;
            serviceBreakdown[categoryKey].cost += itemCost;
            serviceBreakdown[categoryKey].profit += itemProfit;
            serviceBreakdown[categoryKey].transactionCount += 1;
        }

        if (enrichedTxns.length < 30) {
            const userInfo = userMap.get(tx.user_id);
            enrichedTxns.push({
                ...tx,
                customerName: userInfo?.name || 'Registered Customer',
                customerEmail: userInfo?.email || '',
                serviceCategory: categoryKey,
                serviceName: serviceBreakdown[categoryKey]?.serviceName || 'Service Order',
                revenue: itemRevenue,
                cost: itemCost,
                profit: itemProfit,
                marginPercent: itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0
            });
        }
    }

    // Compute margins for service breakdowns
    for (const key of Object.keys(serviceBreakdown)) {
        const item = serviceBreakdown[key];
        item.marginPercent = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
    }

    // Aggregate expenses
    let totalExpenses = 0;
    const categoryExpenseBreakdown: Record<string, number> = {};
    for (const exp of expenses) {
        totalExpenses += exp.amount;
        categoryExpenseBreakdown[exp.category] = (categoryExpenseBreakdown[exp.category] || 0) + exp.amount;
    }

    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Daily Run-Rate and Projections
    const now = new Date();
    let daysCount = 30;
    if (startDate && endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } else if (startDate) {
        const diffTime = Math.abs(now.getTime() - startDate.getTime());
        daysCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    const dailyRunRate = netProfit / daysCount;
    const projectedMonthlyProfit = dailyRunRate * 30;

    return {
        totalRevenue,
        totalCost,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin,
        successfulTransactionsCount: transactions.length,
        expensesCount: expenses.length,
        serviceBreakdown,
        categoryExpenseBreakdown,
        recentTransactions: enrichedTxns,
        recentExpenses: expenses.slice(0, 15),
        userLiquidity: {
            totalUserBalances,
            totalUserCount,
            fundedUserCount,
            averageUserBalance,
            topHolders
        },
        dailyRunRate,
        projectedMonthlyProfit,
    };
};

/**
 * Generate a PDF Profit & Loss Executive Statement.
 */
export const generateProfitLossPDF = async (
    metrics: AccountingMetrics,
    periodLabel: string
): Promise<void> => {
    try {
        const isNetProfitable = metrics.netProfit >= 0;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Executive Profit & Loss Statement</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0F172A; }
                    .header { border-bottom: 2px solid #D97706; padding-bottom: 12px; margin-bottom: 20px; }
                    .brand { font-size: 22px; font-weight: 900; color: #0F172A; }
                    .sub { font-size: 11px; color: #64748B; margin-top: 2px; }
                    .meta { margin-top: 10px; font-size: 12px; color: #475569; }
                    
                    .kpi-grid { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 8px; }
                    .kpi-box { flex: 1; padding: 12px; border-radius: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; }
                    .kpi-label { font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; }
                    .kpi-val { font-size: 16px; font-weight: 900; margin-top: 4px; }
                    
                    .net-box { padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: center; background: ${isNetProfitable ? '#F0FDF4' : '#FEF2F2'}; border: 1px solid ${isNetProfitable ? '#86EFAC' : '#FCA5A5'}; }
                    .net-val { font-size: 24px; font-weight: 900; color: ${isNetProfitable ? '#16A34A' : '#DC2626'}; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                    th { background: #0F172A; color: white; padding: 8px 10px; text-align: left; font-size: 10px; }
                    td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
                    .num { text-align: right; }
                    
                    .footer { text-align: center; font-size: 10px; color: #94A3B8; margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="brand">ABU MAFHAL HUB</div>
                    <div class="sub">EXECUTIVE FINANCIAL & PROFIT LEDGER</div>
                    <div class="meta">
                        <b>Period:</b> ${periodLabel} &nbsp;•&nbsp; 
                        <b>Generated on:</b> ${formatAccountingDate(new Date(), true)}
                    </div>
                </div>

                <div class="net-box">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: ${isNetProfitable ? '#16A34A' : '#DC2626'}">
                        ${isNetProfitable ? 'NET OPERATING PROFIT' : 'NET OPERATING DEFICIT'}
                    </div>
                    <div class="net-val">${formatNaira(metrics.netProfit)}</div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
                        Gross Profit Margin: <b>${metrics.profitMargin.toFixed(1)}%</b>
                    </div>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-box">
                        <div class="kpi-label">Gross Revenue</div>
                        <div class="kpi-val" style="color: #0F172A">${formatNaira(metrics.totalRevenue)}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-label">Cost of Sales (API)</div>
                        <div class="kpi-val" style="color: #64748B">${formatNaira(metrics.totalCost)}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-label">Gross Profit</div>
                        <div class="kpi-val" style="color: #10B981">${formatNaira(metrics.grossProfit)}</div>
                    </div>
                    <div class="kpi-box">
                        <div class="kpi-label">Total Expenses</div>
                        <div class="kpi-val" style="color: #EF4444">${formatNaira(metrics.totalExpenses)}</div>
                    </div>
                </div>

                <h4 style="margin-bottom: 6px; font-size: 13px;">Profit Breakdown by Service</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Service</th>
                            <th class="num">Txns</th>
                            <th class="num">Revenue</th>
                            <th class="num">Cost of Sales</th>
                            <th class="num">Profit</th>
                            <th class="num">Margin</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.values(metrics.serviceBreakdown)
                            .filter(s => s.revenue > 0 || s.transactionCount > 0)
                            .map(s => `
                                <tr>
                                    <td><b>${s.serviceName}</b></td>
                                    <td class="num">${s.transactionCount}</td>
                                    <td class="num">${formatNaira(s.revenue)}</td>
                                    <td class="num">${formatNaira(s.cost)}</td>
                                    <td class="num" style="color: #10B981; font-weight: bold;">${formatNaira(s.profit)}</td>
                                    <td class="num">${s.marginPercent.toFixed(1)}%</td>
                                </tr>
                            `).join('')}
                    </tbody>
                </table>

                <h4 style="margin-bottom: 6px; font-size: 13px;">Recent Operating Expenditures</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Method</th>
                            <th class="num">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metrics.recentExpenses.length > 0 
                            ? metrics.recentExpenses.map(e => `
                                <tr>
                                    <td>${formatAccountingDate(e.expense_date)}</td>
                                    <td><b>${e.title}</b></td>
                                    <td>${e.category.replace('_', ' ').toUpperCase()}</td>
                                    <td>${e.payment_method.replace('_', ' ')}</td>
                                    <td class="num" style="color: #EF4444; font-weight: bold;">-${formatNaira(e.amount)}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="5" style="text-align: center; color: #94A3B8;">No expenses recorded in this period.</td></tr>'
                        }
                    </tbody>
                </table>

                <div class="footer">
                    Confidential Document • Generated from Abu Mafhal Hub Super Admin Console • 
                    Secured by Abu Mafhal Cloud Accounting
                </div>
            </body>
            </html>
        `;

        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err: any) {
        Alert.alert('PDF Export Notice', err.message || 'Failed to generate PDF document.');
    }
};
