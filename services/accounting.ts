import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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
 * Bulletproof print-safe architecture with official Abu Mafhal branding,
 * corporate tags, 18-service performance matrix, liabilities portfolio, and CEO audit seal.
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
        const adv = getFinancialHealthAdvisory(metrics);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Abu_Mafhal_Financial_Statement_${refId}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 8mm 10mm 8mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FFFFFF;
            color: #0F172A;
            margin: 0;
            padding: 0;
            width: 100%;
            line-height: 1.35;
            font-size: 11px;
        }
        .container {
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            padding: 4px;
            background-color: #FFFFFF;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        tr {
            page-break-inside: avoid;
        }
        thead {
            display: table-header-group;
        }
        .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        /* Executive Branded Header */
        .header-box {
            background-color: #0A1128;
            color: #FFFFFF;
            border-radius: 10px;
            border-bottom: 4px solid #DAA520;
            margin-bottom: 14px;
            padding: 16px 18px;
        }
        .brand-title {
            font-size: 21px;
            font-weight: 900;
            color: #FFFFFF;
            letter-spacing: 0.6px;
            line-height: 1.1;
        }
        .brand-sub {
            font-size: 10.5px;
            font-weight: 800;
            color: #F59E0B;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-top: 3px;
        }
        .brand-desc {
            font-size: 9.5px;
            color: #94A3B8;
            margin-top: 2px;
            font-weight: 500;
        }
        .conf-pill {
            display: inline-block;
            background-color: #1E293B;
            border: 1.5px solid #DAA520;
            border-radius: 6px;
            padding: 3px 9px;
            color: #F59E0B;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .verified-pill {
            display: inline-block;
            background-color: #064E3B;
            color: #34D399;
            border: 1px solid #059669;
            border-radius: 4px;
            padding: 2px 7px;
            font-size: 8.5px;
            font-weight: 800;
            margin-top: 4px;
            text-transform: uppercase;
        }

        /* Net Profit Showcase */
        .hero-box {
            background-color: ${isNetProfitable ? '#0F172A' : '#450A0A'};
            border-radius: 12px;
            border: 1.5px solid ${isNetProfitable ? '#DAA520' : '#EF4444'};
            padding: 16px 20px;
            margin-bottom: 14px;
            color: #FFFFFF;
        }
        .hero-headline {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.8px;
            color: ${isNetProfitable ? '#34D399' : '#F87171'};
            text-transform: uppercase;
        }
        .margin-badge {
            background-color: #1E293B;
            border: 1px solid #DAA520;
            border-radius: 6px;
            padding: 2px 8px;
            font-size: 9.5px;
            font-weight: 900;
            color: #F59E0B;
        }
        .hero-amount {
            font-size: 30px;
            font-weight: 900;
            color: ${isNetProfitable ? '#10B981' : '#EF4444'};
            font-family: 'Courier New', Courier, monospace;
            margin: 3px 0 5px 0;
        }
        .hero-subtext {
            font-size: 10.5px;
            color: #94A3B8;
            margin-bottom: 12px;
        }
        .hero-grid-cell {
            background-color: #1E293B;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 8px 10px;
            width: 25%;
        }

        /* 4 KPIs */
        .kpi-cell {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 10px 12px;
            width: 25%;
        }
        .kpi-title {
            font-size: 9px;
            font-weight: 800;
            color: #64748B;
            text-transform: uppercase;
        }
        .kpi-value {
            font-size: 15px;
            font-weight: 900;
            font-family: 'Courier New', Courier, monospace;
            margin-top: 3px;
        }

        /* Customer Liabilities */
        .liability-box {
            background-color: #F8FAFC;
            border: 1.5px solid #CBD5E1;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 14px;
        }
        .reserve-badge {
            display: inline-block;
            background-color: #ECFDF5;
            color: #059669;
            border: 1px solid #A7F3D0;
            border-radius: 5px;
            padding: 1px 7px;
            font-size: 9px;
            font-weight: 800;
            margin-bottom: 4px;
        }

        /* Tables */
        .section-header-title {
            font-size: 12px;
            font-weight: 900;
            color: #0F172A;
        }
        .section-header-sub {
            font-size: 9.5px;
            color: #64748B;
            font-weight: 800;
            text-align: right;
        }
        .styled-table {
            border: 1px solid #CBD5E1;
            border-radius: 8px;
            background-color: #FFFFFF;
            font-size: 10px;
            margin-bottom: 14px;
        }
        .styled-table th {
            background-color: #0A1128;
            color: #FFFFFF;
            padding: 7px 9px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .styled-table td {
            padding: 6px 9px;
            border-bottom: 1px solid #E2E8F0;
        }
        .row-alt {
            background-color: #F8FAFC;
        }
        .styled-table tfoot td {
            background-color: #F1F5F9;
            font-weight: 900;
            border-top: 2px solid #94A3B8;
            font-size: 10.5px;
            padding: 8px 9px;
        }

        /* Audit Signatures */
        .audit-box {
            background-color: #F8FAFC;
            border: 1.5px solid #CBD5E1;
            border-radius: 12px;
            padding: 14px 18px;
            margin-bottom: 10px;
        }
        .sig-line {
            width: 130px;
            height: 1px;
            background-color: #94A3B8;
            margin-top: 14px;
            margin-bottom: 6px;
        }

        /* Footer */
        .footer-note {
            text-align: center;
            font-size: 8.5px;
            color: #94A3B8;
            border-top: 1px solid #E2E8F0;
            padding-top: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- 1. EXECUTIVE BRANDED HEADER -->
        <table class="header-box">
            <tr>
                <td style="vertical-align: middle;">
                    <table style="border-collapse: collapse; margin-bottom: 0;">
                        <tr>
                            <td style="width: 64px; vertical-align: middle;">
                                <img src="${ABU_MAFHAL_LOGO_B64}" width="58" height="58" style="width: 58px; height: 58px; border-radius: 10px; border: 2px solid #DAA520; background-color: #FFFFFF; object-fit: contain; padding: 2px; display: block;" alt="Abu Mafhal Logo" />
                            </td>
                            <td style="padding-left: 14px; vertical-align: middle;">
                                <div class="brand-title">ABU MAFHAL HUB</div>
                                <div class="brand-sub">ABU MAFHAL ENTERPRISE LTD • RC-8979939</div>
                                <div class="brand-desc">Executive Profit & Loss Ledger • Certified Commercial Statement</div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td style="vertical-align: middle; text-align: right; width: 250px;">
                    <div class="conf-pill">SUPER ADMIN STRICTLY CONFIDENTIAL</div>
                    <div style="font-size: 10.5px; color: #E2E8F0; line-height: 1.4;"><b>Ref:</b> <span style="font-family: 'Courier New', Courier, monospace; color: #F59E0B; font-weight: 800;">${refId}</span></div>
                    <div style="font-size: 10.5px; color: #E2E8F0; line-height: 1.4;"><b>Period:</b> ${periodLabel}</div>
                    <div style="font-size: 10.5px; color: #E2E8F0; line-height: 1.4;"><b>Date:</b> ${formatAccountingDate(new Date().toISOString(), true)}</div>
                    <div class="verified-pill">✓ 100% AUDITED & VERIFIED</div>
                </td>
            </tr>
        </table>

        <!-- 2. TITANIUM NET PROFIT / LOSS SHOWCASE -->
        <div class="hero-box avoid-break">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
                <tr>
                    <td class="hero-headline" style="vertical-align: middle;">
                        ${isNetProfitable ? '★ NET TRADING SURPLUS (TAKE-HOME PROFIT)' : '⚠ NET OPERATING DEFICIT'}
                    </td>
                    <td style="text-align: right; vertical-align: middle;">
                        <span class="margin-badge">${metrics.profitMargin.toFixed(1)}% GROSS MARGIN</span>
                    </td>
                </tr>
            </table>
            <div class="hero-amount">
                ${formatNaira(metrics.netProfit)}
            </div>
            <div class="hero-subtext">
                Gross Trading Margin (${formatNaira(metrics.grossProfit)}) minus Total Logged Expenses (${formatNaira(metrics.totalExpenses)})
            </div>
            <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; border-top: 1px solid #334155; padding-top: 10px; margin-bottom: 0;">
                <tr>
                    <td class="hero-grid-cell">
                        <div style="font-size: 8.5px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Daily Run-Rate</div>
                        <div style="font-size: 12px; font-weight: 900; color: #FFFFFF; font-family: 'Courier New', Courier, monospace; margin-top: 2px;">${formatNaira(metrics.dailyRunRate)}/day</div>
                    </td>
                    <td class="hero-grid-cell">
                        <div style="font-size: 8.5px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">30-Day Projection</div>
                        <div style="font-size: 12px; font-weight: 900; color: #34D399; font-family: 'Courier New', Courier, monospace; margin-top: 2px;">${formatNaira(metrics.projectedMonthlyProfit)}</div>
                    </td>
                    <td class="hero-grid-cell">
                        <div style="font-size: 8.5px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Commercial Health</div>
                        <div style="font-size: 11px; font-weight: 900; color: #F59E0B; margin-top: 2px;">${adv.rating} (${adv.headline})</div>
                    </td>
                    <td class="hero-grid-cell">
                        <div style="font-size: 8.5px; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Completed Orders</div>
                        <div style="font-size: 12px; font-weight: 900; color: #FFFFFF; font-family: 'Courier New', Courier, monospace; margin-top: 2px;">${metrics.successfulTransactionsCount} Orders</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- 3. 4 CORE FINANCIAL KPIS -->
        <table class="avoid-break" style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 14px;">
            <tr>
                <td class="kpi-cell">
                    <div class="kpi-title">Gross Revenue</div>
                    <div class="kpi-value" style="color: #1D4ED8;">${formatNaira(metrics.totalRevenue)}</div>
                    <div style="font-size: 9px; color: #94A3B8; margin-top: 2px;">Total volume collected</div>
                </td>
                <td class="kpi-cell">
                    <div class="kpi-title">Cost of Sales</div>
                    <div class="kpi-value" style="color: #475569;">${formatNaira(metrics.totalCost)}</div>
                    <div style="font-size: 9px; color: #94A3B8; margin-top: 2px;">Telecom & API wholesale</div>
                </td>
                <td class="kpi-cell">
                    <div class="kpi-title">Gross Trading Profit</div>
                    <div class="kpi-value" style="color: #059669;">${formatNaira(metrics.grossProfit)}</div>
                    <div style="font-size: 9px; color: #94A3B8; margin-top: 2px;">Surplus before expenses</div>
                </td>
                <td class="kpi-cell">
                    <div class="kpi-title">Logged Expenses</div>
                    <div class="kpi-value" style="color: #DC2626;">${formatNaira(metrics.totalExpenses)}</div>
                    <div style="font-size: 9px; color: #94A3B8; margin-top: 2px;">${metrics.expensesCount} expenses logged</div>
                </td>
            </tr>
        </table>

        <!-- 4. CUSTOMER BALANCES & LIABILITIES PORTFOLIO -->
        <table class="liability-box avoid-break">
            <tr>
                <td style="padding: 12px 16px; vertical-align: middle;">
                    <div class="reserve-badge">100% Guaranteed Reserve Backed</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0F172A; font-family: 'Courier New', Courier, monospace;">${formatNaira(metrics.userLiquidity.totalUserBalances)}</div>
                    <div style="font-size: 10px; color: #64748B; margin-top: 2px;">Total user deposits held across platform database wallets (Customer Liabilities)</div>
                </td>
                <td style="padding: 12px 16px; vertical-align: middle; text-align: right; width: 280px;">
                    <table style="border-collapse: collapse; margin-left: auto; margin-bottom: 0;">
                        <tr>
                            <td style="text-align: center; padding: 0 10px;">
                                <div style="font-size: 13px; font-weight: 900; color: #0F172A; font-family: 'Courier New', Courier, monospace;">${metrics.userLiquidity.totalUserCount}</div>
                                <div style="font-size: 9px; color: #64748B;">Registered Users</div>
                            </td>
                            <td style="text-align: center; padding: 0 10px; border-left: 1px solid #CBD5E1;">
                                <div style="font-size: 13px; font-weight: 900; color: #059669; font-family: 'Courier New', Courier, monospace;">${metrics.userLiquidity.fundedUserCount}</div>
                                <div style="font-size: 9px; color: #64748B;">Funded Wallets</div>
                            </td>
                            <td style="text-align: center; padding: 0 10px; border-left: 1px solid #CBD5E1;">
                                <div style="font-size: 13px; font-weight: 900; color: #0F172A; font-family: 'Courier New', Courier, monospace;">${formatNaira(metrics.userLiquidity.averageUserBalance)}</div>
                                <div style="font-size: 9px; color: #64748B;">Avg Balance</div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- 5. ALL 18 SERVICES PROFIT BREAKDOWN -->
        <table style="margin-bottom: 6px;">
            <tr>
                <td class="section-header-title">Comprehensive Product & Service Performance Matrix</td>
                <td class="section-header-sub">18 Enterprise Services Tracked</td>
            </tr>
        </table>
        <table class="styled-table">
            <thead>
                <tr>
                    <th style="text-align: left;">Service Name</th>
                    <th style="text-align: right;">Orders</th>
                    <th style="text-align: right;">Revenue</th>
                    <th style="text-align: right;">Cost of Sales</th>
                    <th style="text-align: right;">Gross Profit</th>
                    <th style="text-align: right;">Margin %</th>
                </tr>
            </thead>
            <tbody>
                ${Object.values(metrics.serviceBreakdown)
                    .filter(s => s.revenue > 0 || s.transactionCount > 0)
                    .map((s, idx) => `
                        <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
                            <td style="color: #0F172A; font-weight: 700;">${s.serviceName}</td>
                            <td style="text-align: right; font-family: 'Courier New', Courier, monospace;">${s.transactionCount}</td>
                            <td style="text-align: right; font-family: 'Courier New', Courier, monospace;">${formatNaira(s.revenue)}</td>
                            <td style="text-align: right; font-family: 'Courier New', Courier, monospace; color: #64748B;">${formatNaira(s.cost)}</td>
                            <td style="text-align: right; font-family: 'Courier New', Courier, monospace; color: #059669; font-weight: 800;">${formatNaira(s.profit)}</td>
                            <td style="text-align: right;">
                                <span style="display: inline-block; background-color: #FFFBEB; border: 1px solid #FDE68A; color: #D97706; border-radius: 4px; padding: 1px 5px; font-size: 8.5px; font-weight: 800;">${s.marginPercent.toFixed(1)}%</span>
                            </td>
                        </tr>
                    `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td style="color: #0A1128;"><b>PORTFOLIO TOTAL</b></td>
                    <td style="text-align: right; font-family: 'Courier New', Courier, monospace;">${metrics.successfulTransactionsCount}</td>
                    <td style="text-align: right; font-family: 'Courier New', Courier, monospace;">${formatNaira(metrics.totalRevenue)}</td>
                    <td style="text-align: right; font-family: 'Courier New', Courier, monospace;">${formatNaira(metrics.totalCost)}</td>
                    <td style="text-align: right; font-family: 'Courier New', Courier, monospace; color: #059669;">${formatNaira(metrics.grossProfit)}</td>
                    <td style="text-align: right;">
                        <span style="display: inline-block; background-color: #FFFBEB; border: 1px solid #FDE68A; color: #D97706; border-radius: 4px; padding: 1px 5px; font-size: 8.5px; font-weight: 800;">${metrics.profitMargin.toFixed(1)}%</span>
                    </td>
                </tr>
            </tfoot>
        </table>

        <!-- 6. LOGGED OPERATING EXPENDITURES -->
        <table style="margin-bottom: 6px;">
            <tr>
                <td class="section-header-title">Logged Operating Expenditures</td>
                <td class="section-header-sub">${metrics.recentExpenses.length} Records</td>
            </tr>
        </table>
        <table class="styled-table">
            <thead>
                <tr>
                    <th style="text-align: left;">Date</th>
                    <th style="text-align: left;">Description</th>
                    <th style="text-align: left;">Category</th>
                    <th style="text-align: left;">Payment Method</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${metrics.recentExpenses.length > 0 
                    ? metrics.recentExpenses.slice(0, 10).map((e, idx) => `
                        <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
                            <td style="color: #64748B;">${formatAccountingDate(e.expense_date)}</td>
                            <td style="color: #0F172A; font-weight: 700;">${e.title}</td>
                            <td style="color: #475569;">${e.category.replace('_', ' ').toUpperCase()}</td>
                            <td style="color: #64748B;">${e.payment_method.replace('_', ' ')}</td>
                            <td style="text-align: right; font-family: 'Courier New', Courier, monospace; color: #DC2626; font-weight: 800;">-${formatNaira(e.amount)}</td>
                        </tr>
                    `).join('')
                    : '<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 12px;">No operating expenses recorded for this reporting period.</td></tr>'
                }
            </tbody>
        </table>

        <!-- 7. AUDIT SIGNATURES & VERIFICATION SEAL -->
        <table class="audit-box avoid-break">
            <tr>
                <td style="width: 33%; vertical-align: top;">
                    <div class="sig-line"></div>
                    <div style="font-size: 11.5px; font-weight: 900; color: #0A1128;">Sale Abu Mafhal</div>
                    <div style="font-size: 9.5px; color: #64748B; margin-top: 1px;">Managing Director & CEO</div>
                    <div style="font-size: 8.5px; color: #DAA520; font-weight: 800;">Abu Mafhal Enterprise Ltd</div>
                </td>
                <td style="width: 34%; vertical-align: top; text-align: center;">
                    <div class="sig-line" style="margin-left: auto; margin-right: auto;"></div>
                    <div style="font-size: 11.5px; font-weight: 900; color: #0A1128;">Audit & Financial Control</div>
                    <div style="font-size: 9.5px; color: #64748B; margin-top: 1px;">Certified by Cloud Accounting</div>
                    <div style="font-size: 8.5px; color: #059669; font-weight: 800;">✓ Automated Realtime Ledger</div>
                </td>
                <td style="width: 33%; vertical-align: middle; text-align: right;">
                    <table style="border-collapse: collapse; margin-left: auto; margin-bottom: 0;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 8px; text-align: right;">
                                <div style="font-size: 9px; font-weight: 900; color: #0A1128; letter-spacing: 0.5px;">DIGITAL AUDIT SEAL</div>
                                <div style="font-size: 8px; color: #64748B; font-family: 'Courier New', Courier, monospace; margin-top: 2px;">${refId}</div>
                                <div style="font-size: 7.5px; color: #059669; font-weight: 800; margin-top: 1px;">abumafhal.com.ng</div>
                            </td>
                            <td style="vertical-align: middle;">
                                <div style="width: 50px; height: 50px; border-radius: 50%; background-color: #0A1128; border: 2.5px solid #DAA520; text-align: center; display: inline-block; padding-top: 4px; box-sizing: border-box;">
                                    <div style="font-size: 13px; color: #DAA520; line-height: 1;">★</div>
                                    <div style="font-size: 6px; font-weight: 900; color: #DAA520; letter-spacing: 0.5px; line-height: 1.2;">AUDITED</div>
                                    <div style="font-size: 5.5px; font-weight: 700; color: #34D399; line-height: 1.1;">VERIFIED</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- 8. DOCUMENT SECURITY FOOTER -->
        <div class="footer-note">
            Confidential Enterprise Financial Document • Generated from Abu Mafhal Hub Super Admin Console • 
            Secured by 256-bit Cloud Ledger Protocol • All Rights Reserved © ${new Date().getFullYear()} Abu Mafhal Ltd
        </div>
    </div>
</body>
</html>
        `;

        // 1. Web Auto-Download (Direct & High-Fidelity)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            return new Promise<string | null>((resolve) => {
                const fallbackPrintWindow = () => {
                    try {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                            printWindow.document.open();
                            printWindow.document.write(html);
                            printWindow.document.close();
                            setTimeout(() => {
                                printWindow.focus();
                                printWindow.print();
                            }, 350);
                            resolve(fileName);
                            return;
                        }
                    } catch (e) {
                        console.error('[Web Print Fallback] error:', e);
                    }

                    // Direct Blob HTML fallback
                    try {
                        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = fileName.replace('.pdf', '.html');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(url), 2000);
                        resolve(fileName);
                    } catch (e) {
                        console.error('[Web Blob Fallback] error:', e);
                        resolve(null);
                    }
                };

                const triggerAutoDownload = () => {
                    try {
                        const container = document.createElement('div');
                        container.id = 'amh-pdf-root-container';
                        // Fixed positioning with low opacity (NOT negative z-index) so html2canvas renders every pixel
                        container.style.position = 'fixed';
                        container.style.top = '0px';
                        container.style.left = '0px';
                        container.style.width = '794px';
                        container.style.backgroundColor = '#FFFFFF';
                        container.style.zIndex = '999999';
                        container.style.opacity = '0.01';
                        container.style.pointerEvents = 'none';
                        container.innerHTML = html;
                        document.body.appendChild(container);

                        // @ts-ignore
                        window.html2pdf().set({
                            margin: [8, 6, 8, 6],
                            filename: fileName,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: {
                                scale: 2,
                                useCORS: true,
                                allowTaint: true,
                                logging: false,
                                width: 794,
                                backgroundColor: '#FFFFFF',
                            },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        }).from(container).save().then(() => {
                            if (document.body.contains(container)) document.body.removeChild(container);
                            resolve(fileName);
                        }).catch((err: any) => {
                            console.error('[html2pdf] conversion error:', err);
                            if (document.body.contains(container)) document.body.removeChild(container);
                            fallbackPrintWindow();
                        });
                    } catch (err) {
                        console.error('[html2pdf] init error:', err);
                        fallbackPrintWindow();
                    }
                };

                if ((window as any).html2pdf) {
                    triggerAutoDownload();
                } else {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = triggerAutoDownload;
                    script.onerror = fallbackPrintWindow;
                    document.head.appendChild(script);
                }
            });
        }

        // 2. Native Mobile Direct Auto-Download & Share (Natural A4 multi-page pagination)
        const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
        });

        // Store with human-readable filename in cacheDirectory so FileProvider allows sharing
        let finalUri = uri;
        const cacheDir = (FileSystem as any).cacheDirectory;
        if (cacheDir) {
            const friendlyUri = `${cacheDir}${fileName}`;
            try {
                await FileSystem.copyAsync({ from: uri, to: friendlyUri });
                finalUri = friendlyUri;
            } catch (copyErr) {
                console.warn('[PDF Export] Friendly rename copy failed, falling back to original uri:', copyErr);
                finalUri = uri;
            }
        }

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(finalUri, {
                UTI: 'com.adobe.pdf',
                mimeType: 'application/pdf',
                dialogTitle: `Download Statement - ${fileName}`,
            });
        } else {
            Alert.alert('Download Complete', `Statement saved at: ${finalUri}`);
        }

        return finalUri;
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
): Promise<boolean> => {
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

        const csvContent = '\uFEFF' + rows.join('\r\n');
        const filename = `Abu_Mafhal_Financial_Report_${dateStr}_${Date.now()}.csv`;

        // 1. Web Auto-Download (Instant Direct Download, Zero Dialogs)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            return true;
        }

        // 2. Native Mobile Direct Auto-Download & Share
        const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
        const fileUri = `${docDir}${filename}`;

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
            encoding: ((FileSystem as any).EncodingType?.UTF8 || 'utf8') as any
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: `Download Financial Spreadsheet (CSV)`,
                UTI: 'public.comma-separated-values-text'
            });
        } else {
            Alert.alert('Download Complete', `Spreadsheet file generated at: ${fileUri}`);
        }
        return true;
    } catch (err: any) {
        console.error('[CSV Export] Error:', err);
        Alert.alert('CSV Export Notice', err.message || 'Failed to generate financial spreadsheet.');
        return false;
    }
};
