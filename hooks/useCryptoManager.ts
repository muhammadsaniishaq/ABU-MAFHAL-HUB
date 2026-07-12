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

    return {
        settings,
        stats,
        loading,
        updateSetting,
        refetchStats: fetchStats
    };
}
