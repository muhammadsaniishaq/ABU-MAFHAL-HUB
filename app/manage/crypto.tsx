import { View, Text, TouchableOpacity, ScrollView, Platform, SafeAreaView, StyleSheet, Dimensions, Switch, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';

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
    const [enabledCoins, setEnabledCoins] = useState({ btc: true, usdt: true, eth: false, sol: true });
    const [activeTab, setActiveTab] = useState('overview');

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
                            <View style={s.badge} />
                        </TouchableOpacity>
                    </View>

                    {/* Elite Stats View */}
                    <View style={s.statsWrapper}>
                        <View style={s.statBox}>
                            <Text style={s.statLabel}>24h Volume</Text>
                            <Text style={s.statValue}>₦ 142.5M</Text>
                            <View style={s.trendTag}>
                                <Ionicons name="caret-up" size={10} color="#10B981" />
                                <Text style={s.trendTagTxt}>14.5%</Text>
                            </View>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statBox}>
                            <Text style={s.statLabel}>Total Liquidity</Text>
                            <Text style={s.statValue}>$ 840,200</Text>
                            <View style={[s.trendTag, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Ionicons name="caret-down" size={10} color="#EF4444" />
                                <Text style={[s.trendTagTxt, { color: '#EF4444' }]}>2.1%</Text>
                            </View>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statBox}>
                            <Text style={s.statLabel}>Active P2P</Text>
                            <Text style={s.statValue}>48 Open</Text>
                            <View style={[s.trendTag, { backgroundColor: 'rgba(245,166,35,0.1)' }]}>
                                <Ionicons name="radio-button-on" size={10} color="#f5a623" />
                                <Text style={[s.trendTagTxt, { color: '#f5a623' }]}>Live</Text>
                            </View>
                        </View>
                    </View>
                </SafeAreaView>
                <View style={s.headerBottomStrip} />
            </LinearGradient>

            {/* Custom Tab Bar */}
            <View style={s.tabBar}>
                {['overview', 'rates', 'p2p', 'networks'].map((tab) => (
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
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {activeTab === 'overview' && (
                    <>
                        {/* Premium Chart Placeholder */}
                        <View style={s.chartCard}>
                            <View style={s.chartHeader}>
                                <Text style={s.chartTitle}>Platform Revenue (7D)</Text>
                                <Ionicons name="bar-chart" size={20} color="#64748B" />
                            </View>
                            <LinearGradient colors={['rgba(245,166,35,0.2)', 'transparent']} style={s.chartGraphBox}>
                                <Text style={s.chartAmount}>₦ 4,820,000</Text>
                                <Text style={s.chartSub}>Total accumulated fees</Text>
                                {/* Simulated Graph Line */}
                                <View style={s.graphLine} />
                            </LinearGradient>
                        </View>

                        {/* Quick Grid */}
                        <View style={s.quickGrid}>
                            <TouchableOpacity style={s.quickCard}>
                                <LinearGradient colors={['rgba(59,130,246,0.1)', 'transparent']} style={s.quickCardBg} />
                                <View style={[s.quickIconBox, { backgroundColor: '#3B82F6' }]}>
                                    <Ionicons name="wallet" size={20} color="#fff" />
                                </View>
                                <Text style={s.quickCardTitle}>Hot Wallets</Text>
                                <Text style={s.quickCardSub}>Manage liquidity</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={s.quickCard}>
                                <LinearGradient colors={['rgba(239,68,68,0.1)', 'transparent']} style={s.quickCardBg} />
                                <View style={[s.quickIconBox, { backgroundColor: '#EF4444' }]}>
                                    <Ionicons name="warning" size={20} color="#fff" />
                                </View>
                                <Text style={s.quickCardTitle}>Disputes</Text>
                                <Text style={s.quickCardSub}>2 Escrow claims</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Recent Transactions Alert */}
                        <View style={s.alertCard}>
                            <LinearGradient colors={['#FEF2F2', '#FEF2F2']} style={StyleSheet.absoluteFillObject} style={{ borderRadius: 16 }} />
                            <View style={s.alertIconBox}>
                                <Ionicons name="time" size={24} color="#EF4444" />
                            </View>
                            <View style={{ flex: 1, paddingLeft: 12 }}>
                                <Text style={s.alertTitle}>3 High-Value Withdrawals</Text>
                                <Text style={s.alertDesc}>Amounts exceeding $5k require manual admin approval.</Text>
                                <TouchableOpacity style={s.alertAction}>
                                    <Text style={s.alertActionTxt}>Review Queue</Text>
                                    <Ionicons name="arrow-forward" size={14} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
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
                                        <Text style={s.coinRate}>Buy: ₦86.5M | Sell: ₦85.0M</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={enabledCoins.btc} 
                                    onValueChange={(v) => setEnabledCoins({...enabledCoins, btc: v})}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
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
                                        <Text style={s.coinRate}>Buy: ₦1,480 | Sell: ₦1,460</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={enabledCoins.usdt} 
                                    onValueChange={(v) => setEnabledCoins({...enabledCoins, usdt: v})}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
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
                                        <Text style={s.coinRate}>Buy: ₦4.5M | Sell: ₦4.3M</Text>
                                    </View>
                                </View>
                                <Switch 
                                    value={enabledCoins.eth} 
                                    onValueChange={(v) => setEnabledCoins({...enabledCoins, eth: v})}
                                    trackColor={{ false: '#e2e8f0', true: '#10B981' }}
                                    thumbColor="#fff"
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
                        <Text style={s.sectionTitle}>Network & Gas Fees</Text>
                        <View style={s.card}>
                            <View style={s.feeRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.feeLabel}>TRC20 Withdrawal Fee</Text>
                                    <Text style={s.feeSubLabel}>Tron Network</Text>
                                </View>
                                <View style={s.feeInputBox}>
                                    <TextInput style={s.feeInput} defaultValue="1.5" keyboardType="numeric" />
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
                                    <TextInput style={s.feeInput} defaultValue="0.0005" keyboardType="numeric" />
                                    <Text style={s.feeSuffix}>BTC</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.saveFeesBtn}>
                                <Text style={s.saveFeesTxt}>Save Fee Config</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* API Connections */}
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
                                    <Text style={s.p2pStatVal}>214</Text>
                                    <Text style={s.p2pStatLabel}>Completed</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.p2pStat}>
                                    <Text style={[s.p2pStatVal, { color: '#f5a623' }]}>48</Text>
                                    <Text style={s.p2pStatLabel}>Pending</Text>
                                </View>
                                <View style={s.statDivider} />
                                <View style={s.p2pStat}>
                                    <Text style={[s.p2pStatVal, { color: '#EF4444' }]}>2</Text>
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
        paddingBottom: 20,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
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
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 10,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    headerActionBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(245,166,35,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)'
    },
    badge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: T.navyDark },
    headerScreenTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
    headerScreenSubtitle: { fontSize: 11, color: T.goldLight, marginTop: 4, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
    
    statsWrapper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 30 },
    statBox: { alignItems: 'center', flex: 1 },
    statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
    statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center' },
    trendTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
    trendTagTxt: { color: '#10B981', fontSize: 9, fontWeight: '800', marginLeft: 2 },
    
    headerBottomStrip: { height: 4, backgroundColor: T.gold, width: '100%', position: 'absolute', bottom: 0 },

    tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, justifyContent: 'space-between' },
    tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
    tabBtnActive: { backgroundColor: T.navy, shadowColor: T.navy, shadowOffset: {width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
    tabTxt: { fontSize: 13, fontWeight: '700', color: '#64748B' },
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

    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    
    coinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    coinInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    coinIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    coinName: { fontSize: 16, fontWeight: '800', color: T.navy, marginBottom: 2 },
    coinRate: { fontSize: 12, fontWeight: '600', color: '#64748B' },
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
    alertActionTxt: { fontSize: 12, fontWeight: '800', color: '#EF4444' }
});
