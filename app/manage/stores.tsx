import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { supabase } from '../../services/supabase';

export default function AppStores() {
  const router = useRouter();
  const installedVersion = Constants?.expoConfig?.version || '1.0.4';
  const [latestVersion, setLatestVersion] = useState('1.0.5');
  const [minVersion, setMinVersion] = useState('1.0.4');
  const [forceUpdate, setForceUpdate] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('*').then(({ data }) => {
      if (data) {
        data.forEach((s) => {
          if (s.key === 'latest_app_version') setLatestVersion(s.value || '1.0.5');
          if (s.key === 'min_app_version') setMinVersion(s.value || '1.0.4');
          if (s.key === 'force_app_update') setForceUpdate(s.value === 'true');
        });
      }
    });
  }, []);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'App Store & OTA Releases' }} />

      <ScrollView contentContainerStyle={s.content}>
        {/* Live CTA Banner */}
        <TouchableOpacity
          style={s.ctaCard}
          activeOpacity={0.88}
          onPress={() => router.push('/manage/app-update')}
        >
          <LinearGradient
            colors={['#070D1E', '#0F172A']}
            style={s.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.ctaTopRow}>
              <View style={s.ctaIconBox}>
                <Ionicons name="sparkles" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.badgePill}>
                  <Text style={s.badgePillText}>OTA & PUSH ENGINE ACTIVE</Text>
                </View>
                <Text style={s.ctaTitle}>Gudanar da Sabbin Updates</Text>
                <Text style={s.ctaSub}>
                  Loda APK, saita vershoni, rubuta bayanan AI features, da tura push notifications ga dukkan users zuwa Play Store.
                </Text>
              </View>
            </View>

            <View style={s.ctaButtonInner}>
              <Text style={s.ctaButtonInnerText}>Buɗe App Update Manager</Text>
              <Ionicons name="arrow-forward" size={16} color="#070D1E" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Current Production Status */}
        <View style={s.whiteCard}>
          <Text style={s.label}>Live Production Build</Text>
          <View style={s.statsRow}>
            <View>
              <Text style={s.versionText}>v{latestVersion}</Text>
              <Text style={s.liveStatusText}>
                ● Live on Google Play Store {forceUpdate ? '• (Mandatory Force Update)' : ''}
              </Text>
            </View>
            <View style={s.iconBadgeRow}>
              <View style={[s.storeIconBox, { backgroundColor: '#10B981' }]}>
                <Ionicons name="logo-google-playstore" size={20} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.metaGrid}>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Client Device Version</Text>
              <Text style={s.metaVal}>v{installedVersion}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Min Required Version</Text>
              <Text style={s.metaVal}>v{minVersion}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaLabel}>Force Update</Text>
              <Text style={[s.metaVal, { color: forceUpdate ? '#DC2626' : '#16A34A' }]}>
                {forceUpdate ? 'ACTIVE (ENFORCED)' : 'OPTIONAL'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Link to Full Manager */}
        <TouchableOpacity
          style={s.uploadBtn}
          onPress={() => router.push('/manage/app-update')}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-upload" size={24} color="#D97706" />
          <Text style={s.uploadBtnText}>Saita Sabon Release ko Loda APK (.apk)</Text>
          <Text style={s.uploadBtnSub}>Danna nan don shiga babban shafin App Updates</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  ctaCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#070D1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaGradient: {
    padding: 18,
  },
  ctaTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  ctaIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ctaSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  ctaButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  ctaButtonInnerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#070D1E',
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  liveStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  iconBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  storeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  uploadBtnSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
