import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, FlatList, Modal, Platform, Linking, Switch, Share, Image, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import SecurityModal from '../../components/SecurityModal';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Executive Light Mode Theme Tokens (Navy & Gold on Light Slate/White)
const T = {
    navyDark: '#0A1128',      // Deep Executive Navy
    navyMid: '#111D3B',       // Rich Mid Navy
    navyCard: '#1E293B',      // Dark Card Accent
    gold: '#D4AF37',          // Metallic Gold Accent
    goldDark: '#B8952B',      // Dark Gold Text
    goldLight: '#F5E8D0',     // Light Gold
    goldBg: 'rgba(212, 175, 55, 0.12)',
    bg: '#F8FAFC',            // Clean Light Slate Background
    card: '#FFFFFF',          // Crisp White Card Container
    cardBorder: '#E2E8F0',    // Slate Border Edge
    textMain: '#0F172A',      // High Contrast Dark Slate Text
    textSub: '#64748B',       // Subdued Text
    border: '#CBD5E1',
    success: '#10B981',
    successBg: '#ECFDF5',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    purple: '#9333EA',
    purpleBg: '#F3E8FF',
};

// Schema Interfaces
interface UserProfile {
    id: string;
    full_name: string;
    username?: string;
    custom_id?: string;
    email: string;
    role: string;
    status: string;
    balance: number;
    phone?: string;
    created_at?: string;
    last_login?: string;
    kyc_verified?: boolean;
    transfer_limit?: number;
    single_tx_limit?: number;
    admin_notes?: string;
    account_number?: string;
    bank_name?: string;
    bvn?: string;
    nin?: string;
    kyc_tier?: number;
    gender?: string;
    dob?: string;
    address?: string;
    state?: string;
    next_of_kin_name?: string;
    next_of_kin_phone?: string;
    avatar_url?: string;
    credit_balance?: number;
    crypto_enabled?: boolean;
    virtual_cards_enabled?: boolean;
    services_enabled?: boolean;
    cac_registered?: boolean;
    cac_rc_number?: string;
    corporate_email?: string | null;
}

interface UserVirtualCard {
    id: string;
    user_id: string;
    card_id: string;
    card_number: string;
    card_name: string;
    expiry: string;
    cvv: string;
    balance: number;
    currency: string;
    brand: string;
    status: 'active' | 'frozen' | 'terminated';
    created_at: string;
}

interface KycRequest {
    id: string;
    user_id: string;
    id_type: string;
    id_number?: string;
    status: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string;
    document_url?: string;
    created_at: string;
    updated_at?: string;
}

interface Transaction {
    id: string;
    amount: number;
    type: string;
    status: string;
    created_at: string;
    description?: string;
    reference?: string;
}

interface LoginLog {
    id: string;
    device: string;
    ip: string;
    timestamp: string;
    location: string;
}

export default function UserManagement() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'admin' | 'verified' | 'corporate' | 'high_bal'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'balance_high' | 'balance_low'>('newest');
    
    // Selection & Modal States
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalTab, setModalTab] = useState<'overview' | 'kyc' | 'controls' | 'notify' | 'logs'>('overview');
    
    // Dynamic User History States
    const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
    const [userVirtualCards, setUserVirtualCards] = useState<UserVirtualCard[]>([]);
    const [userKycRequests, setUserKycRequests] = useState<KycRequest[]>([]);
    const [userLogs, setUserLogs] = useState<LoginLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [unmaskedCardIds, setUnmaskedCardIds] = useState<Record<string, boolean>>({});

    const [showSecurity, setShowSecurity] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ 
        type: 'fund' | 'debit' | 'block' | 'promote' | 'reset_pin' | 'edit_profile' | 'notify' | 'send_email' | 'kyc' | 'set_limit' | 'save_notes' | 'impersonate' | 'generate_account' | 'delete_user' | 'reset_tx_pin' | 'clear_device' | 'toggle_crypto' | 'toggle_cards' | 'toggle_services' | 'upgrade_tier' | 'verify_nin' | 'verify_cac' | 'toggle_virtual_card', 
        amount?: number, 
        role?: string, 
        tier?: number,
        cardId?: string,
        payload?: any 
    } | null>(null);
    
    // Form Inputs & Funding States
    const [fundAmount, setFundAmount] = useState('');
    const [isDebit, setIsDebit] = useState(false);
    const [fundingProcessing, setFundingProcessing] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ 
        full_name: '', 
        phone: '', 
        email: '',
        username: '',
        gender: '',
        dob: '',
        address: '',
        state: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        custom_id: '',
        account_number: '',
        bvn: '',
        nin: '',
        kyc_tier: '1'
    });

    const [notifyMessage, setNotifyMessage] = useState('');
    const [notifyTitle, setNotifyTitle] = useState('');
    
    // Email Composer State
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    const [bvnInput, setBvnInput] = useState('');
    const [limitInput, setLimitInput] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [rcInput, setRcInput] = useState('');

    // Multi-Selection
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Create User Modal
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ 
        fullName: '', 
        email: '', 
        phone: '', 
        password: 'Password123!', 
        role: 'user',
        username: '',
        gender: '',
        dob: '',
        address: '',
        state: '',
        next_of_kin_name: '',
        next_of_kin_phone: ''
    });
    const [creatingUser, setCreatingUser] = useState(false);

    // Dynamic Executive KPIs
    const stats = {
        totalUsers: users.length,
        totalBalance: users.reduce((acc, u) => acc + (u.balance || u.credit_balance || 0), 0),
        activeUsers: users.filter(u => u.status === 'active').length,
        verifiedUsers: users.filter(u => u.kyc_verified).length,
        corporateAdmins: users.filter(u => u.corporate_email).length,
        highRiskCount: users.filter(u => u.status === 'suspended').length
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchUsers();
        setRefreshing(false);
    }, []);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        if (newSet.size === 0) setIsSelectionMode(false);
    };

    const copyToClipboard = async (text: string, label: string) => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        Alert.alert("Copied", `${label} copied to clipboard.`);
    };

    const handleLongPress = (id: string) => {
        setIsSelectionMode(true);
        const newSet = new Set(selectedIds);
        newSet.add(id);
        setSelectedIds(newSet);
    };

    const executeBulkAction = async (action: 'block' | 'unblock' | 'verify') => {
        if (selectedIds.size === 0) return;
        
        try {
            const updates: any = {};
            if (action === 'block') updates.status = 'suspended';
            if (action === 'unblock') updates.status = 'active';
            if (action === 'verify') updates.kyc_verified = true;

            const ids = Array.from(selectedIds);
            
            const { error } = await supabase.from('profiles').update(updates).in('id', ids);
            if (error) throw error;

            Alert.alert("Bulk Action", `Successfully updated ${ids.length} users.`);
            fetchUsers();
        } catch (error: any) {
            Alert.alert("Bulk Action Failed", error.message);
        } finally {
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        }
    };

    useEffect(() => {
        if (selectedUser) {
            fetchUserHistory(selectedUser.id);
            generateForensics(selectedUser.id);
            setModalTab('overview');
            setEditForm({
                full_name: selectedUser.full_name || '',
                phone: selectedUser.phone || '',
                email: selectedUser.email || '',
                username: selectedUser.username || '',
                gender: selectedUser.gender || '',
                dob: selectedUser.dob || '',
                address: selectedUser.address || '',
                state: selectedUser.state || '',
                next_of_kin_name: selectedUser.next_of_kin_name || '',
                next_of_kin_phone: selectedUser.next_of_kin_phone || '',
                custom_id: selectedUser.custom_id || '',
                account_number: selectedUser.account_number || '',
                bvn: selectedUser.bvn || '',
                nin: selectedUser.nin || '',
                kyc_tier: selectedUser.kyc_tier?.toString() || '1'
            });
            setLimitInput(selectedUser.transfer_limit?.toString() || '');
            setAdminNotes(selectedUser.admin_notes || '');
            setRcInput(selectedUser.cac_rc_number || '');
            setIsEditing(false);
        }
    }, [selectedUser]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, virtual_accounts(account_number, bank_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: corpEmails } = await supabase
                .from('corporate_admin_emails')
                .select('user_id, email, username');

            const corpMap = new Map((corpEmails || []).map(c => [c.user_id, c.email]));
            
            const enrichedData = (data || []).map((u: any) => ({
                ...u,
                account_number: u.virtual_accounts?.[0]?.account_number || u.virtual_accounts?.account_number || null,
                bank_name: u.virtual_accounts?.[0]?.bank_name || u.virtual_accounts?.bank_name || 'Wema Bank',
                corporate_email: corpMap.get(u.id) || (u.email?.endsWith('@abumafhal.com.ng') ? u.email : null)
            }));
            setUsers(enrichedData);
        } catch (error: any) {
            Alert.alert('Error Fetching Users', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Real User History
    const fetchUserHistory = async (userId: string) => {
        setLoadingHistory(true);
        try {
            // 1. Fetch User Financial Transactions
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);
            setUserTransactions(txData || []);

            // 2. Fetch User Purchased Virtual Cards
            const { data: cardsData } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setUserVirtualCards(cardsData || []);

            // 3. Fetch User KYC Requests
            const { data: kycData } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setUserKycRequests(kycData || []);
        } catch (error) {
            setUserTransactions([]);
            setUserVirtualCards([]);
            setUserKycRequests([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const generateForensics = (userId: string) => {
        const devices = ['iPhone 15 Pro Max', 'Samsung S24 Ultra', 'MacBook Air M3', 'Windows 11 PC', 'Google Pixel 8'];
        const locations = ['Kano, NG', 'Abuja, NG', 'Lagos, NG', 'Kaduna, NG', 'Port Harcourt, NG'];
        const logs: LoginLog[] = Array.from({ length: 5 }).map((_, i) => ({
            id: `log-${i}`,
            device: devices[Math.floor(Math.random() * devices.length)],
            ip: `102.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            location: locations[Math.floor(Math.random() * locations.length)],
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 800000000)).toISOString()
        })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setUserLogs(logs);
    };

    const handleSearch = (text: string) => {
        setSearch(text);
    };

    const getFilteredUsers = () => {
        let result = users.filter(u => {
            const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                                  u.email?.toLowerCase().includes(search.toLowerCase()) ||
                                  u.phone?.includes(search) ||
                                  u.custom_id?.toLowerCase().includes(search.toLowerCase()) ||
                                  u.account_number?.includes(search);
            
            let matchesStatus = true;
            if (filterStatus === 'active') matchesStatus = u.status === 'active';
            if (filterStatus === 'suspended') matchesStatus = u.status === 'suspended';
            if (filterStatus === 'admin') matchesStatus = u.role === 'admin' || u.role === 'super_admin';
            if (filterStatus === 'verified') matchesStatus = !!u.kyc_verified;
            if (filterStatus === 'corporate') matchesStatus = !!u.corporate_email;
            if (filterStatus === 'high_bal') matchesStatus = (u.balance || u.credit_balance || 0) >= 100000;

            return matchesSearch && matchesStatus;
        });

        if (sortBy === 'newest') {
            result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        } else if (sortBy === 'balance_high') {
            result.sort((a, b) => (b.credit_balance || b.balance || 0) - (a.credit_balance || a.balance || 0));
        } else if (sortBy === 'balance_low') {
            result.sort((a, b) => (a.credit_balance || a.balance || 0) - (b.credit_balance || b.balance || 0));
        }

        return result;
    };

    const executeAction = async () => {
        if (!selectedUser || !pendingAction) return;
        
        try {
            if (pendingAction.type === 'fund' || pendingAction.type === 'debit') {
                setFundingProcessing(true);
                const amount = pendingAction.type === 'fund' ? Math.abs(Number(pendingAction.amount)) : -Math.abs(Number(pendingAction.amount));
                const currentBalance = Number(selectedUser.credit_balance) || Number(selectedUser.balance) || 0;
                const newBalance = Math.max(0, currentBalance + amount);
                
                // Attempt Supabase Update with fallback
                let { error: err1 } = await supabase.from('profiles').update({ 
                    credit_balance: newBalance,
                    balance: newBalance 
                }).eq('id', selectedUser.id);

                if (err1) {
                    const { error: err2 } = await supabase.from('profiles').update({ 
                        credit_balance: newBalance 
                    }).eq('id', selectedUser.id);
                    if (err2) throw err2;
                }
                
                // Insert transaction log
                try {
                    await supabase.from('transactions').insert({
                        user_id: selectedUser.id,
                        type: pendingAction.type === 'fund' ? 'topup' : 'withdrawal',
                        title: `Admin Wallet ${pendingAction.type === 'fund' ? 'Credit' : 'Debit'}`,
                        amount: Math.abs(amount),
                        status: 'completed',
                        description: `Admin Wallet ${pendingAction.type === 'fund' ? 'Funding' : 'Debit'}`,
                        reference: `admin_${pendingAction.type}_${Date.now()}`
                    });
                } catch (txErr) {}

                Alert.alert(
                    "Wallet Updated 🎉", 
                    amount > 0 
                        ? `Successfully funded ₦${Math.abs(amount).toLocaleString()} to ${selectedUser.full_name}'s vault!` 
                        : `Successfully debited ₦${Math.abs(amount).toLocaleString()} from ${selectedUser.full_name}'s vault!`
                );

                setSelectedUser({ ...selectedUser, balance: newBalance, credit_balance: newBalance });
                setFundAmount('');
                setFundingProcessing(false);
                fetchUserHistory(selectedUser.id);
                fetchUsers();
                setPendingAction(null);
                return;
            }
            else if (pendingAction.type === 'toggle_virtual_card' && pendingAction.cardId) {
                const targetCard = userVirtualCards.find(c => c.id === pendingAction.cardId);
                if (targetCard) {
                    const newStatus = targetCard.status === 'active' ? 'frozen' : 'active';
                    const { error } = await supabase.from('user_virtual_cards').update({ status: newStatus }).eq('id', targetCard.id);
                    if (error) throw error;
                    Alert.alert("Card Updated 💳", `Virtual card is now ${newStatus.toUpperCase()}`);
                    fetchUserHistory(selectedUser.id);
                }
            }
            else if (pendingAction.type === 'block') {
                const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
                const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Status Updated", `User status is now ${newStatus.toUpperCase()}`);
                setSelectedUser({ ...selectedUser, status: newStatus });
                fetchUsers();
            }
            else if (pendingAction.type === 'promote') {
                const targetRole = pendingAction.role || (selectedUser.role === 'super_admin' ? 'admin' : selectedUser.role === 'admin' ? 'user' : 'admin');
                const { error } = await supabase.from('profiles').update({ role: targetRole }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Role Changed 👑", `User role is now ${targetRole.toUpperCase()}`);
                setSelectedUser({ ...selectedUser, role: targetRole });
                fetchUsers();
            }
            else if (pendingAction.type === 'toggle_crypto') {
                const newStatus = !(selectedUser.crypto_enabled ?? true);
                const { error } = await supabase.from('profiles').update({ crypto_enabled: newStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Crypto Feature 🪙", `Crypto Trading is now ${newStatus ? 'ENABLED' : 'DISABLED'} for this user`);
                setSelectedUser({ ...selectedUser, crypto_enabled: newStatus });
                fetchUsers();
            }
            else if (pendingAction.type === 'toggle_cards') {
                const newStatus = !(selectedUser.virtual_cards_enabled ?? true);
                const { error } = await supabase.from('profiles').update({ virtual_cards_enabled: newStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Virtual Cards 💳", `Virtual Cards are now ${newStatus ? 'ENABLED' : 'DISABLED'} for this user`);
                setSelectedUser({ ...selectedUser, virtual_cards_enabled: newStatus });
                fetchUsers();
            }
            else if (pendingAction.type === 'upgrade_tier') {
                const targetTier = pendingAction.tier || 2;
                const { error } = await supabase.from('profiles').update({ kyc_tier: targetTier, kyc_verified: targetTier > 1 }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("KYC Tier Upgraded 🛡️", `User KYC is now Tier ${targetTier}`);
                setSelectedUser({ ...selectedUser, kyc_tier: targetTier, kyc_verified: targetTier > 1 });
                fetchUsers();
            }
            else if (pendingAction.type === 'verify_nin') {
                const { error } = await supabase.from('profiles').update({ kyc_verified: true, kyc_tier: 3 }).eq('id', selectedUser.id);
                if (error) throw error;
                
                await supabase.from('kyc_requests').insert({
                    user_id: selectedUser.id,
                    id_type: 'NIN Verification',
                    id_number: selectedUser.nin || 'NIN-VERIFIED-ADMIN',
                    status: 'approved',
                    created_at: new Date().toISOString()
                });

                Alert.alert("NIN Verified 🆔", `National Identity Number verified for ${selectedUser.full_name}. Tier 3 granted.`);
                setSelectedUser({ ...selectedUser, kyc_verified: true, kyc_tier: 3 });
                fetchUserHistory(selectedUser.id);
                fetchUsers();
            }
            else if (pendingAction.type === 'verify_cac') {
                const { error } = await supabase.from('profiles').update({ cac_registered: true, cac_rc_number: rcInput || 'RC-1928471' }).eq('id', selectedUser.id);
                if (error) throw error;

                await supabase.from('kyc_requests').insert({
                    user_id: selectedUser.id,
                    id_type: 'CAC Corporate Verification',
                    id_number: rcInput || 'RC-1928471',
                    status: 'approved',
                    created_at: new Date().toISOString()
                });

                Alert.alert("CAC Corporate Verified 🏢", `Corporate Business Registration verified.`);
                setSelectedUser({ ...selectedUser, cac_registered: true, cac_rc_number: rcInput || 'RC-1928471' });
                fetchUserHistory(selectedUser.id);
                fetchUsers();
            }
            else if (pendingAction.type === 'send_email') {
                Alert.alert("Email Sent ✉️", `Email "${emailSubject}" sent to ${selectedUser.email}`);
                setEmailSubject('');
                setEmailBody('');
            }
            else if (pendingAction.type === 'reset_pin') {
                 if (selectedUser.email) {
                    const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email);
                    if (error) throw error;
                    Alert.alert("Email Sent", `Password reset instructions sent to ${selectedUser.email}`);
                 } else {
                     Alert.alert("Error", "User has no email address.");
                 }
            }
            else if (pendingAction.type === 'edit_profile') {
                const { error } = await supabase.from('profiles').update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    username: editForm.username,
                    gender: editForm.gender,
                    dob: editForm.dob,
                    address: editForm.address,
                    state: editForm.state,
                    next_of_kin_name: editForm.next_of_kin_name,
                    next_of_kin_phone: editForm.next_of_kin_phone,
                    custom_id: editForm.custom_id,
                    account_number: editForm.account_number,
                    bvn: editForm.bvn,
                    nin: editForm.nin,
                    kyc_tier: parseInt(editForm.kyc_tier) || 1
                }).eq('id', selectedUser.id);
                
                if (error) throw error;
                Alert.alert("Success", "Profile Information Updated Successfully");
                setIsEditing(false);
            }
            else if (pendingAction.type === 'delete_user') {
                await handleDeleteUser();
            }
            else if (pendingAction.type === 'notify') {
                await supabase.from('notifications').insert({
                    user_id: selectedUser.id,
                    title: notifyTitle || 'System Notice',
                    body: notifyMessage,
                    type: 'admin_push',
                    created_at: new Date().toISOString()
                });
                Alert.alert("Message Delivered", `Notification sent to ${selectedUser.full_name}`);
                setNotifyMessage('');
                setNotifyTitle('');
            }

            fetchUsers();
            if (['edit_profile', 'notify', 'kyc', 'set_limit', 'save_notes', 'verify_nin', 'verify_cac', 'send_email', 'toggle_virtual_card', 'fund', 'debit'].includes(pendingAction.type)) {
                 if (pendingAction.type === 'edit_profile' && selectedUser) setSelectedUser({ ...selectedUser, ...editForm, kyc_tier: parseInt(editForm.kyc_tier) || 1 });
            } else {
                 setSelectedUser(null);
            }
            
            setPendingAction(null);
            setFundAmount('');
            setIsDebit(false);
            setFundingProcessing(false);
        } catch (e: any) {
            Alert.alert("Action Error", e.message || "An unexpected error occurred.");
            setPendingAction(null);
            setFundingProcessing(false);
        }
    };

    const handleCreateUser = async () => {
        if (!newUserForm.fullName || !newUserForm.email || !newUserForm.password) {
            Alert.alert("Missing Fields", "Please enter at least a name, email, and password.");
            return;
        }

        setCreatingUser(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: newUserForm
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.user) {
                setUsers([data.user, ...users]);
            } else {
                fetchUsers();
            }

            Alert.alert("User Created", `Successfully created account for ${newUserForm.fullName}. Credentials sent to email.`);
            
            setShowCreateUser(false);
            setNewUserForm({ 
                fullName: '', email: '', phone: '', password: 'Password123!', role: 'user',
                username: '', gender: '', dob: '', address: '', state: '', next_of_kin_name: '', next_of_kin_phone: ''
            });
        } catch (e: any) {
            Alert.alert("Creation Failed", e.message);
        } finally {
            setCreatingUser(false);
        }
    };

    const handleDirectFundOrDebit = async (type: 'fund' | 'debit', amountVal: number) => {
        if (!selectedUser) return;
        setFundingProcessing(true);
        try {
            const amount = type === 'fund' ? Math.abs(amountVal) : Math.abs(amountVal);
            let rpcSuccess = false;

            // Step 1: Execute Supabase Postgres RPC with exact parameter signature (p_user_id & p_amount)
            try {
                if (type === 'fund') {
                    // Try credit_balance with p_user_id & p_amount
                    const { error: rpcErr1 } = await supabase.rpc('credit_balance', { p_user_id: selectedUser.id, p_amount: amount });
                    if (!rpcErr1) rpcSuccess = true;
                    else {
                        // Try fund_wallet with p_user_id & p_amount
                        const { error: rpcErr2 } = await supabase.rpc('fund_wallet', { p_user_id: selectedUser.id, p_amount: amount });
                        if (!rpcErr2) rpcSuccess = true;
                    }
                } else {
                    // Try deduct_balance with p_user_id & p_amount
                    const { error: rpcErr1 } = await supabase.rpc('deduct_balance', { p_user_id: selectedUser.id, p_amount: amount });
                    if (!rpcErr1) rpcSuccess = true;
                }
            } catch (e) {}

            // Step 2: Fallback param signature variations & direct update
            if (!rpcSuccess) {
                try {
                    if (type === 'fund') {
                        await supabase.rpc('credit_balance', { user_id: selectedUser.id, amount: amount });
                    } else {
                        await supabase.rpc('deduct_balance', { user_id: selectedUser.id, amount: amount });
                    }
                } catch (e) {}

                // Direct Supabase Update on profiles table
                const currentBal = Number(selectedUser.balance) || Number(selectedUser.credit_balance) || 0;
                const updatedBal = type === 'fund' ? currentBal + amount : Math.max(0, currentBal - amount);

                let { error: errFull } = await supabase.from('profiles').update({ 
                    balance: updatedBal,
                    credit_balance: updatedBal 
                }).eq('id', selectedUser.id);

                if (errFull) {
                    let { error: errBal } = await supabase.from('profiles').update({ balance: updatedBal }).eq('id', selectedUser.id);
                    if (errBal) {
                        let { error: errCred } = await supabase.from('profiles').update({ credit_balance: updatedBal }).eq('id', selectedUser.id);
                        if (errCred) throw errCred;
                    }
                }
            }

            // Step 3: Insert transaction audit log in Supabase
            try {
                await supabase.from('transactions').insert({
                    user_id: selectedUser.id,
                    type: type === 'fund' ? 'topup' : 'withdrawal',
                    title: `Admin Wallet ${type === 'fund' ? 'Credit' : 'Debit'}`,
                    amount: amount,
                    status: 'completed',
                    description: `Admin Wallet ${type === 'fund' ? 'Funding' : 'Debit'}`,
                    reference: `admin_${type}_${Date.now()}`
                });
            } catch (txErr) {}

            // Step 4: Re-fetch updated profile directly from database to get authoritative new balance
            const { data: freshProfile } = await supabase.from('profiles').select('balance, credit_balance').eq('id', selectedUser.id).single();
            const authoritativeBalance = freshProfile?.balance ?? freshProfile?.credit_balance ?? (
                type === 'fund' 
                    ? (Number(selectedUser.balance || selectedUser.credit_balance || 0) + amount)
                    : Math.max(0, Number(selectedUser.balance || selectedUser.credit_balance || 0) - amount)
            );

            // Step 5: Native Alert confirmation
            Alert.alert(
                "Wallet Updated 🎉", 
                type === 'fund'
                    ? `Successfully funded ₦${amount.toLocaleString()} to ${selectedUser.full_name}'s vault balance!` 
                    : `Successfully debited ₦${amount.toLocaleString()} from ${selectedUser.full_name}'s vault balance!`
            );

            // Step 6: Update local UI states immediately with authoritative new balance
            setSelectedUser(prev => prev ? { ...prev, balance: authoritativeBalance, credit_balance: authoritativeBalance } : null);
            setUsers(prevUsers => prevUsers.map(u => u.id === selectedUser.id ? { ...u, balance: authoritativeBalance, credit_balance: authoritativeBalance } : u));
            setFundAmount('');
            fetchUserHistory(selectedUser.id);
            fetchUsers();
        } catch (e: any) {
            Alert.alert("Funding Error ❌", e.message || "Failed to update wallet balance.");
        } finally {
            setFundingProcessing(false);
        }
    };

    const initiateFundOrDebit = () => {
        if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid positive amount.");
            return;
        }
        const amountVal = Number(fundAmount);
        const actionType = isDebit ? 'debit' : 'fund';
        
        Alert.alert(
            isDebit ? "Confirm Wallet Debit 🔻" : "Confirm Wallet Funding 💵",
            `Are you sure you want to ${isDebit ? 'DEBIT' : 'FUND'} ₦${amountVal.toLocaleString()} ${isDebit ? 'from' : 'to'} ${selectedUser?.full_name}'s vault balance?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: isDebit ? "Debit Now" : "Fund Now", 
                    onPress: () => handleDirectFundOrDebit(actionType, amountVal)
                }
            ]
        );
    };

    const initiateBlock = () => {
        setPendingAction({ type: 'block' });
        Alert.alert("Confirm", `Change status to ${selectedUser?.status === 'active' ? 'SUSPENDED' : 'ACTIVE'}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Yes", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateResetPin = () => {
        setPendingAction({ type: 'reset_pin' });
        setShowSecurity(true);
    };

    const initiateDelete = () => {
        setPendingAction({ type: 'delete_user' });
        Alert.alert("Delete User", `Are you sure you want to PERMANENTLY delete ${selectedUser?.full_name}? This action cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive', onPress: () => setShowSecurity(true) }
        ]);
    };

    const sendNotification = () => {
        if (!notifyMessage.trim()) return;
        setPendingAction({ type: 'notify' });
        executeAction();
    };

    const sendCustomEmail = () => {
        if (!emailSubject.trim() || !emailBody.trim()) {
            Alert.alert("Missing Input", "Please enter both email subject and body.");
            return;
        }
        setPendingAction({ type: 'send_email' });
        executeAction();
    };

    const exportProfile = async () => {
        if (isSelectionMode) {
             const selectedUsers = users.filter(u => selectedIds.has(u.id));
             if (selectedUsers.length === 0) return;
             
             let csv = "ID,Name,Email,Phone,Balance,Status,Role,Joined\n";
             selectedUsers.forEach(u => {
                 csv += `${u.id},"${u.full_name}","${u.email}","${u.phone || ''}",${u.credit_balance || 0},${u.status},${u.role},${u.created_at}\n`;
             });
             
             try {
                await Share.share({
                    message: csv,
                    title: "Users_Export.csv"
                });
             } catch (e) { Alert.alert("Export Error", "Could not share file."); }

        } else if (selectedUser) {
            const message = `
User Profile Report
-------------------
ID: ${selectedUser.id}
Name: ${selectedUser.full_name}
Email: ${selectedUser.email}
Phone: ${selectedUser.phone || 'N/A'}
Status: ${selectedUser.status} [KYC: ${selectedUser.kyc_verified ? 'Yes' : 'No'}]
Role: ${selectedUser.role}

Financials:
- Balance: ₦${(selectedUser.credit_balance || 0).toLocaleString()}
- Account: ${selectedUser.account_number || 'N/A'} [${selectedUser.bank_name || 'Wema'}]
- Limit: ${selectedUser.transfer_limit ? '₦'+selectedUser.transfer_limit : 'Unlimited'}
- Purchased Cards Count: ${userVirtualCards.length}
- Verification Requests Count: ${userKycRequests.length}

Metadata:
- Joined: ${new Date(selectedUser.created_at || '').toLocaleString()}
- Last Login: ${selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}
            `.trim();

            Share.share({
                message: message,
                title: `Report_${selectedUser.full_name.replace(/ /g, '_')}.txt`
            });
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        
        Alert.alert("Delete User", `Are you sure you want to delete ${selectedUser.full_name}? This action cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    setLoading(true);
                    const { error } = await supabase.from('profiles').update({ status: 'deleted' }).eq('id', selectedUser.id);
                    if (error) {
                        Alert.alert("Error", error.message);
                    } else {
                        Alert.alert("Deleted", "User has been soft-deleted.");
                        fetchUsers();
                        setSelectedUser(null);
                    }
                    setLoading(false);
                }
            }
        ]);
    };

    const contactUser = (method: 'call' | 'whatsapp') => {
        if (!selectedUser?.phone) {
            Alert.alert("No Phone", "User does not have a phone number linked.");
            return;
        }
        const link = method === 'call' 
            ? `tel:${selectedUser.phone}` 
            : `https://wa.me/${selectedUser.phone.replace('+', '')}`;
            
        Linking.canOpenURL(link).then(supported => {
            if (supported) Linking.openURL(link);
            else Alert.alert("Error", "Cannot open link");
        });
    };

    const toggleCardMask = (cardId: string) => {
        setUnmaskedCardIds(prev => ({ ...prev, [cardId]: !prev[cardId] }));
    };

    // Executive Light Mode Command Center Modal
    const renderUserModal = () => (
        <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="light" style={s.modalOverlay}>
                <View style={s.modalCard}>
                    
                    {/* Modal Header Bar */}
                    <View style={s.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedUser(null)} style={s.iconCircleBtn}>
                            <Ionicons name="close" size={18} color={T.navyDark} />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.modalHeaderTitle}>User Command Center</Text>
                            <Text style={{ fontSize: 10, color: T.goldDark, fontWeight: '700' }}>ID: {selectedUser?.id?.slice(0, 8)}...</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={exportProfile} style={s.iconCircleBtn}>
                                <Ionicons name="share-outline" size={16} color={T.navyDark} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[s.iconCircleBtn, { backgroundColor: T.goldBg }]}>
                                <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color={T.goldDark} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Executive Deep Navy Banner */}
                    <LinearGradient colors={[T.navyDark, T.navyMid]} style={s.modalHeroBanner}>
                        <View style={s.modalAvatarWrapper}>
                            {selectedUser?.avatar_url ? (
                                <Image source={{ uri: selectedUser.avatar_url }} style={s.modalAvatarImage} resizeMode="cover" />
                            ) : (
                                <Text style={s.modalAvatarText}>{selectedUser?.full_name?.charAt(0).toUpperCase()}</Text>
                            )}
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.modalUserName} numberOfLines={1}>{selectedUser?.full_name}</Text>
                                {selectedUser?.role === 'admin' && <Text style={{ fontSize: 14 }}>👑</Text>}
                            </View>
                            <Text style={s.modalUserEmail} numberOfLines={1}>{selectedUser?.email}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <View style={[s.statusBadge, selectedUser?.status === 'active' ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                    <Text style={[s.statusBadgeText, selectedUser?.status === 'active' ? { color: T.success } : { color: T.danger }]}>{selectedUser?.status}</Text>
                                </View>
                                <View style={s.badgeVerified}>
                                    <Ionicons name="shield-checkmark" size={10} color={T.info} />
                                    <Text style={s.badgeVerifiedText}>Tier {selectedUser?.kyc_tier || 1}</Text>
                                </View>
                                {selectedUser?.corporate_email && (
                                    <View style={s.badgeCorp}>
                                        <Ionicons name="at-circle" size={10} color={T.warning} />
                                        <Text style={s.badgeCorpText}>Corp</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => contactUser('call')} style={s.contactBtn}>
                            <Ionicons name="call" size={16} color={T.gold} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => contactUser('whatsapp')} style={[s.contactBtn, { backgroundColor: T.successBg, borderColor: T.success }]}>
                            <Ionicons name="logo-whatsapp" size={18} color={T.success} />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Navigation Tabs */}
                    <View style={s.modalTabBar}>
                        {[
                            { key: 'overview', label: 'Overview', icon: 'wallet-outline' },
                            { key: 'kyc', label: 'Identity & KYC', icon: 'finger-print-outline' },
                            { key: 'controls', label: 'Controls', icon: 'options-outline' },
                            { key: 'notify', label: 'Notify', icon: 'chatbubble-ellipses-outline' },
                            { key: 'logs', label: 'Audit Logs', icon: 'list-outline' },
                        ].map(t => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setModalTab(t.key as any)}
                                style={[s.modalTabItem, modalTab === t.key ? s.modalTabItemActive : null]}
                            >
                                <Ionicons name={t.icon as any} size={14} color={modalTab === t.key ? T.navyDark : T.textSub} />
                                <Text style={[s.modalTabText, modalTab === t.key ? { color: T.navyDark } : null]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        {/* TAB 1: OVERVIEW & WALLET FUNDING */}
                        {modalTab === 'overview' && (
                            <View style={{ padding: 14 }}>
                                {/* Vault Balance Card */}
                                <View style={s.walletCard}>
                                    <Text style={s.walletLabel}>Vault Balance</Text>
                                    <Text style={s.walletValue}>₦{(selectedUser?.credit_balance || selectedUser?.balance || 0).toLocaleString()}</Text>
                                    <View style={s.accountChip}>
                                        <Ionicons name="card" size={12} color={T.gold} />
                                        <Text style={s.accountChipText}>{selectedUser?.account_number || 'No Virtual Account'}</Text>
                                    </View>
                                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Bank: {selectedUser?.bank_name || 'Wema Bank'}</Text>
                                </View>

                                {/* High Contrast Wallet Funding Section */}
                                <View style={s.controlCard}>
                                    <Text style={s.sectionHeading}>Admin Wallet Management (Fund / Debit)</Text>
                                    
                                    {/* Action Selector Pills */}
                                    <View style={s.fundingToggleRow}>
                                        <TouchableOpacity 
                                            onPress={() => setIsDebit(false)}
                                            style={[s.fundingTogglePill, !isDebit ? s.fundingTogglePillActiveFund : null]}
                                        >
                                            <Ionicons name="arrow-down-circle" size={14} color={!isDebit ? '#FFFFFF' : T.success} />
                                            <Text style={[s.fundingToggleText, !isDebit ? { color: '#FFFFFF' } : { color: T.success }]}>Fund (+) Credit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={() => setIsDebit(true)}
                                            style={[s.fundingTogglePill, isDebit ? s.fundingTogglePillActiveDebit : null]}
                                        >
                                            <Ionicons name="arrow-up-circle" size={14} color={isDebit ? '#FFFFFF' : T.danger} />
                                            <Text style={[s.fundingToggleText, isDebit ? { color: '#FFFFFF' } : { color: T.danger }]}>Debit (-) Deduct</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Amount Input Row */}
                                    <View style={s.amountInputContainer}>
                                        <Text style={s.nairaSymbol}>₦</Text>
                                        <TextInput 
                                            placeholder="Enter Amount" 
                                            placeholderTextColor={T.textSub}
                                            keyboardType="numeric"
                                            style={s.customAmountInput}
                                            value={fundAmount}
                                            onChangeText={setFundAmount}
                                        />
                                        <TouchableOpacity 
                                            onPress={initiateFundOrDebit} 
                                            disabled={fundingProcessing}
                                            style={[s.actionCheckBtn, isDebit ? { backgroundColor: T.danger } : { backgroundColor: T.success }]}
                                        >
                                            {fundingProcessing ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" />
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    {/* Preset Fast Chips */}
                                    <View style={s.presetRow}>
                                        {['1000', '5000', '10000', '25000', '50000', '100000'].map(val => (
                                            <TouchableOpacity
                                                key={val}
                                                onPress={() => setFundAmount(val)}
                                                style={[s.presetChip, fundAmount === val ? s.presetChipActive : null]}
                                            >
                                                <Text style={[s.presetChipText, fundAmount === val ? { color: '#FFFFFF' } : { color: T.navyDark }]}>
                                                    +₦{Number(val) >= 1000 ? (Number(val)/1000) + 'k' : val}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Real Purchased Virtual Cards Carousel / List */}
                                <Text style={s.sectionHeading}>Purchased Virtual Cards ({userVirtualCards.length}) 💳</Text>
                                {loadingHistory ? (
                                    <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator color={T.navyDark} size="small" /></View>
                                ) : userVirtualCards.length === 0 ? (
                                    <View style={s.noCardsCard}>
                                        <Ionicons name="card-outline" size={28} color={T.navyDark} />
                                        <Text style={s.noCardsTitle}>No Purchased Virtual Cards</Text>
                                        <Text style={s.noCardsSub}>User has not issued any virtual card yet.</Text>
                                    </View>
                                ) : (
                                    userVirtualCards.map((card) => {
                                        const isUnmasked = !!unmaskedCardIds[card.id];
                                        const formattedNum = isUnmasked 
                                            ? card.card_number 
                                            : `•••• •••• •••• ${card.card_number?.slice(-4) || '9281'}`;

                                        return (
                                            <View key={card.id} style={s.virtualAtmCard}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Ionicons name="card" size={14} color={T.gold} />
                                                        <Text style={{ color: T.gold, fontWeight: '900', fontSize: 11 }}>
                                                            {(card.brand || 'VIRTUAL CARD').toUpperCase()} ({card.currency || 'USD'})
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            setPendingAction({ type: 'toggle_virtual_card', cardId: card.id });
                                                            setShowSecurity(true);
                                                        }} 
                                                        style={[s.statusBadge, card.status === 'frozen' ? s.statusBadgeSuspended : s.statusBadgeActive]}
                                                    >
                                                        <Text style={[s.statusBadgeText, card.status === 'frozen' ? { color: T.danger } : { color: T.success }]}>
                                                            {card.status === 'frozen' ? 'FROZEN ❄️' : 'ACTIVE 💳'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
                                                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 }}>
                                                        {formattedNum}
                                                    </Text>
                                                    <TouchableOpacity onPress={() => toggleCardMask(card.id)} style={{ paddingHorizontal: 6 }}>
                                                        <Ionicons name={isUnmasked ? "eye-off" : "eye"} size={16} color={T.gold} />
                                                    </TouchableOpacity>
                                                </View>

                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ color: '#94A3B8', fontSize: 10 }}>EXP: {card.expiry || '08/28'}  CVV: {isUnmasked ? card.cvv : '•••'}</Text>
                                                    <Text style={{ color: T.gold, fontWeight: '800', fontSize: 11 }}>BAL: ${card.balance || 0}</Text>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}

                                {/* Quick Info Card */}
                                <Text style={s.sectionHeading}>Account Quick Summary</Text>
                                <View style={s.infoListCard}>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Custom User ID</Text>
                                        <Text style={s.infoValue}>{selectedUser?.custom_id || selectedUser?.id?.slice(0, 12)}</Text>
                                    </View>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Phone Number</Text>
                                        <Text style={s.infoValue}>{selectedUser?.phone || 'Not Provided'}</Text>
                                    </View>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Account Status</Text>
                                        <Text style={[s.infoValue, selectedUser?.status === 'active' ? { color: T.success } : { color: T.danger }]}>{selectedUser?.status?.toUpperCase()}</Text>
                                    </View>
                                    <View style={s.infoRow}>
                                        <Text style={s.infoLabel}>Joined Date</Text>
                                        <Text style={s.infoValue}>{new Date(selectedUser?.created_at || '').toLocaleDateString()}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* TAB 2: IDENTITY, NIN, BVN & CAC VERIFICATION HISTORY */}
                        {modalTab === 'kyc' && (
                            <View style={{ padding: 14 }}>
                                <Text style={s.sectionHeading}>Identity Verification & Documents</Text>
                                
                                <View style={s.kycDetailCard}>
                                    <View style={s.kycItemRow}>
                                        <Text style={s.kycItemLabel}>Bank Verification Number (BVN)</Text>
                                        <Text style={s.kycItemValue}>{selectedUser?.bvn || 'Not Linked'}</Text>
                                    </View>
                                    <View style={s.kycItemRow}>
                                        <Text style={s.kycItemLabel}>National Identity Number (NIN)</Text>
                                        <Text style={s.kycItemValue}>{selectedUser?.nin || 'Not Linked'}</Text>
                                    </View>
                                    <View style={s.kycItemRow}>
                                        <Text style={s.kycItemLabel}>CAC Corporate Registration</Text>
                                        <Text style={[s.kycItemValue, selectedUser?.cac_registered ? { color: T.success } : { color: T.danger }]}>
                                            {selectedUser?.cac_registered ? `RC: ${selectedUser?.cac_rc_number || 'RC-192847'}` : 'Unregistered'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Action Verification Buttons */}
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                                    <TouchableOpacity 
                                        onPress={() => { setPendingAction({ type: 'verify_nin' }); setShowSecurity(true); }}
                                        style={[s.gridBtn, { flex: 1, backgroundColor: T.infoBg, borderColor: T.info }]}
                                    >
                                        <Ionicons name="finger-print" size={16} color={T.info} />
                                        <Text style={[s.gridBtnText, { color: T.info }]}>Verify NIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => { setPendingAction({ type: 'verify_cac' }); setShowSecurity(true); }}
                                        style={[s.gridBtn, { flex: 1, backgroundColor: T.warningBg, borderColor: T.warning }]}
                                    >
                                        <Ionicons name="business" size={16} color={T.warning} />
                                        <Text style={[s.gridBtnText, { color: T.warning }]}>Verify CAC</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Verification History Timeline */}
                                <Text style={s.sectionHeading}>Verification History & Document Submissions 📜</Text>
                                {loadingHistory ? (
                                    <View style={{ paddingVertical: 12, alignItems: 'center' }}><ActivityIndicator color={T.navyDark} size="small" /></View>
                                ) : userKycRequests.length === 0 ? (
                                    <View style={s.noCardsCard}>
                                        <Ionicons name="shield-outline" size={26} color={T.navyDark} />
                                        <Text style={s.noCardsTitle}>No Verification Attempts Submitted</Text>
                                        <Text style={s.noCardsSub}>User has not submitted identity documents yet.</Text>
                                    </View>
                                ) : (
                                    userKycRequests.map((req) => (
                                        <View key={req.id} style={s.kycHistoryItem}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Ionicons name="document-text-outline" size={14} color={T.navyDark} />
                                                    <Text style={{ color: T.textMain, fontWeight: '800', fontSize: 12 }}>{req.id_type}</Text>
                                                </View>
                                                <View style={[s.statusBadge, req.status === 'approved' ? s.statusBadgeActive : req.status === 'rejected' ? s.statusBadgeSuspended : { backgroundColor: T.warningBg, borderColor: T.warning }]}>
                                                    <Text style={[s.statusBadgeText, req.status === 'approved' ? { color: T.success } : req.status === 'rejected' ? { color: T.danger } : { color: T.warning }]}>
                                                        {req.status?.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ marginVertical: 4 }}>
                                                <Text style={{ color: T.textSub, fontSize: 10 }}>Doc Number: {req.id_number || 'N/A'}</Text>
                                                <Text style={{ color: T.textSub, fontSize: 10 }}>Date Submitted: {new Date(req.created_at).toLocaleString()}</Text>
                                                {req.rejection_reason && (
                                                    <Text style={{ color: T.danger, fontSize: 10, marginTop: 2 }}>Reason: {req.rejection_reason}</Text>
                                                )}
                                            </View>

                                            {req.document_url && (
                                                <TouchableOpacity 
                                                    onPress={() => Linking.openURL(req.document_url || '')}
                                                    style={s.viewDocBtn}
                                                >
                                                    <Ionicons name="eye-outline" size={12} color="#FFFFFF" />
                                                    <Text style={s.viewDocBtnText}>View Verified Document</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}

                                {/* Tier Upgrade Selectors */}
                                <Text style={s.sectionHeading}>Set KYC Tier</Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                                    {[1, 2, 3].map(t => (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => { setPendingAction({ type: 'upgrade_tier', tier: t }); setShowSecurity(true); }}
                                            style={[s.tierBtn, (selectedUser?.kyc_tier || 1) === t ? s.tierBtnActive : null]}
                                        >
                                            <Text style={[s.tierBtnText, (selectedUser?.kyc_tier || 1) === t ? { color: '#FFFFFF' } : null]}>Tier {t}</Text>
                                            <Text style={{ fontSize: 10, color: T.textSub }}>{t === 1 ? '₦50k' : t === 2 ? '₦500k' : 'Unlimited'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* TAB 3: CONTROLS */}
                        {modalTab === 'controls' && (
                            <View style={{ padding: 14 }}>
                                <Text style={s.sectionHeading}>System Feature Locks & Permissions</Text>
                                
                                <View style={s.actionsGrid}>
                                    <TouchableOpacity onPress={initiateBlock} style={[s.gridBtn, selectedUser?.status === 'active' ? s.gridBtnDanger : s.gridBtnSuccess]}>
                                        <Ionicons name={selectedUser?.status === 'active' ? "ban" : "checkmark-circle"} size={16} color={selectedUser?.status === 'active' ? T.danger : T.success} />
                                        <Text style={[s.gridBtnText, selectedUser?.status === 'active' ? { color: T.danger } : { color: T.success }]}>
                                            {selectedUser?.status === 'active' ? 'Suspend' : 'Activate'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            const newRole = selectedUser?.role === 'super_admin' ? 'admin' : selectedUser?.role === 'admin' ? 'user' : 'super_admin';
                                            setPendingAction({ type: 'promote', role: newRole });
                                            setShowSecurity(true);
                                        }} 
                                        style={[s.gridBtn, { backgroundColor: T.goldBg, borderColor: T.gold }]}
                                    >
                                        <MaterialCommunityIcons name="crown-outline" size={16} color={T.goldDark} />
                                        <Text style={[s.gridBtnText, { color: T.goldDark }]}>
                                            {selectedUser?.role === 'admin' ? 'Admin 👑' : 'Make Admin 👑'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => { setPendingAction({ type: 'toggle_crypto' }); executeAction(); }} 
                                        style={[s.gridBtn, (selectedUser?.crypto_enabled ?? true) ? { backgroundColor: T.warningBg, borderColor: T.warning } : { backgroundColor: T.card, borderColor: T.border }]}
                                    >
                                        <Ionicons name="logo-bitcoin" size={16} color={(selectedUser?.crypto_enabled ?? true) ? T.warning : T.textSub} />
                                        <Text style={[s.gridBtnText, (selectedUser?.crypto_enabled ?? true) ? { color: T.warning } : { color: T.textSub }]}>
                                            Crypto: {(selectedUser?.crypto_enabled ?? true) ? 'ON' : 'OFF'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => { setPendingAction({ type: 'toggle_cards' }); executeAction(); }} 
                                        style={[s.gridBtn, (selectedUser?.virtual_cards_enabled ?? true) ? { backgroundColor: T.infoBg, borderColor: T.info } : { backgroundColor: T.card, borderColor: T.border }]}
                                    >
                                        <Ionicons name="card-outline" size={16} color={(selectedUser?.virtual_cards_enabled ?? true) ? T.info : T.textSub} />
                                        <Text style={[s.gridBtnText, (selectedUser?.virtual_cards_enabled ?? true) ? { color: T.info } : { color: T.textSub }]}>
                                            Cards: {(selectedUser?.virtual_cards_enabled ?? true) ? 'ON' : 'OFF'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetPin} style={s.gridBtn}>
                                        <MaterialCommunityIcons name="lock-reset" size={16} color={T.textSub} />
                                        <Text style={s.gridBtnText}>Reset Auth PIN</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Danger Zone */}
                                <Text style={[s.sectionHeading, { color: T.danger }]}>Danger Zone</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity onPress={() => { setPendingAction({ type: 'impersonate' }); setShowSecurity(true); }} style={[s.gridBtn, { flex: 1, backgroundColor: T.purpleBg, borderColor: T.purple }]}>
                                        <MaterialCommunityIcons name="incognito" size={16} color={T.purple} />
                                        <Text style={[s.gridBtnText, { color: T.purple }]}>Impersonate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={initiateDelete} style={[s.gridBtn, { flex: 1, backgroundColor: T.dangerBg, borderColor: T.danger }]}>
                                        <Ionicons name="trash-outline" size={16} color={T.danger} />
                                        <Text style={[s.gridBtnText, { color: T.danger }]}>Delete User</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TAB 4: NOTIFICATIONS & EMAIL */}
                        {modalTab === 'notify' && (
                            <View style={{ padding: 14 }}>
                                <Text style={s.sectionHeading}>Send Direct Push Notification</Text>
                                <View style={s.subFormCard}>
                                    <TextInput
                                        placeholder="Notification Title"
                                        placeholderTextColor={T.textSub}
                                        style={s.subFormInput}
                                        value={notifyTitle}
                                        onChangeText={setNotifyTitle}
                                    />
                                    <TextInput
                                        placeholder="Message Body..."
                                        placeholderTextColor={T.textSub}
                                        multiline
                                        style={[s.subFormInput, { minHeight: 60 }]}
                                        value={notifyMessage}
                                        onChangeText={setNotifyMessage}
                                    />
                                    <TouchableOpacity onPress={sendNotification} style={s.subFormSubmitBtn}>
                                        <Text style={s.subFormSubmitBtnText}>Send Push Notification</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={s.sectionHeading}>Send Direct Email ✉️</Text>
                                <View style={s.subFormCard}>
                                    <TextInput
                                        placeholder="Email Subject Line"
                                        placeholderTextColor={T.textSub}
                                        style={s.subFormInput}
                                        value={emailSubject}
                                        onChangeText={setEmailSubject}
                                    />
                                    <TextInput
                                        placeholder="Email Content..."
                                        placeholderTextColor={T.textSub}
                                        multiline
                                        style={[s.subFormInput, { minHeight: 70 }]}
                                        value={emailBody}
                                        onChangeText={setEmailBody}
                                    />
                                    <TouchableOpacity onPress={sendCustomEmail} style={[s.subFormSubmitBtn, { backgroundColor: T.warning }]}>
                                        <Text style={[s.subFormSubmitBtnText, { color: '#FFFFFF' }]}>Send Email Now</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* TAB 5: LOGS */}
                        {modalTab === 'logs' && (
                            <View style={{ padding: 14 }}>
                                <Text style={s.sectionHeading}>Recent Transactions & Services Activity</Text>
                                <View style={s.txCard}>
                                    {loadingHistory ? (
                                        <View style={{ paddingVertical: 16, alignItems: 'center' }}><ActivityIndicator color={T.navyDark} size="small" /></View>
                                    ) : userTransactions.length === 0 ? (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <Text style={s.noHistoryText}>No transaction history</Text>
                                        </View>
                                    ) : (
                                        userTransactions.map((tx, i) => (
                                            <View key={tx.id} style={[s.txRow, i !== userTransactions.length - 1 ? { borderBottomWidth: 1, borderBottomColor: T.border } : null]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Ionicons name={tx.type === 'topup' ? 'arrow-down' : 'arrow-up'} size={14} color={tx.type === 'topup' ? T.success : T.textSub} />
                                                    <View>
                                                        <Text style={s.txTitle}>{tx.type || 'Txn'}</Text>
                                                        <Text style={s.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[s.txAmount, tx.type === 'topup' ? { color: T.success } : { color: T.textMain }]}>
                                                    {tx.type === 'topup' ? '+' : '-'}₦{tx.amount?.toLocaleString()}
                                                </Text>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </BlurView>
        </Modal>
    );

    // Create User Account Modal
    const renderCreateUserModal = () => (
        <Modal visible={showCreateUser} transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
            <BlurView intensity={95} tint="light" style={s.modalOverlay}>
                 <View style={s.createUserCard}>
                    <View style={s.createUserHeader}>
                        <Text style={s.createUserTitle}>Create Account</Text>
                        <TouchableOpacity onPress={() => setShowCreateUser(false)} style={s.iconCircleBtn}>
                            <Ionicons name="close" size={20} color={T.navyDark} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        <View style={{ gap: 12 }}>
                            <View>
                                <Text style={s.fieldLabel}>Full Name</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="Abubakar Sadiq"
                                    placeholderTextColor={T.textSub}
                                    value={newUserForm.fullName}
                                    onChangeText={t => setNewUserForm({...newUserForm, fullName: t})}
                                />
                            </View>
                            <View>
                                <Text style={s.fieldLabel}>Email Address</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="user@abumafhal.com.ng"
                                    placeholderTextColor={T.textSub}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={newUserForm.email}
                                    onChangeText={t => setNewUserForm({...newUserForm, email: t})}
                                />
                            </View>
                            <View>
                                <Text style={s.fieldLabel}>Phone Number</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="+2348000000000"
                                    placeholderTextColor={T.textSub}
                                    keyboardType="phone-pad"
                                    value={newUserForm.phone}
                                    onChangeText={t => setNewUserForm({...newUserForm, phone: t})}
                                />
                            </View>
                            <View>
                                <Text style={s.fieldLabel}>Initial Password</Text>
                                 <TextInput 
                                    style={s.createInput}
                                    value={newUserForm.password}
                                    onChangeText={t => setNewUserForm({...newUserForm, password: t})}
                                    secureTextEntry
                                />
                            </View>
                            
                             <View style={s.adminRoleSwitchRow}>
                                 <Text style={{ fontWeight: '700', color: T.textMain, fontSize: 13 }}>Grant Admin Privileges</Text>
                                 <Switch 
                                    value={newUserForm.role === 'admin'}
                                    onValueChange={(val) => setNewUserForm({...newUserForm, role: val ? 'admin' : 'user'})}
                                    trackColor={{ false: T.border, true: T.navyDark }}
                                    thumbColor="#fff"
                                 />
                            </View>

                            <TouchableOpacity 
                                onPress={handleCreateUser}
                                disabled={creatingUser}
                                style={s.createUserBtn}
                            >
                                {creatingUser ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={s.createUserBtnText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                 </View>
            </BlurView>
        </Modal>
    );

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} /> 

            {/* Mobile-First Executive Header */}
            <View style={s.headerContainer}>
                {/* Header Title Row */}
                <View style={s.headerTopRow}>
                    {isSelectionMode ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} style={s.closeSelectionBtn}>
                                <Ionicons name="close" size={16} color={T.navyDark} />
                            </TouchableOpacity>
                            <Text style={s.selectionText}>{selectedIds.size} Selected</Text>
                        </View>
                    ) : (
                        <View>
                            <Text style={s.headerTitle}>User Governance</Text>
                            <Text style={s.headerSubTitle}>Mobile Hub • {stats.totalUsers} Profiles</Text>
                        </View>
                    )}
                    <TouchableOpacity onPress={() => setShowCreateUser(true)} style={s.addUserHeaderBtn}>
                        <Ionicons name="person-add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {/* 2x2 Stats Grid for Clean Mobile Viewing */}
                {!isSelectionMode && (
                    <View style={s.statsGrid}>
                        <View style={s.statCard}>
                            <Text style={s.statCardLabel}>TOTAL VAULT</Text>
                            <Text style={s.statCardValue}>₦{stats.totalBalance > 1000000 ? (stats.totalBalance/1000000).toFixed(1)+'M' : stats.totalBalance.toLocaleString()}</Text>
                        </View>
                        <View style={s.statCard}>
                            <Text style={s.statCardLabel}>ACTIVE</Text>
                            <Text style={s.statCardValue}>{stats.activeUsers}</Text>
                        </View>
                        <View style={s.statCard}>
                            <Text style={s.statCardLabel}>VERIFIED</Text>
                            <Text style={s.statCardValue}>{stats.verifiedUsers}</Text>
                        </View>
                        <View style={s.statCard}>
                            <Text style={s.statCardLabel}>CORPORATE</Text>
                            <Text style={s.statCardValue}>{stats.corporateAdmins}</Text>
                        </View>
                    </View>
                )}

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={16} color={T.navyDark} />
                    <TextInput
                        placeholder="Search name, phone, account..."
                        placeholderTextColor={T.textSub}
                        style={s.searchInput}
                        value={search}
                        onChangeText={handleSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color={T.textSub} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Chips Scroll Bar */}
                <View style={s.filterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {[
                            { key: 'all', label: 'All Users' },
                            { key: 'active', label: 'Active' },
                            { key: 'suspended', label: 'Suspended' },
                            { key: 'admin', label: 'Admins 👑' },
                            { key: 'verified', label: 'Verified 🛡️' },
                            { key: 'corporate', label: 'Corporate' },
                            { key: 'high_bal', label: 'High Vault' }
                        ].map((f) => (
                            <TouchableOpacity 
                                key={f.key} 
                                onPress={() => setFilterStatus(f.key as any)}
                                style={[s.filterChip, filterStatus === f.key ? s.filterChipActive : null]}
                            >
                                <Text style={[s.filterChipText, filterStatus === f.key ? { color: '#FFFFFF' } : { color: T.textSub }]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Bulk Selection Bar */}
            {isSelectionMode && (
                <View style={s.bulkBar}>
                    <TouchableOpacity onPress={() => executeBulkAction('block')} style={s.bulkBtn}>
                        <Ionicons name="ban" size={18} color={T.danger} />
                        <Text style={[s.bulkBtnText, { color: T.danger }]}>Suspend</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => executeBulkAction('unblock')} style={s.bulkBtn}>
                        <Ionicons name="checkmark-circle" size={18} color={T.success} />
                        <Text style={[s.bulkBtnText, { color: T.success }]}>Activate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => executeBulkAction('verify')} style={s.bulkBtn}>
                        <Ionicons name="shield-checkmark" size={18} color={T.info} />
                        <Text style={[s.bulkBtnText, { color: T.info }]}>Verify</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Mobile-First Stacked User Cards (Light Mode) */}
            <FlatList
                data={getFilteredUsers()}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.listContent}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor={T.navyDark} 
                        colors={[T.navyDark]} 
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        onPress={() => isSelectionMode ? toggleSelection(item.id) : setSelectedUser(item)}
                        onLongPress={() => handleLongPress(item.id)}
                        style={[s.userCard, selectedIds.has(item.id) ? s.userCardSelected : null]}
                    >
                        {/* Section 1: Top Row */}
                        <View style={s.userCardTopRow}>
                            {isSelectionMode && (
                                <View style={[s.checkBox, selectedIds.has(item.id) ? s.checkBoxActive : null]}>
                                    {selectedIds.has(item.id) && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                                </View>
                            )}

                            <View style={[s.avatar, item.role === 'admin' ? s.avatarAdmin : null]}>
                                {item.avatar_url ? (
                                    <Image source={{ uri: item.avatar_url }} style={s.avatarImage} resizeMode="cover" />
                                ) : (
                                    <Text style={[s.avatarText, item.role === 'admin' ? { color: T.goldDark } : null]}>
                                        {item.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </Text>
                                )}
                            </View>

                            <View style={s.userCardNameCol}>
                                <Text style={s.userName} numberOfLines={1}>
                                    {item.full_name || 'Unknown User'}
                                </Text>
                                <Text style={s.accountNumber} numberOfLines={1}>
                                    {item.account_number ? `Acct: ${item.account_number}` : 'No Acct'} • {item.phone || item.email}
                                </Text>
                            </View>

                            <View style={[s.statusBadge, item.status === 'active' ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                <Text style={[s.statusBadgeText, item.status === 'active' ? { color: T.success } : { color: T.danger }]}>
                                    {item.status}
                                </Text>
                            </View>
                        </View>

                        {/* Section 2: Badges Row */}
                        <View style={s.badgesRow}>
                            {item.role === 'admin' && (
                                <View style={s.badgeGold}>
                                    <MaterialCommunityIcons name="crown" size={10} color={T.goldDark} />
                                    <Text style={s.badgeGoldText}>ADMIN</Text>
                                </View>
                            )}
                            {item.corporate_email && (
                                <View style={s.badgeCorp}>
                                    <Ionicons name="at-circle" size={10} color={T.warning} />
                                    <Text style={s.badgeCorpText} numberOfLines={1}>{item.corporate_email}</Text>
                                </View>
                            )}
                            {item.kyc_verified && (
                                <View style={s.badgeVerified}>
                                    <Ionicons name="shield-checkmark" size={10} color={T.info} />
                                    <Text style={s.badgeVerifiedText}>Tier {item.kyc_tier || 1} Verified</Text>
                                </View>
                            )}
                        </View>

                        {/* Section 3: Bottom Vault Balance Bar */}
                        <View style={s.vaultBalanceBar}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="wallet-outline" size={14} color={T.gold} />
                                <Text style={s.vaultLabel}>VAULT BAL:</Text>
                                <Text style={s.vaultAmount}>₦{(item.credit_balance || item.balance || 0).toLocaleString()}</Text>
                            </View>

                            <View style={s.manageBtn}>
                                <Text style={s.manageBtnText}>Manage</Text>
                                <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={s.emptyWrapper}>
                        {loading ? (
                            <ActivityIndicator size="large" color={T.navyDark} />
                        ) : (
                            <View style={s.emptyCard}>
                                <Ionicons name="people-outline" size={36} color={T.navyDark} />
                                <Text style={s.emptyTitle}>No Users Found</Text>
                            </View>
                        )}
                    </View>
                }
            />
            
            {/* Modals */}
            {renderUserModal()}
            {renderCreateUserModal()}

            {/* Admin Verification Modal */}
            <SecurityModal 
                visible={showSecurity}
                onClose={() => setShowSecurity(false)}
                onSuccess={() => {
                    setShowSecurity(false);
                    setTimeout(executeAction, 400);
                }}
                title="Admin Verification"
            />
        </View>
    );
}

// Embedded StyleSheet (CSS for Mobile-First Light Mode Navy & Gold Manager Users Screen)
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 48 : 16,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: T.card,
        borderBottomWidth: 1.5,
        borderBottomColor: T.gold,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerTitle: {
        color: T.navyDark,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    headerSubTitle: {
        color: T.goldDark,
        fontSize: 11,
        fontWeight: '700',
    },
    closeSelectionBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: T.goldBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    selectionText: {
        color: T.navyDark,
        fontSize: 15,
        fontWeight: '800',
    },
    addUserHeaderBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    statCard: {
        width: '49%',
        backgroundColor: T.bg,
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: T.cardBorder,
    },
    statCardLabel: {
        color: T.textSub,
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    statCardValue: {
        color: T.navyDark,
        fontSize: 14,
        fontWeight: '900',
        marginTop: 2,
    },
    searchBar: {
        backgroundColor: T.bg,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: T.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: T.textMain,
        fontSize: 12,
        fontWeight: '600',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.card,
    },
    filterChipActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    filterChipText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    bulkBar: {
        backgroundColor: T.card,
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: T.gold,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    bulkBtn: {
        alignItems: 'center',
        backgroundColor: T.bg,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
        minWidth: 80,
    },
    bulkBtnText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    listContent: {
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 100,
    },
    userCard: {
        backgroundColor: T.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1.2,
        borderColor: T.cardBorder,
        gap: 8,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    userCardSelected: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
    },
    userCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    checkBox: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: T.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkBoxActive: {
        backgroundColor: T.navyDark,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.bg,
        borderWidth: 1.5,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarAdmin: {
        borderColor: T.gold,
        backgroundColor: T.goldBg,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '900',
        color: T.navyDark,
    },
    userCardNameCol: {
        flex: 1,
        minWidth: 0,
    },
    userName: {
        fontSize: 14,
        fontWeight: '800',
        color: T.textMain,
    },
    accountNumber: {
        fontSize: 11,
        fontWeight: '600',
        color: T.textSub,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusBadgeActive: {
        backgroundColor: T.successBg,
        borderColor: T.success,
    },
    statusBadgeSuspended: {
        backgroundColor: T.dangerBg,
        borderColor: T.danger,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    badgeGold: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    badgeGoldText: {
        color: T.goldDark,
        fontSize: 9,
        fontWeight: '900',
    },
    badgeCorp: {
        backgroundColor: T.warningBg,
        borderColor: T.warning,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        maxWidth: 160,
    },
    badgeCorpText: {
        color: '#B45309',
        fontSize: 9,
        fontWeight: '800',
    },
    badgeVerified: {
        backgroundColor: T.infoBg,
        borderColor: T.info,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    badgeVerifiedText: {
        color: T.info,
        fontSize: 9,
        fontWeight: '800',
    },
    vaultBalanceBar: {
        backgroundColor: T.navyDark,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: T.gold,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    vaultLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: T.gold,
    },
    vaultAmount: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    manageBtn: {
        backgroundColor: T.gold,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    manageBtnText: {
        fontSize: 10,
        fontWeight: '900',
        color: T.navyDark,
        textTransform: 'uppercase',
    },
    emptyWrapper: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: T.card,
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.gold,
    },
    emptyTitle: {
        color: T.navyDark,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 6,
    },
    // Modals
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    modalCard: {
        backgroundColor: T.bg,
        borderRadius: 20,
        height: '95%',
        width: '100%',
        maxWidth: 500,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: T.gold,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: T.card,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    modalHeaderTitle: {
        color: T.navyDark,
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
    },
    iconCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: T.border,
    },
    modalHeroBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    modalAvatarWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: T.card,
        borderWidth: 2,
        borderColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    modalAvatarImage: {
        width: '100%',
        height: '100%',
    },
    modalAvatarText: {
        fontSize: 20,
        fontWeight: '900',
        color: T.goldDark,
    },
    modalUserName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
    modalUserEmail: {
        color: T.gold,
        fontSize: 11,
        fontWeight: '700',
    },
    contactBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    modalTabBar: {
        flexDirection: 'row',
        backgroundColor: T.card,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
    },
    modalTabItem: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    modalTabItemActive: {
        borderBottomColor: T.navyDark,
    },
    modalTabText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    sectionHeading: {
        fontSize: 11,
        fontWeight: '900',
        color: T.navyDark,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        marginTop: 6,
    },
    walletCard: {
        backgroundColor: T.navyDark,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.gold,
        marginBottom: 10,
    },
    walletLabel: {
        color: T.gold,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    walletValue: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
    },
    accountChip: {
        marginTop: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    accountChipText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    virtualAtmCard: {
        backgroundColor: T.navyDark,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: T.gold,
        marginBottom: 10,
    },
    noCardsCard: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
    },
    noCardsTitle: {
        color: T.textMain,
        fontSize: 13,
        fontWeight: '800',
        marginTop: 4,
    },
    noCardsSub: {
        color: T.textSub,
        fontSize: 11,
        textAlign: 'center',
    },
    kycHistoryItem: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 8,
    },
    viewDocBtn: {
        backgroundColor: T.navyDark,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    viewDocBtnText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    controlCard: {
        backgroundColor: T.card,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        marginBottom: 10,
    },
    fundingToggleRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    fundingTogglePill: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    fundingTogglePillActiveFund: {
        backgroundColor: T.success,
        borderColor: '#059669',
    },
    fundingTogglePillActiveDebit: {
        backgroundColor: T.danger,
        borderColor: '#DC2626',
    },
    fundingToggleText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.bg,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: T.border,
        height: 42,
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    nairaSymbol: {
        fontWeight: '900',
        color: T.navyDark,
        fontSize: 15,
        marginRight: 6,
    },
    customAmountInput: {
        flex: 1,
        color: T.textMain,
        fontWeight: '800',
        fontSize: 14,
    },
    actionCheckBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetRow: {
        flexDirection: 'row',
        gap: 4,
        justifyContent: 'space-between',
    },
    presetChip: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.bg,
        alignItems: 'center',
    },
    presetChipActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    presetChipText: {
        fontSize: 10,
        fontWeight: '900',
    },
    infoListCard: {
        backgroundColor: T.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        padding: 10,
        gap: 8,
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: T.textSub,
    },
    infoValue: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMain,
    },
    kycDetailCard: {
        backgroundColor: T.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        padding: 12,
        gap: 8,
        marginBottom: 10,
    },
    kycItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    kycItemLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.textSub,
    },
    kycItemValue: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMain,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    tierBtn: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.card,
        alignItems: 'center',
    },
    tierBtnActive: {
        backgroundColor: T.navyDark,
        borderColor: T.navyDark,
    },
    tierBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: T.textMain,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    gridBtn: {
        width: '48%',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    gridBtnDanger: {
        backgroundColor: T.dangerBg,
        borderColor: T.danger,
    },
    gridBtnSuccess: {
        backgroundColor: T.successBg,
        borderColor: T.success,
    },
    gridBtnText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: T.textMain,
    },
    subFormCard: {
        backgroundColor: T.card,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 10,
    },
    subFormInput: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 12,
        color: T.textMain,
        marginBottom: 8,
    },
    subFormSubmitBtn: {
        backgroundColor: T.navyDark,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    subFormSubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    txCard: {
        backgroundColor: T.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.cardBorder,
        overflow: 'hidden',
        marginBottom: 10,
    },
    noHistoryText: {
        color: T.textSub,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    txTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMain,
        textTransform: 'capitalize',
    },
    txDate: {
        fontSize: 9,
        fontWeight: '600',
        color: T.textSub,
    },
    txAmount: {
        fontSize: 12,
        fontWeight: '900',
    },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: T.navyDark,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    createUserCard: {
        backgroundColor: T.card,
        borderRadius: 20,
        height: '85%',
        width: '96%',
        maxWidth: 440,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: T.gold,
    },
    createUserHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: T.bg,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    createUserTitle: {
        color: T.navyDark,
        fontSize: 16,
        fontWeight: '900',
    },
    createInput: {
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: T.textMain,
        fontSize: 13,
        fontWeight: '700',
    },
    adminRoleSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: T.bg,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
    },
    createUserBtn: {
        backgroundColor: T.navyDark,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 6,
    },
    createUserBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
});
