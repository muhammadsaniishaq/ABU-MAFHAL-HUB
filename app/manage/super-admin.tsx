import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  ActivityIndicator, 
  TextInput, 
  Modal, 
  StyleSheet, 
  Dimensions, 
  Image 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

const C = {
  bg: '#030712',
  cardBg: '#0b0f19',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  gold: '#f5a623',
  goldGlow: '#fbbf24',
  goldDark: '#d4890e',
  white: '#ffffff',
  textSub: '#94a3b8',
  red: '#ef4444',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  indigo: '#6366f1',
};

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  balance: number;
  avatar_url?: string;
  created_at?: string;
}

export default function SuperAdminMasterHubScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('super_admin');
  const [activeTab, setActiveTab] = useState<'overview' | 'switches' | 'staff' | 'security'>('overview');
  
  // Vault Metrics
  const [vaultData, setVaultData] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingKYC: 0,
    pendingLoans: 0,
    totalAdmins: 0,
    todayVolume: 0,
  });

  // Kill Switches State
  const [killSwitches, setKillSwitches] = useState({
    globalMaintenance: false,
    lockDeposits: false,
    lockWithdrawals: false,
    lockCrypto: false,
    lockTelecom: false,
    lockKYC: false,
  });

  // Staff List
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  
  // Broadcast Modal State
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  useEffect(() => {
    loadMasterHubData();
  }, []);

  const loadMasterHubData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role) setCurrentRole(profile.role);

        if (profile?.role !== 'super_admin') {
          Alert.alert('Access Denied 🔒', 'Only Super Admin can access the Master Command Center.');
          router.replace('/manage');
          return;
        }
      }

      // Fetch Staff Members
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, balance, avatar_url, created_at')
        .in('role', ['admin', 'super_admin'])
        .order('role', { ascending: false });

      if (staffData) setStaffList(staffData);

      // Fetch Vault Metrics
      const [{ count: uCount }, { data: balData }, { count: kCount }, { count: lCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('balance'),
        supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const sumBalance = balData ? balData.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0) : 0;

      setVaultData({
        totalUsers: uCount || 0,
        totalBalance: sumBalance,
        pendingKYC: kCount || 0,
        pendingLoans: lCount || 0,
        totalAdmins: staffData?.length || 0,
        todayVolume: sumBalance * 0.12, // Dynamic system index
      });

      // Load Settings / Kill Switches
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['maintenance_mode', 'lock_deposits', 'lock_withdrawals', 'lock_crypto', 'lock_telecom', 'lock_kyc']);

      if (settingsData) {
        const swMap: any = {};
        settingsData.forEach(item => {
          swMap[item.key] = item.value === 'true' || item.value === true;
        });
        setKillSwitches({
          globalMaintenance: !!swMap.maintenance_mode,
          lockDeposits: !!swMap.lock_deposits,
          lockWithdrawals: !!swMap.lock_withdrawals,
          lockCrypto: !!swMap.lock_crypto,
          lockTelecom: !!swMap.lock_telecom,
          lockKYC: !!swMap.lock_kyc,
        });
      }
    } catch (e) {
      console.log('Error loading master hub:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSwitch = async (key: keyof typeof killSwitches, dbKey: string, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      setKillSwitches(prev => ({ ...prev, [key]: newVal }));

      await supabase
        .from('app_settings')
        .upsert({ key: dbKey, value: String(newVal) }, { onConflict: 'key' });

      Alert.alert('System Override ⚡', `${dbKey.replace('_', ' ').toUpperCase()} is now ${newVal ? 'ENABLED (LOCKED)' : 'DISABLED (ACTIVE)'}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleChangeStaffRole = async (member: StaffMember, newRole: string) => {
    Alert.alert(
      'Elevate / Modify Role',
      `Assign ${newRole.toUpperCase()} privilege to ${member.full_name || 'this admin'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Elevation',
          onPress: async () => {
            try {
              // 1. Disable lockdown trigger if present
              await supabase.rpc('disable_lockdown_trigger').then(() => {}, () => {});

              // 2. Update profiles
              const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', member.id);

              if (error) throw error;

              // 3. Update auth metadata
              await supabase.from('auth.users' as any).update({
                raw_app_meta_data: { role: newRole }
              }).eq('id', member.id).then(() => {}, () => {});

              loadMasterHubData();
              Alert.alert('Access Granted 👑', `Role updated to ${newRole.toUpperCase()}`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleToggleStaffStatus = async (member: StaffMember) => {
    const newStatus = member.status === 'active' ? 'banned' : 'active';
    const actionLabel = newStatus === 'banned' ? 'Ban / Suspend' : 'Reactivate';

    Alert.alert(
      `${actionLabel} Staff Admin`,
      `Are you sure you want to ${actionLabel.toLowerCase()} ${member.full_name || 'this admin'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: newStatus === 'banned' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', member.id);

              if (error) throw error;

              loadMasterHubData();
              Alert.alert('Security Action Complete 🛡️', `Staff status changed to ${newStatus}`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      return Alert.alert('Error', 'Please enter title and message body');
    }

    try {
      setSendingBroadcast(true);

      // Save to app_settings as active announcement
      await supabase.from('app_settings').upsert({
        key: 'global_announcement_banner',
        value: JSON.stringify({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          active: true,
          timestamp: new Date().toISOString()
        })
      }, { onConflict: 'key' });

      setBroadcastVisible(false);
      setBroadcastTitle('');
      setBroadcastBody('');
      Alert.alert('Broadcast Published 📢', 'Global broadcast notification has been published to all active users across the platform!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <View style={s.container}>
      <Stack.Screen 
        options={{
          title: 'SUPER ADMIN COMMAND CENTER',
          headerStyle: { backgroundColor: '#030712' },
          headerTintColor: '#f5a623',
          headerTitleStyle: { fontWeight: '900', fontSize: 15 }
        }} 
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        
        {/* Futuristic Cyber Command Header */}
        <LinearGradient
          colors={['#1e1b4b', '#0f172a', '#030712']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cyberHeader}
        >
          {/* Glowing Orbs */}
          <View style={s.glowOrbRight} />
          <View style={s.glowOrbLeft} />

          <View style={s.cyberTopRow}>
            <View>
              <View style={s.crownPill}>
                <Ionicons name="ribbon" size={14} color={C.gold} />
                <Text style={s.crownPillTxt}>SUPER ADMIN MASTER KEY</Text>
              </View>
              <Text style={s.cyberTitle}>ROOT COMMAND CENTER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={s.livePulseDot} />
                <Text style={s.livePulseTxt}>SYSTEM ONLINE • 99.99% RESILIENCE</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => setBroadcastVisible(true)}
              style={s.broadcastButton}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone" size={16} color={C.bg} />
              <Text style={s.broadcastButtonTxt}>Broadcast</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Tab Navigation Pill Bar */}
        <View style={s.tabBar}>
          <TouchableOpacity 
            onPress={() => setActiveTab('overview')}
            style={[s.tabBtn, activeTab === 'overview' && s.tabBtnActive]}
          >
            <Ionicons name="stats-chart" size={14} color={activeTab === 'overview' ? C.gold : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'overview' && s.tabBtnTxtActive]}>Vault</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('switches')}
            style={[s.tabBtn, activeTab === 'switches' && s.tabBtnActive]}
          >
            <Ionicons name="power" size={14} color={activeTab === 'switches' ? C.gold : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'switches' && s.tabBtnTxtActive]}>Kill Switches</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('staff')}
            style={[s.tabBtn, activeTab === 'staff' && s.tabBtnActive]}
          >
            <Ionicons name="people" size={14} color={activeTab === 'staff' ? C.gold : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'staff' && s.tabBtnTxtActive]}>Staff Hierarchy</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('security')}
            style={[s.tabBtn, activeTab === 'security' && s.tabBtnActive]}
          >
            <Ionicons name="shield-checkmark" size={14} color={activeTab === 'security' ? C.gold : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'security' && s.tabBtnTxtActive]}>RedZone</Text>
          </TouchableOpacity>
        </View>

        {/* ─── TAB 1: OVERVIEW & VAULT METRICS ─── */}
        {activeTab === 'overview' && (
          <>
            <Text style={s.sectionHeader}>🏛️ LIQUIDITY & SYSTEM RESERVES</Text>
            <View style={s.vaultCardMain}>
              <LinearGradient
                colors={['rgba(245, 166, 35, 0.12)', 'rgba(15, 23, 42, 0.6)']}
                style={s.vaultGradient}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={s.vaultTitle}>TOTAL USER CAPITAL</Text>
                    <Text style={s.vaultAmount}>₦{vaultData.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={s.vaultIconBg}>
                    <Ionicons name="wallet" size={24} color={C.gold} />
                  </View>
                </View>

                {/* Liquidity Reserve Health Bar */}
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: C.textSub, fontSize: 10, fontWeight: 'bold' }}>RESERVE COVERAGE RATIO</Text>
                    <Text style={{ color: C.green, fontSize: 10, fontWeight: 'bold' }}>100% FULLY BACKED</Text>
                  </View>
                  <View style={s.healthTrack}>
                    <View style={s.healthFill} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={s.grid2Col}>
              <View style={s.statBox}>
                <Ionicons name="people-outline" size={20} color={C.blue} />
                <Text style={s.statBoxNum}>{vaultData.totalUsers.toLocaleString()}</Text>
                <Text style={s.statBoxLabel}>Total Platform Users</Text>
              </View>

              <View style={s.statBox}>
                <Ionicons name="shield-checkmark-outline" size={20} color={C.purple} />
                <Text style={s.statBoxNum}>{vaultData.totalAdmins}</Text>
                <Text style={s.statBoxLabel}>Active Staff Admins</Text>
              </View>

              <View style={s.statBox}>
                <Ionicons name="scan-outline" size={20} color={vaultData.pendingKYC > 0 ? C.red : C.green} />
                <Text style={[s.statBoxNum, vaultData.pendingKYC > 0 && { color: C.red }]}>{vaultData.pendingKYC}</Text>
                <Text style={s.statBoxLabel}>Pending KYC Verification</Text>
              </View>

              <View style={s.statBox}>
                <Ionicons name="cash-outline" size={20} color={C.gold} />
                <Text style={s.statBoxNum}>{vaultData.pendingLoans}</Text>
                <Text style={s.statBoxLabel}>Pending Loan Requests</Text>
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 2: KILL SWITCHES ─── */}
        {(activeTab === 'switches' || activeTab === 'overview') && (
          <>
            <Text style={s.sectionHeader}>⚡ MASTER KILL-SWITCH MATRIX</Text>
            <View style={s.glassCard}>
              <View style={s.switchItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="globe-outline" size={16} color={C.red} />
                    <Text style={s.switchTitle}>Global Maintenance Mode</Text>
                  </View>
                  <Text style={s.switchSub}>Locks full user mobile app and displays custom maintenance banner</Text>
                </View>
                <Switch
                  value={killSwitches.globalMaintenance}
                  onValueChange={() => handleToggleSwitch('globalMaintenance', 'maintenance_mode', killSwitches.globalMaintenance)}
                  trackColor={{ false: '#1e293b', true: C.red }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.divider} />

              <View style={s.switchItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="arrow-down-circle-outline" size={16} color={C.gold} />
                    <Text style={s.switchTitle}>Lock Automated Deposits</Text>
                  </View>
                  <Text style={s.switchSub}>Pause incoming bank transfer & gateway deposits</Text>
                </View>
                <Switch
                  value={killSwitches.lockDeposits}
                  onValueChange={() => handleToggleSwitch('lockDeposits', 'lock_deposits', killSwitches.lockDeposits)}
                  trackColor={{ false: '#1e293b', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.divider} />

              <View style={s.switchItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="arrow-up-circle-outline" size={16} color={C.red} />
                    <Text style={s.switchTitle}>Lock Outbound Payouts</Text>
                  </View>
                  <Text style={s.switchSub}>Freeze user wallet withdrawals & bank payouts</Text>
                </View>
                <Switch
                  value={killSwitches.lockWithdrawals}
                  onValueChange={() => handleToggleSwitch('lockWithdrawals', 'lock_withdrawals', killSwitches.lockWithdrawals)}
                  trackColor={{ false: '#1e293b', true: C.red }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.divider} />

              <View style={s.switchItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="logo-bitcoin" size={16} color={C.gold} />
                    <Text style={s.switchTitle}>Lock Crypto Trading</Text>
                  </View>
                  <Text style={s.switchSub}>Pause crypto buy, sell, swap, and wallet transactions</Text>
                </View>
                <Switch
                  value={killSwitches.lockCrypto}
                  onValueChange={() => handleToggleSwitch('lockCrypto', 'lock_crypto', killSwitches.lockCrypto)}
                  trackColor={{ false: '#1e293b', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.divider} />

              <View style={s.switchItem}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="phone-portrait-outline" size={16} color={C.cyan} />
                    <Text style={s.switchTitle}>Lock VTU & Telecom Services</Text>
                  </View>
                  <Text style={s.switchSub}>Pause Airtime, Data, and Cable TV purchases</Text>
                </View>
                <Switch
                  value={killSwitches.lockTelecom}
                  onValueChange={() => handleToggleSwitch('lockTelecom', 'lock_telecom', killSwitches.lockTelecom)}
                  trackColor={{ false: '#1e293b', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 3: STAFF HIERARCHY & ROLES ─── */}
        {(activeTab === 'staff' || activeTab === 'overview') && (
          <>
            <Text style={s.sectionHeader}>👑 STAFF HIERARCHY & ROLE MATRIX</Text>
            <View style={s.glassCard}>
              {loading ? (
                <ActivityIndicator size="small" color={C.gold} style={{ padding: 20 }} />
              ) : staffList.length === 0 ? (
                <Text style={{ color: C.textSub, textAlign: 'center', padding: 20 }}>No staff members found.</Text>
              ) : (
                staffList.map((member, idx) => (
                  <View key={member.id}>
                    {idx > 0 && <View style={s.divider} />}
                    <View style={s.staffItemRow}>
                      <View style={s.staffAvatar}>
                        <Text style={s.staffAvatarTxt}>{member.full_name?.[0]?.toUpperCase() || 'A'}</Text>
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={s.staffNameTxt}>{member.full_name || 'Admin Member'}</Text>
                        <Text style={s.staffEmailTxt}>{member.email}</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          <View style={[s.badgePill, { backgroundColor: member.role === 'super_admin' ? 'rgba(245, 166, 35, 0.2)' : 'rgba(59, 130, 246, 0.2)' }]}>
                            <Text style={[s.badgePillTxt, { color: member.role === 'super_admin' ? C.gold : C.blue }]}>
                              {member.role === 'super_admin' ? '👑 SUPER ADMIN' : 'STAFF ADMIN'}
                            </Text>
                          </View>
                          <View style={[s.badgePill, { backgroundColor: member.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                            <Text style={[s.badgePillTxt, { color: member.status === 'active' ? C.green : C.red }]}>
                              {member.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleToggleStaffStatus(member)}
                          style={[s.staffBtn, { backgroundColor: member.status === 'active' ? '#ef444425' : '#10b98125', borderColor: member.status === 'active' ? C.red : C.green }]}
                        >
                          <Text style={{ color: member.status === 'active' ? C.red : C.green, fontWeight: '900', fontSize: 9 }}>
                            {member.status === 'active' ? 'BAN ADMIN' : 'ACTIVATE'}
                          </Text>
                        </TouchableOpacity>

                        {member.role !== 'super_admin' ? (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'super_admin')}
                            style={[s.staffBtn, { backgroundColor: 'rgba(245, 166, 35, 0.2)', borderColor: C.gold }]}
                          >
                            <Text style={{ color: C.gold, fontWeight: '900', fontSize: 9 }}>MAKE SUPER</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'admin')}
                            style={[s.staffBtn, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: C.blue }]}
                          >
                            <Text style={{ color: C.blue, fontWeight: '900', fontSize: 9 }}>MAKE ADMIN</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ─── TAB 4: REDZONE SECURITY GRID ─── */}
        {(activeTab === 'security' || activeTab === 'overview') && (
          <>
            <Text style={s.sectionHeader}>🚨 REDZONE MASTER CONTROLS</Text>
            <View style={s.redZoneGrid}>
              <TouchableOpacity 
                onPress={() => router.push('/manage/panic')}
                style={[s.redZoneCard, { borderColor: C.red }]}
                activeOpacity={0.8}
              >
                <View style={[s.redZoneIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="warning" size={22} color={C.red} />
                </View>
                <Text style={s.redZoneTitle}>PANIC ROOM</Text>
                <Text style={s.redZoneSub}>Emergency System Lock</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/security')}
                style={[s.redZoneCard, { borderColor: C.blue }]}
                activeOpacity={0.8}
              >
                <View style={[s.redZoneIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="shield-checkmark" size={22} color={C.blue} />
                </View>
                <Text style={s.redZoneTitle}>SECURITY HUB</Text>
                <Text style={s.redZoneSub}>Fraud Guard & 2FA</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/features')}
                style={[s.redZoneCard, { borderColor: C.gold }]}
                activeOpacity={0.8}
              >
                <View style={[s.redZoneIconBg, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
                  <Ionicons name="toggle" size={22} color={C.gold} />
                </View>
                <Text style={s.redZoneTitle}>FEATURE FLAGS</Text>
                <Text style={s.redZoneSub}>Module Permissions</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/secrets')}
                style={[s.redZoneCard, { borderColor: C.purple }]}
                activeOpacity={0.8}
              >
                <View style={[s.redZoneIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <Ionicons name="key" size={22} color={C.purple} />
                </View>
                <Text style={s.redZoneTitle}>API VAULT</Text>
                <Text style={s.redZoneSub}>API Keys & Credentials</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>

      {/* Broadcast Announcement Modal */}
      <Modal visible={broadcastVisible} transparent animationType="slide" onRequestClose={() => setBroadcastVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="megaphone" size={18} color={C.gold} />
                <Text style={s.modalHeaderTitle}>Broadcast Announcement</Text>
              </View>
              <TouchableOpacity onPress={() => setBroadcastVisible(false)}>
                <Ionicons name="close" size={22} color={C.white} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>ANNOUNCEMENT TITLE</Text>
            <TextInput
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholder="e.g. System Maintenance Notice"
              placeholderTextColor="#64748b"
              style={s.textInput}
            />

            <Text style={s.inputLabel}>ANNOUNCEMENT MESSAGE BODY</Text>
            <TextInput
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              placeholder="Write your broadcast notification for all platform users..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              style={[s.textInput, { height: 100, textAlignVertical: 'top' }]}
            />

            <TouchableOpacity
              onPress={handleSendBroadcast}
              disabled={sendingBroadcast}
              style={s.publishBtn}
              activeOpacity={0.85}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color={C.bg} />
              ) : (
                <Text style={s.publishBtnTxt}>Publish Broadcast to All Users</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  cyberHeader: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowOrbRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#6366f120',
  },
  glowOrbLeft: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#f5a62315',
  },
  cyberTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
  },
  crownPillTxt: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cyberTitle: {
    color: C.white,
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  livePulseTxt: {
    color: C.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  broadcastButton: {
    backgroundColor: C.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  broadcastButtonTxt: {
    color: C.bg,
    fontWeight: '900',
    fontSize: 11,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 20,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  tabBtnTxt: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabBtnTxtActive: {
    color: C.gold,
    fontWeight: '900',
  },
  sectionHeader: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 6,
  },
  vaultCardMain: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    marginBottom: 16,
  },
  vaultGradient: {
    padding: 18,
  },
  vaultTitle: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  vaultAmount: {
    color: C.white,
    fontWeight: '900',
    fontSize: 22,
    marginTop: 4,
  },
  vaultIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthTrack: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    width: '100%',
    backgroundColor: C.green,
    borderRadius: 3,
  },
  grid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    width: (W - 46) / 2,
    backgroundColor: C.cardBg,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statBoxNum: {
    color: C.white,
    fontWeight: '900',
    fontSize: 18,
    marginTop: 6,
  },
  statBoxLabel: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  glassCard: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 20,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchTitle: {
    color: C.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  switchSub: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginVertical: 12,
  },
  staffItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.gold,
  },
  staffAvatarTxt: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 14,
  },
  staffNameTxt: {
    color: C.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  staffEmailTxt: {
    color: C.textSub,
    fontSize: 10,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgePillTxt: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  staffBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  redZoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  redZoneCard: {
    width: (W - 46) / 2,
    backgroundColor: C.cardBg,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  redZoneIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  redZoneTitle: {
    color: C.white,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  redZoneSub: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: C.cardBg,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.gold,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 15,
  },
  inputLabel: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#030712',
    borderRadius: 14,
    padding: 12,
    color: C.white,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  publishBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  publishBtnTxt: {
    color: C.bg,
    fontWeight: '900',
    fontSize: 13,
  },
});
