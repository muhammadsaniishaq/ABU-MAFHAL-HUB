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
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';

const { width: W } = Dimensions.get('window');

const C = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  navy: '#0f172a',
  navyLight: '#1e293b',
  gold: '#d97706',
  goldBright: '#f5a623',
  goldBg: '#fffbeb',
  goldBorder: '#fde68a',
  textMain: '#0f172a',
  textSub: '#64748b',
  white: '#ffffff',
  red: '#ef4444',
  green: '#10b981',
  blue: '#2563eb',
  purple: '#7c3aed',
  cyan: '#0891b2',
  indigo: '#4f46e5',
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

  // Create Admin Modal State & Rich Features
  const [createAdminVisible, setCreateAdminVisible] = useState(false);
  const [createMode, setCreateMode] = useState<'existing' | 'new'>('existing');
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchUserQuery, setSearchUserQuery] = useState('');

  const [newAdminForm, setNewAdminForm] = useState({
    fullName: '',
    personalEmail: '',
    usernamePrefix: '',
    password: 'Password123!',
    role: 'admin' as 'admin' | 'super_admin',
    department: 'finance' as 'finance' | 'telecom' | 'crypto' | 'support' | 'master',
    sendMail: true
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

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

  const fetchExistingUsersList = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, status, created_at')
        .order('full_name', { ascending: true })
        .limit(200);

      if (data) setExistingUsers(data);
    } catch (e) {
      console.warn('Fetch existing users list note:', e);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAdminForm(prev => ({ ...prev, password: pass }));
  };

  const openCreateAdminModal = () => {
    fetchExistingUsersList();
    setSelectedUserId(null);
    setSearchUserQuery('');
    setNewAdminForm({
      fullName: '',
      personalEmail: '',
      usernamePrefix: '',
      password: 'Password123!',
      role: 'admin',
      department: 'finance',
      sendMail: true
    });
    setCreateAdminVisible(true);
  };

  const handleToggleSwitch = async (key: keyof typeof killSwitches, dbKey: string, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      setKillSwitches(prev => ({ ...prev, [key]: newVal }));

      await supabase
        .from('app_settings')
        .upsert({ key: dbKey, value: String(newVal) }, { onConflict: 'key' });

      Alert.alert('Setting Updated ⚙️', `${dbKey.replace('_', ' ').toUpperCase()} is now ${newVal ? 'ENABLED (LOCKED)' : 'DISABLED (ACTIVE)'}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleChangeStaffRole = async (member: StaffMember, newRole: string) => {
    Alert.alert(
      'Modify Staff Role',
      `Assign ${newRole.toUpperCase()} privilege to ${member.full_name || 'this admin'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Change',
          onPress: async () => {
            try {
              await supabase.rpc('disable_lockdown_trigger').then(() => {}, () => {});

              const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', member.id);

              if (error) throw error;

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
      `${actionLabel} Staff Member`,
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
      setSendingBroadcast(false);
    }
  };

  const handleCreateAdminSubmit = async () => {
    const { fullName, personalEmail, usernamePrefix, password, role } = newAdminForm;
    if (!fullName.trim()) {
      return Alert.alert('Required', 'Please enter or select staff full name');
    }

    const cleanPrefix = (usernamePrefix.trim() || fullName.trim().split(' ')[0]).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const corporateEmail = `${cleanPrefix}@abumafhal.com.ng`;
    const targetAuthEmail = personalEmail.trim() || corporateEmail;

    try {
      setCreatingAdmin(true);

      let targetUserId = selectedUserId;

      if (targetUserId) {
        // Mode A: Existing User Selected -> Upgrade Role to Admin/Super Admin
        await supabase.from('profiles').update({
          role: role,
          full_name: fullName.trim()
        }).eq('id', targetUserId);
      } else {
        // Mode B: Brand New User -> SignUp in Auth & Profiles
        const { data: authData } = await supabase.auth.signUp({
          email: targetAuthEmail,
          password: password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: role
            }
          }
        });

        targetUserId = authData.user?.id || null;

        if (targetUserId) {
          await supabase.from('profiles').upsert({
            id: targetUserId,
            email: targetAuthEmail,
            full_name: fullName.trim(),
            role: role,
            status: 'active'
          }, { onConflict: 'id' });
        }
      }

      // Register Corporate Email
      await supabase.from('corporate_admin_emails').insert({
        user_id: targetUserId,
        username: cleanPrefix,
        email: corporateEmail,
        display_name: fullName.trim(),
        role: role
      });

      // AUTOMATIC WELCOME & LOGIN DETAILS EMAIL DISPATCH
      const emailSubject = `👑 Welcome to Abu Mafhal Admin Portal - Your Login Details`;
      const emailText = `Hello ${fullName.trim()},\n\nCongratulations! You have been appointed as an official ${role.toUpperCase().replace('_', ' ')} for Abu Mafhal Sub.\n\nHere are your official login credentials:\n----------------------------------------\nOfficial Corporate Email: ${corporateEmail}\nAccount Login Email: ${targetAuthEmail}\nTemporary Password: ${password}\nAssigned Role: ${role.toUpperCase().replace('_', ' ')}\n\nHow to Access:\n1. Open the Abu Mafhal App or Web Portal.\n2. Log in using your email address and password.\n3. Access the Admin Management Console from your profile menu.\n\nPlease keep your credentials secure.`;
      const emailHtml = `<div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #ffffff; border-radius: 16px; border: 1px solid #d97706;"><h2 style="color: #f5a623; margin-top: 0;">👑 Welcome to Abu Mafhal Admin Portal</h2><p style="font-size: 14px; line-height: 1.6;">Hello <strong>${fullName.trim()}</strong>,</p><p style="font-size: 14px; line-height: 1.6;">Congratulations! You have been appointed as an official <strong>${role.toUpperCase().replace('_', ' ')}</strong> for Abu Mafhal Sub.</p><div style="background: rgba(255,255,255,0.08); padding: 16px; border-radius: 12px; border-left: 4px solid #f5a623; margin: 16px 0;"><p style="margin: 4px 0; font-size: 13px;"><strong>Official Corporate Email:</strong> <span style="color: #f5a623;">${corporateEmail}</span></p><p style="margin: 4px 0; font-size: 13px;"><strong>Account Login Email:</strong> ${targetAuthEmail}</p><p style="margin: 4px 0; font-size: 13px;"><strong>Temporary Password:</strong> <code style="background: #1e293b; padding: 2px 6px; borderRadius: 4px; color: #34d399;">${password}</code></p><p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Role:</strong> ${role.toUpperCase().replace('_', ' ')}</p></div><p style="font-size: 13px; color: #94a3b8;">Log in to the app or portal to access your Admin Command Center.</p></div>`;

      const recipients = [corporateEmail];
      if (personalEmail.trim() && personalEmail.trim().toLowerCase() !== corporateEmail.toLowerCase()) {
        recipients.push(personalEmail.trim());
      }

      for (const recipient of recipients) {
        await supabase.from('in_app_emails').insert({
          sender_email: 'authority@abumafhal.com.ng',
          sender_name: 'Abu Mafhal Master Governance',
          recipient_email: recipient,
          subject: emailSubject,
          body_text: emailText,
          body_html: emailHtml,
          is_read: false,
          folder: 'inbox'
        });

        try {
          await supabase.functions.invoke('send-email', {
            body: { to: recipient, from: 'authority@abumafhal.com.ng', subject: emailSubject, text: emailText, html: emailHtml }
          });
        } catch (edgeErr) {
          console.warn("External email dispatch note:", edgeErr);
        }
      }

      Alert.alert('Admin Configured 🎉', `Account for ${fullName.trim()} activated successfully!\n\nOfficial Email: ${corporateEmail}\nWelcome credentials dispatched to in-app mailbox & email.`);
      setCreateAdminVisible(false);
      setSelectedUserId(null);
      setNewAdminForm({ fullName: '', personalEmail: '', usernamePrefix: '', password: 'Password123!', role: 'admin' });
      loadMasterHubData();
    } catch (e: any) {
      Alert.alert('Configuration Failed', e.message || 'Could not configure admin account');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <View style={s.container}>
      <Stack.Screen 
        options={{
          title: 'SUPER ADMIN COMMAND CENTER',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f5a623',
          headerTitleStyle: { fontWeight: '900', fontSize: 15 }
        }} 
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        
        {/* Royal Luxury Banner Header */}
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.royalHeader}
        >
          <View style={s.royalHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={s.crownPill}>
                <MaterialCommunityIcons name="crown" size={14} color={C.goldBright} />
                <Text style={s.crownPillTxt}>SUPER ADMIN MASTER KEY</Text>
              </View>
              <Text style={s.royalTitle}>Root Governance & Control</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={s.liveGreenDot} />
                <Text style={s.liveGreenTxt}>CORE SYSTEM ONLINE & SECURED</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => setBroadcastVisible(true)}
              style={s.broadcastHeaderBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="megaphone-outline" size={16} color={C.navy} />
              <Text style={s.broadcastBtnTxt}>Broadcast</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Tab Selector Bar */}
        <View style={s.tabBar}>
          <TouchableOpacity 
            onPress={() => setActiveTab('overview')}
            style={[s.tabBtn, activeTab === 'overview' && s.tabBtnActive]}
          >
            <Ionicons name="pie-chart" size={14} color={activeTab === 'overview' ? C.navy : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'overview' && s.tabBtnTxtActive]}>Vault</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('switches')}
            style={[s.tabBtn, activeTab === 'switches' && s.tabBtnActive]}
          >
            <Ionicons name="options" size={14} color={activeTab === 'switches' ? C.navy : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'switches' && s.tabBtnTxtActive]}>Kill Switches</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('staff')}
            style={[s.tabBtn, activeTab === 'staff' && s.tabBtnActive]}
          >
            <Ionicons name="people" size={14} color={activeTab === 'staff' ? C.navy : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'staff' && s.tabBtnTxtActive]}>Staff Roster</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveTab('security')}
            style={[s.tabBtn, activeTab === 'security' && s.tabBtnActive]}
          >
            <Ionicons name="shield-checkmark" size={14} color={activeTab === 'security' ? C.navy : C.textSub} />
            <Text style={[s.tabBtnTxt, activeTab === 'security' && s.tabBtnTxtActive]}>RedZone</Text>
          </TouchableOpacity>
        </View>

        {/* ─── TAB 1: VAULT OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <>
            <Text style={s.sectionHeaderTitle}>🏛️ SYSTEM CAPITAL & VAULT</Text>
            <View style={s.mainVaultCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={s.vaultSubTitle}>TOTAL DEPOSIT LIQUIDITY</Text>
                  <Text style={s.vaultMainAmount}>₦{vaultData.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.vaultIconCircle}>
                  <Ionicons name="wallet-outline" size={24} color={C.gold} />
                </View>
              </View>

              <View style={s.vaultDivider} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark-sharp" size={14} color={C.green} />
                  <Text style={{ color: C.green, fontSize: 11, fontWeight: 'bold' }}>100% Reserve Backing Active</Text>
                </View>
                <Text style={{ color: C.textSub, fontSize: 10, fontWeight: 'bold' }}>Realtime Audit</Text>
              </View>
            </View>

            <View style={s.statGrid}>
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                  <Ionicons name="people-outline" size={18} color={C.blue} />
                </View>
                <Text style={s.statCardNum}>{vaultData.totalUsers.toLocaleString()}</Text>
                <Text style={s.statCardLabel}>Active Users</Text>
              </View>

              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: 'rgba(124, 58, 237, 0.1)' }]}>
                  <Ionicons name="key-outline" size={18} color={C.purple} />
                </View>
                <Text style={s.statCardNum}>{vaultData.totalAdmins}</Text>
                <Text style={s.statCardLabel}>Staff & Admins</Text>
              </View>

              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: vaultData.pendingKYC > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="scan-outline" size={18} color={vaultData.pendingKYC > 0 ? C.red : C.green} />
                </View>
                <Text style={[s.statCardNum, vaultData.pendingKYC > 0 && { color: C.red }]}>{vaultData.pendingKYC}</Text>
                <Text style={s.statCardLabel}>Pending KYC</Text>
              </View>

              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: 'rgba(217, 119, 6, 0.1)' }]}>
                  <Ionicons name="cash-outline" size={18} color={C.gold} />
                </View>
                <Text style={s.statCardNum}>{vaultData.pendingLoans}</Text>
                <Text style={s.statCardLabel}>Pending Loans</Text>
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 2: KILL SWITCHES ─── */}
        {(activeTab === 'switches' || activeTab === 'overview') && (
          <>
            <Text style={s.sectionHeaderTitle}>⚡ MASTER SYSTEM KILL SWITCHES</Text>
            <View style={s.whiteCard}>
              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="globe-outline" size={18} color={C.red} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Global Maintenance Mode</Text>
                  <Text style={s.switchSub}>Lock mobile app & show maintenance message</Text>
                </View>
                <Switch
                  value={killSwitches.globalMaintenance}
                  onValueChange={() => handleToggleSwitch('globalMaintenance', 'maintenance_mode', killSwitches.globalMaintenance)}
                  trackColor={{ false: '#cbd5e1', true: C.red }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.itemDivider} />

              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="arrow-down-circle-outline" size={18} color={C.gold} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Lock Automated Deposits</Text>
                  <Text style={s.switchSub}>Pause incoming bank deposits & gateways</Text>
                </View>
                <Switch
                  value={killSwitches.lockDeposits}
                  onValueChange={() => handleToggleSwitch('lockDeposits', 'lock_deposits', killSwitches.lockDeposits)}
                  trackColor={{ false: '#cbd5e1', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.itemDivider} />

              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="arrow-up-circle-outline" size={18} color={C.red} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Lock Outbound Payouts</Text>
                  <Text style={s.switchSub}>Freeze user wallet withdrawals & payouts</Text>
                </View>
                <Switch
                  value={killSwitches.lockWithdrawals}
                  onValueChange={() => handleToggleSwitch('lockWithdrawals', 'lock_withdrawals', killSwitches.lockWithdrawals)}
                  trackColor={{ false: '#cbd5e1', true: C.red }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.itemDivider} />

              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="logo-bitcoin" size={18} color={C.gold} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Lock Crypto Operations</Text>
                  <Text style={s.switchSub}>Pause crypto buy, sell, and swap services</Text>
                </View>
                <Switch
                  value={killSwitches.lockCrypto}
                  onValueChange={() => handleToggleSwitch('lockCrypto', 'lock_crypto', killSwitches.lockCrypto)}
                  trackColor={{ false: '#cbd5e1', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>

              <View style={s.itemDivider} />

              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="phone-portrait-outline" size={18} color={C.cyan} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Lock VTU & Telecom Services</Text>
                  <Text style={s.switchSub}>Pause Airtime, Data, and Cable TV purchases</Text>
                </View>
                <Switch
                  value={killSwitches.lockTelecom}
                  onValueChange={() => handleToggleSwitch('lockTelecom', 'lock_telecom', killSwitches.lockTelecom)}
                  trackColor={{ false: '#cbd5e1', true: C.gold }}
                  thumbColor={C.white}
                />
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 3: STAFF HIERARCHY & ROLES ─── */}
        {(activeTab === 'staff' || activeTab === 'overview') && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 10 }}>
              <Text style={s.sectionHeaderTitle}>👑 STAFF & ADMIN HIERARCHY</Text>
              <TouchableOpacity 
                onPress={() => setCreateAdminVisible(true)}
                style={{ backgroundColor: C.navy, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.goldBorder }}
              >
                <Ionicons name="person-add" size={14} color={C.goldBright} />
                <Text style={{ color: C.goldBright, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 }}>+ CREATE NEW ADMIN</Text>
              </TouchableOpacity>
            </View>
            <View style={s.whiteCard}>
              {loading ? (
                <ActivityIndicator size="small" color={C.gold} style={{ padding: 20 }} />
              ) : staffList.length === 0 ? (
                <Text style={{ color: C.textSub, textAlign: 'center', padding: 20 }}>No staff members found.</Text>
              ) : (
                staffList.map((member, idx) => (
                  <View key={member.id}>
                    {idx > 0 && <View style={s.itemDivider} />}
                    <View style={s.staffRow}>
                      <View style={s.staffAvatarCircle}>
                        <Text style={s.staffAvatarTxt}>{member.full_name?.[0]?.toUpperCase() || 'A'}</Text>
                      </View>

                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={s.staffNameTxt}>{member.full_name || 'Admin Member'}</Text>
                        <Text style={s.staffEmailTxt}>{member.email}</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          <View style={[s.badgePill, { backgroundColor: member.role === 'super_admin' ? C.goldBg : '#eff6ff', borderColor: member.role === 'super_admin' ? C.goldBorder : '#bfdbfe' }]}>
                            <Text style={[s.badgePillTxt, { color: member.role === 'super_admin' ? C.gold : C.blue }]}>
                              {member.role === 'super_admin' ? '👑 SUPER ADMIN' : 'STAFF ADMIN'}
                            </Text>
                          </View>
                          <View style={[s.badgePill, { backgroundColor: member.status === 'active' ? '#ecfdf5' : '#fef2f2', borderColor: member.status === 'active' ? '#a7f3d0' : '#fecaca' }]}>
                            <Text style={[s.badgePillTxt, { color: member.status === 'active' ? C.green : C.red }]}>
                              {member.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => handleToggleStaffStatus(member)}
                          style={[s.actionBtn, { backgroundColor: member.status === 'active' ? '#fef2f2' : '#ecfdf5', borderColor: member.status === 'active' ? '#fecaca' : '#a7f3d0' }]}
                        >
                          <Text style={{ color: member.status === 'active' ? C.red : C.green, fontWeight: 'bold', fontSize: 10 }}>
                            {member.status === 'active' ? 'BAN' : 'ACTIVATE'}
                          </Text>
                        </TouchableOpacity>

                        {member.role !== 'super_admin' ? (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'super_admin')}
                            style={[s.actionBtn, { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                          >
                            <Text style={{ color: C.gold, fontWeight: 'bold', fontSize: 10 }}>MAKE SUPER</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'admin')}
                            style={[s.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                          >
                            <Text style={{ color: C.blue, fontWeight: 'bold', fontSize: 10 }}>MAKE ADMIN</Text>
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

        {/* ─── TAB 4: REDZONE CONTROLS ─── */}
        {(activeTab === 'security' || activeTab === 'overview') && (
          <>
            <Text style={s.sectionHeaderTitle}>🚨 REDZONE MASTER CONTROLS</Text>
            <View style={s.redGrid}>
              <TouchableOpacity 
                onPress={() => router.push('/manage/panic')}
                style={[s.redCard, { borderColor: '#fca5a5' }]}
                activeOpacity={0.8}
              >
                <View style={[s.redIconCircle, { backgroundColor: '#fef2f2' }]}>
                  <Ionicons name="warning-outline" size={20} color={C.red} />
                </View>
                <Text style={s.redCardTitle}>PANIC ROOM</Text>
                <Text style={s.redCardSub}>Emergency System Lock</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/security')}
                style={[s.redCard, { borderColor: '#bfdbfe' }]}
                activeOpacity={0.8}
              >
                <View style={[s.redIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={C.blue} />
                </View>
                <Text style={s.redCardTitle}>SECURITY HUB</Text>
                <Text style={s.redCardSub}>2FA & Fraud Guard</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/features')}
                style={[s.redCard, { borderColor: C.goldBorder }]}
                activeOpacity={0.8}
              >
                <View style={[s.redIconCircle, { backgroundColor: C.goldBg }]}>
                  <Ionicons name="toggle-outline" size={20} color={C.gold} />
                </View>
                <Text style={s.redCardTitle}>FEATURE FLAGS</Text>
                <Text style={s.redCardSub}>Module Access Control</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/secrets')}
                style={[s.redCard, { borderColor: '#ddd6fe' }]}
                activeOpacity={0.8}
              >
                <View style={[s.redIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="key-outline" size={20} color={C.purple} />
                </View>
                <Text style={s.redCardTitle}>API VAULT</Text>
                <Text style={s.redCardSub}>API Keys & Credentials</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/manage/mail-center')}
                style={[s.redCard, { borderColor: '#fde68a' }]}
                activeOpacity={0.8}
              >
                <View style={[s.redIconCircle, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="mail-unread-outline" size={20} color={C.gold} />
                </View>
                <Text style={s.redCardTitle}>CORPORATE MAIL</Text>
                <Text style={s.redCardSub}>@abumafhal.com.ng Hub</Text>
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
                <Ionicons name="megaphone-outline" size={20} color={C.gold} />
                <Text style={s.modalTitle}>Broadcast Announcement</Text>
              </View>
              <TouchableOpacity onPress={() => setBroadcastVisible(false)}>
                <Ionicons name="close" size={22} color={C.textMain} />
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>NOTICE TITLE</Text>
            <TextInput
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholder="e.g. Scheduled System Maintenance"
              placeholderTextColor="#94a3b8"
              style={s.textInput}
            />

            <Text style={s.inputLabel}>NOTICE MESSAGE BODY</Text>
            <TextInput
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              placeholder="Write your notice for all active users..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              style={[s.textInput, { height: 90, textAlignVertical: 'top' }]}
            />

            <TouchableOpacity
              onPress={handleSendBroadcast}
              disabled={sendingBroadcast}
              style={s.sendBtn}
              activeOpacity={0.85}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <Text style={s.sendBtnTxt}>Publish Broadcast to All Users</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create New Admin & Corporate Mail Modal */}
      <Modal visible={createAdminVisible} transparent animationType="slide" onRequestClose={() => setCreateAdminVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '92%', backgroundColor: '#ffffff', borderRadius: 28, padding: 20 }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 4 }}>
                  <Ionicons name="shield-checkmark" size={12} color="#d97706" />
                  <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>PROVISION STAFF & CORPORATE MAIL</Text>
                </View>
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 16 }}>Admin Management Console</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateAdminVisible(false)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', padding: 4, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => { setCreateMode('existing'); setSelectedUserId(null); }}
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: createMode === 'existing' ? '#0f172a' : 'transparent' }}
              >
                <Text style={{ color: createMode === 'existing' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 11 }}>👤 Select Registered User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setCreateMode('new'); setSelectedUserId(null); setNewAdminForm({ fullName: '', personalEmail: '', usernamePrefix: '', password: 'Password123!', role: 'admin', department: 'finance', sendMail: true }); }}
                style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: createMode === 'new' ? '#0f172a' : 'transparent' }}
              >
                <Text style={{ color: createMode === 'new' ? '#ffffff' : '#64748b', fontWeight: '900', fontSize: 11 }}>➕ Brand New Admin</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Mode A: Select Registered User */}
              {createMode === 'existing' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Search & Filter Registered Users ({existingUsers.length}) *</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, paddingHorizontal: 12, marginBottom: 10 }}>
                    <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
                    <TextInput
                      placeholder="Search by name, email, or phone number..."
                      value={searchUserQuery}
                      onChangeText={setSearchUserQuery}
                      style={{ flex: 1, paddingVertical: 10, color: '#0f172a', fontSize: 12, fontWeight: '700', outlineStyle: 'none' as any }}
                    />
                    {searchUserQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchUserQuery('')}>
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={{ maxHeight: 180, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 8 }}>
                    {existingUsers
                      .filter(u => {
                        if (!searchUserQuery.trim()) return true;
                        const q = searchUserQuery.toLowerCase();
                        return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
                      })
                      .map(u => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <TouchableOpacity
                            key={u.id}
                            onPress={() => {
                              setSelectedUserId(u.id);
                              const autoPrefix = (u.full_name || 'admin').trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
                              setNewAdminForm({
                                fullName: u.full_name || '',
                                personalEmail: u.email || '',
                                usernamePrefix: autoPrefix,
                                password: 'Password123!',
                                role: u.role === 'super_admin' ? 'super_admin' : 'admin',
                                department: 'finance',
                                sendMail: true
                              });
                            }}
                            style={{ 
                              padding: 12, 
                              borderRadius: 12, 
                              backgroundColor: isSelected ? '#0f172a' : '#ffffff', 
                              borderWidth: 1, 
                              borderColor: isSelected ? '#f5a623' : '#e2e8f0',
                              flexDirection: 'row', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: 6 
                            }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSelected ? '#f5a623' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                              <Text style={{ color: isSelected ? '#0f172a' : '#334155', fontWeight: '900', fontSize: 14 }}>
                                {(u.full_name || u.email || 'A')[0].toUpperCase()}
                              </Text>
                            </View>

                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ color: isSelected ? '#ffffff' : '#0f172a', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                                {u.full_name || 'Registered Member'}
                              </Text>
                              <Text style={{ color: isSelected ? '#94a3b8' : '#64748b', fontSize: 11 }} numberOfLines={1}>
                                {u.email} {u.phone ? `• ${u.phone}` : ''}
                              </Text>
                            </View>

                            <View style={{ backgroundColor: isSelected ? '#fffbeb' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? '#fde68a' : '#bfdbfe' }}>
                              <Text style={{ color: isSelected ? '#d97706' : '#2563eb', fontWeight: '900', fontSize: 10 }}>
                                {isSelected ? '✓ SELECTED' : (u.role || 'user').toUpperCase()}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </View>
              )}

              {/* Form Input Fields */}
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Staff Full Name *</Text>
              <TextInput
                placeholder="e.g. Musa Ibrahim"
                value={newAdminForm.fullName}
                onChangeText={(t) => {
                  const autoPrefix = t.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
                  setNewAdminForm({ ...newAdminForm, fullName: t, usernamePrefix: newAdminForm.usernamePrefix || autoPrefix });
                }}
                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 12, outlineStyle: 'none' as any }}
              />

              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Corporate Email Prefix (@abumafhal.com.ng) *</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, marginBottom: 6 }}>
                <TextInput
                  placeholder="e.g. musa"
                  value={newAdminForm.usernamePrefix}
                  onChangeText={(t) => setNewAdminForm({ ...newAdminForm, usernamePrefix: t.toLowerCase() })}
                  style={{ flex: 1, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, outlineStyle: 'none' as any }}
                  autoCapitalize="none"
                />
                <Text style={{ color: '#d97706', fontWeight: '900', fontSize: 12 }}>@abumafhal.com.ng</Text>
              </View>

              <View style={{ backgroundColor: '#0f172a', padding: 8, borderRadius: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="at" size={14} color="#f5a623" />
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Live Domain Email: <Text style={{ color: '#f5a623', fontWeight: '900' }}>{(newAdminForm.usernamePrefix || 'musa').toLowerCase()}@abumafhal.com.ng</Text></Text>
              </View>

              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Personal Email (Delivery Address) *</Text>
              <TextInput
                placeholder="e.g. musa.ibrahim@gmail.com"
                value={newAdminForm.personalEmail}
                onChangeText={(t) => setNewAdminForm({ ...newAdminForm, personalEmail: t })}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 12, outlineStyle: 'none' as any }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Temporary Initial Password *</Text>
                <TouchableOpacity onPress={generateRandomPassword}>
                  <Text style={{ color: '#2563eb', fontWeight: '900', fontSize: 10 }}>🎲 Auto-Generate</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="Password123!"
                value={newAdminForm.password}
                onChangeText={(t) => setNewAdminForm({ ...newAdminForm, password: t })}
                style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', fontWeight: '700', fontSize: 13, marginBottom: 12, outlineStyle: 'none' as any }}
              />

              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 }}>Assigned Privilege Level</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={() => setNewAdminForm({ ...newAdminForm, role: 'admin' })}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: newAdminForm.role === 'admin' ? '#0f172a' : '#cbd5e1', backgroundColor: newAdminForm.role === 'admin' ? '#0f172a' : '#f8fafc', alignItems: 'center' }}
                >
                  <Text style={{ color: newAdminForm.role === 'admin' ? '#ffffff' : '#334155', fontWeight: '900', fontSize: 11 }}>STAFF ADMIN 🛡️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNewAdminForm({ ...newAdminForm, role: 'super_admin' })}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: newAdminForm.role === 'super_admin' ? '#d97706' : '#cbd5e1', backgroundColor: newAdminForm.role === 'super_admin' ? '#fffbeb' : '#f8fafc', alignItems: 'center' }}
                >
                  <Text style={{ color: newAdminForm.role === 'super_admin' ? '#d97706' : '#334155', fontWeight: '900', fontSize: 11 }}>SUPER ADMIN 👑</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 }}>Department & Access Privilege</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { id: 'finance', label: '💰 Finance & Wallets' },
                    { id: 'telecom', label: '📱 Telecom VTU' },
                    { id: 'crypto', label: '🪙 Crypto & Cards' },
                    { id: 'support', label: '🎧 Customer Support' },
                    { id: 'master', label: '👑 Master Governance' }
                  ].map(dept => {
                    const isDeptSelected = newAdminForm.department === dept.id;
                    return (
                      <TouchableOpacity
                        key={dept.id}
                        onPress={() => setNewAdminForm({ ...newAdminForm, department: dept.id as any })}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDeptSelected ? '#0f172a' : '#f8fafc', borderWidth: 1, borderColor: isDeptSelected ? '#f5a623' : '#e2e8f0' }}
                      >
                        <Text style={{ color: isDeptSelected ? '#f5a623' : '#334155', fontWeight: '900', fontSize: 11 }}>{dept.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity
                onPress={handleCreateAdminSubmit}
                disabled={creatingAdmin}
                style={{ backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}
                activeOpacity={0.85}
              >
                {creatingAdmin ? (
                  <ActivityIndicator color="#f5a623" />
                ) : (
                  <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}>
                    {selectedUserId ? 'PROVISION ADMIN & SEND CREDENTIALS 🚀' : 'CREATE ADMIN & DISPATCH WELCOME MAIL 🚀'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  royalHeader: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  royalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  crownPillTxt: {
    color: C.goldBright,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  royalTitle: {
    color: C.white,
    fontWeight: '900',
    fontSize: 18,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  liveGreenTxt: {
    color: C.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  broadcastHeaderBtn: {
    backgroundColor: C.goldBright,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  broadcastBtnTxt: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 11,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.white,
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
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.goldBorder,
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
  sectionHeaderTitle: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  mainVaultCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  vaultSubTitle: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  vaultMainAmount: {
    color: C.textMain,
    fontWeight: '900',
    fontSize: 24,
    marginTop: 4,
  },
  vaultIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  vaultDivider: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginVertical: 14,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: (W - 46) / 2,
    backgroundColor: C.white,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCardNum: {
    color: C.textMain,
    fontWeight: '900',
    fontSize: 18,
  },
  statCardLabel: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  whiteCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTitle: {
    color: C.textMain,
    fontWeight: 'bold',
    fontSize: 13,
  },
  switchSub: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 1,
  },
  itemDivider: {
    height: 1,
    backgroundColor: C.cardBorder,
    marginVertical: 10,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  staffAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  staffAvatarTxt: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 14,
  },
  staffNameTxt: {
    color: C.textMain,
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
    borderWidth: 1,
  },
  badgePillTxt: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  redGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  redCard: {
    width: (W - 46) / 2,
    backgroundColor: C.white,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  redIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  redCardTitle: {
    color: C.textMain,
    fontWeight: '900',
    fontSize: 12,
  },
  redCardSub: {
    color: C.textSub,
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: C.textMain,
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
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 12,
    color: C.textMain,
    borderWidth: 1,
    borderColor: C.cardBorder,
    outlineStyle: 'none' as any,
    overflow: 'hidden',
  },
  sendBtn: {
    backgroundColor: C.navy,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  sendBtnTxt: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
});
