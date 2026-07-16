import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, FlatList, Modal, Platform, Linking, Switch, Share, Image, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import SecurityModal from '../../components/SecurityModal';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Define User Interface matching our Schema
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
    const [pendingAction, setPendingAction] = useState<{ type: 'fund' | 'debit' | 'block' | 'promote' | 'reset_pin' | 'edit_profile' | 'notify' | 'kyc' | 'set_limit' | 'save_notes' | 'impersonate' | 'generate_account' | 'delete_user' | 'reset_tx_pin' | 'clear_device', amount?: number, role?: string, payload?: any } | null>(null);
    
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
            const { data, error } = await supabase
                .from('profiles')
                .select('*, virtual_accounts(account_number, bank_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const enrichedData = (data || []).map((u: any) => ({
                ...u,
                account_number: u.virtual_accounts?.[0]?.account_number || u.virtual_accounts?.account_number || null
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
                const currentBalance = Number(selectedUser.credit_balance) || 0;
                const newBalance = currentBalance + amount;
                
                const { error } = await supabase.from('profiles').update({ credit_balance: newBalance }).eq('id', selectedUser.id);
                if (error) throw error;
                
                await supabase.from('transactions').insert({
                    user_id: selectedUser.id,
                    type: pendingAction.type === 'fund' ? 'topup' : 'withdrawal',
                    amount: Math.abs(amount),
                    status: 'success',
                    description: `Admin ${pendingAction.type === 'fund' ? 'Funding' : 'Debit'}`,
                    reference: `admin_${pendingAction.type}_${Date.now()}`
                });
                
                Alert.alert("Success", amount > 0 ? `Funded ₦${amount.toLocaleString()}` : `Debited ₦${Math.abs(amount).toLocaleString()}`);
            }
            else if (pendingAction.type === 'block') {
                const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
                const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Updated", `User is now ${newStatus.toUpperCase()}`);
            }
            else if (pendingAction.type === 'promote') {
                const newRole = selectedUser.role === 'admin' ? 'user' : 'admin';
                const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Role Changed", `User is now ${newRole.toUpperCase()}`);
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
                
                // Refresh profile to show new account number
                const { data: updatedProfile } = await supabase.from('profiles').select('account_number').eq('id', selectedUser.id).single();
                if (updatedProfile) {
                    setSelectedUser({ ...selectedUser, account_number: updatedProfile.account_number });
                }
            }
            else if (pendingAction.type === 'notify') {
                const { error } = await supabase.from('notifications').insert({
                    user_id: selectedUser.id,
                    title: 'Admin Message',
                    body: notifyMessage,
                    is_read: false
                });
                if (error) throw error;
                Alert.alert("Sent", "Notification sent successfully!");
                setNotifyMessage('');
                setShowNotifyInput(false);
            }
            else if (pendingAction.type === 'delete_user') {
                const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Deleted", "User has been permanently deleted!");
            }
            else if (pendingAction.type === 'reset_tx_pin') {
                const { error } = await supabase.from('profiles').update({ transaction_pin: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("PIN Reset", "User's transaction PIN has been cleared. They will be asked to set a new one.");
            }
            else if (pendingAction.type === 'clear_device') {
                const { error } = await supabase.from('profiles').update({ push_token: null }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Device Cleared", "The user's registered device has been unlinked.");
            }
            else if (pendingAction.type === 'kyc') {
                const newKycStatus = !selectedUser.kyc_verified;
                const { error } = await supabase.from('profiles').update({ kyc_verified: newKycStatus }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("KYC Updated", `User is now ${newKycStatus ? 'VERIFIED' : 'UNVERIFIED'}`);
                setSelectedUser({ ...selectedUser, kyc_verified: newKycStatus });
            }
            else if (pendingAction.type === 'set_limit') {
                const limit = limitInput ? Number(limitInput) : null;
                const { error } = await supabase.from('profiles').update({ transfer_limit: limit }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Limit Set", limit ? `Transfer limit set to ₦${limit.toLocaleString()}` : "Transfer limit removed");
                setSelectedUser({ ...selectedUser, transfer_limit: limit || undefined });
            }
            else if (pendingAction.type === 'save_notes') {
                const { error } = await supabase.from('profiles').update({ admin_notes: adminNotes }).eq('id', selectedUser.id);
                if (error) throw error;
                Alert.alert("Saved", "Admin notes updated.");
                setSelectedUser({ ...selectedUser, admin_notes: adminNotes });
            }
            else if (pendingAction.type === 'impersonate') {
                 Alert.alert("Impersonating", `Switching view to ${selectedUser.full_name}... (Simulation)`);
            }

            // Refresh & Close
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
            // Call actual Edge Function to create user in Auth & profiles
            const { data, error } = await supabase.functions.invoke('admin-create-user', {
                body: newUserForm
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            // Refetch or add real user from response to state
            if (data?.user) {
                setUsers([data.user, ...users]);
            } else {
                fetchUsers(); // Fallback if no user object returned
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
    
    const initiatePromote = () => {
         setPendingAction({ type: 'promote' });
         setShowSecurity(true);
    };

    const initiateResetPin = () => {
        setPendingAction({ type: 'reset_pin' });
        Alert.alert("Reset Password", `Send password reset instructions to ${selectedUser?.email}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", style: 'destructive', onPress: () => setShowSecurity(true) }
        ]);
    };

     const initiateResetTxPin = () => {
        setPendingAction({ type: 'reset_tx_pin' });
        Alert.alert("Reset Transaction PIN", `Are you sure you want to reset the 4-digit Transaction PIN for ${selectedUser?.full_name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Reset PIN", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateClearDevice = () => {
        setPendingAction({ type: 'clear_device' });
        Alert.alert("Clear Device", `This will unlink the current device (Push Token) from ${selectedUser?.full_name}'s account. Continue?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", onPress: () => setShowSecurity(true) }
        ]);
    };

    const initiateDelete = () => {
        setPendingAction({ type: 'delete_user' });
        Alert.alert("Delete User", `Are you sure you want to PERMANENTLY delete ${selectedUser?.full_name}? This action cannot be undone and may fail if the user has transaction history.`, [
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

    const renderUserModal = () => (
        <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <View className="bg-slate-50 rounded-[30px] h-[92%] w-[95%] overflow-hidden shadow-2xl border border-[#D4AF37]/50">
                    
                    {/* Header Controls (Navy) */}
                    <View className="flex-row justify-between items-center px-4 py-3 bg-[#0A1128] z-20 border-b border-[#D4AF37]/30">
                        <TouchableOpacity onPress={() => setSelectedUser(null)} className="w-8 h-8 items-center justify-center rounded-full bg-white/10">
                            <Ionicons name="close" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <Text className="text-white font-bold text-sm tracking-widest uppercase">Profile</Text>
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={exportProfile} className="w-8 h-8 items-center justify-center rounded-full bg-white/10">
                                <Ionicons name="share-outline" size={16} color="#D4AF37" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} className="w-8 h-8 items-center justify-center rounded-full bg-[#D4AF37]/20">
                                <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color="#D4AF37" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        {/* Profile Identity Bar (Navy Gradient) */}
                        <LinearGradient colors={['#111D3B', '#0A1128']} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 }}>
                            <View className="w-14 h-14 bg-white rounded-full overflow-hidden border-[2px] border-[#D4AF37] items-center justify-center shadow-sm">
                                {selectedUser?.avatar_url ? (
                                    <Image source={{ uri: selectedUser.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <Text className="text-2xl font-black text-[#D4AF37]">{selectedUser?.full_name?.charAt(0).toUpperCase()}</Text>
                                )}
                            </View>
                            <View className="ml-4 flex-1">
                                <Text className="text-white font-black text-lg tracking-tight" numberOfLines={1}>{selectedUser?.full_name}</Text>
                                <Text className="text-[#D4AF37] text-xs font-mono font-bold" numberOfLines={1}>{selectedUser?.email}</Text>
                                <View className="flex-row items-center gap-2 mt-1">
                                    <View className={`px-2 py-0.5 rounded-full border ${selectedUser?.status === 'active' ? 'bg-emerald-500/20 border-emerald-400' : 'bg-rose-500/20 border-rose-400'}`}>
                                        <Text className={`text-[9px] uppercase tracking-widest font-bold ${selectedUser?.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}>{selectedUser?.status}</Text>
                                    </View>
                                    {selectedUser?.kyc_verified && (
                                        <View className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400 flex-row items-center">
                                            <Ionicons name="shield-checkmark" size={10} color="#60A5FA" />
                                            <Text className="text-blue-300 text-[9px] uppercase tracking-widest font-bold ml-1">Verified</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => contactUser('call')} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/20 mr-2 shadow-sm">
                                <Ionicons name="call" size={16} color="#E2E8F0" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => contactUser('whatsapp')} className="w-10 h-10 bg-emerald-500/20 rounded-full items-center justify-center border border-emerald-400 shadow-sm">
                                <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
                            </TouchableOpacity>
                        </LinearGradient>

                        {isEditing ? (
                            <View className="p-4 gap-y-3">
                                <Text className="text-[10px] text-[#0A1128] font-black uppercase tracking-widest mb-1">Edit Profile Details</Text>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Full Name</Text>
                                        <TextInput value={editForm.full_name} onChangeText={(t) => setEditForm({...editForm, full_name: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Username</Text>
                                        <TextInput value={editForm.username} onChangeText={(t) => setEditForm({...editForm, username: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-[1.5]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Phone</Text>
                                        <TextInput value={editForm.phone} onChangeText={(t) => setEditForm({...editForm, phone: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="phone-pad" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Gender</Text>
                                        <TextInput value={editForm.gender} onChangeText={(t) => setEditForm({...editForm, gender: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3">
                                    <View className="flex-[2]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Address</Text>
                                        <TextInput value={editForm.address} onChangeText={(t) => setEditForm({...editForm, address: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">State</Text>
                                        <TextInput value={editForm.state} onChangeText={(t) => setEditForm({...editForm, state: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3 mt-2">
                                    <View className="flex-[1.5]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Email</Text>
                                        <TextInput value={editForm.email} onChangeText={(t) => setEditForm({...editForm, email: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="email-address" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">DOB</Text>
                                        <TextInput placeholder="YYYY-MM-DD" value={editForm.dob} onChangeText={(t) => setEditForm({...editForm, dob: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                </View>
                                <Text className="text-[10px] text-[#0A1128] font-black uppercase tracking-widest mt-2 mb-1">Next of Kin</Text>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <TextInput placeholder="Name" value={editForm.next_of_kin_name} onChangeText={(t) => setEditForm({...editForm, next_of_kin_name: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <TextInput placeholder="Phone" value={editForm.next_of_kin_phone} onChangeText={(t) => setEditForm({...editForm, next_of_kin_phone: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="phone-pad" />
                                    </View>
                                </View>
                                <Text className="text-[10px] text-[#0A1128] font-black uppercase tracking-widest mt-3 mb-1">Admin Controls (Identity & KYC)</Text>
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">BVN</Text>
                                        <TextInput value={editForm.bvn} onChangeText={(t) => setEditForm({...editForm, bvn: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">NIN</Text>
                                        <TextInput value={editForm.nin} onChangeText={(t) => setEditForm({...editForm, nin: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                </View>
                                <View className="flex-row gap-3 mt-1">
                                    <View className="flex-[1.5]">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">Custom ID</Text>
                                        <TextInput value={editForm.custom_id} onChangeText={(t) => setEditForm({...editForm, custom_id: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-[9px] text-[#0A1128] font-bold uppercase tracking-widest ml-1 mb-1">KYC Tier (1-3)</Text>
                                        <TextInput value={editForm.kyc_tier} onChangeText={(t) => setEditForm({...editForm, kyc_tier: t})} className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-[#0A1128] text-xs font-medium shadow-sm" keyboardType="numeric" />
                                    </View>
                                </View>
                                <TouchableOpacity onPress={saveProfileChanges} className="bg-[#D4AF37] py-3 rounded-xl items-center mt-4 shadow-lg shadow-[#D4AF37]/40 border border-[#b8952b]">
                                    <Text className="text-[#0A1128] font-black text-xs tracking-widest uppercase">Save Changes</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="p-4">
                                {/* Wallet & Metrics Grid */}
                                <View className="flex-row gap-3 mb-4">
                                    {/* Main Balance (Navy) */}
                                    <View className="flex-[1.5] bg-[#0A1128] p-4 rounded-[20px] shadow-sm relative overflow-hidden border border-[#D4AF37]/50">
                                        <View className="absolute top-0 right-0 w-24 h-24 bg-[#D4AF37]/20 rounded-full blur-2xl -mr-10 -mt-10" />
                                        <Text className="text-[#D4AF37] font-bold text-[9px] uppercase tracking-widest mb-1">Wallet Balance</Text>
                                        <Text className="text-white text-2xl font-black tracking-tight">₦{(selectedUser?.balance || 0).toLocaleString()}</Text>
                                        <View className="mt-2 bg-white/10 px-2.5 py-1.5 rounded-lg self-start flex-row items-center gap-1 border border-white/5">
                                            <Ionicons name="card" size={10} color="#E2E8F0" />
                                            <Text className="text-white font-mono text-[9px] tracking-widest">{selectedUser?.account_number || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    {/* AI Insight (Light but with Navy Text) */}
                                    {aiInsight && (
                                        <View className="flex-1 bg-white p-4 rounded-[20px] border border-slate-200 shadow-sm justify-between">
                                            <View className="flex-row items-center justify-between mb-1">
                                                <Text className="text-[#0A1128] font-bold text-[9px] uppercase tracking-widest">AI Scan</Text>
                                                <Ionicons name="sparkles" size={12} color="#D4AF37" />
                                            </View>
                                            <Text className={`text-xs font-black uppercase tracking-tight ${aiInsight.risk === 'High' ? 'text-rose-600' : 'text-emerald-600'}`}>{aiInsight.risk} Risk</Text>
                                            <Text className="text-[#D4AF37] font-bold text-[10px] leading-tight mt-1" numberOfLines={2}>{aiInsight.nextAction}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Admin Financial Control (Navy & Gold styling) */}
                                <View className="bg-white p-3 rounded-[20px] border border-slate-200 mb-4 flex-row items-center justify-between shadow-sm">
                                    <View className="flex-row items-center gap-2">
                                        <Switch 
                                            value={isDebit} 
                                            onValueChange={setIsDebit}
                                            trackColor={{ false: "#34D399", true: "#FB7185" }}
                                            thumbColor={"#fff"}
                                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                        />
                                        <Text className={`text-[10px] font-black uppercase tracking-widest ${isDebit ? 'text-rose-600' : 'text-emerald-600'}`}>{isDebit ? 'Debit' : 'Fund'}</Text>
                                    </View>
                                    <View className="flex-row items-center bg-slate-50 rounded-xl border border-slate-200 overflow-hidden w-32 h-9">
                                        <Text className="text-[#0A1128] font-black pl-2 text-xs">₦</Text>
                                        <TextInput 
                                            placeholder="Amount" 
                                            keyboardType="numeric"
                                            className="flex-1 text-[#0A1128] font-bold text-xs px-1 text-center"
                                            value={fundAmount}
                                            onChangeText={setFundAmount}
                                        />
                                    </View>
                                    <TouchableOpacity onPress={initiateFundOrDebit} className={`w-9 h-9 rounded-xl items-center justify-center ${isDebit ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                        <Ionicons name="checkmark-done" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>

                                {/* Limits & Notes Grid */}
                                <View className="flex-row gap-3 mb-4">
                                    <View className="flex-1 bg-white p-4 rounded-[20px] border border-slate-200 shadow-sm">
                                        <Text className="text-[#0A1128] font-bold text-[9px] uppercase tracking-widest mb-2">Daily Limit (₦)</Text>
                                        <TextInput 
                                            placeholder="No Limit" 
                                            keyboardType="numeric"
                                            className="font-black text-[#0A1128] text-base bg-slate-50 rounded-xl px-3 py-2 border border-slate-200"
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
                                    <View className="flex-[1.5] bg-amber-50 p-4 rounded-[20px] border border-amber-200 shadow-sm">
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-amber-800 font-bold text-[9px] uppercase tracking-widest">Private Notes</Text>
                                            <Ionicons name="lock-closed" size={10} color="#D97706" />
                                        </View>
                                        <TextInput 
                                            placeholder="Add notes..." 
                                            multiline
                                            className="text-amber-900 text-xs bg-white border border-amber-200 rounded-xl px-3 py-2 min-h-[42px]"
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
                                <Text className="text-[#0A1128] font-black text-xs tracking-widest uppercase mb-2 ml-1">Quick Actions</Text>
                                <View className="flex-row flex-wrap gap-2 mb-6">
                                    <TouchableOpacity onPress={initiateBlock} className={`w-[48%] py-3 rounded-xl border flex-row justify-center items-center gap-2 shadow-sm ${selectedUser?.status === 'active' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <Ionicons name={selectedUser?.status === 'active' ? "ban" : "checkmark-circle"} size={14} color={selectedUser?.status === 'active' ? "#E11D48" : "#10B981"} />
                                        <Text className={`font-black text-[10px] uppercase tracking-widest ${selectedUser?.status === 'active' ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedUser?.status === 'active' ? 'Suspend' : 'Activate'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiatePromote} className="w-[48%] bg-amber-50 border border-amber-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="shield-half" size={14} color="#D97706" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-amber-700">{selectedUser?.role === 'admin' ? 'Demote' : 'Make Admin'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetPin} className="w-[48%] bg-white border border-slate-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <MaterialCommunityIcons name="lock-reset" size={14} color="#64748B" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-slate-700">Reset PIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => { setPendingAction({ type: 'impersonate' }); setShowSecurity(true); }} className="w-[48%] bg-purple-50 border border-purple-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <MaterialCommunityIcons name="incognito" size={14} color="#9333EA" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-purple-700">View As</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={toggleKyc} className="w-[48%] bg-sky-50 border border-sky-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name={selectedUser?.kyc_verified ? "checkmark-done-circle" : "shield-checkmark-outline"} size={14} color="#0284C7" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-sky-700">{selectedUser?.kyc_verified ? 'Revoke KYC' : 'Verify KYC'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => copyToClipboard(selectedUser?.id || '', 'User ID')} className="w-[48%] bg-slate-50 border border-slate-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="copy-outline" size={14} color="#475569" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-slate-700">Copy ID</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => setShowNotifyInput(!showNotifyInput)} className="w-[48%] bg-indigo-50 border border-indigo-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#4F46E5" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-indigo-700">Message</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateDelete} className="w-[48%] bg-red-50 border border-red-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-red-700">Delete</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowGenerateAccount(!showGenerateAccount)} className="w-[48%] bg-teal-50 border border-teal-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="card-outline" size={14} color="#0D9488" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-teal-700">Gen Account</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateResetTxPin} className="w-[48%] bg-orange-50 border border-orange-200 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="keypad" size={14} color="#EA580C" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-orange-700">Reset Tx PIN</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={initiateClearDevice} className="w-[48%] bg-gray-50 border border-gray-300 py-3 rounded-xl flex-row justify-center items-center gap-2 shadow-sm">
                                        <Ionicons name="hardware-chip-outline" size={14} color="#4B5563" />
                                        <Text className="font-black text-[10px] uppercase tracking-widest text-gray-700">Unlink Device</Text>
                                    </TouchableOpacity>
                                </View>

                                {showGenerateAccount && (
                                    <View className="bg-teal-50 p-4 rounded-xl mb-6 border border-teal-200 shadow-sm">
                                        <Text className="text-teal-800 font-bold text-[10px] uppercase tracking-widest mb-2">Generate Virtual Account (KYC)</Text>
                                        <TextInput
                                            placeholder="Enter BVN/NIN (Optional if already in DB)"
                                            className="bg-white border border-teal-100 rounded-lg p-3 text-teal-900 text-sm mb-3"
                                            value={bvnInput}
                                            onChangeText={setBvnInput}
                                            keyboardType="numeric"
                                        />
                                        <TouchableOpacity onPress={() => { setPendingAction({ type: 'generate_account' }); setShowSecurity(true); }} className="bg-[#0D9488] py-2.5 rounded-lg items-center shadow-sm">
                                            <Text className="text-white font-bold text-xs uppercase tracking-widest">Generate Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showNotifyInput && (
                                    <View className="bg-indigo-50 p-4 rounded-xl mb-6 border border-indigo-200 shadow-sm">
                                        <Text className="text-indigo-800 font-bold text-[10px] uppercase tracking-widest mb-2">Send Push Notification</Text>
                                        <TextInput
                                            placeholder="Type message here..."
                                            multiline
                                            className="bg-white border border-indigo-100 rounded-lg p-3 text-indigo-900 text-sm mb-3 min-h-[60px]"
                                            value={notifyMessage}
                                            onChangeText={setNotifyMessage}
                                        />
                                        <TouchableOpacity onPress={sendNotification} className="bg-[#4F46E5] py-2.5 rounded-lg items-center shadow-sm">
                                            <Text className="text-white font-bold text-xs uppercase tracking-widest">Send Now</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Compact Transactions */}
                                <Text className="text-[#0A1128] font-black text-xs tracking-widest uppercase mb-2 ml-1">Recent Transactions</Text>
                                <View className="bg-white rounded-2xl border border-[#D4AF37]/20 overflow-hidden mb-6 shadow-sm">
                                    {loadingHistory ? (
                                        <View className="py-6 items-center"><ActivityIndicator color="#D4AF37" size="small" /></View>
                                    ) : userTransactions.length === 0 ? (
                                        <View className="p-4 items-center">
                                            <Text className="text-[#0A1128]/50 text-[10px] uppercase tracking-widest font-bold">No history</Text>
                                        </View>
                                    ) : (
                                        userTransactions.slice(0,3).map((tx, i) => (
                                            <View key={tx.id} className={`flex-row justify-between items-center px-4 py-3 ${i !== Math.min(userTransactions.length, 3) - 1 ? 'border-b border-slate-100' : ''}`}>
                                                <View className="flex-row items-center gap-3">
                                                    <View className={`w-6 h-6 rounded-full items-center justify-center ${tx.type === 'topup' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                                        <Ionicons name={tx.type === 'topup' ? 'arrow-down' : 'arrow-up'} size={10} color={tx.type === 'topup' ? '#10B981' : '#64748B'} />
                                                    </View>
                                                    <View>
                                                        <Text className="font-bold text-[#0A1128] text-xs capitalize">{tx.type || 'Txn'}</Text>
                                                        <Text className="text-[9px] text-[#0A1128]/60 font-bold uppercase">{new Date(tx.created_at).toLocaleDateString()}</Text>
                                                    </View>
                                                </View>
                                                <Text className={`font-black text-xs ${tx.type === 'topup' ? 'text-emerald-500' : 'text-[#0A1128]'}`}>
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

    const renderCreateUserModal = () => (
        <Modal visible={showCreateUser} transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
            <BlurView intensity={90} tint="dark" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
                 <View className="bg-[#111D3B] rounded-[36px] overflow-hidden shadow-2xl h-[88%] relative">
                    <View className="p-6 border-b border-[#D4AF37]/50/5 flex-row justify-between items-center bg-[#1A2950]/50 z-10 relative">
                        <Text className="text-2xl font-black text-slate-100 tracking-tight">Create User</Text>
                        <TouchableOpacity onPress={() => setShowCreateUser(false)} className="bg-[#111D3B] w-10 h-10 items-center justify-center rounded-full shadow-sm border border-[#D4AF37]/50/5">
                            <Ionicons name="close" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        <View className="space-y-5">
                            <View>
                                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name</Text>
                                <TextInput 
                                    className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold text-base"
                                    placeholder="e.g. John Doe"
                                    value={newUserForm.fullName}
                                    onChangeText={t => setNewUserForm({...newUserForm, fullName: t})}
                                />
                            </View>
                             <View>
                                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username</Text>
                                <TextInput 
                                    className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold text-base"
                                    placeholder="e.g. johndoe123"
                                    value={newUserForm.username}
                                    onChangeText={t => setNewUserForm({...newUserForm, username: t})}
                                    autoCapitalize="none"
                                />
                            </View>
                            <View>
                                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</Text>
                                <TextInput 
                                    className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold text-base"
                                    placeholder="john@example.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={newUserForm.email}
                                    onChangeText={t => setNewUserForm({...newUserForm, email: t})}
                                />
                            </View>
                             <View>
                                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone (Optional)</Text>
                                <TextInput 
                                    className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold text-base"
                                    placeholder="+234..."
                                    keyboardType="phone-pad"
                                    value={newUserForm.phone}
                                    onChangeText={t => setNewUserForm({...newUserForm, phone: t})}
                                />
                            </View>
                            
                             <View className="flex-row gap-4">
                                <View className="flex-1">
                                    <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Gender</Text>
                                    <TextInput 
                                        className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold"
                                        placeholder="M/F"
                                        value={newUserForm.gender}
                                        onChangeText={t => setNewUserForm({...newUserForm, gender: t})}
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">DOB</Text>
                                    <TextInput 
                                        className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold"
                                        placeholder="YYYY-MM-DD"
                                        value={newUserForm.dob}
                                        onChangeText={t => setNewUserForm({...newUserForm, dob: t})}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Initial Password</Text>
                                 <TextInput 
                                    className="bg-[#1A2950] border border-[#D4AF37]/50/10 rounded-[20px] px-5 py-4 text-slate-100 font-bold text-base"
                                    value={newUserForm.password}
                                    onChangeText={t => setNewUserForm({...newUserForm, password: t})}
                                    secureTextEntry
                                />
                                 <Text className="text-[10px] font-medium text-slate-400 mt-2 ml-2">User should change this on first login.</Text>
                            </View>
                            
                             <View className="flex-row items-center justify-between mt-4 mb-2 bg-[#1A2950] p-5 rounded-[20px] border border-[#D4AF37]/50/5">
                                 <View>
                                    <Text className="font-bold text-slate-100 text-base">Admin Privileges</Text>
                                    <Text className="text-xs text-slate-500 mt-1">Grant full dashboard access</Text>
                                 </View>
                                 <Switch 
                                    value={newUserForm.role === 'admin'}
                                    onValueChange={(val) => setNewUserForm({...newUserForm, role: val ? 'admin' : 'user'})}
                                    trackColor={{ false: "#E2E8F0", true: "#6366F1" }}
                                    ios_backgroundColor="#E2E8F0"
                                 />
                            </View>

                            <TouchableOpacity 
                                onPress={handleCreateUser}
                                disabled={creatingUser}
                                className={`py-4 rounded-[20px] items-center mt-6 shadow-xl ${creatingUser ? 'bg-indigo-400' : 'bg-[#D4AF37] shadow-[#D4AF37]/20'}`}
                            >
                                {creatingUser ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-black uppercase tracking-widest text-sm">Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                 </View>
            </BlurView>
        </Modal>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} /> 

            {/* Hyper-Modern Command Center Header */}
            <View className="z-10 relative pt-16 px-3 pb-2">
                <LinearGradient colors={['#0A1128', '#111D3B', '#1A2950']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16, borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}>
                    {/* Premium Decorative Elements */}
                    <View className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
                    <View className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/10 rounded-full blur-3xl -ml-8 -mb-8 pointer-events-none" />
                    
                    {/* Top Bar: Title & Actions */}
                    <View className="flex-row justify-between items-center mb-3 relative z-10">
                        {isSelectionMode ? (
                            <View className="flex-row items-center">
                                <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="bg-[#111D3B]/10 w-8 h-8 items-center justify-center rounded-full mr-2 border border-[#D4AF37]/50/20">
                                    <Ionicons name="close" size={16} color="white" />
                                </TouchableOpacity>
                                <Text className="text-white text-base font-black tracking-tight">{selectedIds.size} Selected</Text>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-white text-lg font-black tracking-tighter leading-tight">User Manager</Text>
                            </View>
                        )}
                        <View className="flex-row gap-2">
                            <TouchableOpacity 
                                onPress={() => setShowCreateUser(true)}
                                className="w-8 h-8 bg-[#111D3B]/10 backdrop-blur-xl rounded-full items-center justify-center border border-[#D4AF37]/50/20 shadow-sm shadow-black/20"
                            >
                                <Ionicons name="person-add" size={14} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Compact Mini-Stats Row */}
                    {!isSelectionMode && (
                        <View className="flex-row justify-between mb-2">
                            <View className="bg-white/5 rounded-lg p-1.5 flex-1 mr-1.5 flex-row items-center border border-white/5">
                                <View className="w-5 h-5 rounded-full bg-emerald-500/20 items-center justify-center mr-1.5">
                                    <Ionicons name="wallet" size={10} color="#34D399" />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[6px] uppercase tracking-widest font-bold">Vault</Text>
                                    <Text className="text-white text-[10px] font-black">₦{stats.totalBalance > 1000000 ? (stats.totalBalance/1000000).toFixed(1)+'M' : stats.totalBalance}</Text>
                                </View>
                            </View>
                            <View className="bg-white/5 rounded-lg p-1.5 flex-1 mr-1.5 flex-row items-center border border-white/5">
                                <View className="w-5 h-5 rounded-full bg-blue-500/20 items-center justify-center mr-1.5">
                                    <Ionicons name="people" size={10} color="#60A5FA" />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[6px] uppercase tracking-widest font-bold">Users</Text>
                                    <Text className="text-white text-[10px] font-black">{stats.activeUsers}</Text>
                                </View>
                            </View>
                            <View className="bg-white/5 rounded-lg p-1.5 flex-1 flex-row items-center border border-white/5">
                                <View className="w-5 h-5 rounded-full bg-purple-500/20 items-center justify-center mr-1.5">
                                    <Ionicons name="shield-checkmark" size={10} color="#C084FC" />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[6px] uppercase tracking-widest font-bold">KYC</Text>
                                    <Text className="text-white text-[10px] font-black">{stats.verifiedUsers}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Search & Filter Row */}
                    <View className="relative z-10">
                        <View className="bg-black/20 border border-[#D4AF37]/50/20 py-2 px-4 rounded-full flex-row items-center backdrop-blur-2xl mb-2 shadow-inner">
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                placeholder="Search users..."
                                placeholderTextColor="#64748B"
                                className="flex-1 ml-2 font-semibold text-slate-200 text-xs py-0"
                                value={search}
                                onChangeText={handleSearch}
                            />
                        </View>
                        
                        <View className="flex-row justify-between items-center">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 mr-2">
                                {['all', 'active', 'suspended'].map((status) => (
                                    <TouchableOpacity 
                                        key={status} 
                                        onPress={() => setFilterStatus(status)}
                                        className={`mr-2 px-3 py-1.5 rounded-full border ${
                                            filterStatus === status 
                                            ? 'bg-[#D4AF37] border-[#D4AF37] shadow-sm shadow-[#D4AF37]/30' 
                                            : 'bg-[#111D3B]/20 border-[#D4AF37]/50/10'
                                        }`}
                                    >
                                        <Text className={`text-[10px] font-black tracking-[0.1em] uppercase ${
                                            filterStatus === status ? 'text-white' : 'text-slate-400'
                                        }`}>
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
                                className="bg-[#111D3B]/20 px-3 py-1.5 rounded-full border border-[#D4AF37]/50/10 flex-row items-center backdrop-blur-xl"
                            >
                                <Ionicons name="filter" size={10} color="#CBD5E1" style={{ marginRight: 4 }} />
                                <Text className="text-white text-[10px] font-black tracking-widest uppercase">
                                    {sortBy === 'newest' ? 'New' : (sortBy === 'balance_high' ? 'High' : 'Low')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Bulk Action Bar - Sticky Bottom */}
            {isSelectionMode && (
                <BlurView intensity={90} tint="light" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.05)', flexDirection: 'row', justifyContent: 'space-around' }}>
                    <TouchableOpacity onPress={() => executeBulkAction('block')} className="items-center bg-white py-3 px-6 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                         <Ionicons name="ban" size={24} color="#E11D48" className="mb-1" />
                        <Text className="text-[10px] font-black uppercase tracking-widest text-rose-600 mt-1">Suspend</Text>
                    </TouchableOpacity>
                     <TouchableOpacity onPress={() => executeBulkAction('unblock')} className="items-center bg-white py-3 px-6 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                         <Ionicons name="checkmark-circle" size={24} color="#059669" className="mb-1" />
                        <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-1">Activate</Text>
                    </TouchableOpacity>
                     <TouchableOpacity onPress={() => executeBulkAction('verify')} className="items-center bg-white py-3 px-6 rounded-2xl shadow-sm border border-slate-100 min-w-[100px]">
                         <Ionicons name="shield-checkmark" size={24} color="#2563EB" className="mb-1" />
                        <Text className="text-[10px] font-black uppercase tracking-widest text-blue-600 mt-1">Verify</Text>
                    </TouchableOpacity>
                </BlurView>
            )}

            {/* User List */}
            <FlatList
                data={getFilteredUsers()}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 150, paddingTop: 10 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor="#4F46E5" 
                        colors={['#4F46E5']} 
                    />
                }
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        onPress={() => isSelectionMode ? toggleSelection(item.id) : setSelectedUser(item)}
                        onLongPress={() => handleLongPress(item.id)}
                        className={`p-3 rounded-[20px] mb-2.5 border flex-row items-center overflow-hidden ${
                            selectedIds.has(item.id) 
                                ? 'bg-[#D4AF37]/10 border-[#D4AF37]/50' 
                                : 'bg-white border-slate-200/80'
                        }`}
                        style={{ elevation: 2, shadowColor: '#64748b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 }}
                    >
                        {/* Premium Decorative background accents */}
                        <View className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-[0.04] ${item.role === 'admin' ? 'bg-amber-500' : 'bg-[#D4AF37]'}`} />
                        <View className={`absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-[0.06] blur-xl ${item.role === 'admin' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                        <View className="absolute top-2 left-1/2 w-20 h-20 rounded-full opacity-[0.02] bg-indigo-500 blur-2xl" />


                        {isSelectionMode && (
                            <View className={`w-5 h-5 rounded-full border mr-3 items-center justify-center shadow-sm ${selectedIds.has(item.id) ? 'bg-[#D4AF37] border-indigo-600' : 'border-slate-300 bg-slate-50'}`}>
                                {selectedIds.has(item.id) && <Ionicons name="checkmark" size={12} color="white" />}
                            </View>
                        )}

                        <View className="flex-row items-center gap-3 flex-1 relative z-10">
                            <View className={`w-10 h-10 rounded-full items-center justify-center border-2 overflow-hidden shadow-sm ${
                                item.role === 'admin' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                            }`}>
                                {item.avatar_url ? (
                                    <Image source={{ uri: item.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <Text className={`font-black text-base ${
                                        item.role === 'admin' ? 'text-amber-600' : 'text-slate-600'
                                    }`}>
                                        {item.full_name?.charAt(0).toUpperCase() || 'U'}
                                    </Text>
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-slate-800 text-sm mb-0.5 tracking-tight" numberOfLines={1}>
                                    {item.full_name || 'Unknown User'}
                                </Text>
                                <View className="flex-row items-center gap-2 mb-1.5">
                                    <Text className="text-[9px] text-slate-500 font-mono tracking-widest opacity-80">
                                        {item.account_number || 'No Account'}
                                    </Text>
                                    {(item.phone || item.email) && (
                                        <View className="flex-row items-center gap-1 opacity-60">
                                            <View className="w-1 h-1 rounded-full bg-slate-300" />
                                            <Ionicons name={item.phone ? "call" : "mail"} size={8} color="#64748b" />
                                            <Text className="text-[8px] text-slate-500 font-medium" numberOfLines={1}>
                                                {item.phone || item.email}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-row items-center gap-1.5 flex-wrap">
                                    <View className={`px-2 py-0.5 rounded-md ${item.status === 'active' ? 'bg-emerald-100/70' : 'bg-rose-100/70'}`}>
                                         <Text className={`text-[8px] font-black tracking-widest uppercase ${item.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {item.status}
                                         </Text>
                                    </View>
                                    {item.role === 'admin' && (
                                        <View className="bg-amber-100/70 px-2 py-0.5 rounded-md">
                                            <Text className="text-[8px] font-black tracking-widest text-amber-700 uppercase">ADMIN</Text>
                                        </View>
                                    )}
                                    {item.kyc_verified && (
                                        <View className="bg-blue-100/70 px-1 py-0.5 rounded-md flex-row items-center">
                                            <Ionicons name="shield-checkmark" size={8} color="#2563EB" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        <View className="items-center flex-row pl-2 relative z-10">
                            <View className="items-end mr-2">
                                <Text className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-0.5">Vault Bal</Text>
                                <Text className="font-black text-slate-800 text-base tracking-tighter">₦{(item.balance || item.credit_balance || 0).toLocaleString()}</Text>
                            </View>
                            <TouchableOpacity className="w-7 h-7 items-center justify-center rounded-full bg-slate-100/50">
                                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-8">
                        {loading ? (
                            <View className="w-full px-2">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <View key={i} className="mb-4 bg-white p-5 rounded-[28px] border border-slate-100 flex-row items-center animate-pulse opacity-60">
                                        <View className="w-14 h-14 bg-slate-200 rounded-[20px] mr-4" />
                                        <View className="flex-1 space-y-3">
                                            <View className="h-4 bg-slate-200 rounded-full w-3/4" />
                                            <View className="h-3 bg-slate-200 rounded-full w-1/3" />
                                        </View>
                                        <View className="w-20 h-6 bg-slate-200 rounded-full" />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View className="items-center mt-12 bg-[#111D3B] p-10 rounded-[40px] border border-[#D4AF37]/50/5 shadow-sm w-full">
                                <View className="w-20 h-20 bg-[#1A2950] rounded-full items-center justify-center mb-4">
                                    <Ionicons name="people-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text className="text-slate-100 font-bold text-lg mb-1">No Users Found</Text>
                                <Text className="text-slate-400 text-center text-sm px-4">Try adjusting your filters or searching with different terms.</Text>
                            </View>
                        )}
                    </View>
                }
            />
            
            {/* Details Modal */}
            {renderUserModal()}
            {renderCreateUserModal()}

            {/* Security Check for Sensitive Actions */}
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

const DetailRow = ({ label, value, capitalize }: { label: string, value?: string, capitalize?: boolean }) => (
    <View className="flex-row justify-between py-3 border-b border-slate-50">
        <Text className="text-slate-500 font-medium text-[13px]">{label}</Text>
        <Text className={`text-slate-100 font-bold text-right text-[13px] ${capitalize ? 'capitalize' : ''} flex-1 ml-4`}>
            {value || 'N/A'}
        </Text>
    </View>
);
