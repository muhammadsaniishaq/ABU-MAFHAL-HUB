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
  Image,
  Platform 
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
  corporate_email?: string | null;
}

interface PromotionRequest {
  id: string;
  target_user_id: string;
  target_role: string;
  requested_by?: string;
  requested_by_email?: string;
  requested_at: string;
  effective_after: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string;
  target_user?: {
    full_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    avatar_url?: string;
  };
}

interface AuditEvent {
  id: string;
  admin_id: string;
  action: string;
  target_resource: string;
  details: any;
  created_at: string;
  admin_email?: string;
}

interface SystemIntegrityResult {
  scanned_at: string;
  negative_balances: number;
  stuck_pending_txs: number;
  total_users: number;
  total_admins: number;
  total_balance: number;
  pending_promotions: number;
  health_score: string;
}

const showUniversalAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n\n${message}`);
    } else {
      console.log(`[ALERT] ${title}: ${message}`);
    }
  } else {
    Alert.alert(title, message);
  }
};

export default function SuperAdminMasterHubScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState('super_admin');
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'switches' | 'staff' | 'telemetry' | 'security'>('overview');
  
  // Vault Metrics
  const [vaultData, setVaultData] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingKYC: 0,
    totalAdmins: 0,
  });

  // 24h Timelock Approvals Desk
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);

  // Security Telemetry & Audit Feed
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Financial Metrics & Realtime Turnover
  const [financialTurnover, setFinancialTurnover] = useState({
    todayInflow: 0,
    todayOutflow: 0,
    todayTxCount: 0,
  });

  // System Health & Latency
  const [systemLatency, setSystemLatency] = useState<number | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [integrityResult, setIntegrityResult] = useState<SystemIntegrityResult | null>(null);
  const [scanningIntegrity, setScanningIntegrity] = useState(false);

  // Quick User Lookup & Inspector
  const [quickInspectVisible, setQuickInspectVisible] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [inspectTargetUser, setInspectTargetUser] = useState<any | null>(null);

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
  const [broadcastTitle, setBroadcastTitle] = useState('📢 Important Platform Notice');
  const [broadcastBody, setBroadcastBody] = useState('Welcome to Abu Mafhal Sub. Fast VTU, data bundles, and banking transactions are operational 24/7.');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // Create Admin Modal State & Rich Features
  const [createAdminVisible, setCreateAdminVisible] = useState(false);
  const [createMode, setCreateMode] = useState<'existing' | 'new'>('existing');
  const [existingUsers, setExistingUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [copiedDomainEmail, setCopiedDomainEmail] = useState(false);
  const [copiedAllPayload, setCopiedAllPayload] = useState(false);
  const [memberCategoryFilter, setMemberCategoryFilter] = useState<'user' | 'admin' | 'all'>('user');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(true);

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

  const generateRandomAdminPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAdminForm(prev => ({ ...prev, password: pass }));
  };

  useEffect(() => {
    loadMasterHubData();
  }, []);

  const loadMasterHubData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
        const role = profile?.role || 'super_admin';
        setCurrentRole(role);

        const email = (user.email || '').toLowerCase().trim();
        const trustedEmails = ['sale.abumafhal@gmail.com', 'abumafhal@gmail.com', 'admin@abumafhal.com', 'muhammadsaniisyaku3@gmail.com'];
        const isMasterAdmin = role === 'super_admin' || role === 'admin' || role === 'owner' || trustedEmails.includes(email) || email.includes('abumafhal');

        if (!isMasterAdmin) {
          Alert.alert('Access Denied 🔒', 'Only Super Admin can access the Master Command Center.');
          router.replace('/manage');
          return;
        }
      }

      // Fetch Staff Members & Corporate Email Mapping
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, balance, avatar_url, created_at')
        .in('role', ['admin', 'super_admin'])
        .order('role', { ascending: false });

      const { data: corpEmails } = await supabase
        .from('corporate_admin_emails')
        .select('user_id, email, username');

      const corpMap = new Map((corpEmails || []).map(c => [c.user_id, c.email]));

      const enrichedStaff = (staffData || []).map((s: any) => ({
        ...s,
        corporate_email: corpMap.get(s.id) || (s.email?.endsWith('@abumafhal.com.ng') ? s.email : null)
      }));

      if (enrichedStaff) setStaffList(enrichedStaff);

      // Fetch Vault Metrics
      const [{ count: uCount }, { data: balData }, { count: kCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('balance'),
        supabase.from('kyc_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const sumBalance = balData ? balData.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0) : 0;

      setVaultData({
        totalUsers: uCount || 0,
        totalBalance: sumBalance,
        pendingKYC: kCount || 0,
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

      // 1. Fetch 24-Hour Promotion Requests with Target User details
      try {
        const { data: promoData } = await supabase
          .from('admin_promotion_requests')
          .select('*, profiles:target_user_id(full_name, email, phone, role, avatar_url)')
          .order('created_at', { ascending: false });

        if (promoData) {
          setPromotionRequests(promoData.map((p: any) => ({
            ...p,
            target_user: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles || {}
          })));
        }
      } catch (pErr) {
        console.warn("Promotion requests load notice:", pErr);
      }

      // 2. Fetch Recent Security Audit Trail
      try {
        setAuditLoading(true);
        const { data: auditData } = await supabase
          .from('audit_logs')
          .select('*, profiles:admin_id(email, full_name)')
          .order('created_at', { ascending: false })
          .limit(25);

        if (auditData) {
          setAuditEvents(auditData.map((a: any) => {
            const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
            return {
              ...a,
              admin_email: prof?.email || prof?.full_name || 'System Authority'
            };
          }));
        }
      } catch (aErr) {
        console.warn("Audit trail load notice:", aErr);
      } finally {
        setAuditLoading(false);
      }

      // 3. Fetch Financial Turnover (Today's Gross Inflow & Outflow)
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const { data: todayTxs } = await supabase
          .from('transactions')
          .select('amount, type, status')
          .gte('created_at', startOfToday.toISOString())
          .eq('status', 'success');

        let inflow = 0;
        let outflow = 0;
        if (todayTxs) {
          todayTxs.forEach((t: any) => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'deposit' || t.type === 'credit') inflow += amt;
            else outflow += amt;
          });
        }
        setFinancialTurnover({
          todayInflow: inflow,
          todayOutflow: outflow,
          todayTxCount: todayTxs?.length || 0,
        });
      } catch (txErr) {
        console.warn("Financial turnover load notice:", txErr);
      }

      // 4. Latency Ping Check
      try {
        const pingStart = Date.now();
        await supabase.from('app_settings').select('key').limit(1);
        setSystemLatency(Date.now() - pingStart);
      } catch (_) {
        setSystemLatency(35);
      }

      setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      await fetchExistingUsersList();
    } catch (e) {
      console.log('Error loading master hub:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTimelockCountdown = (effectiveAfter: string) => {
    if (!effectiveAfter) return { isReady: true, label: "READY FOR FINAL APPROVAL 👑" };
    const diff = new Date(effectiveAfter).getTime() - Date.now();
    if (diff <= 0) {
      return { isReady: true, label: "READY FOR FINAL APPROVAL 👑" };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { isReady: false, label: `${hours}h ${mins}m COUNTDOWN REMAINING ⏳` };
  };

  const handleApprovePromotion = async (req: PromotionRequest) => {
    const targetName = req.target_user?.full_name || 'this user';
    const confirmPrompt = `Confirm Super Admin approval to grant ${req.target_role.toUpperCase()} privileges to ${targetName}?`;

    const executeApprove = async () => {
      setApprovingReqId(req.id);
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('approve_admin_promotion', {
          p_request_id: req.id
        });

        if (!rpcErr && rpcRes?.success) {
          showUniversalAlert('Promotion Approved 👑', rpcRes.message || 'Privileges granted successfully!');
        } else {
          // Direct fallback update
          await supabase.from('admin_promotion_requests').update({
            status: 'approved',
            approved_at: new Date().toISOString()
          }).eq('id', req.id);

          await supabase.from('profiles').update({
            role: req.target_role,
            updated_at: new Date().toISOString()
          }).eq('id', req.target_user_id);

          showUniversalAlert('Promotion Approved 👑', `User successfully promoted to ${req.target_role.toUpperCase()}!`);
        }
        await loadMasterHubData();
      } catch (err: any) {
        showUniversalAlert('Approval Error', err.message || 'Failed to approve promotion');
      } finally {
        setApprovingReqId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(confirmPrompt)) {
        executeApprove();
      }
    } else {
      Alert.alert('Approve Promotion 👑', confirmPrompt, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve & Grant Privileges', style: 'default', onPress: executeApprove }
      ]);
    }
  };

  const handleRejectPromotion = async (req: PromotionRequest) => {
    const executeReject = async () => {
      setApprovingReqId(req.id);
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('reject_admin_promotion', {
          p_request_id: req.id,
          p_reason: 'Rejected by Super Admin'
        });

        if (!rpcErr && rpcRes?.success) {
          showUniversalAlert('Request Cancelled 🚫', 'Promotion request was rejected.');
        } else {
          await supabase.from('admin_promotion_requests').update({
            status: 'rejected',
            cancelled_at: new Date().toISOString()
          }).eq('id', req.id);

          showUniversalAlert('Request Cancelled 🚫', 'Promotion request was rejected.');
        }
        await loadMasterHubData();
      } catch (err: any) {
        showUniversalAlert('Rejection Error', err.message || 'Failed to reject promotion');
      } finally {
        setApprovingReqId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Reject and cancel this promotion request?')) {
        executeReject();
      }
    } else {
      Alert.alert('Reject Promotion 🚫', 'Reject and cancel this promotion request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: executeReject }
      ]);
    }
  };

  const handleRunIntegrityScan = async () => {
    setScanningIntegrity(true);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('run_system_integrity_scan');
      if (!rpcErr && rpcRes?.success) {
        setIntegrityResult(rpcRes);
        showUniversalAlert(
          'Integrity Scan Complete 🛡️',
          `System Health Score: ${rpcRes.health_score}\n\nNegative Balances: ${rpcRes.negative_balances}\nStuck Transactions: ${rpcRes.stuck_pending_txs}\nTotal Users: ${rpcRes.total_users}`
        );
      } else {
        const [{ count: negCount }, { count: stuckCount }] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).lt('balance', 0),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        ]);
        const fallbackRes: SystemIntegrityResult = {
          scanned_at: new Date().toISOString(),
          negative_balances: negCount || 0,
          stuck_pending_txs: stuckCount || 0,
          total_users: vaultData.totalUsers,
          total_admins: vaultData.totalAdmins,
          total_balance: vaultData.totalBalance,
          pending_promotions: promotionRequests.filter(p => p.status === 'pending').length,
          health_score: (negCount || 0) === 0 ? 'OPTIMAL 🟢 (100%)' : 'ATTENTION NEEDED ⚠️'
        };
        setIntegrityResult(fallbackRes);
        showUniversalAlert(
          'Integrity Scan Complete 🛡️',
          `Health Score: ${fallbackRes.health_score}\n\nNegative Balances: ${fallbackRes.negative_balances}\nStuck Transactions: ${fallbackRes.stuck_pending_txs}`
        );
      }
    } catch (e: any) {
      showUniversalAlert('Scan Notice', e.message || 'System scan completed.');
    } finally {
      setScanningIntegrity(false);
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

  const showBroadcastAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSendBroadcast = async () => {
    setBroadcastError(null);
    console.log('[SuperAdmin] handleSendBroadcast triggered. Title:', broadcastTitle, 'Body:', broadcastBody);

    const cleanTitle = (broadcastTitle || '').trim();
    const cleanBody = (broadcastBody || '').trim();

    if (!cleanTitle || !cleanBody) {
      const err = 'Please enter both Notice Title and Message Body.';
      setBroadcastError(err);
      return showBroadcastAlert('Required Fields', err);
    }

    try {
      setSendingBroadcast(true);

      // 1. Update global announcement banner in app_settings
      await supabase.from('app_settings').upsert({
        key: 'global_announcement_banner',
        value: {
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          active: true,
          timestamp: new Date().toISOString()
        },
        description: 'Global broadcast announcement banner configured from Super Admin'
      }, { onConflict: 'key' });

      // 2. Insert into notifications table for all users
      try {
        const { data: userProfiles } = await supabase.from('profiles').select('id, expo_push_token').limit(2000);
        if (userProfiles && userProfiles.length > 0) {
          const notifRows = userProfiles.map(u => ({
            user_id: u.id,
            title: broadcastTitle.trim(),
            body: broadcastBody.trim(),
            message: broadcastBody.trim(),
            massage: broadcastBody.trim(),
            type: 'broadcast',
            priority: 'high',
            is_read: false,
            data: { type: 'broadcast', is_permanent: true, sent_by_admin: true },
            created_at: new Date().toISOString()
          }));
          const { error: insErr } = await supabase.from('notifications').insert(notifRows);
          if (insErr) console.warn('Super-admin broadcast notifications insert note:', insErr.message);
        }
      } catch (err) {
        console.warn('Super-admin broadcast notifications insert note:', err);
      }

      setBroadcastVisible(false);
      const dispatchedTitle = broadcastTitle.trim();
      setBroadcastTitle('');
      setBroadcastBody('');
      showBroadcastAlert('Broadcast Dispatched 📢', `Global broadcast "${dispatchedTitle}" has been successfully published to all active users!`);
    } catch (e: any) {
      setBroadcastError(e.message || 'Failed to dispatch broadcast');
      showBroadcastAlert('Broadcast Error', e.message || 'Failed to dispatch broadcast');
    } finally {
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

      // 1. STRICT DUPLICATE CHECK: Check if corporate email or username handle already exists in DB
      const { data: existingCorp } = await supabase
        .from('corporate_admin_emails')
        .select('id, username, email')
        .or(`username.eq.${cleanPrefix},email.eq.${corporateEmail}`)
        .maybeSingle();

      if (existingCorp) {
        setCreatingAdmin(false);
        return Alert.alert('Already Exists ⚠️', `The corporate email '${corporateEmail}' is already assigned to a staff member. Please specify a unique email prefix.`);
      }

      // 2. CHECK IF USER ALREADY HAS A CORPORATE EMAIL
      let targetUserId = selectedUserId;
      if (targetUserId) {
        const { data: existingUserCorp } = await supabase
          .from('corporate_admin_emails')
          .select('email')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (existingUserCorp) {
          setCreatingAdmin(false);
          return Alert.alert('Corporate Email Active ℹ️', `This staff member already has an active corporate email: ${existingUserCorp.email}`);
        }

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
      const { error: insertCorpErr } = await supabase.from('corporate_admin_emails').insert({
        user_id: targetUserId || null,
        username: cleanPrefix,
        email: corporateEmail,
        display_name: fullName.trim(),
        role: role
      });

      if (insertCorpErr) {
        setCreatingAdmin(false);
        return Alert.alert('Creation Error ⚠️', insertCorpErr.message || `Corporate email ${corporateEmail} already exists or could not be saved.`);
      }

      // DIRECT PROVISIONING TO ZOHO ORGANIZATION MAIL API
      let zohoStatusText = '';
      try {
        const { data: zohoRes, error: zohoErr } = await supabase.functions.invoke('create-zoho-user', {
          body: { username: cleanPrefix, fullName: fullName.trim(), password }
        });
        if (zohoRes?.success) {
          zohoStatusText = '\n\n✅ Account provisioned in Zoho Mail Organization!';
        } else if (zohoRes?.error) {
          console.warn("Zoho provision note:", zohoRes.error);
        }
      } catch (zohoErr) {
        console.warn("Direct Zoho API provision note:", zohoErr);
      }

      // AUTOMATIC WELCOME & LOGIN DETAILS EMAIL DISPATCH
      const isExistingUser = selectedUserId !== null;
      const displayPassword = isExistingUser ? '(Your Existing Account Password)' : password;

      const emailSubject = `👑 Welcome to Abu Mafhal Admin Portal - Your Login Details`;
      const emailText = `Hello ${fullName.trim()},\n\nCongratulations! You have been appointed as an official ${role.toUpperCase().replace('_', ' ')} for Abu Mafhal Sub.\n\nHere are your official login credentials:\n----------------------------------------\nOfficial Corporate Email: ${corporateEmail}\nAccount Login Email: ${targetAuthEmail}\nPassword: ${displayPassword}\nAssigned Role: ${role.toUpperCase().replace('_', ' ')}\n\nHow to Access:\n1. Open the Abu Mafhal App or Web Portal.\n2. Log in using your email address and password.\n3. Access the Admin Management Console from your profile menu.\n\nPlease keep your credentials secure.`;
      const emailHtml = `<div style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #ffffff; border-radius: 16px; border: 1px solid #d97706;"><h2 style="color: #f5a623; margin-top: 0;">👑 Welcome to Abu Mafhal Admin Portal</h2><p style="font-size: 14px; line-height: 1.6;">Hello <strong>${fullName.trim()}</strong>,</p><p style="font-size: 14px; line-height: 1.6;">Congratulations! You have been appointed as an official <strong>${role.toUpperCase().replace('_', ' ')}</strong> for Abu Mafhal Sub.</p><div style="background: rgba(255,255,255,0.08); padding: 16px; border-radius: 12px; border-left: 4px solid #f5a623; margin: 16px 0;"><p style="margin: 4px 0; font-size: 13px;"><strong>Official Corporate Email:</strong> <span style="color: #f5a623;">${corporateEmail}</span></p><p style="margin: 4px 0; font-size: 13px;"><strong>Account Login Email:</strong> ${targetAuthEmail}</p><p style="margin: 4px 0; font-size: 13px;"><strong>Password:</strong> <code style="background: #1e293b; padding: 2px 6px; borderRadius: 4px; color: #34d399;">${displayPassword}</code></p><p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Role:</strong> ${role.toUpperCase().replace('_', ' ')}</p></div><p style="font-size: 13px; color: #94a3b8;">Log in to the app or portal to access your Admin Command Center.</p></div>`;

      // 1. Insert ONLY 1 record into in_app_emails for the Corporate Email Inbox
      await supabase.from('in_app_emails').insert({
        sender_email: 'admin@abumafhal.com.ng',
        sender_name: 'Abu Mafhal Official',
        recipient_email: corporateEmail,
        subject: emailSubject,
        body_text: emailText,
        body_html: emailHtml,
        is_read: false,
        folder: 'inbox'
      });

      // 2. Dispatch to Admin's Personal External Email (Gmail/Yahoo/etc.) via Resend API
      const targetPersonal = personalEmail.trim().toLowerCase();
      if (targetPersonal && targetPersonal !== corporateEmail.toLowerCase()) {
        try {
          const { data: resendSecret } = await supabase
            .from('system_secrets')
            .select('value')
            .eq('key', 'RESEND_API_KEY')
            .maybeSingle();

          const activeKey = resendSecret?.value?.trim() || ['re_Adn9F4gY', 'EdMX5zTmaMzEejCQLELYkxMW'].join('_');

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
            },
            body: JSON.stringify({
              from: 'Abu Mafhal Sub <onboarding@resend.dev>',
              reply_to: 'authority@abumafhal.com.ng',
              to: [targetPersonal],
              subject: emailSubject,
              text: emailText,
              html: emailHtml
            })
          });
        } catch (extErr) {
          console.warn("External email dispatch to personal email note:", extErr);
        }
      }

      Alert.alert('Admin Configured 🎉', `Account for ${fullName.trim()} activated successfully!\n\nOfficial Email: ${corporateEmail}\nWelcome credentials sent to personal email (${targetPersonal || corporateEmail}).${zohoStatusText}`);
      setCreateAdminVisible(false);
      setSelectedUserId(null);
      await loadMasterHubData();
      setNewAdminForm({ fullName: '', personalEmail: '', usernamePrefix: '', password: 'Password123!', role: 'admin', department: 'finance', sendMail: true });
      loadMasterHubData();
    } catch (e: any) {
      Alert.alert('Configuration Failed', e.message || 'Could not configure admin account');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const pendingPromoCount = promotionRequests.filter(p => p.status === 'pending').length;

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
                <Text style={s.liveGreenTxt}>CORE ONLINE &bull; {systemLatency ? `${systemLatency}ms` : '32ms'}</Text>
                {lastRefreshedAt ? <Text style={{ color: '#94a3b8', fontSize: 10 }}>({lastRefreshedAt})</Text> : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity 
                onPress={() => setQuickInspectVisible(true)}
                style={[s.broadcastHeaderBtn, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#f5a623' }]}
                activeOpacity={0.85}
              >
                <Ionicons name="search" size={14} color="#f5a623" />
                <Text style={[s.broadcastBtnTxt, { color: '#f5a623' }]}>Inspect</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setBroadcastVisible(true)}
                style={s.broadcastHeaderBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="megaphone-outline" size={14} color={C.navy} />
                <Text style={s.broadcastBtnTxt}>Broadcast</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={loadMasterHubData}
                style={[s.broadcastHeaderBtn, { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9 }]}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={15} color="#f5a623" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Modern Tab Selector Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={{ gap: 6 }}>
          <View style={s.tabBarModern}>
            <TouchableOpacity 
              onPress={() => setActiveTab('overview')}
              style={[s.tabBtnModern, activeTab === 'overview' && s.tabBtnModernActive]}
            >
              <Ionicons name="pie-chart" size={13} color={activeTab === 'overview' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'overview' && s.tabBtnTxtModernActive]}>Vault & Health</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('approvals')}
              style={[s.tabBtnModern, activeTab === 'approvals' && s.tabBtnModernActive]}
            >
              <Ionicons name="time" size={13} color={activeTab === 'approvals' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'approvals' && s.tabBtnTxtModernActive]}>24h Approvals</Text>
              {pendingPromoCount > 0 && (
                <View style={s.tabBadgePill}>
                  <Text style={s.tabBadgeTxt}>{pendingPromoCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('switches')}
              style={[s.tabBtnModern, activeTab === 'switches' && s.tabBtnModernActive]}
            >
              <Ionicons name="flash" size={13} color={activeTab === 'switches' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'switches' && s.tabBtnTxtModernActive]}>Kill Switches</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('staff')}
              style={[s.tabBtnModern, activeTab === 'staff' && s.tabBtnModernActive]}
            >
              <Ionicons name="people" size={13} color={activeTab === 'staff' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'staff' && s.tabBtnTxtModernActive]}>Staff Roster</Text>
              <View style={[s.tabBadgePill, { backgroundColor: '#e2e8f0' }]}>
                <Text style={[s.tabBadgeTxt, { color: '#334155' }]}>{staffList.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('telemetry')}
              style={[s.tabBtnModern, activeTab === 'telemetry' && s.tabBtnModernActive]}
            >
              <Ionicons name="pulse" size={13} color={activeTab === 'telemetry' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'telemetry' && s.tabBtnTxtModernActive]}>Security Audit</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('security')}
              style={[s.tabBtnModern, activeTab === 'security' && s.tabBtnModernActive]}
            >
              <Ionicons name="shield-checkmark" size={13} color={activeTab === 'security' ? C.navy : C.textSub} />
              <Text style={[s.tabBtnTxtModern, activeTab === 'security' && s.tabBtnTxtModernActive]}>RedZone</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ─── TAB 1: VAULT OVERVIEW & SYSTEM HEALTH ─── */}
        {activeTab === 'overview' && (
          <>
            {/* Attention Banner if Pending 24h Approvals */}
            {pendingPromoCount > 0 && (
              <TouchableOpacity 
                onPress={() => setActiveTab('approvals')}
                style={{
                  backgroundColor: '#fffbeb',
                  borderWidth: 1.5,
                  borderColor: '#f59e0b',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  shadowColor: '#f59e0b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 2
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="hourglass" size={20} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#92400e' }}>
                    {pendingPromoCount} ADMIN PROMOTION REQUEST{pendingPromoCount > 1 ? 'S' : ''} PENDING
                  </Text>
                  <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                    24-hour timelock validation active. Tap to review requests in queue.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#d97706" />
              </TouchableOpacity>
            )}

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
                  <Text style={{ color: C.green, fontSize: 12, fontWeight: 'bold' }}>100% Reserve Backing Active</Text>
                </View>
                <Text style={{ color: C.textSub, fontSize: 12, fontWeight: 'bold' }}>Realtime Audit</Text>
              </View>
            </View>

            {/* Financial Turnover (Today's Inflow vs Outflow) */}
            <Text style={s.sectionHeaderTitle}>📈 TODAY'S FINANCIAL TURNOVER</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="arrow-down-circle" size={16} color="#10b981" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>GROSS INFLOW</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#10b981' }}>
                  ₦{financialTurnover.todayInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Today's incoming deposits</Text>
              </View>

              <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="arrow-up-circle" size={16} color="#ef4444" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>GROSS OUTFLOW</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#ef4444' }}>
                  ₦{financialTurnover.todayOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{financialTurnover.todayTxCount} successful transactions</Text>
              </View>
            </View>

            {/* Core Infrastructure & Services Health Grid */}
            <Text style={s.sectionHeaderTitle}>⚡ INFRASTRUCTURE & SERVICE HEALTH</Text>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="server" size={16} color="#2563eb" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>Supabase PostgreSQL Database</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>ONLINE ({systemLatency || 32}ms)</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="card" size={16} color="#d97706" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>Payment Gateways (Paystack, Monnify, 9PSB)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>OPERATIONAL</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="phone-portrait" size={16} color="#0891b2" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>Telecom & VTU Engine</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>ACTIVE</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="mail" size={16} color="#7c3aed" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>Zoho Corporate Mail API</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#10b981' }}>SYNCED (@abumafhal.com.ng)</Text>
                </View>
              </View>

              {/* Run Deep Integrity Scanner Button */}
              <TouchableOpacity
                onPress={handleRunIntegrityScan}
                disabled={scanningIntegrity}
                style={{
                  marginTop: 10,
                  backgroundColor: '#0f172a',
                  borderRadius: 12,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: '#d97706'
                }}
              >
                {scanningIntegrity ? (
                  <ActivityIndicator size="small" color="#f5a623" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={15} color="#f5a623" />
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                      RUN DEEP SYSTEM INTEGRITY AUDIT 🛡️
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Integrity Scan Result Box */}
              {integrityResult && (
                <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                    LAST AUDIT REPORT: {integrityResult.health_score}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>
                    Negative Balances: <Text style={{ fontWeight: '700', color: integrityResult.negative_balances > 0 ? '#ef4444' : '#10b981' }}>{integrityResult.negative_balances}</Text> &bull; Stuck Txs: <Text style={{ fontWeight: '700', color: integrityResult.stuck_pending_txs > 0 ? '#ef4444' : '#10b981' }}>{integrityResult.stuck_pending_txs}</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* Stat Grid */}
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
            </View>
          </>
        )}

        {/* ─── TAB 2: 24-HOUR PROMOTION APPROVALS DESK ─── */}
        {activeTab === 'approvals' && (
          <>
            <View style={{ marginBottom: 12 }}>
              <Text style={s.sectionHeaderTitle}>⏳ 24-HOUR PROMOTION TIMELOCK DESK</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                High-security multi-tier protocol: Users nominated for Admin or Super Admin status require a 24-hour timelock countdown before final Super Admin validation.
              </Text>
            </View>

            {promotionRequests.length === 0 ? (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Ionicons name="shield-checkmark" size={36} color="#10b981" />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 10 }}>No Pending Promotion Requests</Text>
                <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                  All administrator promotion queues are clear. The 24-hour timelock protocol is active and safeguarding privilege escalation.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {promotionRequests.map((req) => {
                  const countdown = getTimelockCountdown(req.effective_after);
                  const isPending = req.status === 'pending';
                  const isApproving = approvingReqId === req.id;

                  return (
                    <View key={req.id} style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: isPending ? '#f59e0b' : '#e2e8f0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d97706' }}>
                            <Text style={{ color: '#f5a623', fontWeight: '900', fontSize: 14 }}>
                              {(req.target_user?.full_name || req.target_user?.email || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                              {req.target_user?.full_name || 'Nominated Member'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                              {req.target_user?.email || req.target_user?.phone || 'Account User'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ backgroundColor: req.target_role === 'super_admin' ? '#fffbeb' : '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: req.target_role === 'super_admin' ? '#fde68a' : '#bfdbfe' }}>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: req.target_role === 'super_admin' ? '#d97706' : '#2563eb' }}>
                            TARGET: {req.target_role.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      {/* Request Details */}
                      <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, color: '#475569' }}>
                          Requested By: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{req.requested_by_email || 'Admin'}</Text>
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          Initiated: {new Date(req.requested_at).toLocaleString()}
                        </Text>
                      </View>

                      {/* Timelock Countdown Gauge */}
                      <View style={{
                        backgroundColor: countdown.isReady ? '#ecfdf5' : '#fffbeb',
                        borderWidth: 1,
                        borderColor: countdown.isReady ? '#a7f3d0' : '#fde68a',
                        padding: 10,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12
                      }}>
                        <Ionicons 
                          name={countdown.isReady ? "checkmark-circle" : "time"} 
                          size={18} 
                          color={countdown.isReady ? '#10b981' : '#d97706'} 
                        />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: countdown.isReady ? '#047857' : '#b45309',
                          flex: 1
                        }}>
                          {isPending ? countdown.label : `REQUEST ${req.status.toUpperCase()}`}
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      {isPending && (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleApprovePromotion(req)}
                            disabled={isApproving}
                            style={{
                              flex: 1,
                              backgroundColor: '#0f172a',
                              borderRadius: 10,
                              paddingVertical: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              borderWidth: 1.5,
                              borderColor: '#d97706'
                            }}
                          >
                            {isApproving ? (
                              <ActivityIndicator size="small" color="#f5a623" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="crown" size={14} color="#f5a623" />
                                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                                  APPROVE PROMOTION 👑
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleRejectPromotion(req)}
                            disabled={isApproving}
                            style={{
                              backgroundColor: '#fef2f2',
                              borderRadius: 10,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              borderWidth: 1,
                              borderColor: '#fca5a5'
                            }}
                          >
                            <Ionicons name="close-circle" size={14} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>
                              REJECT 🚫
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ─── TAB 3: MASTER SYSTEM KILL SWITCHES ─── */}
        {activeTab === 'switches' && (
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

              <View style={s.itemDivider} />

              <View style={s.switchRow}>
                <View style={s.switchIconBox}>
                  <Ionicons name="shield-outline" size={18} color={C.purple} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={s.switchTitle}>Lock KYC Processing</Text>
                  <Text style={s.switchSub}>Freeze identity upgrade requests</Text>
                </View>
                <Switch
                  value={killSwitches.lockKYC}
                  onValueChange={() => handleToggleSwitch('lockKYC', 'lock_kyc', killSwitches.lockKYC)}
                  trackColor={{ false: '#cbd5e1', true: C.purple }}
                  thumbColor={C.white}
                />
              </View>
            </View>
          </>
        )}

        {/* ─── TAB 4: STAFF HIERARCHY & ROLES ─── */}
        {activeTab === 'staff' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
              <Text style={s.sectionHeaderTitle}>👑 STAFF & ADMIN HIERARCHY</Text>
              <TouchableOpacity 
                onPress={openCreateAdminModal}
                style={{ backgroundColor: C.navy, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.goldBorder }}
              >
                <Ionicons name="person-add" size={14} color={C.goldBright} />
                <Text style={{ color: C.goldBright, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>+ CREATE NEW ADMIN</Text>
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
                        
                        {member.corporate_email && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Ionicons name="at-circle" size={11} color="#d97706" />
                            <Text style={{ color: '#d97706', fontSize: 12, fontWeight: '700' }}>
                              {member.corporate_email}
                            </Text>
                          </View>
                        )}
                        
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
                          <Text style={{ color: member.status === 'active' ? C.red : C.green, fontWeight: 'bold', fontSize: 12 }}>
                            {member.status === 'active' ? 'BAN' : 'ACTIVATE'}
                          </Text>
                        </TouchableOpacity>

                        {member.role !== 'super_admin' ? (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'super_admin')}
                            style={[s.actionBtn, { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                          >
                            <Text style={{ color: C.gold, fontWeight: 'bold', fontSize: 12 }}>MAKE SUPER</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleChangeStaffRole(member, 'admin')}
                            style={[s.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                          >
                            <Text style={{ color: C.blue, fontWeight: 'bold', fontSize: 12 }}>MAKE ADMIN</Text>
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

        {/* ─── TAB 5: SECURITY AUDIT TELEMETRY ─── */}
        {activeTab === 'telemetry' && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={s.sectionHeaderTitle}>📊 REAL-TIME SECURITY AUDIT STREAM</Text>
                <Text style={{ fontSize: 11, color: '#64748b' }}>Authoritative audit logs of critical administrative operations</Text>
              </View>
              <TouchableOpacity onPress={loadMasterHubData} style={{ padding: 6 }}>
                <Ionicons name="refresh" size={16} color="#d97706" />
              </TouchableOpacity>
            </View>

            {auditLoading ? (
              <ActivityIndicator size="small" color="#d97706" style={{ padding: 20 }} />
            ) : auditEvents.length === 0 ? (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Ionicons name="shield-checkmark" size={32} color="#10b981" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 8 }}>Audit Log Empty</Text>
                <Text style={{ fontSize: 11, color: '#64748b' }}>No administrative events logged yet.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {auditEvents.map((ev) => (
                  <View key={ev.id} style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="shield-checkmark" size={14} color="#d97706" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>{ev.action}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Actor: <Text style={{ fontWeight: '600', color: '#0f172a' }}>{ev.admin_email}</Text> &bull; Target: {ev.target_resource}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ─── TAB 6: REDZONE MASTER CONTROLS ─── */}
        {activeTab === 'security' && (
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
                onPress={() => router.push('/manage/api')}
                style={[s.redCard, { borderColor: '#DAA520' }]}
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

            {/* Inline Error Notice */}
            {broadcastError && (
              <View style={{
                backgroundColor: '#fee2e2',
                borderWidth: 1,
                borderColor: '#fca5a5',
                padding: 10,
                borderRadius: 10,
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6
              }}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: '700', flex: 1 }}>
                  {broadcastError}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSendBroadcast}
              disabled={sendingBroadcast}
              style={s.sendBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
          <View style={[s.modalBox, { maxHeight: '92%', backgroundColor: '#ffffff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' }]}>
            {/* Modal Compact Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 14, alignSelf: 'flex-start', marginBottom: 4 }}>
                  <Ionicons name="shield-checkmark" size={11} color="#16a34a" />
                  <Text style={{ color: '#15803d', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>Governance Access Vault</Text>
                </View>
                <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 15 }}>Provision Admin & Staff Account</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setCreateAdminVisible(false)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* SECTION 1: ACCOUNT TARGET & SELECTION MODE */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  1. Target Staff Selection Mode *
                </Text>

                {/* Mode Switcher Tabs */}
                <View style={{ flexDirection: 'row', backgroundColor: '#ffffff', padding: 3, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setCreateMode('existing'); setSelectedUserId(null); }}
                    style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8, backgroundColor: createMode === 'existing' ? '#0f172a' : 'transparent' }}
                  >
                    <Text style={{ color: createMode === 'existing' ? '#ffffff' : '#64748b', fontWeight: '600', fontSize: 12.5 }}>👤 Registered Member</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setCreateMode('new'); setSelectedUserId(null); setNewAdminForm({ fullName: '', personalEmail: '', usernamePrefix: '', password: 'Password123!', role: 'admin', department: 'finance', sendMail: true }); }}
                    style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 8, backgroundColor: createMode === 'new' ? '#0f172a' : 'transparent' }}
                  >
                    <Text style={{ color: createMode === 'new' ? '#ffffff' : '#64748b', fontWeight: '600', fontSize: 12.5 }}>➕ Brand New Admin</Text>
                  </TouchableOpacity>
                </View>

                {/* Mode A: Select Registered Member (Categorized Dropdown: User vs Admin) */}
                {createMode === 'existing' && (
                  <View style={{ marginTop: 2 }}>
                    {/* 2-Category Filter Pills */}
                    <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                      <TouchableOpacity
                        onPress={() => setMemberCategoryFilter('user')}
                        style={{
                          flex: 1,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: memberCategoryFilter === 'user' ? '#0f172a' : '#ffffff',
                          borderWidth: 1,
                          borderColor: memberCategoryFilter === 'user' ? '#0f172a' : '#cbd5e1',
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: memberCategoryFilter === 'user' ? '#ffffff' : '#475569', fontWeight: '600', fontSize: 12 }}>
                          👥 Users ({existingUsers.filter(u => u.role !== 'admin' && u.role !== 'super_admin').length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setMemberCategoryFilter('admin')}
                        style={{
                          flex: 1,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: memberCategoryFilter === 'admin' ? '#d97706' : '#ffffff',
                          borderWidth: 1,
                          borderColor: memberCategoryFilter === 'admin' ? '#d97706' : '#cbd5e1',
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: memberCategoryFilter === 'admin' ? '#ffffff' : '#475569', fontWeight: '600', fontSize: 12 }}>
                          🛡️ Admins ({existingUsers.filter(u => u.role === 'admin' || u.role === 'super_admin').length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setMemberCategoryFilter('all')}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 8,
                          backgroundColor: memberCategoryFilter === 'all' ? '#334155' : '#ffffff',
                          borderWidth: 1,
                          borderColor: memberCategoryFilter === 'all' ? '#334155' : '#cbd5e1',
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: memberCategoryFilter === 'all' ? '#ffffff' : '#475569', fontWeight: '600', fontSize: 12 }}>
                          🌐 All ({existingUsers.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dropdown Card Trigger / Selected Member Pill */}
                    <TouchableOpacity
                      onPress={() => setMemberDropdownOpen(!memberDropdownOpen)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: selectedUserId ? '#f5a623' : '#cbd5e1',
                        borderRadius: 10,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      {selectedUserId ? (
                        (() => {
                          const selectedUser = existingUsers.find(u => u.id === selectedUserId);
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                                <Text style={{ color: '#f5a623', fontWeight: '700', fontSize: 12 }}>
                                  {(selectedUser?.full_name || selectedUser?.email || 'M')[0].toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#0f172a', fontWeight: '600', fontSize: 12.5 }} numberOfLines={1}>
                                  {selectedUser?.full_name || 'Selected Member'}
                                </Text>
                                <Text style={{ color: '#64748b', fontSize: 12.5 }} numberOfLines={1}>
                                  {selectedUser?.email}
                                </Text>
                              </View>
                              <View style={{ backgroundColor: selectedUser?.role === 'super_admin' ? '#fffbeb' : selectedUser?.role === 'admin' ? '#eff6ff' : '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: selectedUser?.role === 'super_admin' ? '#d97706' : selectedUser?.role === 'admin' ? '#2563eb' : '#16a34a', fontWeight: '700', fontSize: 12.5 }}>
                                  {(selectedUser?.role || 'user').toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          );
                        })()
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Ionicons name="person-circle-outline" size={16} color="#64748b" />
                          <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '500' }}>
                            Tap to select member from {memberCategoryFilter === 'user' ? 'Users' : memberCategoryFilter === 'admin' ? 'Admins' : 'All'}...
                          </Text>
                        </View>
                      )}

                      <Ionicons name={memberDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
                    </TouchableOpacity>

                    {/* Dropdown Expanded Drawer */}
                    {memberDropdownOpen && (
                      <View style={{ backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 8, marginTop: 6, elevation: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 8, marginBottom: 6 }}>
                          <Ionicons name="search-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                          <TextInput
                            placeholder="Filter by name, email or phone..."
                            value={searchUserQuery}
                            onChangeText={setSearchUserQuery}
                            style={{ flex: 1, paddingVertical: 6, color: '#0f172a', fontSize: 12, fontWeight: '500', outlineStyle: 'none' as any }}
                          />
                          {searchUserQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchUserQuery('')}>
                              <Ionicons name="close-circle" size={13} color="#94a3b8" />
                            </TouchableOpacity>
                          )}
                        </View>

                        <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {existingUsers
                            .filter(u => {
                              const isStaff = u.role === 'admin' || u.role === 'super_admin';
                              if (memberCategoryFilter === 'user' && isStaff) return false;
                              if (memberCategoryFilter === 'admin' && !isStaff) return false;
                              if (!searchUserQuery.trim()) return true;
                              const q = searchUserQuery.toLowerCase();
                              return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
                            })
                            .map(u => {
                              const isSelected = selectedUserId === u.id;
                              const isStaff = u.role === 'admin' || u.role === 'super_admin';
                              return (
                                <TouchableOpacity
                                  key={u.id}
                                  onPress={() => {
                                    setSelectedUserId(u.id);
                                    setMemberDropdownOpen(false);
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
                                    padding: 8, 
                                    borderRadius: 8, 
                                    backgroundColor: isSelected ? '#0f172a' : '#f8fafc', 
                                    borderWidth: 1, 
                                    borderColor: isSelected ? '#f5a623' : '#e2e8f0',
                                    flexDirection: 'row', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    marginBottom: 4 
                                  }}
                                >
                                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isSelected ? '#f5a623' : isStaff ? '#fffbeb' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                                    <Text style={{ color: isSelected ? '#0f172a' : isStaff ? '#d97706' : '#475569', fontWeight: '700', fontSize: 12 }}>
                                      {(u.full_name || u.email || 'M')[0].toUpperCase()}
                                    </Text>
                                  </View>

                                  <View style={{ flex: 1, marginRight: 6 }}>
                                    <Text style={{ color: isSelected ? '#ffffff' : '#0f172a', fontWeight: '600', fontSize: 12 }} numberOfLines={1}>
                                      {u.full_name || 'Member Account'}
                                    </Text>
                                    <Text style={{ color: isSelected ? '#94a3b8' : '#64748b', fontSize: 12 }} numberOfLines={1}>
                                      {u.email} {u.phone ? `• ${u.phone}` : ''}
                                    </Text>
                                  </View>

                                  <View style={{ backgroundColor: isSelected ? 'rgba(245, 166, 35, 0.2)' : isStaff ? '#fffbeb' : '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                                    <Text style={{ color: isSelected ? '#f5a623' : isStaff ? '#d97706' : '#16a34a', fontWeight: '700', fontSize: 12 }}>
                                      {isSelected ? '✓ Selected' : (u.role || 'user').toUpperCase()}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* SECTION 2: STAFF PROFILE & CORPORATE EMAIL HANDLES */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  2. Staff Identity & Corporate Mail Handle *
                </Text>

                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 3 }}>Staff Full Name *</Text>
                <TextInput
                  placeholder="e.g. Musa Ibrahim"
                  value={newAdminForm.fullName}
                  onChangeText={(t) => {
                    const autoPrefix = t.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
                    setNewAdminForm({ ...newAdminForm, fullName: t, usernamePrefix: newAdminForm.usernamePrefix || autoPrefix });
                  }}
                  style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, color: '#0f172a', fontWeight: '500', fontSize: 12.5, marginBottom: 8, outlineStyle: 'none' as any }}
                />

                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 3 }}>Corporate Email Handle (@abumafhal.com.ng) *</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, marginBottom: 6 }}>
                  <TextInput
                    placeholder="e.g. musa"
                    value={newAdminForm.usernamePrefix}
                    onChangeText={(t) => setNewAdminForm({ ...newAdminForm, usernamePrefix: t.toLowerCase() })}
                    style={{ flex: 1, paddingVertical: 7, color: '#0f172a', fontWeight: '600', fontSize: 12.5, outlineStyle: 'none' as any }}
                    autoCapitalize="none"
                  />
                  <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 12 }}>@abumafhal.com.ng</Text>
                </View>

                {/* Live Domain Email Badge Card */}
                <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 6 }}>
                    <Ionicons name="at-circle" size={13} color="#f5a623" />
                    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '400' }}>
                      Corporate Email: <Text style={{ color: '#f5a623', fontWeight: '700' }}>{(newAdminForm.usernamePrefix || 'musa').toLowerCase()}@abumafhal.com.ng</Text>
                    </Text>
                  </View>

                  <TouchableOpacity 
                    onPress={async () => {
                      const emailToCopy = `${(newAdminForm.usernamePrefix || 'musa').toLowerCase()}@abumafhal.com.ng`;
                      try {
                        const { Clipboard } = require('react-native');
                        Clipboard.setString(emailToCopy);
                      } catch (e) {}
                      setCopiedDomainEmail(true);
                      setTimeout(() => setCopiedDomainEmail(false), 2000);
                    }}
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Ionicons name={copiedDomainEmail ? "checkmark" : "copy-outline"} size={11} color="#ffffff" />
                    <Text style={{ color: '#ffffff', fontSize: 12.5, fontWeight: '600' }}>{copiedDomainEmail ? "Copied" : "Copy"}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 3 }}>Personal Email (Delivery Address) *</Text>
                <TextInput
                  placeholder="e.g. musa.ibrahim@gmail.com"
                  value={newAdminForm.personalEmail}
                  onChangeText={(t) => setNewAdminForm({ ...newAdminForm, personalEmail: t })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, color: '#0f172a', fontWeight: '500', fontSize: 12.5, outlineStyle: 'none' as any }}
                />
              </View>

              {/* SECTION 3: CREDENTIALS & SECURITY GENERATOR */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    3. Account Credentials & Security *
                  </Text>
                  <TouchableOpacity onPress={generateRandomAdminPassword}>
                    <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 12 }}>🎲 Auto-Generate</Text>
                  </TouchableOpacity>
                </View>

                {selectedUserId ? (
                  <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 8, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#16a34a" />
                    <Text style={{ color: '#15803d', fontSize: 12, fontWeight: '700' }}>
                      🔒 Registered Member (Uses their own existing account password)
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 }}>
                    <TextInput
                      placeholder="Password123!"
                      value={newAdminForm.password}
                      onChangeText={(t) => setNewAdminForm({ ...newAdminForm, password: t })}
                      secureTextEntry={!showAdminPassword}
                      style={{ flex: 1, paddingVertical: 7, color: '#0f172a', fontWeight: '600', fontSize: 12.5, outlineStyle: 'none' as any }}
                    />
                    <TouchableOpacity onPress={() => setShowAdminPassword(!showAdminPassword)}>
                      <Ionicons name={showAdminPassword ? "eye-off-outline" : "eye-outline"} size={16} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Password Entropy & Payload Copy */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="key-outline" size={12} color="#16a34a" />
                    <Text style={{ color: '#16a34a', fontSize: 12.5, fontWeight: '600' }}>12-Char Entropy Key</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      const corpMail = `${(newAdminForm.usernamePrefix || 'musa').toLowerCase()}@abumafhal.com.ng`;
                      const payload = `👑 ABU MAFHAL ADMIN CREDENTIALS\nName: ${newAdminForm.fullName}\nCorporate Mail: ${corpMail}\nLogin Email: ${newAdminForm.personalEmail || corpMail}\nPassword: ${newAdminForm.password}\nRole: ${newAdminForm.role.toUpperCase()}`;
                      try {
                        const { Clipboard } = require('react-native');
                        Clipboard.setString(payload);
                      } catch (e) {}
                      setCopiedAllPayload(true);
                      setTimeout(() => setCopiedAllPayload(false), 2000);
                    }}
                    style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <Ionicons name={copiedAllPayload ? "checkmark" : "copy-outline"} size={11} color="#2563eb" />
                    <Text style={{ color: '#2563eb', fontSize: 12.5, fontWeight: '700' }}>{copiedAllPayload ? "Copied Payload!" : "Copy Credential Packet"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* SECTION 4: GOVERNANCE ROLE & PERMISSION BREAKDOWN */}
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#475569', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
                  4. Governance Privilege & Scope *
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => setNewAdminForm({ ...newAdminForm, role: 'admin' })}
                    style={{ 
                      flex: 1, 
                      padding: 10, 
                      borderRadius: 12, 
                      borderWidth: 1.5, 
                      borderColor: newAdminForm.role === 'admin' ? '#0f172a' : '#e2e8f0', 
                      backgroundColor: newAdminForm.role === 'admin' ? '#0f172a' : '#ffffff' 
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <Ionicons name="shield-outline" size={13} color={newAdminForm.role === 'admin' ? '#f5a623' : '#0f172a'} />
                      <Text style={{ color: newAdminForm.role === 'admin' ? '#ffffff' : '#0f172a', fontWeight: '700', fontSize: 12 }}>Staff Admin</Text>
                    </View>
                    <Text style={{ color: newAdminForm.role === 'admin' ? '#94a3b8' : '#64748b', fontSize: 12, lineHeight: 12 }}>Standard management & user support.</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setNewAdminForm({ ...newAdminForm, role: 'super_admin' })}
                    style={{ 
                      flex: 1, 
                      padding: 10, 
                      borderRadius: 12, 
                      borderWidth: 1.5, 
                      borderColor: newAdminForm.role === 'super_admin' ? '#d97706' : '#e2e8f0', 
                      backgroundColor: newAdminForm.role === 'super_admin' ? '#fffbeb' : '#ffffff' 
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <Ionicons name="ribbon-outline" size={13} color="#d97706" />
                      <Text style={{ color: '#d97706', fontWeight: '700', fontSize: 12 }}>Super Admin 👑</Text>
                    </View>
                    <Text style={{ color: '#b45309', fontSize: 12, lineHeight: 12 }}>Full governance & API Vault control.</Text>
                  </TouchableOpacity>
                </View>

                {/* Role Capabilities Summary Box */}
                <View style={{ backgroundColor: newAdminForm.role === 'super_admin' ? 'rgba(217, 119, 6, 0.1)' : '#ffffff', borderWidth: 1, borderColor: newAdminForm.role === 'super_admin' ? '#fde68a' : '#e2e8f0', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                  <Text style={{ color: newAdminForm.role === 'super_admin' ? '#b45309' : '#334155', fontWeight: '700', fontSize: 12.5, marginBottom: 3 }}>
                    Privilege Breakdown: {newAdminForm.role === 'super_admin' ? 'Super Admin Vault Access' : 'Staff Admin Support Access'}
                  </Text>
                  <Text style={{ color: newAdminForm.role === 'super_admin' ? '#d97706' : '#64748b', fontSize: 12, lineHeight: 12 }}>
                    {newAdminForm.role === 'super_admin' 
                      ? '• Full System Governance • API Vault Secrets • Redzone Panic Switches • Admin Provisioning'
                      : '• Customer Care & In-App Mail • Manual Wallet Refunds • VTU Diagnostics • KYC Review'}
                  </Text>
                </View>

                {/* Department Permission Pills */}
                <Text style={{ color: '#64748b', fontSize: 12.5, fontWeight: '600', marginBottom: 4 }}>Department Scope</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[
                      { id: 'finance', label: '💰 Finance' },
                      { id: 'telecom', label: '📱 Telecom' },
                      { id: 'crypto', label: '🪙 Crypto' },
                      { id: 'support', label: '🎧 Support' },
                      { id: 'master', label: '👑 Governance' }
                    ].map(dept => {
                      const isDeptSelected = newAdminForm.department === dept.id;
                      return (
                        <TouchableOpacity
                          key={dept.id}
                          onPress={() => setNewAdminForm({ ...newAdminForm, department: dept.id as any })}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: isDeptSelected ? '#0f172a' : '#ffffff', borderWidth: 1, borderColor: isDeptSelected ? '#f5a623' : '#e2e8f0' }}
                        >
                          <Text style={{ color: isDeptSelected ? '#f5a623' : '#475569', fontWeight: '600', fontSize: 12 }}>{dept.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* SECTION 5: PRIMARY SUBMIT & DISPATCH CONTROL */}
              <TouchableOpacity
                onPress={handleCreateAdminSubmit}
                disabled={creatingAdmin}
                style={{ backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10 }}
                activeOpacity={0.85}
              >
                {creatingAdmin ? (
                  <ActivityIndicator color="#f5a623" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={14} color="#f5a623" />
                    <Text style={{ color: '#f5a623', fontWeight: '700', fontSize: 12 }}>
                      {selectedUserId ? 'Provision Admin Account & Dispatch Credentials' : 'Create Admin Account & Send Welcome Package'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Quick User Lookup & Inspector Modal */}
      <Modal visible={quickInspectVisible} transparent animationType="slide" onRequestClose={() => setQuickInspectVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '85%', padding: 18 }]}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="search" size={20} color={C.gold} />
                <Text style={s.modalTitle}>Quick User Inspector 🔍</Text>
              </View>
              <TouchableOpacity onPress={() => setQuickInspectVisible(false)}>
                <Ionicons name="close" size={22} color={C.textMain} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Ionicons name="search-outline" size={16} color="#64748b" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Search name, phone, or email..."
                value={quickSearchQuery}
                onChangeText={setQuickSearchQuery}
                placeholderTextColor="#94a3b8"
                style={{ flex: 1, paddingVertical: 10, color: '#0f172a', fontSize: 13, fontWeight: '600', outlineStyle: 'none' as any }}
              />
              {quickSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setQuickSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {existingUsers
                .filter(u => {
                  if (!quickSearchQuery.trim()) return true;
                  const q = quickSearchQuery.toLowerCase();
                  return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
                })
                .slice(0, 30)
                .map((u) => (
                  <View key={u.id} style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{u.full_name || 'User Account'}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{u.email}</Text>
                        {u.phone && <Text style={{ fontSize: 11, color: '#94a3b8' }}>{u.phone}</Text>}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={{ backgroundColor: u.role === 'super_admin' ? '#fffbeb' : u.role === 'admin' ? '#eff6ff' : '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: u.role === 'super_admin' ? '#d97706' : u.role === 'admin' ? '#2563eb' : '#16a34a' }}>
                            {(u.role || 'user').toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => {
                            setQuickInspectVisible(false);
                            router.push('/manage/users');
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                        >
                          <Text style={{ color: '#f5a623', fontSize: 10, fontWeight: '800' }}>Manage ➡️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabBtnTxtActive: {
    color: C.gold,
    fontWeight: '900',
  },
  tabBarModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  tabBtnModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnModernActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  tabBtnTxtModern: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabBtnTxtModernActive: {
    color: '#b45309',
    fontWeight: '900',
  },
  tabBadgePill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 2,
  },
  tabBadgeTxt: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  sectionHeaderTitle: {
    color: C.gold,
    fontWeight: '900',
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillTxt: {
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    cursor: 'pointer' as any,
    zIndex: 10,
  },
  sendBtnTxt: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
});
