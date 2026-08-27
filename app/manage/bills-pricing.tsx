import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, StyleSheet, StatusBar
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

export default function ModernBillsPricingManager() {
  const router = useRouter();
  const [electricityFee, setElectricityFee] = useState<string>('50');
  const [tvFee, setTvFee] = useState<string>('50');
  const [examFee, setExamFee] = useState<string>('100');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['electricity_markup_fee', 'tv_markup_fee', 'exam_markup_fee']);

      if (settings) {
        const elec = settings.find(s => s.key === 'electricity_markup_fee');
        const tv = settings.find(s => s.key === 'tv_markup_fee');
        const exam = settings.find(s => s.key === 'exam_markup_fee');

        if (elec?.value) setElectricityFee(String(elec.value));
        if (tv?.value) setTvFee(String(tv.value));
        if (exam?.value) setExamFee(String(exam.value));
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch bills pricing');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const elecVal = parseFloat(electricityFee);
    const tvVal = parseFloat(tvFee);
    const examVal = parseFloat(examFee);

    if (isNaN(elecVal) || elecVal < 0 || isNaN(tvVal) || tvVal < 0 || isNaN(examVal) || examVal < 0) {
      Alert.alert("Invalid Amount", "Please enter valid numeric fees (e.g. 50, 100)");
      return;
    }

    try {
      setSaving(true);
      const updates = [
        { key: 'electricity_markup_fee', value: electricityFee, updated_at: new Date().toISOString(), description: 'Convenience fee added to electricity tokens' },
        { key: 'tv_markup_fee', value: tvFee, updated_at: new Date().toISOString(), description: 'Convenience fee added to cable TV bills' },
        { key: 'exam_markup_fee', value: examFee, updated_at: new Date().toISOString(), description: 'Convenience fee added to exam scratch cards' },
      ];

      const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
      if (error) throw error;

      Alert.alert("Success 🎉", "Utility & Bills pricing updated globally!");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update pricing");
    } finally {
      setSaving(false);
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
            <Text style={s.topBarTitle}>Bills & Utility Pricing</Text>
            <Text style={s.topBarSub}>Manage extra transaction profit added to utility purchases</Text>
          </View>
          <TouchableOpacity onPress={fetchData} style={s.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="refresh" size={15} color={L.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="small" color={L.goldDk} />
          <Text style={s.loadingText}>Loading utility pricing settings...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {/* INFO BANNER */}
            <View style={s.infoCard}>
              <View style={s.infoIconWrap}>
                <Ionicons name="information-circle" size={16} color={L.goldAmber} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.infoTitle}>Automatic Utility Markup</Text>
                <Text style={s.infoBody}>
                  The specified convenience fee is added on top of the gateway provider rate. Users pay: <Text style={{ fontWeight: '800' }}>[Bill Amount] + [Convenience Fee]</Text>.
                </Text>
              </View>
            </View>

            {/* ELECTRICITY FEE CARD */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.serviceIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="flash" size={16} color={L.goldAmber} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.cardTitle}>Electricity Token Fee</Text>
                  <Text style={s.cardSub}>Applied to AEDC, EKEDC, IBEDC, IKEDC, JED, KEDCO, PHED</Text>
                </View>
              </View>

              <View style={s.feeInputRow}>
                <Text style={s.nairaPrefix}>₦</Text>
                <TextInput
                  style={s.feeInput}
                  value={electricityFee}
                  onChangeText={setElectricityFee}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor="#94A3B8"
                  selectionColor={L.goldDk}
                />
                <View style={s.feeUnitTag}>
                  <Text style={s.feeUnitTagText}>per transaction</Text>
                </View>
              </View>
            </View>

            {/* CABLE TV FEE CARD */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.serviceIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="tv" size={16} color={L.sky} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.cardTitle}>Cable TV Subscription Fee</Text>
                  <Text style={s.cardSub}>Applied to DStv, GOtv, Startimes, Showmax</Text>
                </View>
              </View>

              <View style={s.feeInputRow}>
                <Text style={s.nairaPrefix}>₦</Text>
                <TextInput
                  style={s.feeInput}
                  value={tvFee}
                  onChangeText={setTvFee}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor="#94A3B8"
                  selectionColor={L.goldDk}
                />
                <View style={s.feeUnitTag}>
                  <Text style={s.feeUnitTagText}>per subscription</Text>
                </View>
              </View>
            </View>

            {/* EXAM PINS & EDUCATION CARD */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.serviceIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="school" size={16} color={L.emerald} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={s.cardTitle}>Exam Scratch Card Fee</Text>
                  <Text style={s.cardSub}>Applied to WAEC, NECO, JAMB & NABTEB PINs</Text>
                </View>
              </View>

              <View style={s.feeInputRow}>
                <Text style={s.nairaPrefix}>₦</Text>
                <TextInput
                  style={s.feeInput}
                  value={examFee}
                  onChangeText={setExamFee}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor="#94A3B8"
                  selectionColor={L.goldDk}
                />
                <View style={s.feeUnitTag}>
                  <Text style={s.feeUnitTagText}>per PIN generated</Text>
                </View>
              </View>
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#0F172A', '#1E293B']} style={s.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                {saving ? (
                  <ActivityIndicator size="small" color={L.gold} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color={L.gold} />
                    <Text style={s.saveBtnText}>Save Bills Pricing</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: L.goldLight,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
    marginBottom: 10,
  },
  infoIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(218, 165, 32, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    color: L.goldAmber,
    fontWeight: '900',
    fontSize: 10.5,
  },
  infoBody: {
    color: L.navyMid,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 1,
  },
  card: {
    backgroundColor: L.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11.5,
  },
  cardSub: {
    color: L.textMuted,
    fontSize: 8.5,
    marginTop: 1,
  },
  feeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    paddingHorizontal: 8,
    height: 36,
  },
  nairaPrefix: {
    color: L.goldDk,
    fontWeight: '900',
    fontSize: 13,
    marginRight: 4,
  },
  feeInput: {
    flex: 1,
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 13,
    paddingVertical: 0,
  },
  feeUnitTag: {
    backgroundColor: L.card,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  feeUnitTagText: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  saveBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
  },
  saveBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  saveBtnText: {
    color: L.gold,
    fontWeight: '900',
    fontSize: 11.5,
  },
});

