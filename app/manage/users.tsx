import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, FlatList, Modal, Platform, Linking, Switch, Share, Image, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import SecurityModal from '../../components/SecurityModal';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Design Theme Tokens (Embedded CSS)
const T = {
    navyDark: '#0A1128',
    navyMid: '#111D3B',
    navyCard: '#1A2950',
    gold: '#D4AF37',
    goldDark: '#B8952B',
    goldLight: '#F5E8D0',
    goldBg: 'rgba(212,175,55,0.12)',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    textMain: '#0F172A',
    textSub: '#64748B',
    border: '#E2E8F0',
    success: '#10B981',
    successBg: '#ECFDF5',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    info: '#0284C7',
    infoBg: '#F0F9FF',
    indigo: '#6366F1',
    purple: '#9333EA',
    teal: '#0D9488',
};

// Define User Interface matching Schema
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
    admin_notes?: string;
    account_number?: string;
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
    corporate_email?: string | null;
}

interface Transaction {
    id: string;
    amount: number;
    type: string;
    status: string;
    created_at: string;
    description?: string;
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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState<'newest' | 'balance_high' | 'balance_low'>('newest');
    
    // Selection & Actions
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
    const [userLogs, setUserLogs] = useState<LoginLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const [showSecurity, setShowSecurity] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ 
        type: 'fund' | 'debit' | 'block' | 'promote' | 'reset_pin' | 'edit_profile' | 'notify' | 'kyc' | 'set_limit' | 'save_notes' | 'impersonate' | 'generate_account' | 'delete_user' | 'reset_tx_pin' | 'clear_device' | 'toggle_crypto' | 'toggle_cards', 
        amount?: number, 
        role?: string, 
        payload?: any 
    } | null>(null);
    
    // Fund/Debit Input
    const [fundAmount, setFundAmount] = useState('');
    const [isDebit, setIsDebit] = useState(false);

    // Edit Profile Loading
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

    // Notification Input
    const [notifyMessage, setNotifyMessage] = useState('');
    const [showNotifyInput, setShowNotifyInput] = useState(false);
    const [showGenerateAccount, setShowGenerateAccount] = useState(false);
    const [bvnInput, setBvnInput] = useState('');

    // Governance Inputs
    const [limitInput, setLimitInput] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    // Bulk Selection & Modern UI
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Create User State
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

    // AI & Polish
    const [aiInsight, setAiInsight] = useState<{ risk: 'Low' | 'Medium' | 'High', loyalty: 'Bronze' | 'Silver' | 'Gold', nextAction: string } | null>(null);

    // Stats
    const stats = {
        totalUsers: users.length,
        totalBalance: users.reduce((acc, u) => acc + (u.balance || u.credit_balance || 0), 0),
        activeUsers: users.filter(u => u.status === 'active').length,
        verifiedUsers: users.filter(u => u.kyc_verified).length
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

    const runSmartScan = (user: UserProfile) => {
        const balance = user.balance || user.credit_balance || 0;
        const risk = user.status === 'suspended' ? 'High' : (balance > 1000000 ? 'Medium' : 'Low');
        const loyalty = balance > 500000 ? 'Gold' : (balance > 50000 ? 'Silver' : 'Bronze');
        let next = 'None';
        if (risk === 'High') next = 'Review Activity';
        else if (loyalty === 'Gold') next = 'Send Reward';
        else if (!user.kyc_verified) next = 'Request KYC';

        setAiInsight({ risk, loyalty, nextAction: next });
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
            runSmartScan(selectedUser);
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
            setIsEditing(false);
            setShowNotifyInput(false);
        }
    }, [selectedUser]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            await supabase
                .from('profiles')
                .update({ status: 'inactive' })
                .eq('status', 'active')
                .lt('last_login', sevenDaysAgo);

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
                corporate_email: corpMap.get(u.id) || (u.email?.endsWith('@abumafhal.com.ng') ? u.email : null)
            }));
            setUsers(enrichedData);
        } catch (error: any) {
            Alert.alert('Error Fetching Users', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserHistory = async (userId: string) => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);
            
            if (!error && data) {
                setUserTransactions(data);
            } else {
                setUserTransactions([]);
            }
        } catch (error) {
            setUserTransactions([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const generateForensics = (userId: string) => {
        const devices = ['iPhone 15 Pro', 'Samsung S24 Ultra', 'Windows PC', 'MacBook Air M3'];
        const locations = ['Kano, NG', 'Abuja, NG', 'Lagos, NG', 'Kaduna, NG'];
        const logs: LoginLog[] = Array.from({ length: 3 }).map((_, i) => ({
            id: `log-${i}`,
            device: devices[Math.floor(Math.random() * devices.length)],
            ip: `102.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            location: locations[Math.floor(Math.random() * locations.length)],
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString()
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
                                  u.custom_id?.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = filterStatus === 'all' ? true : u.status === filterStatus;
            return matchesSearch && matchesStatus;
        });

        if (sortBy === 'newest') {
            result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        } else if (sortBy === 'balance_high') {
            result.sort((a, b) => (b.credit_balance || 0) - (a.credit_balance || 0));
        } else if (sortBy === 'balance_low') {
            result.sort((a, b) => (a.credit_balance || 0) - (b.credit_balance || 0));
        }

        return result;
    };

    const executeAction = async () => {
        if (!selectedUser || !pendingAction) return;
        
        try {
            if (pendingAction.type === 'fund' || pendingAction.type === 'debit') {
                const amount = pendingAction.type === 'fund' ? Number(pendingAction.amount) : -Number(pendingAction.amount);
                const currentBalance = Number(selectedUser.balance) || Number(selectedUser.credit_balance) || 0;
                const newBalance = currentBalance + amount;
                
                const { error } = await supabase.from('profiles').update({ 
                    balance: newBalance,
                    credit_balance: newBalance 
                }).eq('id', selectedUser.id);

                if (error) throw error;
                
                await supabase.from('transactions').insert({
                    user_id: selectedUser.id,
                    type: pendingAction.type === 'fund' ? 'topup' : 'withdrawal',
                    title: `Admin Wallet ${pendingAction.type === 'fund' ? 'Credit' : 'Debit'}`,
                    amount: Math.abs(amount),
                    status: 'completed',
                    description: `Admin Wallet ${pendingAction.type === 'fund' ? 'Funding' : 'Debit'}`,
                    reference: `admin_${pendingAction.type}_${Date.now()}`
                });
                
                Alert.alert("Wallet Updated 🎉", amount > 0 ? `Funded ₦${amount.toLocaleString()} to user wallet!` : `Debited ₦${Math.abs(amount).toLocaleString()} from user wallet!`);
                setSelectedUser({ ...selectedUser, balance: newBalance, credit_balance: newBalance });
                setFundAmount('');
                fetchUsers();
            }
            else if (pendingAction.type === 'block') {
                const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
                const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Updated", `User status is now ${newStatus.toUpperCase()}`);
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
            else if (pendingAction.type === 'generate_account') {
                const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                    body: { userId: selectedUser.id, bvn: bvnInput }
                });
                
                if (error) throw new Error(error.message || "Failed to generate account");
                if (data?.error) throw new Error(data.error);

                Alert.alert("Success", "Virtual account generated successfully!");
                setShowGenerateAccount(false);
                setBvnInput('');
                
                const { data: updatedProfile } = await supabase.from('profiles').select('account_number').eq('id', selectedUser.id).single();
                if (updatedProfile) {
                    setSelectedUser({ ...selectedUser, account_number: updatedProfile.account_number });
                }
            }
            else if (pendingAction.type === 'delete_user') {
                await handleDeleteUser();
            }
            else if (pendingAction.type === 'reset_tx_pin') {
                const { error } = await supabase.from('profiles').update({ transaction_pin: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Transaction PIN Reset", `Transaction PIN for ${selectedUser.full_name} has been cleared.`);
            }
            else if (pendingAction.type === 'clear_device') {
                const { error } = await supabase.from('profiles').update({ push_token: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Device Cleared", `Push token/device unlinked from ${selectedUser.full_name}.`);
            }
            else if (pendingAction.type === 'impersonate') {
                 Alert.alert("Impersonating", `Switching view to ${selectedUser.full_name}... (Simulation)`);
            }

            fetchUsers();
            if (['edit_profile', 'notify', 'kyc', 'set_limit', 'save_notes'].includes(pendingAction.type)) {
                 if (pendingAction.type === 'edit_profile' && selectedUser) setSelectedUser({ ...selectedUser, ...editForm, kyc_tier: parseInt(editForm.kyc_tier) || 1 });
            } else {
                 setSelectedUser(null);
            }
            
            setPendingAction(null);
            setFundAmount('');
            setIsDebit(false);
        } catch (e: any) {
            Alert.alert("Action Error", e.message || "An unexpected error occurred.");
            setPendingAction(null);
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

    const initiateFundOrDebit = () => {
        if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid positive number");
            return;
        }
        let amount = Number(fundAmount);
        
        setPendingAction({ type: isDebit ? 'debit' : 'fund', amount: amount });
        setShowSecurity(true);
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

    const initiateResetTxPin = () => {
        setPendingAction({ type: 'reset_tx_pin' });
        Alert.alert("Reset Tx PIN", `Are you sure you want to reset Transaction PIN for ${selectedUser?.full_name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateClearDevice = () => {
        setPendingAction({ type: 'clear_device' });
        Alert.alert("Clear Device", `This will unlink current device (Push Token) from ${selectedUser?.full_name}'s account. Continue?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateDelete = () => {
        setPendingAction({ type: 'delete_user' });
        Alert.alert("Delete User", `Are you sure you want to PERMANENTLY delete ${selectedUser?.full_name}? This action cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive', onPress: () => setShowSecurity(true) }
        ]);
    };

    const toggleKyc = () => {
        setPendingAction({ type: 'kyc' });
        setShowSecurity(true);
    };

    const saveProfileChanges = () => {
        setPendingAction({ type: 'edit_profile' });
        setShowSecurity(true);
    };

    const sendNotification = () => {
        if (!notifyMessage.trim()) return;
        Alert.alert("Send Message", "Send this notification directly to the user?", [
            { text: "Cancel" },
            { text: "Send", onPress: () => { 
                setPendingAction({ type: 'notify' }); 
                setTimeout(executeAction, 100); 
            }}
        ]);
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
- Account: ${selectedUser.account_number || 'N/A'}
- Limit: ${selectedUser.transfer_limit ? '₦'+selectedUser.transfer_limit : 'Unlimited'}

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

    // User Profile Modal Render
    const renderUserModal = () => (
        <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={s.modalOverlay}>
                <View style={s.modalCard}>
                    
                    {/* Header Controls (Navy) */}
                    <View style={s.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedUser(null)} style={s.iconCircleBtn}>
                            <Ionicons name="close" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <Text style={s.modalHeaderTitle}>User Profile</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={exportProfile} style={s.iconCircleBtn}>
                                <Ionicons name="share-outline" size={16} color={T.gold} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[s.iconCircleBtn, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
                                <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color={T.gold} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        {/* Profile Banner */}
                        <LinearGradient colors={[T.navyMid, T.navyDark]} style={s.modalHeroBanner}>
                            <View style={s.modalAvatarWrapper}>
                                {selectedUser?.avatar_url ? (
                                    <Image source={{ uri: selectedUser.avatar_url }} style={s.modalAvatarImage} resizeMode="cover" />
                                ) : (
                                    <Text style={s.modalAvatarText}>{selectedUser?.full_name?.charAt(0).toUpperCase()}</Text>
                                )}
                            </View>
                            <View style={{ marginLeft: 14, flex: 1 }}>
                                <Text style={s.modalUserName} numberOfLines={1}>{selectedUser?.full_name}</Text>
                                <Text style={s.modalUserEmail} numberOfLines={1}>{selectedUser?.email}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <View style={[s.statusBadge, selectedUser?.status === 'active' ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                        <Text style={[s.statusBadgeText, selectedUser?.status === 'active' ? { color: '#34D399' } : { color: '#F87171' }]}>{selectedUser?.status}</Text>
                                    </View>
                                    {selectedUser?.kyc_verified && (
                                        <View style={s.kycBadge}>
                                            <Ionicons name="shield-checkmark" size={10} color="#60A5FA" />
                                            <Text style={s.kycBadgeText}>Verified</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => contactUser('call')} style={s.contactBtn}>
                                <Ionicons name="call" size={16} color="#E2E8F0" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => contactUser('whatsapp')} style={[s.contactBtn, { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: T.success }]}>
                                <Ionicons name="logo-whatsapp" size={18} color={T.success} />
                            </TouchableOpacity>
                        </LinearGradient>

                        {isEditing ? (
                            <View style={{ padding: 16, gap: 12 }}>
                                <Text style={s.sectionHeading}>Edit Profile Details</Text>
                                <View style={s.formRow}>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>Full Name</Text>
                                        <TextInput value={editForm.full_name} onChangeText={(t) => setEditForm({...editForm, full_name: t})} style={s.formInput} />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>Username</Text>
                                        <TextInput value={editForm.username} onChangeText={(t) => setEditForm({...editForm, username: t})} style={s.formInput} />
                                    </View>
                                </View>
                                <View style={s.formRow}>
                                    <View style={[s.formCol, { flex: 1.5 }]}>
                                        <Text style={s.fieldLabel}>Phone</Text>
                                        <TextInput value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} style={s.formInput} keyboardType="phone-pad" />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>Gender</Text>
                                        <TextInput value={editForm.gender} onChangeText={(t) => setEditForm({...editForm, gender: t})} style={s.formInput} />
                                    </View>
                                </View>
                                <View style={s.formRow}>
                                    <View style={[s.formCol, { flex: 2 }]}>
                                        <Text style={s.fieldLabel}>Address</Text>
                                        <TextInput value={editForm.address} onChangeText={(t) => setEditForm({...editForm, address: t})} style={s.formInput} />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>State</Text>
                                        <TextInput value={editForm.state} onChangeText={(t) => setEditForm({...editForm, state: t})} style={s.formInput} />
                                    </View>
                                </View>
                                <View style={s.formRow}>
                                    <View style={[s.formCol, { flex: 1.5 }]}>
                                        <Text style={s.fieldLabel}>Email</Text>
                                        <TextInput value={editForm.email} onChangeText={(t) => setEditForm({...editForm, email: t})} style={s.formInput} keyboardType="email-address" />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>DOB</Text>
                                        <TextInput placeholder="YYYY-MM-DD" value={editForm.dob} onChangeText={(t) => setEditForm({...editForm, dob: t})} style={s.formInput} />
                                    </View>
                                </View>
                                <Text style={s.sectionHeading}>Next of Kin</Text>
                                <View style={s.formRow}>
                                    <View style={s.formCol}>
                                        <TextInput placeholder="Name" value={editForm.next_of_kin_name} onChangeText={(t) => setEditForm({...editForm, next_of_kin_name: t})} style={s.formInput} />
                                    </View>
                                    <View style={s.formCol}>
                                        <TextInput placeholder="Phone" value={editForm.next_of_kin_phone} onChangeText={(t) => setEditForm({...editForm, next_of_kin_phone: t})} style={s.formInput} keyboardType="phone-pad" />
                                    </View>
                                </View>
                                <Text style={s.sectionHeading}>Admin Controls (Identity & KYC)</Text>
                                <View style={s.formRow}>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>BVN</Text>
                                        <TextInput value={editForm.bvn} onChangeText={(t) => setEditForm({...editForm, bvn: t})} style={s.formInput} keyboardType="numeric" />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>NIN</Text>
                                        <TextInput value={editForm.nin} onChangeText={(t) => setEditForm({...editForm, nin: t})} style={s.formInput} keyboardType="numeric" />
                                    </View>
                                </View>
                                <View style={s.formRow}>
                                    <View style={[s.formCol, { flex: 1.5 }]}>
                                        <Text style={s.fieldLabel}>Custom ID</Text>
                                        <TextInput value={editForm.custom_id} onChangeText={(t) => setEditForm({...editForm, custom_id: t})} style={s.formInput} />
                                    </View>
                                    <View style={s.formCol}>
                                        <Text style={s.fieldLabel}>KYC Tier (1-3)</Text>
                                        <TextInput value={editForm.kyc_tier} onChangeText={(t) => setEditForm({...editForm, kyc_tier: t})} style={s.formInput} keyboardType="numeric" />
                                    </View>
                                </View>
                                <TouchableOpacity onPress={saveProfileChanges} style={s.saveBtn}>
                                    <Text style={s.saveBtnText}>Save Changes</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ padding: 16 }}>
                                {/* Metrics Cards */}
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <View style={s.walletCard}>
                                        <Text style={s.walletLabel}>Wallet Balance</Text>
                                        <Text style={s.walletValue}>₦{(selectedUser?.balance || 0).toLocaleString()}</Text>
                                        <View style={s.accountChip}>
                                            <Ionicons name="card" size={12} color="#E2E8F0" />
                                            <Text style={s.accountChipText}>{selectedUser?.account_number || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    {aiInsight && (
                                        <View style={s.aiInsightCard}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={s.aiTitle}>AI Scan</Text>
                                                <Ionicons name="sparkles" size={14} color={T.gold} />
                                            </View>
                                            <Text style={[s.aiRisk, aiInsight.risk === 'High' ? { color: T.danger } : { color: T.success }]}>{aiInsight.risk} Risk</Text>
                                            <Text style={s.aiNextAction} numberOfLines={2}>{aiInsight.nextAction}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Admin Financial Control */}
                                <View style={s.controlCard}>
                                    <View style={s.switchRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Switch 
                                                value={isDebit} 
                                                onValueChange={setIsDebit}
                                                trackColor={{ false: T.success, true: T.danger }}
                                                thumbColor="#fff"
                                            />
                                            <Text style={[s.switchLabel, isDebit ? { color: T.danger } : { color: T.success }]}>
                                                {isDebit ? 'Debit Wallet' : 'Fund Wallet'}
                                            </Text>
                                        </View>
                                        <View style={s.customAmountInputWrapper}>
                                            <Text style={s.nairaSymbol}>₦</Text>
                                            <TextInput 
                                                placeholder="Custom Amt" 
                                                keyboardType="numeric"
                                                style={s.customAmountInput}
                                                value={fundAmount}
                                                onChangeText={setFundAmount}
                                            />
                                        </View>
                                        <TouchableOpacity onPress={initiateFundOrDebit} style={[s.actionCheckBtn, isDebit ? { backgroundColor: T.danger } : { backgroundColor: T.success }]}>
                                            <Ionicons name="checkmark-done" size={16} color="white" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Presets */}
                                    <View style={s.presetRow}>
                                        {['5000', '10000', '25000', '50000', '100000'].map(val => (
                                            <TouchableOpacity
                                                key={val}
                                                onPress={() => {
                                                    setFundAmount(val);
                                                    setIsDebit(false);
                                                }}
                                                style={[s.presetChip, fundAmount === val ? s.presetChipActive : null]}
                                            >
                                                <Text style={[s.presetChipText, fundAmount === val ? { color: T.gold } : null]}>+₦{Number(val)/1000}k</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Limits & Private Notes */}
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <View style={s.limitCard}>
                                        <Text style={s.limitTitle}>Daily Limit (₦)</Text>
                                        <TextInput 
                                            placeholder="No Limit" 
                                            keyboardType="numeric"
                                            style={s.limitInput}
                                            value={limitInput}
                                            onChangeText={setLimitInput}
                                            onBlur={() => {
                                                if (limitInput !== (selectedUser?.transfer_limit?.toString() || '')) {
                                                   setPendingAction({ type: 'set_limit' });
                                                   setShowSecurity(true);
                                                }
                                            }}
                                        />
                                    </View>
                                    <View style={s.notesCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={s.notesTitle}>Private Notes</Text>
                                            <Ionicons name="lock-closed" size={12} color="#D97706" />
                                        </View>
                                        <TextInput 
                                            placeholder="Add private notes..." 
                                            multiline
                                            style={s.notesInput}
                                            value={adminNotes}
                                            onChangeText={setAdminNotes}
                                            onBlur={() => {
                                                if (adminNotes !== (selectedUser?.admin_notes || '')) {
                                                    setPendingAction({ type: 'save_notes' });
                                                    executeAction(); 
                                                }
                                            }}
                                        />
                                    </View>
                                </View>

                                {/* Quick Actions Grid */}
                                <Text style={s.sectionHeading}>Admin Controls & Feature Toggles</Text>
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
                                            {selectedUser?.role === 'super_admin' ? 'Super Admin 👑' : selectedUser?.role === 'admin' ? 'Admin 🛡️' : 'Make Admin 👑'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            setPendingAction({ type: 'toggle_crypto' });
                                            executeAction();
                                        }} 
                                        style={[s.gridBtn, (selectedUser?.crypto_enabled ?? true) ? { backgroundColor: T.warningBg, borderColor: T.warning } : { backgroundColor: '#F1F5F9', borderColor: T.border }]}
                                    >
                                        <Ionicons name="logo-bitcoin" size={16} color={(selectedUser?.crypto_enabled ?? true) ? T.warning : T.textSub} />
                                        <Text style={[s.gridBtnText, (selectedUser?.crypto_enabled ?? true) ? { color: '#B45309' } : { color: T.textSub }]}>
                                            Crypto: {(selectedUser?.crypto_enabled ?? true) ? 'ON 🪙' : 'OFF 🚫'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            setPendingAction({ type: 'toggle_cards' });
                                            executeAction();
                                        }} 
                                        style={[s.gridBtn, (selectedUser?.virtual_cards_enabled ?? true) ? { backgroundColor: '#EEF2FF', borderColor: '#818CF8' } : { backgroundColor: '#F1F5F9', borderColor: T.border }]}
                                    >
                                        <Ionicons name="card-outline" size={16} color={(selectedUser?.virtual_cards_enabled ?? true) ? T.indigo : T.textSub} />
                                        <Text style={[s.gridBtnText, (selectedUser?.virtual_cards_enabled ?? true) ? { color: '#3730A3' } : { color: T.textSub }]}>
                                            Cards: {(selectedUser?.virtual_cards_enabled ?? true) ? 'ON 💳' : 'OFF 🚫'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetPin} style={s.gridBtn}>
                                        <MaterialCommunityIcons name="lock-reset" size={16} color={T.textSub} />
                                        <Text style={s.gridBtnText}>Reset PIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => { setPendingAction({ type: 'impersonate' }); setShowSecurity(true); }} style={[s.gridBtn, { backgroundColor: '#F3E8FF', borderColor: '#C084FC' }]}>
                                        <MaterialCommunityIcons name="incognito" size={16} color={T.purple} />
                                        <Text style={[s.gridBtnText, { color: T.purple }]}>View As</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={toggleKyc} style={[s.gridBtn, { backgroundColor: T.infoBg, borderColor: T.info }]}>
                                        <Ionicons name={selectedUser?.kyc_verified ? "checkmark-done-circle" : "shield-checkmark-outline"} size={16} color={T.info} />
                                        <Text style={[s.gridBtnText, { color: T.info }]}>{selectedUser?.kyc_verified ? 'Revoke KYC' : 'Verify KYC'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => copyToClipboard(selectedUser?.id || '', 'User ID')} style={s.gridBtn}>
                                        <Ionicons name="copy-outline" size={16} color={T.textSub} />
                                        <Text style={s.gridBtnText}>Copy ID</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowNotifyInput(!showNotifyInput)} style={[s.gridBtn, { backgroundColor: '#EEF2FF', borderColor: T.indigo }]}>
                                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={T.indigo} />
                                        <Text style={[s.gridBtnText, { color: T.indigo }]}>Message</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateDelete} style={[s.gridBtn, { backgroundColor: T.dangerBg, borderColor: T.danger }]}>
                                        <Ionicons name="trash-outline" size={16} color={T.danger} />
                                        <Text style={[s.gridBtnText, { color: T.danger }]}>Delete</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowGenerateAccount(!showGenerateAccount)} style={[s.gridBtn, { backgroundColor: '#F0FDFA', borderColor: T.teal }]}>
                                        <Ionicons name="card-outline" size={16} color={T.teal} />
                                        <Text style={[s.gridBtnText, { color: T.teal }]}>Gen Account</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetTxPin} style={[s.gridBtn, { backgroundColor: '#FFF7ED', borderColor: '#F97316' }]}>
                                        <Ionicons name="keypad" size={16} color="#EA580C" />
                                        <Text style={[s.gridBtnText, { color: '#C2410C' }]}>Reset Tx PIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateClearDevice} style={s.gridBtn}>
                                        <Ionicons name="hardware-chip-outline" size={16} color={T.textSub} />
                                        <Text style={s.gridBtnText}>Unlink Device</Text>
                                    </TouchableOpacity>
                                </View>

                                {showGenerateAccount && (
                                    <View style={s.subFormCard}>
                                        <Text style={[s.sectionHeading, { color: T.teal }]}>Generate Virtual Account (KYC)</Text>
                                        <TextInput
                                            placeholder="Enter BVN/NIN (Optional if in DB)"
                                            style={s.subFormInput}
                                            value={bvnInput}
                                            onChangeText={setBvnInput}
                                            keyboardType="numeric"
                                        />
                                        <TouchableOpacity onPress={() => { setPendingAction({ type: 'generate_account' }); setShowSecurity(true); }} style={[s.subFormSubmitBtn, { backgroundColor: T.teal }]}>
                                            <Text style={s.subFormSubmitBtnText}>Generate Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showNotifyInput && (
                                    <View style={[s.subFormCard, { backgroundColor: '#EEF2FF', borderColor: T.indigo }]}>
                                        <Text style={[s.sectionHeading, { color: T.indigo }]}>Send Push Notification</Text>
                                        <TextInput
                                            placeholder="Type message here..."
                                            multiline
                                            style={[s.subFormInput, { minHeight: 60 }]}
                                            value={notifyMessage}
                                            onChangeText={setNotifyMessage}
                                        />
                                        <TouchableOpacity onPress={sendNotification} style={[s.subFormSubmitBtn, { backgroundColor: T.indigo }]}>
                                            <Text style={s.subFormSubmitBtnText}>Send Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Compact Transactions */}
                                <Text style={s.sectionHeading}>Recent Transactions</Text>
                                <View style={s.txCard}>
                                    {loadingHistory ? (
                                        <View style={{ paddingVertical: 16, alignItems: 'center' }}><ActivityIndicator color={T.gold} size="small" /></View>
                                    ) : userTransactions.length === 0 ? (
                                        <View style={{ padding: 16, alignItems: 'center' }}>
                                            <Text style={s.noHistoryText}>No transaction history</Text>
                                        </View>
                                    ) : (
                                        userTransactions.slice(0,3).map((tx, i) => (
                                            <View key={tx.id} style={[s.txRow, i !== Math.min(userTransactions.length, 3) - 1 ? { borderBottomWidth: 1, borderBottomColor: T.border } : null]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <View style={[s.txIconWrapper, tx.type === 'topup' ? { backgroundColor: T.successBg } : { backgroundColor: '#F1F5F9' }]}>
                                                        <Ionicons name={tx.type === 'topup' ? 'arrow-down' : 'arrow-up'} size={12} color={tx.type === 'topup' ? T.success : T.textSub} />
                                                    </View>
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

    // Create User Modal Render
    const renderCreateUserModal = () => (
        <Modal visible={showCreateUser} transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
            <BlurView intensity={90} tint="dark" style={s.modalOverlay}>
                 <View style={s.createUserCard}>
                    <View style={s.createUserHeader}>
                        <Text style={s.createUserTitle}>Create User Account</Text>
                        <TouchableOpacity onPress={() => setShowCreateUser(false)} style={s.iconCircleBtn}>
                            <Ionicons name="close" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        <View style={{ gap: 14 }}>
                            <View>
                                <Text style={s.fieldLabel}>Full Name</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="e.g. John Doe"
                                    placeholderTextColor="#94A3B8"
                                    value={newUserForm.fullName}
                                    onChangeText={t => setNewUserForm({...newUserForm, fullName: t})}
                                />
                            </View>
                             <View>
                                <Text style={s.fieldLabel}>Username</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="e.g. johndoe123"
                                    placeholderTextColor="#94A3B8"
                                    value={newUserForm.username}
                                    onChangeText={t => setNewUserForm({...newUserForm, username: t})}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View>
                                <Text style={s.fieldLabel}>Email Address</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="john@example.com"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={newUserForm.email}
                                    onChangeText={t => setNewUserForm({...newUserForm, email: t})}
                                />
                            </View>
                             <View>
                                <Text style={s.fieldLabel}>Phone (Optional)</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="+234..."
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={newUserForm.phone}
                                    onChangeText={t => setNewUserForm({...newUserForm, phone: t})}
                                />
                            </View>
                            
                             <View style={s.formRow}>
                                <View style={s.formCol}>
                                    <Text style={s.fieldLabel}>Gender</Text>
                                    <TextInput 
                                        style={s.createInput}
                                        placeholder="M/F"
                                        placeholderTextColor="#94A3B8"
                                        value={newUserForm.gender}
                                        onChangeText={t => setNewUserForm({...newUserForm, gender: t})}
                                    />
                                </View>
                                <View style={s.formCol}>
                                    <Text style={s.fieldLabel}>DOB</Text>
                                    <TextInput 
                                        style={s.createInput}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor="#94A3B8"
                                        value={newUserForm.dob}
                                        onChangeText={t => setNewUserForm({...newUserForm, dob: t})}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text style={s.fieldLabel}>Initial Password</Text>
                                 <TextInput 
                                    style={s.createInput}
                                    value={newUserForm.password}
                                    onChangeText={t => setNewUserForm({...newUserForm, password: t})}
                                    secureTextEntry
                                />
                                 <Text style={s.fieldSubNote}>User can update password after first login.</Text>
                            </View>
                            
                             <View style={s.adminRoleSwitchRow}>
                                 <View>
                                    <Text style={{ fontWeight: '700', color: '#F8FAFC', fontSize: 14 }}>Admin Privileges</Text>
                                    <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Grant full manager dashboard access</Text>
                                 </View>
                                 <Switch 
                                    value={newUserForm.role === 'admin'}
                                    onValueChange={(val) => setNewUserForm({...newUserForm, role: val ? 'admin' : 'user'})}
                                    trackColor={{ false: "#475569", true: T.indigo }}
                                    thumbColor="#fff"
                                 />
                            </View>

                            <TouchableOpacity 
                                onPress={handleCreateUser}
                                disabled={creatingUser}
                                style={[s.createUserBtn, creatingUser ? { backgroundColor: '#818CF8' } : null]}
                            >
                                {creatingUser ? (
                                    <ActivityIndicator color="white" />
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

            {/* Header Command Center */}
            <View style={s.headerContainer}>
                <LinearGradient colors={[T.navyDark, T.navyMid, T.navyCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerGradient}>
                    {/* Top Bar */}
                    <View style={s.headerTopRow}>
                        {isSelectionMode ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} style={s.closeSelectionBtn}>
                                    <Ionicons name="close" size={16} color="white" />
                                </TouchableOpacity>
                                <Text style={s.selectionText}>{selectedIds.size} Selected</Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={s.headerTitle}>User Manager</Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => setShowCreateUser(true)} style={s.addUserHeaderBtn}>
                                <Ionicons name="person-add" size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Row */}
                    {!isSelectionMode && (
                        <View style={s.statsRow}>
                            <View style={s.statBox}>
                                <View style={[s.statIcon, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                                    <Ionicons name="wallet" size={12} color={T.success} />
                                </View>
                                <View>
                                    <Text style={s.statLabel}>Vault</Text>
                                    <Text style={s.statValue}>₦{stats.totalBalance > 1000000 ? (stats.totalBalance/1000000).toFixed(1)+'M' : stats.totalBalance.toLocaleString()}</Text>
                                </View>
                            </View>
                            <View style={s.statBox}>
                                <View style={[s.statIcon, { backgroundColor: 'rgba(96,165,250,0.2)' }]}>
                                    <Ionicons name="people" size={12} color="#60A5FA" />
                                </View>
                                <View>
                                    <Text style={s.statLabel}>Active</Text>
                                    <Text style={s.statValue}>{stats.activeUsers}</Text>
                                </View>
                            </View>
                            <View style={s.statBox}>
                                <View style={[s.statIcon, { backgroundColor: 'rgba(192,132,252,0.2)' }]}>
                                    <Ionicons name="shield-checkmark" size={12} color="#C084FC" />
                                </View>
                                <View>
                                    <Text style={s.statLabel}>KYC</Text>
                                    <Text style={s.statValue}>{stats.verifiedUsers}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Search & Filter Bar */}
                    <View>
                        <View style={s.searchBar}>
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                placeholder="Search users..."
                                placeholderTextColor="#64748B"
                                style={s.searchInput}
                                value={search}
                                onChangeText={handleSearch}
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <View style={s.filterRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 8 }}>
                                {['all', 'active', 'suspended'].map((status) => (
                                    <TouchableOpacity 
                                        key={status} 
                                        onPress={() => setFilterStatus(status)}
                                        style={[s.filterChip, filterStatus === status ? s.filterChipActive : null]}
                                    >
                                        <Text style={[s.filterChipText, filterStatus === status ? { color: T.navyDark } : { color: '#94A3B8' }]}>
                                            {status}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TouchableOpacity 
                                onPress={() => {
                                    if (sortBy === 'newest') setSortBy('balance_high');
                                    else if (sortBy === 'balance_high') setSortBy('balance_low');
                                    else setSortBy('newest');
                                }}
                                style={s.sortBtn}
                            >
                                <Ionicons name="filter" size={12} color="#CBD5E1" style={{ marginRight: 4 }} />
                                <Text style={s.sortBtnText}>
                                    {sortBy === 'newest' ? 'New' : (sortBy === 'balance_high' ? 'High' : 'Low')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Bulk Action Sticky Bar */}
            {isSelectionMode && (
                <View style={s.bulkBar}>
                    <TouchableOpacity onPress={() => executeBulkAction('block')} style={s.bulkBtn}>
                         <Ionicons name="ban" size={20} color={T.danger} />
                        <Text style={[s.bulkBtnText, { color: T.danger }]}>Suspend</Text>
                    </TouchableOpacity>
                     <TouchableOpacity onPress={() => executeBulkAction('unblock')} style={s.bulkBtn}>
                         <Ionicons name="checkmark-circle" size={20} color={T.success} />
                        <Text style={[s.bulkBtnText, { color: T.success }]}>Activate</Text>
                    </TouchableOpacity>
                     <TouchableOpacity onPress={() => executeBulkAction('verify')} style={s.bulkBtn}>
                         <Ionicons name="shield-checkmark" size={20} color={T.info} />
                        <Text style={[s.bulkBtnText, { color: T.info }]}>Verify</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* User List */}
            <FlatList
                data={getFilteredUsers()}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.listContent}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor={T.gold} 
                        colors={[T.gold]} 
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        onPress={() => isSelectionMode ? toggleSelection(item.id) : setSelectedUser(item)}
                        onLongPress={() => handleLongPress(item.id)}
                        style={[s.userCard, selectedIds.has(item.id) ? s.userCardSelected : null]}
                    >
                        {isSelectionMode && (
                            <View style={[s.checkBox, selectedIds.has(item.id) ? s.checkBoxActive : null]}>
                                {selectedIds.has(item.id) && <Ionicons name="checkmark" size={12} color="white" />}
                            </View>
                        )}

                        <View style={s.userCardContent}>
                            <View style={[s.avatar, item.role === 'admin' ? s.avatarAdmin : null]}>
                                {item.avatar_url ? (
                                    <Image source={{ uri: item.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                ) : (
                                    <Text style={[s.avatarText, item.role === 'admin' ? { color: T.goldDark } : null]}>
                                        {item.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.userName} numberOfLines={1}>
                                    {item.full_name || 'Unknown User'}
                                </Text>
                                <View style={s.userSubRow}>
                                    <Text style={s.accountNumber}>
                                        {item.account_number || 'No Account'}
                                    </Text>
                                    {(item.phone || item.email) && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <View style={s.dotDivider} />
                                            <Ionicons name={item.phone ? "call" : "mail"} size={10} color={T.textSub} />
                                            <Text style={s.contactInfo} numberOfLines={1}>
                                                {item.phone || item.email}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={s.badgesRow}>
                                    <View style={[s.badge, item.status === 'active' ? s.badgeSuccess : s.badgeDanger]}>
                                         <Text style={[s.badgeText, item.status === 'active' ? { color: '#047857' } : { color: '#B91C1C' }]}>
                                            {item.status}
                                         </Text>
                                    </View>
                                    {item.role === 'admin' && (
                                        <View style={[s.badge, s.badgeGold]}>
                                            <Text style={[s.badgeText, { color: '#B45309' }]}>ADMIN</Text>
                                        </View>
                                    )}
                                    {item.corporate_email && (
                                        <View style={[s.badge, { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }]}>
                                            <Ionicons name="at-circle" size={10} color="#D97706" />
                                            <Text style={[s.badgeText, { color: '#B45309', marginLeft: 2 }]}>{item.corporate_email}</Text>
                                        </View>
                                    )}
                                    {item.kyc_verified && (
                                        <View style={[s.badge, s.badgeInfo]}>
                                            <Ionicons name="shield-checkmark" size={10} color={T.info} />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        
                        <View style={s.userCardRight}>
                            <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                                <Text style={s.balLabel}>Vault Bal</Text>
                                <Text style={s.balAmount}>₦{(item.balance || item.credit_balance || 0).toLocaleString()}</Text>
                            </View>
                            <View style={s.chevronCircle}>
                                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={s.emptyWrapper}>
                        {loading ? (
                            <View style={{ paddingHorizontal: 8 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <View key={i} style={s.skeletonRow}>
                                        <View style={s.skeletonAvatar} />
                                        <View style={{ flex: 1, gap: 6 }}>
                                            <View style={s.skeletonTextLine1} />
                                            <View style={s.skeletonTextLine2} />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={s.emptyCard}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="people-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text style={s.emptyTitle}>No Users Found</Text>
                                <Text style={s.emptySubText}>Try adjusting your filters or searching with different terms.</Text>
                            </View>
                        )}
                    </View>
                }
            />
            
            {/* Details Modal */}
            {renderUserModal()}
            {renderCreateUserModal()}

            {/* Security Check Modal */}
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

// Embedded StyleSheet (CSS for Manager Users Screen)
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    headerContainer: {
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    headerGradient: {
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    closeSelectionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    selectionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    addUserHeaderBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212,175,55,0.25)',
        borderWidth: 1,
        borderColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 6,
    },
    statBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    statIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    searchBar: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        marginRight: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    filterChipActive: {
        backgroundColor: T.gold,
        borderColor: T.goldDark,
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    sortBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
    },
    sortBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    bulkBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: T.border,
        flexDirection: 'row',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 10,
    },
    bulkBtn: {
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: T.border,
        minWidth: 90,
    },
    bulkBtnText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 140,
    },
    userCard: {
        backgroundColor: T.card,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: T.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    checkBox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: T.textSub,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkBoxActive: {
        backgroundColor: T.gold,
        borderColor: T.goldDark,
    },
    userCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarAdmin: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '900',
        color: T.textMain,
    },
    userName: {
        fontSize: 14,
        fontWeight: '800',
        color: T.textMain,
        marginBottom: 2,
    },
    userSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    accountNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: T.textSub,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    dotDivider: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: T.textSub,
    },
    contactInfo: {
        fontSize: 11,
        color: T.textSub,
        fontWeight: '500',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
    },
    badge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeSuccess: {
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
    },
    badgeDanger: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
    },
    badgeGold: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
    },
    badgeInfo: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    userCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 8,
    },
    balLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: T.textSub,
        textTransform: 'uppercase',
    },
    balAmount: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyMid,
    },
    chevronCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    skeletonRow: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    skeletonAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E2E8F0',
        marginRight: 12,
    },
    skeletonTextLine1: {
        height: 14,
        backgroundColor: '#E2E8F0',
        borderRadius: 7,
        width: '60%',
    },
    skeletonTextLine2: {
        height: 10,
        backgroundColor: '#E2E8F0',
        borderRadius: 5,
        width: '40%',
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: T.navyMid,
        padding: 30,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: T.gold,
        width: '100%',
    },
    emptyIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: T.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    emptySubText: {
        color: '#94A3B8',
        fontSize: 13,
        textAlign: 'center',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    modalCard: {
        backgroundColor: T.bg,
        borderRadius: 24,
        height: '92%',
        width: '98%',
        maxWidth: 500,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: T.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: T.navyDark,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.3)',
    },
    modalHeaderTitle: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    iconCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalHeroBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.3)',
    },
    modalAvatarWrapper: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#FFFFFF',
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
        fontSize: 24,
        fontWeight: '900',
        color: T.goldDark,
    },
    modalUserName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    modalUserEmail: {
        color: T.gold,
        fontSize: 12,
        fontWeight: '700',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusBadgeActive: {
        backgroundColor: 'rgba(16,185,129,0.2)',
        borderColor: T.success,
    },
    statusBadgeSuspended: {
        backgroundColor: 'rgba(239,68,68,0.2)',
        borderColor: T.danger,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    kycBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: 'rgba(96,165,250,0.2)',
        borderColor: '#60A5FA',
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    kycBadgeText: {
        color: '#93C5FD',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginLeft: 4,
    },
    contactBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    sectionHeading: {
        fontSize: 12,
        fontWeight: '900',
        color: T.navyMid,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 6,
    },
    formRow: {
        flexDirection: 'row',
        gap: 10,
    },
    formCol: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: T.navyMid,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    formInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 38,
        fontSize: 13,
        fontWeight: '600',
        color: T.textMain,
    },
    saveBtn: {
        backgroundColor: T.gold,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: T.goldDark,
    },
    saveBtnText: {
        color: T.navyDark,
        fontWeight: '900',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    walletCard: {
        flex: 1.5,
        backgroundColor: T.navyDark,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.gold,
        position: 'relative',
    },
    walletLabel: {
        color: T.gold,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    walletValue: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
    },
    accountChip: {
        marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
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
    aiInsightCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
        justifyContent: 'space-between',
    },
    aiTitle: {
        color: T.navyMid,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    aiRisk: {
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginVertical: 2,
    },
    aiNextAction: {
        color: T.goldDark,
        fontSize: 11,
        fontWeight: '700',
    },
    controlCard: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 12,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    switchLabel: {
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    customAmountInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
        width: 140,
        height: 36,
        paddingHorizontal: 8,
    },
    nairaSymbol: {
        fontWeight: '900',
        color: T.navyMid,
        fontSize: 13,
    },
    customAmountInput: {
        flex: 1,
        color: T.navyMid,
        fontWeight: '700',
        fontSize: 13,
        textAlign: 'center',
    },
    actionCheckBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetRow: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'space-between',
    },
    presetChip: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
    },
    presetChipActive: {
        backgroundColor: T.navyMid,
        borderColor: T.navyDark,
    },
    presetChipText: {
        fontSize: 11,
        fontWeight: '800',
        color: T.textMain,
    },
    limitCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
    },
    limitTitle: {
        color: T.navyMid,
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    limitInput: {
        fontWeight: '900',
        fontSize: 16,
        color: T.navyDark,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        borderWidth: 1,
        borderColor: T.border,
    },
    notesCard: {
        flex: 1.5,
        backgroundColor: '#FFFBEB',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    notesTitle: {
        color: '#92400E',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    notesInput: {
        fontSize: 12,
        color: '#78350F',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FCD34D',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minHeight: 42,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    gridBtn: {
        width: '48%',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    gridBtnDanger: {
        backgroundColor: T.dangerBg,
        borderColor: '#FECACA',
    },
    gridBtnSuccess: {
        backgroundColor: T.successBg,
        borderColor: '#A7F3D0',
    },
    gridBtnText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: T.textMain,
    },
    subFormCard: {
        backgroundColor: '#F0FDFA',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#99F6E4',
        marginBottom: 16,
    },
    subFormInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: T.textMain,
        marginBottom: 10,
    },
    subFormSubmitBtn: {
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    subFormSubmitBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    txCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: T.border,
        overflow: 'hidden',
        marginBottom: 16,
    },
    noHistoryText: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    txRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    txIconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: T.textMain,
        textTransform: 'capitalize',
    },
    txDate: {
        fontSize: 10,
        fontWeight: '600',
        color: T.textSub,
    },
    txAmount: {
        fontSize: 13,
        fontWeight: '900',
    },
    // Create User Modal
    createUserCard: {
        backgroundColor: T.navyMid,
        borderRadius: 24,
        height: '88%',
        width: '96%',
        maxWidth: 480,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: T.gold,
    },
    createUserHeader: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: T.navyDark,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.3)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    createUserTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
    },
    createInput: {
        backgroundColor: T.navyCard,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    fieldSubNote: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
        marginLeft: 4,
    },
    adminRoleSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: T.navyCard,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
        marginTop: 6,
    },
    createUserBtn: {
        backgroundColor: T.gold,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: T.goldDark,
    },
    createUserBtnText: {
        color: T.navyDark,
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
