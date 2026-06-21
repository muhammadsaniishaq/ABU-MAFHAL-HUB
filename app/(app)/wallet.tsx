import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, Image, Dimensions, StyleSheet } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};

export default function WalletScreen() {
    const router = useRouter();
    const [balance, setBalance] = useState(0);
    const [virtualAccount, setVirtualAccount] = useState<any>(null);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showBalance, setShowBalance] = useState(true);
    const hasLoadedOnce = useRef(false);

    useFocusEffect(
        useCallback(() => {
            fetchWalletData();
        }, [])
    );

    const fetchWalletData = async () => {
        if (!hasLoadedOnce.current) {
            setLoading(true);
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch all required data in parallel using Promise.all to cut network latency by ~75%
            const [profileRes, vAccountRes, statsRes, recentRes] = await Promise.all([
                supabase.from('profiles').select('balance').eq('id', user.id).single(),
                supabase.from('virtual_accounts').select('bank_name, account_number, account_name').eq('user_id', user.id).maybeSingle(),
                supabase.from('transactions').select('amount, type').eq('user_id', user.id).eq('status', 'success'),
                supabase.from('transactions').select('id, amount, type, status, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4)
            ]);

            // 1. Profile Balance
            if (profileRes.data) {
                setBalance(profileRes.data.balance || 0);
            }

            // 2. Virtual Account
            setVirtualAccount(vAccountRes.data);

            // 3. Calculate Stats (fast for loop is more performant than forEach)
            const transactions = statsRes.data;
            if (transactions) {
                let income = 0;
                let expenses = 0;
                for (let i = 0; i < transactions.length; i++) {
                    const tx = transactions[i];
                    const amt = parseFloat(tx.amount);
                    if (tx.type === 'deposit') {
                        income += amt;
                    } else {
                        expenses += amt;
                    }
                }
                setTotalIn(income);
                setTotalOut(expenses);
            } else {
                setTotalIn(0);
                setTotalOut(0);
            }

            // 4. Recent Transactions
            setRecentTransactions(recentRes.data || []);

            hasLoadedOnce.current = true;
        } catch (error) {
            console.error("Error fetching wallet data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWalletData();
    };

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied", "Account number copied to clipboard!");
    };

    const formatCurrency = (val?: number | string) => {
        if (val === undefined || val === null) return ['0', '00'];
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return ['0', '00'];
        const formatted = num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return formatted.split('.');
    };

    const formatTxDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } else if (diffDays <= 2 && date.getDate() === now.getDate() - 1) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'deposit':
                return { name: 'arrow-down', color: '#ffffff', bg: '#107c10' };
            case 'withdrawal':
                return { name: 'arrow-up', color: '#ffffff', bg: '#ef4444' };
            case 'transfer':
                return { name: 'arrow-up', color: '#ffffff', bg: '#ef4444' };
            default:
                return { name: 'receipt', color: '#ffffff', bg: '#0056d2' };
        }
    };

    const getTransactionLabel = (tx: any) => {
        if (tx.description) return tx.description;
        switch (tx.type) {
            case 'deposit':
                return 'Wallet Funding';
            case 'withdrawal':
                return 'Wallet Withdrawal';
            case 'transfer':
                return 'Fund Transfer';
            default:
                return 'Service Payment';
        }
    };

    if (loading && !refreshing) {
        return (
            <LinearGradient 
              colors={['#060d21', '#0d1b3e']} 
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
                <ActivityIndicator size="large" color="#f5a623" />
            </LinearGradient>
        );
    }

    const [balanceWhole, balanceDecimal] = formatCurrency(balance);

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* 1. Curved Navy Header */}
            <LinearGradient 
              colors={['#060d21', '#0d1b3e']} 
              style={s.headerContainer}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            >
              {/* Brand logo top row */}
              <View style={s.headerTop}>
                <View style={s.brandRow}>
                  <Image
                    source={require('../../assets/images/logo.png')}
                    style={s.headerLogo}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={s.brandTxt}>MAFHAL</Text>
                    <Text style={s.brandSub}>SUB</Text>
                  </View>
                </View>
                
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => router.push('/notifications')} style={s.bellBtn} activeOpacity={0.8}>
                      <Ionicons name="notifications-outline" size={20} color={T.white} />
                      <View style={s.bellBadge}>
                        <Text style={s.bellBadgeText}>3</Text>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => router.push('/edit-profile')} style={s.bellBtn} activeOpacity={0.8}>
                      <Ionicons name="settings-outline" size={20} color={T.white} />
                    </TouchableOpacity>
                </View>
              </View>

              <Text style={s.headerTitle}>Wallet Details</Text>
            </LinearGradient>

            {/* 2. Floating Balance Card */}
            <View style={s.balanceCardContainer}>
              <LinearGradient 
                colors={['#102258', '#0b163a']} 
                style={s.balanceCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Background Logo Watermark */}
                <View style={s.watermarkWrapper}>
                  <Image 
                    source={require('../../assets/images/logo.png')} 
                    style={s.watermarkImage} 
                    resizeMode="contain" 
                  />
                </View>

                <View style={s.cardLeft}>
                  <View style={s.balanceHeader}>
                    <Text style={s.balanceLabel}>Wallet Balance</Text>
                    <TouchableOpacity onPress={() => setShowBalance(!showBalance)} activeOpacity={0.7} style={{ marginLeft: 6 }}>
                      <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={s.amountRow}>
                    <Text style={s.amountSymbol}>₦</Text>
                    {showBalance ? (
                      <>
                        <Text style={s.amountMain}>{balanceWhole}</Text>
                        <Text style={s.amountDec}>.{balanceDecimal}</Text>
                      </>
                    ) : (
                      <Text style={s.amountMain}>••••</Text>
                    )}
                  </View>
                  <Text style={s.availLabel}>Available Balance</Text>
                </View>

                <View style={s.cardRight}>
                  <TouchableOpacity 
                    onPress={() => router.push('/fund-wallet')}
                    style={s.fundBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={16} color={T.navy} />
                    <Text style={s.fundBtnTxt}>Fund Wallet</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => router.push('/transfer')}
                    style={s.withdrawBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="arrow-up-outline" size={13} color={T.white} style={{ marginRight: 4 }} />
                    <Text style={s.withdrawBtnTxt}>Withdraw</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>

            {/* SCROLLABLE VIEW */}
            <ScrollView 
              style={s.scrollView}
              contentContainerStyle={{ paddingBottom: 150 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.gold} />
              }
            >
                
                {/* 3. Dedicated Account Box */}
                <View style={s.section}>
                  <View style={s.cardSection}>
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-2">
                            <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                                <Ionicons name="card" size={16} color="#0056D2" />
                            </View>
                            <Text style={s.sectionTitleText}>Dedicated Account</Text>
                        </View>
                        <View className="bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            <Text className="text-emerald-600 text-[8px] font-bold uppercase">Auto-Credited</Text>
                        </View>
                    </View>

                    {virtualAccount ? (
                        <View style={s.virtualAccountBox}>
                            <View className="flex-row justify-between items-center mb-1">
                                <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{virtualAccount.bank_name}</Text>
                                <TouchableOpacity 
                                    onPress={() => copyToClipboard(virtualAccount.account_number)}
                                    className="flex-row items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-slate-100 shadow-sm"
                                >
                                    <Ionicons name="copy-outline" size={12} color="#0056D2" />
                                    <Text style={{ color: '#0056D2', fontSize: 10, fontWeight: 'bold' }}>Copy</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <Text style={s.virtualAccountNumber}>
                                {virtualAccount.account_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                            </Text>
                            
                            <Text style={s.virtualAccountName}>
                                {virtualAccount.account_name}
                            </Text>
                        </View>
                    ) : (
                        <View style={s.virtualAccountEmpty}>
                            <Ionicons name="alert-circle-outline" size={32} color="#94a3b8" />
                            <Text className="text-slate-400 text-xs font-semibold mt-2 mb-3">No dedicated account active</Text>
                            <TouchableOpacity 
                                onPress={() => router.push('/kyc')}
                                className="bg-[#0d1b3e] px-4 py-2 rounded-xl"
                            >
                                <Text className="text-white font-bold text-[11px]">Verify Identity to Activate</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                  </View>
                </View>

                {/* 4. Stats Row */}
                <View style={s.statsRow}>
                  {/* Income */}
                  <View style={[s.statCard, { backgroundColor: 'rgba(16, 124, 16, 0.05)', borderColor: 'rgba(16, 124, 16, 0.12)' }]}>
                    <View style={s.statIconBox}>
                      <Ionicons name="arrow-down" size={18} color="#107c10" />
                    </View>
                    <View className="flex-1">
                      <Text style={s.statLabel}>Total In</Text>
                      <Text style={[s.statAmount, { color: '#107c10' }]} numberOfLines={1}>
                        ₦{totalIn.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  </View>

                  {/* Expenses */}
                  <View style={[s.statCard, { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <View style={s.statIconBox}>
                      <Ionicons name="arrow-up" size={18} color="#ef4444" />
                    </View>
                    <View className="flex-1">
                      <Text style={s.statLabel}>Total Out</Text>
                      <Text style={[s.statAmount, { color: '#ef4444' }]} numberOfLines={1}>
                        ₦{totalOut.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 5. Recent Transactions Preview */}
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Recent Transactions</Text>
                    <TouchableOpacity onPress={() => router.push('/history')} activeOpacity={0.7}>
                      <Text style={s.seeAllTxt}>See All</Text>
                    </TouchableOpacity>
                  </View>

                  {recentTransactions.length > 0 ? (
                      <View style={s.txCardContainer}>
                          {recentTransactions.map((tx: any, index: number) => {
                              const isDeposit = tx.type === 'deposit';
                              const iconConfig = getTransactionIcon(tx.type);
                              
                              return (
                                  <View 
                                      key={tx.id || index} 
                                      style={[s.txRow, index === recentTransactions.length - 1 && { borderBottomWidth: 0 }]}
                                  >
                                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                          <View style={[s.txIconBox, { backgroundColor: iconConfig.bg }]}>
                                              <Ionicons name={iconConfig.name as any} size={16} color={iconConfig.color} />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                              <Text style={s.txTitle} numberOfLines={1}>
                                                  {getTransactionLabel(tx)}
                                              </Text>
                                              <Text style={s.txSub} numberOfLines={1}>
                                                  {formatTxDate(tx.created_at)}
                                              </Text>
                                          </View>
                                      </View>

                                      <View style={{ alignItems: 'flex-end' }}>
                                          <Text style={[s.txAmount, { color: isDeposit ? '#107c10' : T.navy }]}>
                                              {isDeposit ? '+' : '-'} ₦{parseFloat(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                          </Text>
                                          
                                          {tx.status !== 'success' && (
                                              <View style={[s.statusBadge, { backgroundColor: tx.status === 'failed' ? '#fee2e2' : '#fef3c7' }]}>
                                                  <Text style={[s.statusBadgeText, { color: tx.status === 'failed' ? '#ef4444' : '#d97706' }]}>
                                                      {tx.status}
                                                  </Text>
                                              </View>
                                          )}
                                      </View>
                                  </View>
                              );
                          })}
                      </View>
                  ) : (
                      <View style={s.txEmpty}>
                          <Ionicons name="receipt-outline" size={24} color={T.textSub} style={{ marginBottom: 6 }} />
                          <Text style={s.txEmptyText}>No recent transactions</Text>
                      </View>
                  )}
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  scrollView: {
    flex: 1,
  },
  
  // curved header
  headerContainer: {
    backgroundColor: T.navy,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  brandTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: T.white,
    letterSpacing: 0.3,
    lineHeight: 13,
  },
  brandSub: {
    fontSize: 7,
    fontWeight: '700',
    color: T.gold,
    letterSpacing: 1.2,
    lineHeight: 8,
  },
  bellBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    color: T.navy,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: T.white,
    letterSpacing: -0.4,
    marginTop: 2,
  },

  // balance card
  balanceCardContainer: {
    paddingHorizontal: 20,
    marginTop: -24,
    marginBottom: 16,
    shadowColor: T.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 30,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkWrapper: {
    position: 'absolute',
    right: -15,
    bottom: -15,
    width: 110,
    height: 110,
    opacity: 0.06,
  },
  watermarkImage: {
    width: '100%',
    height: '100%',
  },
  cardLeft: {
    flex: 1.25,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  balanceLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amountSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: T.white,
    marginRight: 1,
  },
  amountMain: {
    fontSize: 22,
    fontWeight: '900',
    color: T.white,
    letterSpacing: -0.4,
  },
  amountDec: {
    fontSize: 13,
    fontWeight: '800',
    color: T.white,
  },
  availLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    fontWeight: '500',
  },
  cardRight: {
    flex: 1,
    alignItems: 'stretch',
    gap: 6,
  },
  fundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.gold,
    borderRadius: 10,
    paddingVertical: 8,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  fundBtnTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: T.navy,
    marginLeft: 3,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  withdrawBtnTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: T.white,
  },

  // layout section style
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  cardSection: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e5ef',
    shadowColor: 'rgba(13,27,62,0.03)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: T.navy,
  },
  virtualAccountBox: {
    backgroundColor: '#f8f9fc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e5ef',
  },
  virtualAccountNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: T.navy,
    letterSpacing: 0.5,
    marginVertical: 2,
  },
  virtualAccountName: {
    fontSize: 9,
    fontWeight: '700',
    color: T.textSub,
    textTransform: 'uppercase',
  },
  virtualAccountEmpty: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f8f9fc',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },

  // Stats Grid
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
    marginRight: 8,
  },
  statLabel: {
    fontSize: 8,
    color: T.textSub,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statAmount: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 0.5,
  },

  // Recent Transactions
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: T.navy,
    letterSpacing: -0.2,
  },
  seeAllTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: T.indigo,
  },
  txCardContainer: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e5ef',
    shadowColor: 'rgba(13,27,62,0.03)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 1,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f8',
  },
  txIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  txTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: T.navy,
  },
  txSub: {
    fontSize: 9,
    color: T.textSub,
    marginTop: 1,
  },
  txAmount: {
    fontSize: 12,
    fontWeight: '800',
  },
  txDateText: {
    fontSize: 8,
    color: T.textSub,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 1,
  },
  statusBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  txEmpty: {
    backgroundColor: T.white,
    borderRadius: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e5ef',
  },
  txEmptyText: {
    fontSize: 11,
    color: T.textSub,
    fontWeight: '600',
  }
});
