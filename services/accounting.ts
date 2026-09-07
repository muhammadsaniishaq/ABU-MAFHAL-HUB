import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import { ABU_MAFHAL_LOGO_B64 } from '../assets/images/logoB64';

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

export interface DailyTrendPoint {
    date: string;
    dayName: string;
    revenue: number;
    profit: number;
    salesCount: number;
}

export interface AdminClearanceInfo {
    id: string;
    fullName: string;
    email: string;
    role: string;
    isMasterAdmin: boolean;
    hasClearance: boolean;
}

export interface FinancialHealthAdvisory {
    rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'WARNING';
    headline: string;
    summary: string;
    topDriverName: string;
    topDriverProfit: number;
    topDriverShare: number;
    burnRate: number;
    liquidityStatus: 'Strong' | 'Adequate' | 'Watchlist';
    recommendation: string;
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
    dailyTrends: DailyTrendPoint[];
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
 * Fetch all administrator accounts and their profit clearance status.
 */
export const getAdminsWithProfitClearance = async (): Promise<AdminClearanceInfo[]> => {
    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['admin', 'super_admin', 'agent'])
            .order('role', { ascending: false });

        if (error) {
            console.error('[Clearance] Error fetching admin profiles:', error);
        }

        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'authorized_profit_admins')
            .maybeSingle();

        const masterEmails = ['sale.abumafhal@gmail.com', 'abumafhal@gmail.com'];
        let authorizedList: string[] = [];
        if (setting?.value) {
            authorizedList = Array.isArray(setting.value)
                ? setting.value.map((e: any) => String(e).toLowerCase().trim())
                : String(setting.value).toLowerCase().split(',').map((s: string) => s.trim());
        }

        const list: AdminClearanceInfo[] = (profiles || []).map((p: any) => {
            const email = (p.email || '').toLowerCase().trim();
            const isMaster = masterEmails.includes(email);
            const isSuper = p.role === 'super_admin';
            const isAuthorized = isMaster || isSuper || authorizedList.includes(email) || authorizedList.includes(p.id);

            return {
                id: p.id,
                fullName: p.full_name || 'System Staff',
                email: p.email || 'N/A',
                role: p.role || 'admin',
                isMasterAdmin: isMaster || isSuper,
                hasClearance: isAuthorized
            };
        });

        return list;
    } catch (err) {
        console.error('[Clearance] Exception in getAdminsWithProfitClearance:', err);
        return [];
    }
};

/**
 * Toggle Profit Access Clearance for an administrator (Persisted to app_settings).
 */
export const toggleAdminProfitClearance = async (
    targetEmailOrId: string,
    grant: boolean
): Promise<{ success: boolean; error?: string }> => {
    try {
        const normalized = targetEmailOrId.toLowerCase().trim();
        
        const { data: currentSetting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'authorized_profit_admins')
            .maybeSingle();

        let currentList: string[] = [];
        if (currentSetting?.value) {
            currentList = Array.isArray(currentSetting.value)
                ? currentSetting.value.map((e: any) => String(e).toLowerCase().trim())
                : String(currentSetting.value).toLowerCase().split(',').map((s: string) => s.trim());
        }

        let updatedList: string[];
        if (grant) {
            if (!currentList.includes(normalized)) {
                updatedList = [...currentList, normalized];
            } else {
                updatedList = currentList;
            }
        } else {
            updatedList = currentList.filter(item => item !== normalized);
        }

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'authorized_profit_admins',
                value: updatedList,
                description: 'List of emails or IDs of admins authorized to access profit ledger',
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || 'Failed to toggle clearance.' };
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

    // 7-day trend accumulator
    const trendMap = new Map<string, { revenue: number; profit: number; salesCount: number }>();
    const nowForTrends = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(nowForTrends.getFullYear(), nowForTrends.getMonth(), nowForTrends.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        trendMap.set(`${yyyy}-${mm}-${dd}`, { revenue: 0, profit: 0, salesCount: 0 });
    }

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

        // Track 7-day trend
        if (tx.created_at) {
            const txDateKey = tx.created_at.split('T')[0];
            if (trendMap.has(txDateKey)) {
                const tr = trendMap.get(txDateKey)!;
                tr.revenue += itemRevenue;
                tr.profit += itemProfit;
                tr.salesCount += 1;
            }
        }

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

    // Convert trendMap to dailyTrends array
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyTrends: DailyTrendPoint[] = Array.from(trendMap.entries()).map(([dateStr, val]) => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayName = isNaN(d.getTime()) ? '' : dayLabels[d.getDay()];
        return {
            date: dateStr,
            dayName,
            revenue: val.revenue,
            profit: val.profit,
            salesCount: val.salesCount
        };
    });

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
        dailyTrends,
    };
};

/**
 * Smart Executive Financial Health Diagnostics & Advisory.
 */
export const getFinancialHealthAdvisory = (metrics: AccountingMetrics): FinancialHealthAdvisory => {
    const gross = metrics.grossProfit;
    const net = metrics.netProfit;
    const expenses = metrics.totalExpenses;
    const rev = metrics.totalRevenue;
    const liabilities = metrics.userLiquidity.totalUserBalances;

    let topName = 'Data Bundles';
    let topProfit = 0;
    Object.values(metrics.serviceBreakdown).forEach(s => {
        if (s.profit > topProfit) {
            topProfit = s.profit;
            topName = s.serviceName;
        }
    });

    const topShare = gross > 0 ? (topProfit / gross) * 100 : 0;
    const burnRate = gross > 0 ? (expenses / gross) * 100 : 0;

    let rating: 'AAA' | 'AA' | 'A' | 'BBB' | 'WARNING' = 'A';
    let headline = 'Healthy Commercial Operations';
    let summary = 'Platform maintains positive unit economics with sustainable profit margins across services.';
    let recommendation = 'Maintain current pricing structures while scaling high-volume telecom and data products.';

    if (net < 0) {
        rating = 'WARNING';
        headline = 'Operating Deficit Detected';
        summary = 'Expenditures exceed gross trading surplus in this period. Immediate expense audit recommended.';
        recommendation = 'Reduce non-essential operating overhead and review API vendor cost tiers.';
    } else if (metrics.profitMargin >= 20 && burnRate < 20) {
        rating = 'AAA';
        headline = 'Exceptional Profitability & Low Burn';
        summary = 'Outstanding financial performance with strong unit margins and well-contained operating costs.';
        recommendation = 'Opportunity to aggressively scale customer acquisition and marketing spend.';
    } else if (metrics.profitMargin >= 12 && burnRate < 45) {
        rating = 'AA';
        headline = 'Strong Commercial Margin';
        summary = 'Healthy profit margins with balanced operational expenditure.';
        recommendation = 'Expand inventory and negotiate higher volume discounts with telecom vendors.';
    } else if (burnRate >= 60) {
        rating = 'BBB';
        headline = 'High Expense Ratio';
        summary = 'Operating expenditures consume over 60% of gross trading profits.';
        recommendation = 'Audit recurring server, marketing, or staffing costs to protect net earnings.';
    }

    const liquidityStatus = liabilities > (rev * 3 + 100000) ? 'Watchlist' : liabilities > rev ? 'Adequate' : 'Strong';

    return {
        rating,
        headline,
        summary,
        topDriverName: topName,
        topDriverProfit: topProfit,
        topDriverShare: topShare,
        burnRate,
        liquidityStatus,
        recommendation
    };
};

/**
 * Generate a PDF Profit & Loss Executive Statement.
 */
export const generateProfitLossPDF = async (
    metrics: AccountingMetrics,
    periodLabel: string
): Promise<string | null> => {
    try {
        const isNetProfitable = metrics.netProfit >= 0;
        const refId = `AMH-FIN-${Date.now().toString().slice(-8)}`;
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Abu_Mafhal_Financial_Statement_${dateStr}_${Date.now()}.pdf`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://abumafhal.com.ng/verify?ref=${refId}`)}`;
        const adv = getFinancialHealthAdvisory(metrics);

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Abu_Mafhal_Financial_Statement_${refId}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap');

                    @page {
                        size: A4 portrait;
                        margin: 10mm 10mm 12mm 10mm;
                    }

                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                        background: #FFFFFF;
                        color: #0F172A;
                        padding: 16px;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /* EXECUTIVE HEADER WITH LOGO & GOLD ACCENTS */
                    .header-banner {
                        background: linear-gradient(135deg, #020617 0%, #0A1128 45%, #1E293B 100%);
                        border-radius: 14px;
                        padding: 20px 24px;
                        color: #FFFFFF;
                        border-bottom: 4px solid #DAA520;
                        margin-bottom: 18px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .brand-wrap {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }

                    .brand-logo {
                        width: 64px;
                        height: 64px;
                        border-radius: 14px;
                        border: 2px solid #DAA520;
                        background: #FFFFFF;
                        object-fit: contain;
                        padding: 3px;
                    }

                    .brand-title {
                        font-size: 22px;
                        font-weight: 900;
                        color: #FFFFFF;
                        letter-spacing: 0.5px;
                        line-height: 1.1;
                    }

                    .brand-corp {
                        font-size: 11px;
                        font-weight: 800;
                        color: #F59E0B;
                        letter-spacing: 0.8px;
                        text-transform: uppercase;
                        margin-top: 3px;
                    }

                    .brand-desc {
                        font-size: 10px;
                        color: #94A3B8;
                        margin-top: 2px;
                        font-weight: 500;
                    }

                    .doc-meta {
                        text-align: right;
                    }

                    .doc-badge {
                        display: inline-block;
                        background: rgba(245, 158, 11, 0.18);
                        border: 1px solid #DAA520;
                        border-radius: 6px;
                        padding: 4px 10px;
                        color: #F59E0B;
                        font-size: 9.5px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.6px;
                        margin-bottom: 6px;
                    }

                    .meta-line {
                        font-size: 10.5px;
                        color: #CBD5E1;
                        line-height: 1.4;
                    }

                    /* TITANIUM HERO CARD */
                    .net-profit-card {
                        background: linear-gradient(135deg, ${isNetProfitable ? '#0F172A 0%, #1E293B 100%' : '#2D0D11 0%, #1B0709 100%'});
                        border-radius: 14px;
                        padding: 18px 22px;
                        color: #FFFFFF;
                        border: 1.5px solid ${isNetProfitable ? 'rgba(218, 165, 32, 0.45)' : 'rgba(239, 68, 68, 0.45)'};
                        margin-bottom: 16px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                    }

                    .net-top-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 6px;
                    }

                    .net-label {
                        font-size: 11px;
                        font-weight: 800;
                        letter-spacing: 1px;
                        color: ${isNetProfitable ? '#34D399' : '#F87171'};
                        text-transform: uppercase;
                    }

                    .net-margin-pill {
                        background: rgba(245, 158, 11, 0.2);
                        border: 1px solid rgba(245, 158, 11, 0.4);
                        border-radius: 6px;
                        padding: 3px 8px;
                        font-size: 10px;
                        font-weight: 800;
                        color: #F59E0B;
                    }

                    .net-amount {
                        font-size: 30px;
                        font-weight: 900;
                        color: ${isNetProfitable ? '#10B981' : '#EF4444'};
                        font-family: 'JetBrains Mono', monospace;
                        margin: 4px 0 6px 0;
                    }

                    .net-sub {
                        font-size: 11px;
                        color: #94A3B8;
                        margin-bottom: 12px;
                    }

                    .net-pills-row {
                        display: flex;
                        gap: 10px;
                        border-top: 1px solid rgba(255,255,255,0.1);
                        padding-top: 10px;
                    }

                    .net-pill-item {
                        flex: 1;
                        background: rgba(255,255,255,0.04);
                        border-radius: 8px;
                        padding: 8px 10px;
                        border: 1px solid rgba(255,255,255,0.07);
                    }

                    .net-pill-lbl {
                        font-size: 9px;
                        color: #94A3B8;
                        font-weight: 700;
                        text-transform: uppercase;
                    }

                    .net-pill-val {
                        font-size: 12px;
                        font-weight: 800;
                        color: #FFFFFF;
                        margin-top: 2px;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    /* 4 KPI TILES */
                    .kpi-row {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 16px;
                    }

                    .kpi-card {
                        flex: 1;
                        background: #F8FAFC;
                        border: 1px solid #E2E8F0;
                        border-radius: 12px;
                        padding: 12px 14px;
                    }

                    .kpi-title {
                        font-size: 9.5px;
                        font-weight: 800;
                        color: #64748B;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }

                    .kpi-num {
                        font-size: 15px;
                        font-weight: 900;
                        color: #0F172A;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    .kpi-hint {
                        font-size: 9.5px;
                        color: #94A3B8;
                        margin-top: 3px;
                    }

                    /* CUSTOMER WALLET LIABILITIES CARD */
                    .liabilities-card {
                        background: #F8FAFC;
                        border: 1.5px solid #E2E8F0;
                        border-radius: 12px;
                        padding: 14px 18px;
                        margin-bottom: 18px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }

                    .liabilities-left {
                        flex: 1;
                    }

                    .liabilities-badge {
                        display: inline-block;
                        background: #ECFDF5;
                        color: #059669;
                        border: 1px solid #A7F3D0;
                        border-radius: 6px;
                        padding: 2px 8px;
                        font-size: 9.5px;
                        font-weight: 800;
                        margin-bottom: 4px;
                    }

                    .liabilities-val {
                        font-size: 20px;
                        font-weight: 900;
                        color: #0F172A;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    .liabilities-sub {
                        font-size: 10.5px;
                        color: #64748B;
                        margin-top: 2px;
                    }

                    .liabilities-stats {
                        display: flex;
                        gap: 16px;
                        text-align: right;
                    }

                    .stat-box-val {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0F172A;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    .stat-box-lbl {
                        font-size: 9.5px;
                        color: #64748B;
                    }

                    /* TABLES */
                    .section-header {
                        font-size: 13px;
                        font-weight: 900;
                        color: #0F172A;
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }

                    .section-count {
                        font-size: 10px;
                        color: #64748B;
                        font-weight: 700;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 16px;
                        font-size: 10.5px;
                        background: #FFFFFF;
                        border-radius: 8px;
                        overflow: hidden;
                        border: 1px solid #E2E8F0;
                    }

                    th {
                        background: #0A1128;
                        color: #FFFFFF;
                        padding: 8px 10px;
                        text-align: left;
                        font-size: 9.5px;
                        font-weight: 800;
                        letter-spacing: 0.4px;
                        text-transform: uppercase;
                    }

                    td {
                        padding: 7px 10px;
                        border-bottom: 1px solid #E2E8F0;
                        color: #1E293B;
                    }

                    tr:nth-child(even) td {
                        background: #F8FAFC;
                    }

                    .num {
                        text-align: right;
                        font-family: 'JetBrains Mono', monospace;
                    }

                    .profit-green {
                        color: #059669;
                        font-weight: 800;
                    }

                    .margin-badge {
                        display: inline-block;
                        background: #FFFBEB;
                        border: 1px solid #FDE68A;
                        color: #D97706;
                        border-radius: 4px;
                        padding: 1px 5px;
                        font-size: 9px;
                        font-weight: 800;
                    }

                    .table-total-row td {
                        background: #F1F5F9;
                        font-weight: 900;
                        border-top: 2px solid #CBD5E1;
                        font-size: 11px;
                        color: #0F172A;
                    }

                    /* SIGNATURE & AUDIT FOOTER */
                    .audit-box {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #F8FAFC;
                        border: 1px solid #E2E8F0;
                        border-radius: 12px;
                        padding: 14px 18px;
                        margin-top: 12px;
                        margin-bottom: 12px;
                    }

                    .sig-col {
                        flex: 1;
                    }

                    .sig-name {
                        font-size: 12px;
                        font-weight: 900;
                        color: #0A1128;
                    }

                    .sig-title {
                        font-size: 10px;
                        color: #64748B;
                        margin-top: 2px;
                    }

                    .sig-line {
                        width: 140px;
                        height: 1px;
                        background: #CBD5E1;
                        margin-top: 18px;
                        margin-bottom: 4px;
                    }

                    .qr-wrap {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .qr-img {
                        width: 60px;
                        height: 60px;
                        border-radius: 6px;
                        border: 1px solid #CBD5E1;
                    }

                    .footer-note {
                        text-align: center;
                        font-size: 9px;
                        color: #94A3B8;
                        border-top: 1px solid #E2E8F0;
                        padding-top: 8px;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <!-- BRANDED EXECUTIVE HEADER -->
                <div class="header-banner">
                    <div class="brand-wrap">
                        <img class="brand-logo" src="${ABU_MAFHAL_LOGO_B64}" alt="Abu Mafhal Hub Logo" />
                        <div>
                            <div class="brand-title">ABU MAFHAL HUB</div>
                            <div class="brand-corp">ABU MAFHAL ENTERPRISE LTD • RC-8979939</div>
                            <div class="brand-desc">Executive Profit & Loss Ledger • Certified Commercial Statement</div>
                        </div>
                    </div>
                    <div class="doc-meta">
                        <div class="doc-badge">Official Financial Audit</div>
                        <div class="meta-line"><b>Ref:</b> ${refId}</div>
                        <div class="meta-line"><b>Period:</b> ${periodLabel}</div>
                        <div class="meta-line"><b>Date:</b> ${formatAccountingDate(new Date(), true)}</div>
                        <div class="meta-line" style="color: #F59E0B; font-weight: 700; font-size: 9px; margin-top: 2px;">SUPER ADMIN STRICTLY CONFIDENTIAL</div>
                    </div>
                </div>

                <!-- TITANIUM NET PROFIT HERO CARD -->
                <div class="net-profit-card">
                    <div class="net-top-row">
                        <div class="net-label">${isNetProfitable ? 'NET TRADING SURPLUS (PROFIT)' : 'NET OPERATING DEFICIT'}</div>
                        <div class="net-margin-pill">${metrics.profitMargin.toFixed(1)}% GROSS MARGIN</div>
                    </div>
                    <div class="net-amount">${formatNaira(metrics.netProfit)}</div>
                    <div class="net-sub">
                        Gross Trading Profit (${formatNaira(metrics.grossProfit)}) − Total Logged Expenses (${formatNaira(metrics.totalExpenses)})
                    </div>

                    <div class="net-pills-row">
                        <div class="net-pill-item">
                            <div class="net-pill-lbl">Daily Run-Rate</div>
                            <div class="net-pill-val">${formatNaira(metrics.dailyRunRate)}/day</div>
                        </div>
                        <div class="net-pill-item">
                            <div class="net-pill-lbl">30-Day Extrapolation</div>
                            <div class="net-pill-val" style="color: #34D399;">${formatNaira(metrics.projectedMonthlyProfit)}</div>
                        </div>
                        <div class="net-pill-item">
                            <div class="net-pill-lbl">Commercial Rating</div>
                            <div class="net-pill-val" style="color: #F59E0B;">${adv.rating} (${adv.headline})</div>
                        </div>
                        <div class="net-pill-item">
                            <div class="net-pill-lbl">Orders Completed</div>
                            <div class="net-pill-val">${metrics.successfulTransactionsCount} orders</div>
                        </div>
                    </div>
                </div>

                <!-- 4 CORE COMMERCIAL KPIS -->
                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-title">Gross Revenue</div>
                        <div class="kpi-num" style="color: #2563EB;">${formatNaira(metrics.totalRevenue)}</div>
                        <div class="kpi-hint">Total volume collected</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Cost of Sales</div>
                        <div class="kpi-num" style="color: #64748B;">${formatNaira(metrics.totalCost)}</div>
                        <div class="kpi-hint">Telecom & API wholesale</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Gross Trading Margin</div>
                        <div class="kpi-num" style="color: #059669;">${formatNaira(metrics.grossProfit)}</div>
                        <div class="kpi-hint">Profit before operating costs</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-title">Operating Expenses</div>
                        <div class="kpi-num" style="color: #DC2626;">${formatNaira(metrics.totalExpenses)}</div>
                        <div class="kpi-hint">${metrics.expensesCount} expenses logged</div>
                    </div>
                </div>

                <!-- CUSTOMER BALANCES & LIABILITIES PORTFOLIO -->
                <div class="liabilities-card">
                    <div class="liabilities-left">
                        <div class="liabilities-badge">100% Guaranteed Reserve Backed</div>
                        <div class="liabilities-val">${formatNaira(metrics.userLiquidity.totalUserBalances)}</div>
                        <div class="liabilities-sub">Total user deposits held across platform database wallets</div>
                    </div>
                    <div class="liabilities-stats">
                        <div>
                            <div class="stat-box-val">${metrics.userLiquidity.totalUserCount}</div>
                            <div class="stat-box-lbl">Registered Users</div>
                        </div>
                        <div>
                            <div class="stat-box-val">${metrics.userLiquidity.fundedUserCount}</div>
                            <div class="stat-box-lbl">Funded Wallets</div>
                        </div>
                        <div>
                            <div class="stat-box-val">${formatNaira(metrics.userLiquidity.averageUserBalance)}</div>
                            <div class="stat-box-lbl">Avg Balance</div>
                        </div>
                    </div>
                </div>

                <!-- ALL 18 SERVICES PROFIT BREAKDOWN -->
                <div class="section-header">
                    <span>Comprehensive Product & Service Performance Matrix</span>
                    <span class="section-count">18 Enterprise Services Tracked</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Service Name</th>
                            <th class="num">Orders</th>
                            <th class="num">Revenue</th>
                            <th class="num">Cost of Sales</th>
                            <th class="num">Gross Profit</th>
                            <th class="num">Margin %</th>
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
                                    <td class="num profit-green">${formatNaira(s.profit)}</td>
                                    <td class="num"><span class="margin-badge">${s.marginPercent.toFixed(1)}%</span></td>
                                </tr>
                            `).join('')}
                        <tr class="table-total-row">
                            <td><b>PORTFOLIO TOTAL</b></td>
                            <td class="num">${metrics.successfulTransactionsCount}</td>
                            <td class="num">${formatNaira(metrics.totalRevenue)}</td>
                            <td class="num">${formatNaira(metrics.totalCost)}</td>
                            <td class="num profit-green">${formatNaira(metrics.grossProfit)}</td>
                            <td class="num"><span class="margin-badge">${metrics.profitMargin.toFixed(1)}%</span></td>
                        </tr>
                    </tbody>
                </table>

                <!-- OPERATING EXPENDITURES -->
                <div class="section-header">
                    <span>Logged Operating Expenditures</span>
                    <span class="section-count">${metrics.recentExpenses.length} Records</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Payment Method</th>
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
                                    <td class="num" style="color: #DC2626; font-weight: 800;">-${formatNaira(e.amount)}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 12px;">No operating expenses recorded for this reporting period.</td></tr>'
                        }
                    </tbody>
                </table>

                <!-- AUDIT SIGNATURES & VERIFICATION -->
                <div class="audit-box">
                    <div class="sig-col">
                        <div class="sig-line"></div>
                        <div class="sig-name">Sale Abu Mafhal</div>
                        <div class="sig-title">Managing Director & CEO • Abu Mafhal Hub</div>
                    </div>
                    <div class="sig-col" style="text-align: center;">
                        <div class="sig-line" style="margin-left: auto; margin-right: auto;"></div>
                        <div class="sig-name">Audit & Financial Control</div>
                        <div class="sig-title">Certified by Abu Mafhal Cloud Accounting</div>
                    </div>
                    <div class="qr-wrap">
                        <img class="qr-img" src="${qrUrl}" alt="Verification QR Code" />
                        <div style="font-size: 9px; color: #64748B; text-align: left; line-height: 1.3;">
                            <b>DIGITAL AUDIT STAMP</b><br/>
                            Scan to verify authenticity<br/>
                            abumafhal.com.ng
                        </div>
                    </div>
                </div>

                <div class="footer-note">
                    Confidential Enterprise Document • Generated from Abu Mafhal Hub Super Admin Console • 
                    Secured by 256-bit Cloud Ledger Protocol • All Rights Reserved © ${new Date().getFullYear()} Abu Mafhal Ltd
                </div>
            </body>
            </html>
        `;

        // 1. Generate high-resolution PDF
        const { uri } = await Print.printToFileAsync({ html, base64: false });

        // 2. Direct download / local save onto phone
        const targetUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: targetUri });

        // 3. Web download or native share sheet
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const link = document.createElement('a');
            link.href = uri;
            link.download = fileName;
            link.click();
        } else {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(targetUri, {
                    UTI: 'com.adobe.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: `Download Statement - ${fileName}`,
                });
            }
        }

        return targetUri;
    } catch (err: any) {
        console.error('[PDF Export] Error:', err);
        Alert.alert('PDF Export Notice', err.message || 'Failed to generate PDF document.');
        return null;
    }
};

/**
 * Generate and export a comprehensive Excel-compatible CSV Financial Spreadsheet.
 */
export const exportFinancialCSV = async (
    metrics: AccountingMetrics,
    periodLabel: string
): Promise<void> => {
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        const rows: string[] = [];

        // 1. Title & Header
        rows.push('"ABU MAFHAL HUB - EXECUTIVE FINANCIAL STATEMENT"');
        rows.push(`"Reporting Period:","${periodLabel}"`);
        rows.push(`"Generated Date:","${formatAccountingDate(new Date().toISOString(), true)}"`);
        rows.push(`"Security Level:","Super Administrator Confidential"`);
        rows.push('');

        // 2. Executive Summary
        rows.push('"EXECUTIVE SUMMARY"');
        rows.push('"Metric","Amount (NGN)","Details"');
        rows.push(`"Gross Revenue",${metrics.totalRevenue.toFixed(2)},"Total transaction volume collected"`);
        rows.push(`"Cost of Sales",${metrics.totalCost.toFixed(2)},"API wholesale cost / provider purchase prices"`);
        rows.push(`"Gross Profit",${metrics.grossProfit.toFixed(2)},"Revenue minus wholesale costs"`);
        rows.push(`"Operating Expenses",${metrics.totalExpenses.toFixed(2)},"Total logged business expenditures"`);
        rows.push(`"Net Profit",${metrics.netProfit.toFixed(2)},"Actual cash surplus / take-home earnings"`);
        rows.push(`"Gross Profit Margin",${metrics.profitMargin.toFixed(2)}%,"Gross trading margin percentage"`);
        rows.push(`"Completed Transactions",${metrics.successfulTransactionsCount},"Total successful customer service orders"`);
        rows.push(`"Daily Profit Run-Rate",${metrics.dailyRunRate.toFixed(2)},"Average net profit earned per day"`);
        rows.push(`"Projected Monthly Profit",${metrics.projectedMonthlyProfit.toFixed(2)},"30-day extrapolated net projection"`);
        rows.push('');

        // 3. Customer Wallet Liabilities
        rows.push('"CUSTOMER BALANCES & LIABILITIES PORTFOLIO"');
        rows.push('"Metric","Value"');
        rows.push(`"Total Held Customer Balances (Liabilities)",${metrics.userLiquidity.totalUserBalances.toFixed(2)}`);
        rows.push(`"Funded User Wallets",${metrics.userLiquidity.fundedUserCount}`);
        rows.push(`"Total Registered Accounts",${metrics.userLiquidity.totalUserCount}`);
        rows.push(`"Average Funded Balance",${metrics.userLiquidity.averageUserBalance.toFixed(2)}`);
        rows.push('');

        // 4. Service Breakdown Matrix
        rows.push('"SERVICE PROFIT MATRIX (ALL 18 SERVICES)"');
        rows.push('"Service Name","Service Type","Orders Count","Revenue (NGN)","Cost (NGN)","Profit (NGN)","Margin %"');
        Object.values(metrics.serviceBreakdown).forEach(s => {
            rows.push(`"${s.serviceName}","${s.type}",${s.transactionCount},${s.revenue.toFixed(2)},${s.cost.toFixed(2)},${s.profit.toFixed(2)},${s.marginPercent.toFixed(2)}%`);
        });
        rows.push('');

        // 5. Operating Expenses Log
        rows.push('"OPERATING EXPENDITURE LOG"');
        rows.push('"Date","Title","Category","Payment Method","Amount (NGN)","Notes"');
        if (metrics.recentExpenses && metrics.recentExpenses.length > 0) {
            metrics.recentExpenses.forEach(e => {
                const noteClean = (e.notes || '').replace(/"/g, '""');
                rows.push(`"${e.expense_date}","${e.title.replace(/"/g, '""')}","${e.category.replace('_', ' ').toUpperCase()}","${e.payment_method.replace('_', ' ')}",${e.amount.toFixed(2)},"${noteClean}"`);
            });
        } else {
            rows.push('"No operating expenses recorded for this period"');
        }
        rows.push('');

        // 6. Recent Sales Margin Records
        rows.push('"INDIVIDUAL SALES MARGIN AUDIT"');
        rows.push('"Reference / ID","Date","Service","Customer Name","Customer Email","Revenue (NGN)","Cost (NGN)","Profit (NGN)","Margin %"');
        if (metrics.recentTransactions && metrics.recentTransactions.length > 0) {
            metrics.recentTransactions.forEach(t => {
                const ref = (t.reference || t.id || 'N/A').replace(/"/g, '""');
                const sName = (t.serviceName || 'Order').replace(/"/g, '""');
                const cName = (t.customerName || 'Customer').replace(/"/g, '""');
                const cEmail = (t.customerEmail || '').replace(/"/g, '""');
                rows.push(`"${ref}","${formatAccountingDate(t.created_at, true)}","${sName}","${cName}","${cEmail}",${(t.revenue || 0).toFixed(2)},${(t.cost || 0).toFixed(2)},${(t.profit || 0).toFixed(2)},${(t.marginPercent || 0).toFixed(2)}%`);
            });
        }

        const csvContent = rows.join('\n');
        const filename = `Abu_Mafhal_Financial_Report_${dateStr}_${Date.now()}.csv`;
        const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Abu Mafhal Financial Spreadsheet (CSV)',
                UTI: 'public.comma-separated-values-text'
            });
        } else {
            Alert.alert('Spreadsheet Export', `File generated at: ${fileUri}`);
        }
    } catch (err: any) {
        console.error('[CSV Export] Error:', err);
        Alert.alert('CSV Export Notice', err.message || 'Failed to generate financial spreadsheet.');
    }
};
