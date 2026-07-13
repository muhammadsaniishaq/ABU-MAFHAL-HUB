import { View, Text, TouchableOpacity, ScrollView, Platform, SafeAreaView, StyleSheet, Dimensions, Switch, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect } from 'react';
import { useCryptoManager } from '../../hooks/useCryptoManager';

const { width } = Dimensions.get('window');
const T = {
    navy: '#0d1b3e',
    navyDark: '#060d21',
    gold: '#f5a623',
    goldLight: '#fde047',
    green: '#10B981',
    red: '#EF4444',
    bg: '#f8fafc',
    card: '#ffffff'
};

export default function CryptoManager() {
    const router = useRouter();
    const { 
        settings, 
        stats, 
        loading, 
        updateSetting,
        fetchTradeHistory,
        fetchUserWallets,
        fetchPendingWithdrawalsList,
        approveWithdrawal,
        updateUserBalance 
    } = useCryptoManager();
    
    const [activeTab, setActiveTab] = useState('overview');

    // State for new features
    const [tradeHistory, setTradeHistory] = useState<any[]>([]);
    const [userWallets, setUserWallets] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [isFetchingData, setIsFetchingData] = useState(false);

    // Local state for text inputs to avoid jumping during typing
    const [feeTrc20, setFeeTrc20] = useState('');
    const [feeBtc, setFeeBtc] = useState('');

    useEffect(() => {
        if (activeTab === 'history') loadHistory();
        if (activeTab === 'users') loadWallets();
        if (activeTab === 'withdrawals') loadWithdrawals();
    }, [activeTab]);

    const loadHistory = async () => { setIsFetchingData(true); setTradeHistory(await fetchTradeHistory()); setIsFetchingData(false); };
    const loadWallets = async () => { setIsFetchingData(true); setUserWallets(await fetchUserWallets()); setIsFetchingData(false); };
    const loadWithdrawals = async () => { setIsFetchingData(true); setWithdrawals(await fetchPendingWithdrawalsList()); setIsFetchingData(false); };

    const handleApprove = async (id: string) => {
        await approveWithdrawal(id);
        loadWithdrawals(); // refresh list
    };

    const handleFundUser = async (userId: string, coin: string, amount: number) => {
        await updateUserBalance(userId, coin, amount);
        loadWallets(); // refresh balances
    };

    useEffect(() => {
        setFeeTrc20(settings.crypto_fee_trc20_usdt || '1.5');
        setFeeBtc(settings.crypto_fee_btc || '0.0005');
    }, [settings.crypto_fee_trc20_usdt, settings.crypto_fee_btc]);

    const handleSaveFees = () => {
        updateSetting('crypto_fee_trc20_usdt', feeTrc20);
        updateSetting('crypto_fee_btc', feeBtc);
        alert('Fees Updated Successfully!');
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Ultra Premium Cinematic Header */}
            <LinearGradient colors={[T.navyDark, '#0f172a', '#1e293b']} style={s.header}>
                <View style={s.glowOrb} />
                <View style={s.glowOrb2} />
                <View style={s.glowOrb3} />
                <SafeAreaView>
                    <View style={s.headerContent}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={s.headerScreenTitle}>Crypto Command</Text>
                            <Text style={s.headerScreenSubtitle}>Advanced Asset Management</Text>
                        </View>
                        <TouchableOpacity style={s.headerActionBtn}>
                            <Ionicons name="notifications-outline" size={20} color={T.gold} />
                            {stats.pendingWithdrawals > 0 && <View style={s.badge} />}
                        </TouchableOpacity>
                    </View>

                </SafeAreaView>
                <View style={s.headerBottomStrip} />
            </LinearGradient>

            {/* Custom Tab Bar */}
            <View style={s.tabBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
                    {['overview', 'users', 'history', 'withdrawals', 'rates', 'p2p', 'networks'].map((tab) => (
                        <TouchableOpacity 
                            key={tab} 
                            onPress={() => setActiveTab(tab)}
                            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
                        >
                            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {activeTab === 'overview' && (
                    <>
                        {/* Elite Stats View */}
                        <View style={s.statsCard}>
                            <View style={s.statBox}>
                                <Text style={s.statLabel}>24h Volume</Text>
                                <Text style={s.statValueDark}>₦ {stats.totalVolume24h.toLocaleString()}</Text>
                                <View style={s.trendTag}>
                                    <Ionicons name="caret-up" size={10} color="#10B981" />
                                    <Text style={s.trendTagTxt}>Live</Text>
                                </View>
                            </View>
                            <View style={s.statDividerDark} />
                            <View style={s.statBox}>
                                <Text style={s.statLabel}>Total Liquidity</Text>
                                <Text style={s.statValueDark}>API Syncing...</Text>
                                <View style={[s.trendTag, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                    <Ionicons name="sync" size={10} color="#EF4444" />
                                    <Text style={[s.trendTagTxt, { color: '#EF4444' }]}>Pending</Text>
                                </View>
                            </View>
                        </View>

                        <View style={s.chartCard}>
                            <View style={s.chartHeader}>
                                <Text style={s.chartTitle}>Platform Revenue (7D)</Text>
                                <Ionicons name="bar-chart" size={20} color="#64748B" />
                            </View>
                            <LinearGradient colors={['rgba(245,166,35,0.2)', 'transparent']} style={s.chartGraphBox}>
                                <Text style={s.chartAmount}>₦ {stats.totalRevenue7d.toLocaleString()}</Text>
                                <Text style={s.chartSub}>Total accumulated fees from transactions</Text>
                                <View style={s.graphLine} />
                            </LinearGradient>
                        </View>

                        <View style={s.quickGrid}>
                            <TouchableOpacity style={s.quickCard}>
                                <LinearGradient colors={['rgba(59,130,246,0.1)', 'transparent']} style={s.quickCardBg} />
                                <View style={[s.quickIconBox, { backgroundColor: '#3B82F6' }]}>
                                    <Ionicons name="wallet" size={20} color="#fff" />
                                </View>
                                <Text style={s.quickCardTitle}>User Balances</Text>
                                <Text style={s.quickCardSub}>View active wallets</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={s.quickCard}>
                                <LinearGradient colors={['rgba(239,68,68,0.1)', 'transparent']} style={s.quickCardBg} />
                                <View style={[s.quickIconBox, { backgroundColor: '#EF4444' }]}>
                                    <Ionicons name="warning" size={20} color="#fff" />
                                </View>
                                <Text style={s.quickCardTitle}>Disputes</Text>
                                <Text style={s.quickCardSub}>{stats.p2pDisputed} Escrow claims</Text>
                            </TouchableOpacity>
                        </View>

                        {stats.pendingWithdrawals > 0 && (
                            <View style={s.alertCard}>
                                <LinearGradient colors={['#FEF2F2', '#FEF2F2']} style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]} />
                                <View style={s.alertIconBox}>
                                    <Ionicons name="time" size={24} color="#EF4444" />
                                </View>
                                <View style={{ flex: 1, paddingLeft: 12 }}>
                                    <Text style={s.alertTitle}>{stats.pendingWithdrawals} Pending Withdrawals</Text>
                                    <Text style={s.alertDesc}>High value withdrawals requiring manual approval from admin.</Text>
                                    <TouchableOpacity style={s.alertAction}>
                                        <Text style={s.alertActionTxt}>Review Queue</Text>
                                        <Ionicons name="arrow-forward" size={14} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}
                {activeTab === 'history' && (
                    <View style={{ gap: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.sectionTitle}>Recent Trades & Swaps</Text>
                            <TouchableOpacity style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569' }}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={s.card}>
                            {isFetchingData ? <Text style={{padding: 20, textAlign: 'center'}}>Loading history...</Text> : tradeHistory.map((trade: any, index: number) => (
                                <View key={trade.id || index} style={s.historyRow}>
                                    <View style={[s.historyIcon, { backgroundColor: trade.trade_type === 'buy' ? '#D1FAE5' : '#FEE2E2' }]}>
                                        <Ionicons name={trade.trade_type === 'buy' ? 'arrow-down' : 'arrow-up'} size={18} color={trade.trade_type === 'buy' ? T.green : T.red} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.historyTitle}>{trade.trade_type.toUpperCase()} {trade.coin}</Text>
                                        <Text style={s.historySub}>{trade.user?.email || 'Unknown User'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={s.historyAmt}>₦{trade.fiat_value?.toLocaleString()}</Text>
                                        <View style={[s.statusBadge, { backgroundColor: trade.status === 'completed' ? '#D1FAE5' : '#FEF3C7' }]}>
                                            <Text style={[s.historyStatus, { color: trade.status === 'completed' ? T.green : '#D97706', marginTop: 0 }]}>{trade.status}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                            {tradeHistory.length === 0 && !isFetchingData && <Text style={{padding: 20, textAlign: 'center', color: '#64748B'}}>No trade history found</Text>}
                        </View>
                    </View>
                )}

                {activeTab === 'users' && (
                    <View style={{ gap: 16 }}>
                        <Text style={s.sectionTitle}>User Balances Management</Text>
                        {isFetchingData ? <Text style={{padding: 20, textAlign: 'center'}}>Loading wallets...</Text> : userWallets.map((wallet: any, index: number) => (
                            <View key={wallet.user_id || index} style={[s.card, { padding: 0, overflow: 'hidden' }]}>
                                <LinearGradient colors={[T.navy, '#1e3a8a']} style={{ padding: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff30', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="person" size={20} color="#fff" />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>User Account</Text>
                                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{wallet.user?.email || 'Unknown User'}</Text>
                                        </View>
                                    </View>
                                </LinearGradient>
                                <View style={{ padding: 16 }}>
                                    <View style={s.balanceGrid}>
                                        <View style={s.balanceItem}>
                                            <Text style={s.balLabel}>BTC</Text>
                                            <Text style={s.balValue}>{wallet.btc_balance || 0}</Text>
                                        </View>
                                        <View style={s.balanceItem}>
                                            <Text style={s.balLabel}>USDT</Text>
                                            <Text style={s.balValue}>{wallet.usdt_balance || 0}</Text>
                                        </View>
                                        <View style={s.balanceItem}>
                                            <Text style={s.balLabel}>ETH</Text>
                                            <Text style={s.balValue}>{wallet.eth_balance || 0}</Text>
                                        </View>
                                    </View>
                                    <View style={s.fundActions}>
                                        <TouchableOpacity style={[s.fundBtn, { backgroundColor: '#F0F9FF' }]} onPress={() => handleFundUser(wallet.user_id, 'USDT', 10)}>
                                            <Ionicons name="add-circle" size={16} color="#0284C7" style={{ marginBottom: 4 }} />
                                            <Text style={[s.fundBtnTxt, { color: '#0284C7' }]}>Credit 10 USDT</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[s.fundBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => handleFundUser(wallet.user_id, 'USDT', -10)}>
                                            <Ionicons name="remove-circle" size={16} color="#DC2626" style={{ marginBottom: 4 }} />
                                            <Text style={[s.fundBtnTxt, { color: '#DC2626' }]}>Debit 10 USDT</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {userWallets.length === 0 && !isFetchingData && <Text style={{padding: 20, textAlign: 'center', color: '#64748B'}}>No wallets found</Text>}
                    </View>
                )}

                {activeTab === 'withdrawals' && (
                    <View style={{ gap: 16 }}>
                        <Text style={s.sectionTitle}>Withdrawals Queue</Text>
                        <View style={s.card}>
                            {isFetchingData ? <Text style={{padding: 20, textAlign: 'center'}}>Loading withdrawals...</Text> : withdrawals.map((tx: any, index: number) => (
                                <View key={tx.id || index} style={s.historyRow}>
                                    <View style={[s.historyIcon, { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name="time" size={18} color="#D97706" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.historyTitle}>Withdrawal Request</Text>
                                        <Text style={s.historySub}>{tx.user?.email || 'Unknown User'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <Text style={s.historyAmt}>₦{tx.amount?.toLocaleString()}</Text>
                                        <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(tx.id)}>
                                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                                            <Text style={s.approveBtnTxt}>Approve</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            {withdrawals.length === 0 && !isFetchingData && (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Ionicons name="checkmark-done-circle-outline" size={48} color="#E2E8F0" />
                                    <Text style={{ marginTop: 12, color: '#94A3B8', fontWeight: '600' }}>Queue is empty. You're all caught up!</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {activeTab === 'rates' && (
                    <>
                        <Text style={s.sectionTitle}>Asset Listing & Margins</Text>
                        <View style={s.card}>
                            {/* BTC */}
                            <View style={s.coinRow}>
                                <View style={s.coinInfo}>
                                    <View style={[s.coinIcon, { backgroundColor: '#FFF7E6' }]}>
                                        <Ionicons name="logo-bitcoin" size={22} color="#F7931A" />
                                    </View>
                                    <View>
                                        <Text style={s.coinName}>Bitcoin (BTC)</Text>
                                        <Text style={s.coinRate}>Buy: ₦{settings.crypto_rate_btc_buy || '86.5M'} | Sell: ₦{settings.crypto_rate_btc_sell || '85.0M'}</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={settings.crypto_enabled_btc} 
                                    onValueChange={(v) => updateSetting('crypto_enabled_btc', v)}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
                                    disabled={loading}
                                />
                            </View>
                            <View style={s.divider} />

                            {/* USDT */}
                            <View style={s.coinRow}>
                                <View style={s.coinInfo}>
                                    <View style={[s.coinIcon, { backgroundColor: '#E6F6EC' }]}>
                                        <Ionicons name="logo-usd" size={22} color="#26A17B" />
                                    </View>
                                    <View>
                                        <Text style={s.coinName}>Tether (USDT)</Text>
                                        <Text style={s.coinRate}>Buy: ₦{settings.crypto_rate_usdt_buy || '1,480'} | Sell: ₦{settings.crypto_rate_usdt_sell || '1,460'}</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={settings.crypto_enabled_usdt} 
                                    onValueChange={(v) => updateSetting('crypto_enabled_usdt', v)}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
                                    disabled={loading}
                                />
                            </View>
                            <View style={s.divider} />

                            {/* ETH */}
                            <View style={s.coinRow}>
                                <View style={s.coinInfo}>
                                    <View style={[s.coinIcon, { backgroundColor: '#F1F5F9' }]}>
                                        <MaterialCommunityIcons name="ethereum" size={22} color="#627EEA" />
                                    </View>
                                    <View>
                                        <Text style={s.coinName}>Ethereum (ETH)</Text>
                                        <Text style={s.coinRate}>Buy: ₦{settings.crypto_rate_eth_buy || '4.5M'} | Sell: ₦{settings.crypto_rate_eth_sell || '4.3M'}</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={settings.crypto_enabled_eth} 
                                    onValueChange={(v) => updateSetting('crypto_enabled_eth', v)}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
                                    disabled={loading}
                                />
                            </View>

                            <TouchableOpacity style={s.updateRatesBtn}>
                                <Ionicons name="create-outline" size={16} color="#fff" />
                                <Text style={s.updateRatesTxt}>Update Market Rates</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {activeTab === 'networks' && (
                    <>
                        <Text style={s.sectionTitle}>Global Engine Control</Text>
                        <View style={s.card}>
                            <View style={s.coinRow}>
                                <View style={s.coinInfo}>
                                    <View style={[s.coinIcon, { backgroundColor: '#FEE2E2' }]}>
                                        <Ionicons name="power" size={22} color="#EF4444" />
                                    </View>
                                    <View>
                                        <Text style={[s.coinName, { color: '#EF4444' }]}>Maintenance Mode</Text>
                                        <Text style={s.coinRate}>Disable all crypto features for users</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={settings.crypto_maintenance_mode} 
                                    onValueChange={(v) => updateSetting('crypto_maintenance_mode', v)}
                                    trackColor={{ false: '#e2e8f0', true: '#EF4444' }}
                                    thumbColor="#fff"
                                    disabled={loading}
                                />
                            </View>
                        </View>

                        <Text style={s.sectionTitle}>Feature Modules Control</Text>
                        <View style={s.card}>
                            {[
                                { key: 'crypto_receive_enabled', name: 'Receive Crypto', desc: 'Allow users to generate deposit addresses', icon: 'arrow-down-circle' },
                                { key: 'crypto_send_enabled', name: 'Send Crypto', desc: 'Allow users to withdraw to external wallets', icon: 'paper-plane' },
                                { key: 'crypto_buy_enabled', name: 'Buy Crypto', desc: 'Allow purchasing crypto with fiat', icon: 'cart' },
                                { key: 'crypto_sell_enabled', name: 'Sell Crypto', desc: 'Allow selling crypto for fiat', icon: 'cash' },
                                { key: 'crypto_swap_enabled', name: 'Swap Crypto', desc: 'Allow exchanging between crypto assets', icon: 'swap-horizontal' }
                            ].map((feat, index) => (
                                <View key={feat.key}>
                                    <View style={s.coinRow}>
                                        <View style={s.coinInfo}>
                                            <View style={[s.coinIcon, { backgroundColor: '#F1F5F9' }]}>
                                                <Ionicons name={feat.icon as any} size={18} color={T.navy} />
                                            </View>
                                            <View>
                                                <Text style={[s.coinName, { fontSize: 13 }]}>{feat.name}</Text>
                                                <Text style={s.coinRate}>{feat.desc}</Text>
                                            </View>
                                        </View>
                                        <Switch 
                                            value={settings[feat.key]} 
                                            onValueChange={(v) => updateSetting(feat.key, v)}
                                            trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                            thumbColor="#fff"
                                            disabled={loading}
                                        />
                                    </View>
                                    {index < 4 && <View style={s.divider} />}
                                </View>
                            ))}
                        </View>

                        <Text style={s.sectionTitle}>Network & Gas Fees</Text>
                        <View style={s.card}>
                            <View style={s.feeRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.feeLabel}>TRC20 Withdrawal Fee</Text>
                                    <Text style={s.feeSubLabel}>Tron Network</Text>
                                </View>
                                <View style={s.feeInputBox}>
                                    <TextInput style={s.feeInput} value={feeTrc20} onChangeText={setFeeTrc20} keyboardType="numeric" />
                                    <Text style={s.feeSuffix}>USDT</Text>
                                </View>
                            </View>
                            <View style={s.divider} />
                            <View style={s.feeRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.feeLabel}>BTC Withdrawal Fee</Text>
                                    <Text style={s.feeSubLabel}>Bitcoin Network</Text>
                                </View>
                                <View style={s.feeInputBox}>
                                    <TextInput style={s.feeInput} value={feeBtc} onChangeText={setFeeBtc} keyboardType="numeric" />
                                    <Text style={s.feeSuffix}>BTC</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.saveFeesBtn} onPress={handleSaveFees}>
                                <Text style={s.saveFeesTxt}>{loading ? 'Saving...' : 'Save Fee Config'}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={s.sectionTitle}>Exchange API Nodes</Text>
                        <View style={s.card}>
                            <View style={s.nodeRow}>
                                <Ionicons name="server" size={18} color="#10B981" />
                                <Text style={s.nodeTxt}>Binance Node (Primary)</Text>
                                <View style={s.nodeStatus}><Text style={s.nodeStatusTxt}>Connected</Text></View>
                            </View>
                            <View style={s.nodeRow}>
                                <Ionicons name="server" size={18} color="#64748B" />
                                <Text style={s.nodeTxt}>Kraken Node (Backup)</Text>
                                <View style={[s.nodeStatus, { backgroundColor: '#F1F5F9' }]}><Text style={[s.nodeStatusTxt, { color: '#64748B' }]}>Standby</Text></View>
                            </View>
                        </View>
                    </>
                )}

                {activeTab === 'p2p' && (
                    <>
                        <Text style={s.sectionTitle}>P2P Engine Controls</Text>
                        <View style={s.card}>
                            <View style={s.p2pStatRow}>
                                <View style={s.p2pStat}>
                                    <Text style={s.p2pStatVal}>{stats.p2pCompleted}</Text>
                                    <Text style={s.p2pStatLabel}>Completed</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.p2pStat}>
                                    <Text style={[s.p2pStatVal, { color: '#f5a623' }]}>{stats.p2pPending}</Text>
                                    <Text style={s.p2pStatLabel}>Pending</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.p2pStat}>
                                    <Text style={[s.p2pStatVal, { color: '#EF4444' }]}>{stats.p2pDisputed}</Text>
                                    <Text style={s.p2pStatLabel}>Disputed</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.updateRatesBtn}>
                                <Ionicons name="people-circle" size={16} color="#fff" />
                                <Text style={s.updateRatesTxt}>Manage Escrow Disputes</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

            </ScrollView>
        </View>
    );
}


const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: T.bg },
    scrollView: { flex: 1 },
    header: {
        paddingBottom: 12,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        zIndex: 10,
        overflow: 'hidden',
    },
    glowOrb: {
        position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: '#4F46E5', opacity: 0.2, filter: 'blur(40px)',
    },
    glowOrb2: {
        position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: '#10B981', opacity: 0.15, filter: 'blur(35px)',
    },
    glowOrb3: {
        position: 'absolute', top: '20%', left: '30%', width: 100, height: 100, borderRadius: 50, backgroundColor: '#f5a623', opacity: 0.1, filter: 'blur(20px)',
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 30 : 5,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    headerActionBtn: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,166,35,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)'
    },
    badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: T.navyDark },
    headerScreenTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    headerScreenSubtitle: { fontSize: 10, color: T.goldLight, marginTop: 2, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    
    statsCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
    statValueDark: { color: T.navy, fontSize: 16, fontWeight: '900' },
    statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center' },
    statDividerDark: { width: 1, height: 30, backgroundColor: '#E2E8F0', alignSelf: 'center' },
    trendTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
    trendTagTxt: { color: '#10B981', fontSize: 9, fontWeight: '800', marginLeft: 2 },
    
    headerBottomStrip: { height: 4, backgroundColor: T.gold, width: '100%', position: 'absolute', bottom: 0 },

    tabBarContainer: { paddingHorizontal: 0, marginTop: -20, paddingBottom: 10, zIndex: 20 },
    tabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    tabBtn: { height: 40, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    tabBtnActive: { backgroundColor: T.navy, borderColor: T.navy },
    tabTxt: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    tabTxtActive: { color: '#fff' },

    chartCard: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingBottom: 10 },
    chartTitle: { fontSize: 14, fontWeight: '800', color: T.navy },
    chartGraphBox: { padding: 20, paddingTop: 10, minHeight: 120 },
    chartAmount: { fontSize: 28, fontWeight: '900', color: T.navy },
    chartSub: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    graphLine: { height: 3, backgroundColor: T.gold, width: '80%', marginTop: 20, borderRadius: 2, transform: [{ rotate: '-5deg' }] },

    quickGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    quickCard: { width: (width - 44) / 2, backgroundColor: '#fff', borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, overflow: 'hidden' },
    quickCardBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    quickIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    quickCardTitle: { fontSize: 15, fontWeight: '800', color: T.navy },
    quickCardSub: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },

    sectionTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    
    coinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    coinInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    coinIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    coinName: { fontSize: 14, fontWeight: '800', color: T.navy, marginBottom: 2 },
    coinRate: { fontSize: 11, fontWeight: '600', color: '#64748B' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14, width: '100%' },

    updateRatesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.navy, paddingVertical: 16, borderRadius: 16, marginTop: 20, gap: 8, shadowColor: T.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    updateRatesTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

    feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    feeLabel: { fontSize: 14, fontWeight: '800', color: '#334155' },
    feeSubLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    feeInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12 },
    feeInput: { paddingVertical: 10, fontSize: 14, fontWeight: '800', color: T.navy, width: 60, textAlign: 'right' },
    feeSuffix: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginLeft: 8 },
    saveFeesBtn: { backgroundColor: '#F1F5F9', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
    saveFeesTxt: { color: T.navy, fontWeight: '800', fontSize: 14 },

    nodeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    nodeTxt: { fontSize: 14, fontWeight: '700', color: '#334155', flex: 1, marginLeft: 12 },
    nodeStatus: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    nodeStatusTxt: { color: '#059669', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    p2pStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    p2pStat: { flex: 1, alignItems: 'center' },
    p2pStatVal: { fontSize: 24, fontWeight: '900', color: T.green },
    p2pStatLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },

    alertCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', marginBottom: 20, overflow: 'hidden' },
    alertIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
    alertTitle: { fontSize: 14, fontWeight: '800', color: '#991B1B', marginBottom: 2 },
    alertDesc: { fontSize: 12, color: '#B91C1C', lineHeight: 16, marginBottom: 8 },
    alertAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    alertActionTxt: { fontSize: 12, fontWeight: '800', color: '#EF4444' },

    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    historyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    historyTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    historySub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
    historyAmt: { fontSize: 13, fontWeight: '900', color: T.navy },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: 'flex-end' },
    historyStatus: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },

    userEmail: { fontSize: 13, fontWeight: '800', color: T.navy, marginBottom: 8 },
    balanceGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    balanceItem: { alignItems: 'center', flex: 1 },
    balLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },
    balValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 4 },
    fundActions: { flexDirection: 'row', gap: 10 },
    fundBtn: { flex: 1, backgroundColor: '#D1FAE5', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
    fundBtnTxt: { color: '#059669', fontSize: 11, fontWeight: '800' },

    approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.navy, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    approveBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '800' }
});
