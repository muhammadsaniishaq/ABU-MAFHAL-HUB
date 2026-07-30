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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

const COLORS = {
  bg: '#090d16',
  cardBg: '#121826',
  cardBorder: '#1e293b',
  gold: '#f5a623',
  goldDark: '#d4890e',
  white: '#ffffff',
  textSub: '#94a3b8',
  red: '#ef4444',
  green: '#10b981',
  blue: '#3b82f6',
  purple: '#8b5cf6',
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
  
  // Vault Metrics
  const [vaultData, setVaultData] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingKYC: 0,
    pendingLoans: 0,
    totalAdmins: 0,
  });

  // Kill Switches State
  const [killSwitches, setKillSwitches] = useState({
    globalMaintenance: false,
    lockDeposits: false,
    lockWithdrawals: false,
    lockCrypto: false,
    lockTelecom: false,
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
          Alert.alert('Access Denied 🔒', 'Only Super Admin can access the Master Command Hub.');
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
      });

      // Load Settings / Kill Switches
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['maintenance_mode', 'lock_deposits', 'lock_withdrawals', 'lock_crypto', 'lock_telecom']);

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

      Alert.alert('Setting Updated ⚙️', `${dbKey.replace('_', ' ').toUpperCase()} is now ${newVal ? 'ENABLED' : 'DISABLED'}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleChangeStaffRole = async (member: StaffMember, newRole: string) => {
    Alert.alert(
      'Change Admin Role',
      `Are you sure you want to change ${member.full_name || 'this admin'}'s role to ${newRole.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Change',
          onPress: async () => {
            try {
              // 1. Temporarily disable lockdown trigger if present
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
              Alert.alert('Success 🎉', `Role updated to ${newRole.toUpperCase()}`);
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
      `${actionLabel} Admin`,
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
              Alert.alert('Success 🎉', `Staff status changed to ${newStatus}`);
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

      // Create broadcast notification / banner in app_settings or notifications
      await supabase.from('notifications').insert([{
        user_id: '00000000-0000-0000-0000-000000000000', // Global broadcast
        title: broadcastTitle.trim(),
        message: broadcastBody.trim(),
        type: 'broadcast',
        created_at: new Date().toISOString()
      }]).then(() => {}, () => {});

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
      Alert.alert('Broadcast Sent 📢', 'Global broadcast notification has been published to all active users!');
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
          title: 'SUPER ADMIN MASTER HUB',
          headerStyle: { backgroundColor: '#090d16' },
          headerTintColor: '#f5a623',
          headerTitleStyle: { fontWeight: '900', fontSize: 16 }
        }} 
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        {/* Master Banner Header */}
        <LinearGradient
          colors={['#1e1b4b', '#090d16']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.masterBanner}
        >
          <View style={s.masterBannerRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.gold} />
                <Text style={s.masterBadgeTitle}>ROOT MASTER COMMAND</Text>
              </View>
              <Text style={s.masterBannerSub}>System-wide Root Governance & Vault</Text>
            </View>

            <TouchableOpacity 
              onPress={() => setBroadcastVisible(true)}
              style={s.broadcastHeaderBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone-outline" size={16} color={COLORS.gold} />
              <Text style={s.broadcastBtnTxt}>Broadcast</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Financial Reserve & Vault Metrics */}
        <Text style={s.sectionHeaderTitle}>🏛️ SYSTEM VAULT & LIQUIDITY</Text>
        <View style={s.vaultGrid}>
          <View style={s.vaultCard}>
            <Ionicons name="wallet-outline" size={20} color={COLORS.gold} />
            <Text style={s.vaultNumber}>₦{vaultData.totalBalance.toLocaleString()}</Text>
            <Text style={s.vaultLabel}>Total User Deposits</Text>
          </View>

          <View style={s.vaultCard}>
            <Ionicons name="people-outline" size={20} color={COLORS.blue} />
            <Text style={s.vaultNumber}>{vaultData.totalUsers.toLocaleString()}</Text>
            <Text style={s.vaultLabel}>Active User Base</Text>
          </View>

          <View style={s.vaultCard}>
            <Ionicons name="scan-outline" size={20} color={COLORS.purple} />
            <Text style={s.vaultNumber}>{vaultData.pendingKYC}</Text>
            <Text style={s.vaultLabel}>Pending KYC Queue</Text>
          </View>

          <View style={s.vaultCard}>
            <Ionicons name="key-outline" size={20} color={COLORS.green} />
            <Text style={s.vaultNumber}>{vaultData.totalAdmins}</Text>
            <Text style={s.vaultLabel}>Staff & Admins</Text>
          </View>
        </View>

        {/* System Kill Switches & Maintenance Controls */}
        <Text style={s.sectionHeaderTitle}>⚡ MASTER SYSTEM KILL SWITCHES</Text>
        <View style={s.cardContainer}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Global System Maintenance</Text>
              <Text style={s.switchSub}>Locks user app and shows maintenance banner</Text>
            </View>
            <Switch
              value={killSwitches.globalMaintenance}
              onValueChange={() => handleToggleSwitch('globalMaintenance', 'maintenance_mode', killSwitches.globalMaintenance)}
              trackColor={{ false: '#334155', true: COLORS.red }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={s.divider} />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Lock Wallet Deposits</Text>
              <Text style={s.switchSub}>Pause automated bank deposits across all gateways</Text>
            </View>
            <Switch
              value={killSwitches.lockDeposits}
              onValueChange={() => handleToggleSwitch('lockDeposits', 'lock_deposits', killSwitches.lockDeposits)}
              trackColor={{ false: '#334155', true: COLORS.gold }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={s.divider} />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Lock Outbound Withdrawals</Text>
              <Text style={s.switchSub}>Freeze user payouts & transfers temporarily</Text>
            </View>
            <Switch
              value={killSwitches.lockWithdrawals}
              onValueChange={() => handleToggleSwitch('lockWithdrawals', 'lock_withdrawals', killSwitches.lockWithdrawals)}
              trackColor={{ false: '#334155', true: COLORS.red }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={s.divider} />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Lock Crypto Operations</Text>
              <Text style={s.switchSub}>Pause crypto buy, sell & swap services</Text>
            </View>
            <Switch
              value={killSwitches.lockCrypto}
              onValueChange={() => handleToggleSwitch('lockCrypto', 'lock_crypto', killSwitches.lockCrypto)}
              trackColor={{ false: '#334155', true: COLORS.gold }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={s.divider} />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Lock Telecom & VTU APIs</Text>
              <Text style={s.switchSub}>Pause Airtime, Data, and Cable TV purchases</Text>
            </View>
            <Switch
              value={killSwitches.lockTelecom}
              onValueChange={() => handleToggleSwitch('lockTelecom', 'lock_telecom', killSwitches.lockTelecom)}
              trackColor={{ false: '#334155', true: COLORS.gold }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Staff & Admin Roster Controls */}
        <Text style={s.sectionHeaderTitle}>👑 ADMIN STAFF & ROLE MANAGEMENT</Text>
        <View style={s.cardContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.gold} />
          ) : staffList.length === 0 ? (
            <Text style={{ color: COLORS.textSub, textAlign: 'center', padding: 10 }}>No staff members found.</Text>
          ) : (
            staffList.map((member, idx) => (
              <View key={member.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={s.staffRow}>
                  <View style={s.staffAvatarCircle}>
                    <Text style={s.staffAvatarTxt}>{member.full_name?.[0] || 'A'}</Text>
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={s.staffName}>{member.full_name || 'Admin Member'}</Text>
                    <Text style={s.staffEmail}>{member.email}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <View style={[s.badge, { backgroundColor: member.role === 'super_admin' ? 'rgba(245, 166, 35, 0.2)' : 'rgba(59, 130, 246, 0.2)' }]}>
                        <Text style={[s.badgeTxt, { color: member.role === 'super_admin' ? COLORS.gold : COLORS.blue }]}>{member.role.toUpperCase()}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: member.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }]}>
                        <Text style={[s.badgeTxt, { color: member.status === 'active' ? COLORS.green : COLORS.red }]}>{member.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => handleToggleStaffStatus(member)}
                      style={[s.miniActionBtn, { backgroundColor: member.status === 'active' ? '#ef444422' : '#10b98122' }]}
                    >
                      <Text style={{ color: member.status === 'active' ? COLORS.red : COLORS.green, fontWeight: 'bold', fontSize: 10 }}>
                        {member.status === 'active' ? 'BAN' : 'ACTIVATE'}
                      </Text>
                    </TouchableOpacity>

                    {member.role !== 'super_admin' ? (
                      <TouchableOpacity
                        onPress={() => handleChangeStaffRole(member, 'super_admin')}
                        style={[s.miniActionBtn, { backgroundColor: 'rgba(245, 166, 35, 0.2)' }]}
                      >
                        <Text style={{ color: COLORS.gold, fontWeight: 'bold', fontSize: 10 }}>MAKE SUPER</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleChangeStaffRole(member, 'admin')}
                        style={[s.miniActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}
                      >
                        <Text style={{ color: COLORS.blue, fontWeight: 'bold', fontSize: 10 }}>MAKE ADMIN</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Direct RedZone Shortcuts */}
        <Text style={s.sectionHeaderTitle}>🚨 REDZONE MASTER CONTROLS</Text>
        <View style={s.redZoneGrid}>
          <TouchableOpacity 
            onPress={() => router.push('/manage/panic')}
            style={[s.redCard, { borderColor: COLORS.red }]}
          >
            <Ionicons name="warning-outline" size={24} color={COLORS.red} />
            <Text style={s.redCardTitle}>PANIC ROOM</Text>
            <Text style={s.redCardSub}>Emergency System Lock</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/manage/security')}
            style={[s.redCard, { borderColor: COLORS.blue }]}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.blue} />
            <Text style={s.redCardTitle}>SECURITY HUB</Text>
            <Text style={s.redCardSub}>2FA & Fraud Guard</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/manage/features')}
            style={[s.redCard, { borderColor: COLORS.gold }]}
          >
            <Ionicons name="toggle-outline" size={24} color={COLORS.gold} />
            <Text style={s.redCardTitle}>FEATURE FLAGS</Text>
            <Text style={s.redCardSub}>Module Control</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/manage/secrets')}
            style={[s.redCard, { borderColor: COLORS.purple }]}
          >
            <Ionicons name="key-outline" size={24} color={COLORS.purple} />
            <Text style={s.redCardTitle}>API VAULT</Text>
            <Text style={s.redCardSub}>Secrets & Keys</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Broadcast Emergency Modal */}
      <Modal visible={broadcastVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>📢 Send Emergency Broadcast</Text>
              <TouchableOpacity onPress={() => setBroadcastVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Notice Title</Text>
            <TextInput
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholder="e.g. Scheduled System Maintenance"
              placeholderTextColor="#64748b"
              style={s.modalInput}
            />

            <Text style={s.inputLabel}>Notice Message Body</Text>
            <TextInput
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              placeholder="Write your broadcast message for all users..."
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              style={[s.modalInput, { height: 90, textAlignVertical: 'top' }]}
            />

            <TouchableOpacity
              onPress={handleSendBroadcast}
              disabled={sendingBroadcast}
              style={s.sendBroadcastBtn}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={s.sendBroadcastBtnTxt}>Publish Broadcast to All Users</Text>
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
    backgroundColor: COLORS.bg,
  },
  masterBanner: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    marginBottom: 20,
  },
  masterBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masterBadgeTitle: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  masterBannerSub: {
    color: COLORS.textSub,
    fontSize: 11,
  },
  broadcastHeaderBtn: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  broadcastBtnTxt: {
    color: COLORS.gold,
    fontWeight: 'bold',
    fontSize: 11,
  },
  sectionHeaderTitle: {
    color: COLORS.gold,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 10,
  },
  vaultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  vaultCard: {
    width: (W - 50) / 2,
    backgroundColor: COLORS.cardBg,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  vaultNumber: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
    marginTop: 6,
  },
  vaultLabel: {
    color: COLORS.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  cardContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchTitle: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  switchSub: {
    color: COLORS.textSub,
    fontSize: 10,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 10,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  staffAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  staffAvatarTxt: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  staffName: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  staffEmail: {
    color: COLORS.textSub,
    fontSize: 10,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTxt: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  miniActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  redZoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  redCard: {
    width: (W - 50) / 2,
    backgroundColor: COLORS.cardBg,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  redCardTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 12,
    marginTop: 6,
  },
  redCardSub: {
    color: COLORS.textSub,
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: COLORS.gold,
    fontWeight: '900',
    fontSize: 14,
  },
  inputLabel: {
    color: COLORS.textSub,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#090d16',
    borderRadius: 12,
    padding: 12,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sendBroadcastBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  sendBroadcastBtnTxt: {
    color: COLORS.bg,
    fontWeight: '900',
    fontSize: 13,
  },
});
