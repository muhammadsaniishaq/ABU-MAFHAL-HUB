import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, StyleSheet, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

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

export default function ModernSMMPricingManager() {
  const router = useRouter();
  const [markup, setMarkup] = useState<string>('20');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'smm_markup_percentage')
        .maybeSingle();

      if (setting && setting.value) {
        setMarkup(String(setting.value));
      }

      const srvData = await api.smm.invoke({ action: 'services' });
      if (srvData && srvData.services) {
        setServices(srvData.services);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMarkup = async () => {
    const val = parseFloat(markup);
    if (isNaN(val) || val < 0) {
      Alert.alert("Invalid Margin", "Please enter a valid percentage number (e.g. 20)");
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from('app_settings').upsert({
        key: 'smm_markup_percentage',
        value: markup,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

      if (error) throw error;

      Alert.alert("Success 🎉", `SMM profit margin updated to ${markup}% globally!`);
      fetchData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update margin");
    } finally {
      setSaving(false);
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(services.map(s => (s.category || 'General').trim())));
    return ['All', ...cats.sort()];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const nameMatch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const idMatch = String(s.service || '').includes(searchQuery);
      const catMatch = selectedCategory === 'All' || (s.category || '').trim() === selectedCategory;
      return (nameMatch || idMatch) && catMatch;
    });
  }, [services, searchQuery, selectedCategory]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* EXECUTIVE TOP BAR */}
        <View style={s.topBar}>
          <View style={s.topBarRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={16} color={L.gold} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.topBarTitle}>SMM Services & Pricing</Text>
              <Text style={s.topBarSub}>Configure global profit margins and inspect live package rates</Text>
            </View>
            <TouchableOpacity onPress={fetchData} style={s.refreshBtn} activeOpacity={0.8}>
              <Ionicons name="refresh" size={15} color={L.gold} />
            </TouchableOpacity>
          </View>

          {/* GLOBAL PROFIT MARGIN BOX */}
          <View style={s.marginCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.marginCardLabel}>GLOBAL PROFIT MARGIN</Text>
              <Text style={s.marginCardSub}>Automatically added on top of provider rates</Text>
            </View>

            <View style={s.marginInputRow}>
              <View style={s.marginInputWrap}>
                <TextInput
                  style={s.marginInput}
                  value={markup}
                  onChangeText={setMarkup}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor="#94A3B8"
                  selectionColor={L.goldDk}
                />
                <Text style={s.marginPercentSign}>%</Text>
              </View>

              <TouchableOpacity
                onPress={handleSaveMarkup}
                disabled={saving}
                style={s.applyBtn}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={s.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SEARCH & CATEGORY CHIPS */}
        <View style={s.filterHeader}>
          <View style={s.searchBox}>
            <Ionicons name="search" size={13} color={L.goldDk} />
            <TextInput
              style={s.searchInput}
              placeholder="Search service name or ID..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={14} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catChipsRow}>
            {categories.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[s.catChip, isActive && s.catChipActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.catChipText, isActive && s.catChipTextActive]} numberOfLines={1}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* SERVICES LIST */}
        <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.centerBox}>
              <ActivityIndicator size="small" color={L.goldDk} />
              <Text style={s.loadingText}>Fetching live SMM provider catalog...</Text>
            </View>
          ) : filteredServices.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="folder-open-outline" size={28} color={L.goldDk} />
              <Text style={s.emptyTitle}>No Services Found</Text>
              <Text style={s.emptySub}>No packages match your search query or category filter.</Text>
            </View>
          ) : (
            filteredServices.map(srv => {
              const origRate = parseFloat(srv.original_rate || srv.rate || '0');
              const finalRate = parseFloat(srv.rate || '0');
              const profit = Math.max(0, finalRate - origRate);

              return (
                <View key={srv.service} style={s.serviceCard}>
                  <View style={s.serviceCardHeader}>
                    <View style={s.categoryBadge}>
                      <Text style={s.categoryBadgeText} numberOfLines={1}>{(srv.category || 'GENERAL').toUpperCase()}</Text>
                    </View>
                    <View style={s.idBadge}>
                      <Text style={s.idBadgeText}>ID: #{srv.service}</Text>
                    </View>
                  </View>

                  <Text style={s.serviceName}>{srv.name}</Text>

                  <View style={s.rateComparisonRow}>
                    <View style={s.rateBlock}>
                      <Text style={s.rateLabel}>Provider Cost</Text>
                      <Text style={s.rateValueCost}>₦{origRate.toFixed(2)}</Text>
                    </View>

                    <View style={s.profitPill}>
                      <Ionicons name="trending-up" size={10} color={L.emerald} />
                      <Text style={s.profitPillText}>+₦{profit.toFixed(2)} Profit</Text>
                    </View>

                    <View style={[s.rateBlock, { alignItems: 'flex-end' }]}>
                      <Text style={s.rateLabel}>User Selling Price</Text>
                      <Text style={s.rateValueSelling}>₦{finalRate.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 8,
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
  marginCard: {
    backgroundColor: '#060B19',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  marginCardLabel: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  marginCardSub: {
    color: '#94A3B8',
    fontSize: 8,
    marginTop: 1,
  },
  marginInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marginInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  marginInput: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    width: 36,
    textAlign: 'center',
  },
  marginPercentSign: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11,
  },
  applyBtn: {
    backgroundColor: L.gold,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
  },
  filterHeader: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    height: 30,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: L.textPrimary,
    fontSize: 10.5,
    marginLeft: 5,
    fontWeight: '500',
  },
  catChipsRow: {
    gap: 4,
    paddingBottom: 2,
  },
  catChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  catChipActive: {
    backgroundColor: L.navyHeader,
    borderColor: L.navyHeader,
  },
  catChipText: {
    color: L.textSecondary,
    fontSize: 8.5,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: L.gold,
    fontWeight: '900',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 60,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    gap: 6,
  },
  loadingText: {
    color: L.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
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
  serviceCard: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: L.bg,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: L.cardBorder,
    maxWidth: '70%',
  },
  categoryBadgeText: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '800',
  },
  idBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  idBadgeText: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '700',
  },
  serviceName: {
    color: L.navyHeader,
    fontWeight: '700',
    fontSize: 10.5,
    lineHeight: 14,
    marginBottom: 8,
  },
  rateComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rateBlock: {
    flex: 1,
  },
  rateLabel: {
    color: L.textMuted,
    fontSize: 7.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  rateValueCost: {
    color: L.textSecondary,
    fontWeight: '800',
    fontSize: 10,
  },
  rateValueSelling: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12,
  },
  profitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: L.emeraldBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.emeraldBorder,
  },
  profitPillText: {
    color: L.emerald,
    fontSize: 8,
    fontWeight: '900',
  },
});

