import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAppSettings } from './useAppSettings';

export function useCryptoManager() {
    const { settings, refetch } = useAppSettings();
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        pendingWithdrawals: 0,
        p2pCompleted: 0,
        p2pPending: 0,
        p2pDisputed: 0,
        totalVolume24h: 0,
        totalRevenue7d: 0,
        totalLiquidity: 0
    });

    useEffect(() => {
        fetchStats();
        // Set up real-time subscription for transactions if needed
    }, []);

    const fetchStats = async () => {
        try {
            // Count pending crypto withdrawals
            const { count: pendingWithdrawals } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('type', 'crypto_withdrawal')
                .eq('status', 'pending');
            
            // Count P2P states
            const { count: p2pPending } = await supabase.from('p2p_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            const { count: p2pCompleted } = await supabase.from('p2p_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed');
            const { count: p2pDisputed } = await supabase.from('p2p_orders').select('*', { count: 'exact', head: true }).eq('status', 'disputed');

            // Fetch Real Financial Stats (Sum of completed transactions in 24h)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const { data: volumeData } = await supabase.from('transactions').select('amount').eq('status', 'completed').gte('created_at', yesterday.toISOString());
            const volume24h = volumeData ? volumeData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) : 0;

            // Fetch 7D Revenue (Simulated via a margin fee table or generic calculation)
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            const { data: revenueData } = await supabase.from('transactions').select('amount').eq('status', 'completed').gte('created_at', lastWeek.toISOString());
            const revenue7d = revenueData ? revenueData.reduce((acc, curr) => acc + ((Number(curr.amount) || 0) * 0.015), 0) : 0; // Assuming 1.5% average platform fee

            setStats({
                pendingWithdrawals: pendingWithdrawals || 0,
                p2pCompleted: p2pCompleted || 0,
                p2pPending: p2pPending || 0,
                p2pDisputed: p2pDisputed || 0,
                totalVolume24h: volume24h,
                totalRevenue7d: revenue7d,
                totalLiquidity: 0 // Would require fetching from hot wallet balances via API
            });
        } catch (e) {
            console.log("Error fetching crypto stats:", e);
        }
    };

    const updateSetting = async (key: string, value: string | boolean) => {
        setLoading(true);
        try {
            const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
            const { error } = await supabase.from('app_settings').upsert({ key, value: stringValue }, { onConflict: 'key' });
            if (error) throw error;
            await refetch(); // Refetch the settings hook context
        } catch (error) {
            console.error('Error updating crypto setting:', error);
            alert("Failed to update setting. Ensure you are connected to internet and have Admin permissions.");
        } finally {
            setLoading(false);
        }
    };

    const fetchTradeHistory = async () => {
        const { data, error } = await supabase.from('trade_history').select('*, user:user_id(email)').order('created_at', { ascending: false }).limit(50);
        if (error) { console.error(error); return []; }
        return data;
    };

    const fetchUserWallets = async () => {
        const { data, error } = await supabase.from('user_wallets').select('*, user:user_id(email)');
        if (error) { console.error(error); return []; }
        return data;
    };

    const fetchPendingWithdrawalsList = async () => {
        const { data, error } = await supabase.from('transactions').select('*, user:user_id(email)').eq('type', 'crypto_withdrawal').eq('status', 'pending');
        if (error) { console.error(error); return []; }
        return data;
    };

    const approveWithdrawal = async (txId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('transactions').update({ status: 'completed' }).eq('id', txId);
            if (error) throw error;
            alert("Withdrawal Approved!");
            await fetchStats();
        } catch (e) {
            alert("Error approving withdrawal");
        } finally {
            setLoading(false);
        }
    };

    const updateUserBalance = async (userId: string, coin: string, amount: number) => {
        setLoading(true);
        try {
            // Get current balance
            const { data: wallet } = await supabase.from('user_wallets').select('*').eq('user_id', userId).single();
            if (!wallet) throw new Error("Wallet not found");

            const updateObj: any = {};
            updateObj[`${coin.toLowerCase()}_balance`] = Number(wallet[`${coin.toLowerCase()}_balance`] || 0) + amount;
            
            const { error } = await supabase.from('user_wallets').update(updateObj).eq('user_id', userId);
            if (error) throw error;
            alert("Balance Updated Successfully!");
        } catch (e: any) {
            alert("Error updating balance: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        settings,
        stats,
        loading,
        updateSetting,
        refetchStats: fetchStats,
        fetchTradeHistory,
        fetchUserWallets,
        fetchPendingWithdrawalsList,
        approveWithdrawal,
        updateUserBalance
    };
}
