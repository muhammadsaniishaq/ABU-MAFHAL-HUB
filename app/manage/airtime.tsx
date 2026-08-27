import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, TextInput, StyleSheet, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

// Platinum Light Executive Tokens
const L = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  navyHeader: '#0F172A',
  navyMid: '#1E293B',
  gold: '#FFD700',
  goldDk: '#DAA520',
  goldAmber: '#D97706',
  goldLight: '#FEF3C7',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  emerald: '#10B981',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  sky: '#0EA5E9',
  skyBg: '#F0F9FF',
  coral: '#EF4444',
  coralBg: '#FFF1F2',
  coralBorder: '#FECDD3',
};

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  MTN: { bg: '#FEF08A', text: '#854D0E', border: '#FACC15' },
  AIRTEL: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  GLO: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  '9MOBILE': { bg: '#ECFCCB', text: '#3F6212', border: '#BEF264' },
};

export default function ModernAirtimePricing() {
  const router = useRouter();
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('airtime_configs')
        .select('*')
        .order('network', { ascending: true });

      if (error) throw error;
      setNetworks(data || []);
    } catch (error: any) {
      console.log('Error fetching airtime configs', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLocalNetwork = (id: string, field: 'cost_percentage' | 'sell_percentage', value: string) => {
    setNetworks(prev =>
      prev.map(n => {
        if (n.id === id) {
          return { ...n, [field]: value };
        }
        return n;
      })
    );
  };

  const handleSave = async (id: string) => {
    const network = networks.find(n => n.id === id);
    if (!network) return;

    try {
      setSavingId(id);
      const { error } = await supabase
        .from('airtime_configs')
        .update({
          cost_percentage: parseFloat(network.cost_percentage) || 0,
          sell_percentage: parseFloat(network.sell_percentage) || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      Alert.alert('Saved 🎉', `${network.network} airtime rates updated successfully!`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* EXECUTIVE TOP BAR */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={16} color={L.gold} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={s.topBarTitle}>Airtime Discount & Margin</Text>
            <Text style={s.topBarSub}>Configure telecom cost discounts and user discount pricing</Text>
          </View>
          <TouchableOpacity onPress={fetchNetworks} style={s.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="refresh" size={15} color={L.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="small" color={L.goldDk} />
          <Text style={s.loadingText}>Loading network configurations...</Text>
        </View>
      ) : (
        <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* PROFIT FORMULA EXPLANATION CARD */}
          <View style={s.formulaCard}>
            <View style={s.formulaHeader}>
              <Ionicons name="calculator-outline" size={15} color={L.goldAmber} />
              <Text style={s.formulaTitle}>Airtime Margin Formula</Text>
            </View>
            <Text style={s.formulaText}>
              <Text style={{ fontWeight: '800', color: L.navyHeader }}>Cost Discount (%):</Text> Discount ClubKonnect/API gives you (e.g. 3.0%).{'\n'}
              <Text style={{ fontWeight: '800', color: L.navyHeader }}>Sell Discount (%):</Text> Discount you pass to users (e.g. 1.5%).{'\n'}
              <Text style={{ fontWeight: '900', color: L.emerald }}>Net Profit Margin = Cost % − Sell % (e.g. +1.5%)</Text>
            </Text>
          </View>

          {/* NETWORK CARRIER CARDS */}
          {networks.map(net => {
            const netKey = String(net.network || '').toUpperCase();
            const brand = NETWORK_COLORS[netKey] || { bg: '#F1F5F9', text: L.navyHeader, border: L.cardBorder };
            const cost = parseFloat(net.cost_percentage) || 0;
            const sell = parseFloat(net.sell_percentage) || 0;
            const margin = cost - sell;
            const isProfit = margin >= 0;
            const isSaving = savingId === net.id;

            // Example on ₦1,000 recharge
            const userPays = 1000 - (1000 * (sell / 100));
            const costAdmin = 1000 - (1000 * (cost / 100));
            const profitNaira = userPays - costAdmin;

            return (
              <View key={net.id} style={s.netCard}>
                <View style={s.netCardHeader}>
                  <View style={[s.brandBadge, { backgroundColor: brand.bg, borderColor: brand.border }]}>
                    <Text style={[s.brandBadgeText, { color: brand.text }]}>{net.network}</Text>
                  </View>

                  <View style={[s.marginPill, isProfit ? s.marginPillProfit : s.marginPillLoss]}>
                    <Ionicons name={isProfit ? 'trending-up' : 'trending-down'} size={11} color={isProfit ? L.emerald : L.coral} />
                    <Text style={[s.marginPillText, isProfit ? { color: L.emerald } : { color: L.coral }]}>
                      Margin: {isProfit ? '+' : ''}{margin.toFixed(2)}%
                    </Text>
                  </View>
                </View>

                {/* Input Fields */}
                <View style={s.inputsRow}>
                  {/* Cost discount */}
                  <View style={s.inputBlock}>
                    <Text style={s.inputLabel}>Provider Cost (%)</Text>
                    <View style={s.inputWrap}>
                      <TextInput
                        style={s.textInput}
                        value={String(net.cost_percentage)}
                        onChangeText={v => updateLocalNetwork(net.id, 'cost_percentage', v)}
                        keyboardType="numeric"
                        placeholder="3.0"
                        placeholderTextColor="#94A3B8"
                        selectionColor={L.goldDk}
                      />
                      <Text style={s.inputPercentSign}>%</Text>
                    </View>
                  </View>

                  {/* Sell discount */}
                  <View style={s.inputBlock}>
                    <Text style={s.inputLabel}>User Sell (%)</Text>
                    <View style={s.inputWrap}>
                      <TextInput
                        style={s.textInput}
                        value={String(net.sell_percentage)}
                        onChangeText={v => updateLocalNetwork(net.id, 'sell_percentage', v)}
                        keyboardType="numeric"
                        placeholder="1.5"
                        placeholderTextColor="#94A3B8"
                        selectionColor={L.goldDk}
                      />
                      <Text style={s.inputPercentSign}>%</Text>
                    </View>
                  </View>
                </View>

                {/* 1,000 NAIRA SIMULATOR NOTE */}
                <View style={s.simRow}>
                  <Text style={s.simText}>
                    On ₦1,000 Airtime: User pays <Text style={{ fontWeight: '800' }}>₦{userPays.toFixed(2)}</Text> • Your profit:{' '}
                    <Text style={{ fontWeight: '900', color: profitNaira >= 0 ? L.emerald : L.coral }}>
                      {profitNaira >= 0 ? '+' : ''}₦{profitNaira.toFixed(2)}
                    </Text>
                  </Text>
                </View>

                {/* UPDATE BUTTON */}
                <TouchableOpacity onPress={() => handleSave(net.id)} disabled={isSaving} style={s.updateBtn} activeOpacity={0.85}>
                  <LinearGradient colors={['#0F172A', '#1E293B']} style={s.updateBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    {isSaving ? (
                      <ActivityIndicator size="small" color={L.gold} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={13} color={L.gold} />
                        <Text style={s.updateBtnText}>Save {net.network} Rates</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })}

          {networks.length === 0 && (
            <View style={s.emptyBox}>
              <Ionicons name="radio-outline" size={28} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Airtime Networks Configured</Text>
              <Text style={s.emptySub}>Please check database connection to load telecom carriers.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: L.bg,
  },
  topBar: {
    backgroundColor: L.navyHeader,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingBottom: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13.5,
  },
  topBarSub: {
    color: L.goldLight,
    fontSize: 8.5,
    fontWeight: '600',
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 60,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 40,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
  },
  formulaCard: {
    backgroundColor: L.goldLight,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    marginBottom: 10,
  },
  formulaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  formulaTitle: {
    color: L.goldAmber,
    fontWeight: '900',
    fontSize: 10.5,
  },
  formulaText: {
    color: L.navyMid,
    fontSize: 8.5,
    lineHeight: 12,
  },
  netCard: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  netCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  brandBadgeText: {
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  marginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  marginPillProfit: {
    backgroundColor: L.emeraldBg,
    borderColor: L.emeraldBorder,
  },
  marginPillLoss: {
    backgroundColor: L.coralBg,
    borderColor: L.coralBorder,
  },
  marginPillText: {
    fontWeight: '900',
    fontSize: 9,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    color: L.navyHeader,
    fontSize: 8.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    height: 34,
  },
  textInput: {
    flex: 1,
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
    paddingVertical: 0,
  },
  inputPercentSign: {
    color: L.goldDk,
    fontWeight: '900',
    fontSize: 11,
  },
  simRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginBottom: 8,
  },
  simText: {
    color: L.textMuted,
    fontSize: 8,
  },
  updateBtn: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  updateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
  },
  updateBtnText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 10,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    marginTop: 10,
    gap: 4,
  },
  emptyTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
  },
  emptySub: {
    color: L.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
});

