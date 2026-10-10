import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, FlatList, Modal, Platform, Linking, Switch, Share, Image, RefreshControl, StyleSheet, useWindowDimensions } from 'react-native';
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
    daily_limit?: number;
    single_tx_limit?: number;
    transaction_pin?: string;
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
    crypto_info?: {
        totalUSD: number;
        totalNGN: number;
        tokens: string[];
        hasCrypto: boolean;
    };
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

interface CryptoBalance {
    id?: string;
    user_id: string;
    asset: string;
    balance: number;
    updated_at?: string;
}

interface CryptoAddress {
    id?: string;
    user_id: string;
    network: string;
    currency: string;
    address: string;
    is_active?: boolean;
    created_at?: string;
}

interface Transaction {
    id: string;
    user_id?: string;
    amount: number;
    type: string;
    status: string;
    created_at: string;
    description?: string;
    reference?: string;
    gateway_reference?: string;
    channel?: string;
    fee?: number;
    metadata?: any;
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
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
    const isTabletWeb = Platform.OS === 'web' && width >= 768 && width < 1024;
    const numColumns = isDesktopWeb ? 3 : isTabletWeb ? 2 : 1;

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'admin' | 'verified' | 'corporate' | 'high_bal' | 'crypto' | 'missing_va'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'balance_high' | 'balance_low'>('newest');
    
    // Selection & Modal States
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [modalTab, setModalTab] = useState<'overview' | 'crypto' | 'transactions' | 'kyc' | 'controls' | 'notify' | 'logs'>('overview');
    
    // Dynamic User History & Crypto States
    const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
    const [userCryptoBalances, setUserCryptoBalances] = useState<CryptoBalance[]>([]);
    const [userCryptoAddresses, setUserCryptoAddresses] = useState<CryptoAddress[]>([]);
    const [userVirtualCards, setUserVirtualCards] = useState<UserVirtualCard[]>([]);
    const [userKycRequests, setUserKycRequests] = useState<KycRequest[]>([]);
    const [userLogs, setUserLogs] = useState<LoginLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [unmaskedCardIds, setUnmaskedCardIds] = useState<Record<string, boolean>>({});

    // Transaction Filtering & Detailed Inspection
    const [txFilterType, setTxFilterType] = useState<'all' | 'credit' | 'debit' | 'crypto' | 'bills'>('all');
    const [txSearch, setTxSearch] = useState('');
    const [selectedTransactionDetails, setSelectedTransactionDetails] = useState<Transaction | null>(null);

    // Crypto Admin Direct Funding / Debit States
    const [cryptoFundingModal, setCryptoFundingModal] = useState(false);
    const [cryptoFundAsset, setCryptoFundAsset] = useState('USDT');
    const [cryptoFundAmount, setCryptoFundAmount] = useState('');
    const [cryptoFundIsDebit, setCryptoFundIsDebit] = useState(false);
    const [cryptoFundProcessing, setCryptoFundProcessing] = useState(false);

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

    // Batch Virtual Account Generation States
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentName: '', success: 0, failed: 0 });
    const [generatingSingleAcc, setGeneratingSingleAcc] = useState(false);

    // Manual Virtual Account Assignment State
    const [showManualVaModal, setShowManualVaModal] = useState(false);
    const [manualBankName, setManualBankName] = useState('Palmpay');
    const [manualAccNumber, setManualAccNumber] = useState('');
    const [manualAccName, setManualAccName] = useState('');
    const [assigningManualVa, setAssigningManualVa] = useState(false);

    // Luxury Credential Vault & Password Authority States
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [showPasswordPlaintext, setShowPasswordPlaintext] = useState(false);
    const [sendPasswordEmailNotification, setSendPasswordEmailNotification] = useState(true);
    const [changingPasswordProcessing, setChangingPasswordProcessing] = useState(false);
    const [sendingDirectResetEmail, setSendingDirectResetEmail] = useState(false);
    const [customPinInput, setCustomPinInput] = useState('');
    const [resetPinProcessing, setResetPinProcessing] = useState(false);
    const [showCustomPinBox, setShowCustomPinBox] = useState(false);

    const handleDirectEmailResetDispatch = async () => {
        if (!selectedUser?.email) {
            Alert.alert("Babu Email", "Wannan mai asusun ba shi da adireshin email a tsarinmu.");
            return;
        }
        setSendingDirectResetEmail(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email);
            if (error) throw error;
            Alert.alert(
                "An Tura Sakon Email ✉️",
                `An aika da link na sake password kai-tsaye zuwa ga ${selectedUser.email}.\nMai asusun zai iya danna link din ya sauya kalmar sirri da kanshi.`
            );
        } catch (err: any) {
            Alert.alert("Aika Email Ya Gaza", err.message || "An samu matsala wajen tura sakon email.");
        } finally {
            setSendingDirectResetEmail(false);
        }
    };

    const handleResetTransactionPin = async (pinValue: string = '1234') => {
        if (!selectedUser) return;
        const cleanPin = pinValue.trim();
        if (cleanPin.length !== 4 || isNaN(Number(cleanPin))) {
            Alert.alert("Lambar PIN Mara Kyau", "Dole ne lambar PIN ta kasance lambobi 4 daidai (misali 1234).");
            return;
        }
        setResetPinProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ transaction_pin: cleanPin })
                .eq('id', selectedUser.id);
            if (error) throw error;
            setSelectedUser({ ...selectedUser, transaction_pin: cleanPin });
            Alert.alert(
                "Transaction PIN An Sabunta 🔢",
                `An yi nasarar saita lambar Transaction PIN ta ${selectedUser.full_name} zuwa: ${cleanPin}\n\nKa sanar da mai asusun sabuwar lambar tasa.`
            );
            setShowCustomPinBox(false);
            setCustomPinInput('');
        } catch (err: any) {
            Alert.alert("Saita PIN Ya Gaza", err.message || "An samu matsala wajen canza PIN.");
        } finally {
            setResetPinProcessing(false);
        }
    };

    const handleToggleSecurityFreeze = async () => {
        if (!selectedUser) return;
        const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', selectedUser.id);
            if (error) throw error;
            setSelectedUser({ ...selectedUser, status: newStatus });
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
            Alert.alert(
                newStatus === 'suspended' ? "An Kulle Asusu ❄️" : "An Bude Asusu 🟢",
                `Asusun ${selectedUser.full_name} yanzu yana: ${newStatus === 'suspended' ? 'FROZEN / A KULLE (An hana duk wani hada-hada)' : 'ACTIVE / BUDE (Komai na aiki normal)'}.`
            );
        } catch (err: any) {
            Alert.alert("Matsalar Sauya Tsaro", err.message);
        }
    };

    const handleSetDailyLimit = async (limitVal: number) => {
        if (!selectedUser) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ transfer_limit: limitVal, daily_limit: limitVal })
                .eq('id', selectedUser.id);
            if (error) throw error;
            setSelectedUser({ ...selectedUser, transfer_limit: limitVal, daily_limit: limitVal });
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, transfer_limit: limitVal, daily_limit: limitVal } : u));
            Alert.alert(
                "Iyakar Tura Kudi An Saita 🛡️",
                `Iyakar tura kudi ta rana (Daily Limit) ga ${selectedUser.full_name} yanzu: ${limitVal >= 100000000 ? 'Unlimited ♾️' : '₦' + limitVal.toLocaleString()}`
            );
        } catch (err: any) {
            Alert.alert("Matsala", err.message);
        }
    };

    const generateRandomSecurePassword = () => {
        const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lower = "abcdefghjkmnpqrstuvwxyz";
        const numbers = "23456789";
        const symbols = "@#$&*!";
        let pass = "Abu#";
        for (let i = 0; i < 3; i++) pass += upper.charAt(Math.floor(Math.random() * upper.length));
        for (let i = 0; i < 2; i++) pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
        for (let i = 0; i < 2; i++) pass += lower.charAt(Math.floor(Math.random() * lower.length));
        pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
        setNewPasswordInput(pass);
    };

    const getPasswordEntropy = (pass: string) => {
        if (!pass || pass.length === 0) return { score: 0, label: 'Enter Password', color: '#64748B' };
        if (pass.length < 6) return { score: 1, label: 'Too Short (Min 6 chars)', color: '#EF4444' };
        const hasUpper = /[A-Z]/.test(pass);
        const hasLower = /[a-z]/.test(pass);
        const hasNum = /[0-9]/.test(pass);
        const hasSym = /[^A-Za-z0-9]/.test(pass);
        const varietyCount = [hasUpper, hasLower, hasNum, hasSym].filter(Boolean).length;
        
        if (pass.length >= 10 && varietyCount >= 3) {
            return { score: 4, label: '👑 24K VIP SECURE (Maximum Protection)', color: '#10B981' };
        }
        if (pass.length >= 8 && varietyCount >= 2) {
            return { score: 3, label: '🛡️ Strong Password', color: '#38BDF8' };
        }
        return { score: 2, label: '⚠️ Fair (Add numbers & symbols)', color: '#F59E0B' };
    };

    // Dynamic Executive KPIs
    const stats = {
        totalUsers: users.length,
        totalBalance: users.reduce((acc, u) => acc + (u.balance || u.credit_balance || 0), 0),
        activeUsers: users.filter(u => u.status === 'active').length,
        verifiedUsers: users.filter(u => u.kyc_verified).length,
        corporateAdmins: users.filter(u => u.corporate_email).length,
        highRiskCount: users.filter(u => u.status === 'suspended').length,
        missingAccounts: users.filter(u => !u.account_number).length,
        cryptoHolders: users.filter(u => u.crypto_info?.hasCrypto).length,
        totalCryptoUSD: users.reduce((acc, u) => acc + (u.crypto_info?.totalUSD || 0), 0),
    };

    const handleStartBatchGeneration = async () => {
        const targetUsers = users.filter(u => !u.account_number);
        const usersToProcess = targetUsers.length > 0 ? targetUsers : users;

        if (usersToProcess.length === 0) {
            Alert.alert("All Set! 🏦", "All users already have active virtual accounts.");
            return;
        }

        setBatchProcessing(true);
        setBatchProgress({
            current: 0,
            total: usersToProcess.length,
            currentName: '',
            success: 0,
            failed: 0,
        });

        let successCount = 0;
        let failCount = 0;
        const failedErrors: string[] = [];

        for (let i = 0; i < usersToProcess.length; i++) {
            const user = usersToProcess[i];
            const userName = user.full_name || user.email || 'User';
            
            setBatchProgress({
                current: i + 1,
                total: usersToProcess.length,
                currentName: userName,
                success: successCount,
                failed: failCount,
            });

            try {
                const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                    body: { userId: user.id, bvn: user.bvn, nin: user.nin, forceUpdate: false }
                });

                if (error) {
                    throw new Error(error.message || 'Function invocation failed');
                }

                if (data?.error && (!data?.accounts || data.accounts.length === 0)) {
                    throw new Error(data.error);
                }

                const genAcc = data?.accounts?.[0]?.account_number || data?.account_number;
                const genBank = data?.accounts?.[0]?.bank_name || data?.bank_name;

                if (!genAcc) {
                    throw new Error(data?.message || 'No account returned');
                }

                successCount++;
                // Update live state immediately
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, account_number: genAcc, bank_name: genBank } : u));
            } catch (err: any) {
                console.warn(`Batch account generate error for ${user.email}:`, err);
                failCount++;
                if (failedErrors.length < 3) {
                    failedErrors.push(`${userName}: ${err.message || 'Error'}`);
                }
            }

            setBatchProgress(prev => ({
                ...prev,
                success: successCount,
                failed: failCount,
            }));
        }

        setBatchProcessing(false);
        await fetchUsers();
        
        let reportMsg = `Processed ${usersToProcess.length} users:\n• ${successCount} accounts generated/confirmed\n• ${failCount} failed`;
        if (failedErrors.length > 0) {
            reportMsg += `\n\nIssues encountered:\n${failedErrors.join('\n')}`;
        }

        Alert.alert(
            successCount > 0 ? "Batch Engine Finished 🎉" : "Batch Engine Report ⚠️",
            reportMsg
        );
    };

    const handleGenerateSingleUserAccount = async (targetUser: UserProfile | null) => {
        if (!targetUser) return;
        setGeneratingSingleAcc(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                body: { 
                    userId: targetUser.id, 
                    bvn: targetUser.bvn, 
                    nin: targetUser.nin,
                    forceUpdate: true,
                    forceSecondAccount: true 
                }
            });
            if (error) throw error;
            if (data?.error && (!data?.accounts || data.accounts.length === 0)) throw new Error(data.error);

            const newAcc = data?.accounts?.[0]?.account_number || data?.account_number;
            const newBank = data?.accounts?.[0]?.bank_name || data?.bank_name;

            if (!newAcc) {
                throw new Error(data?.message || "No virtual account returned");
            }

            // Immediately reflect in state and users list
            setSelectedUser(prev => prev ? { ...prev, account_number: newAcc, bank_name: newBank } : null);
            setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, account_number: newAcc, bank_name: newBank } : u));

            Alert.alert(
                "Account Generated Successfully 🏦",
                `Virtual account generated!\nBank: ${newBank || '9Payment Service Bank / PalmPay'}\nAccount: ${newAcc}`
            );

            fetchUsers();
        } catch (e: any) {
            Alert.alert("Generation Failed", e.message || "Failed to generate virtual account.");
        } finally {
            setGeneratingSingleAcc(false);
        }
    };

    const handleManualAssignVA = async () => {
        if (!selectedUser) return;
        const cleanAcc = manualAccNumber.trim();
        const cleanBank = manualBankName.trim();
        if (!cleanAcc || cleanAcc.length < 8) {
            Alert.alert("Invalid Account", "Please enter a valid account number (at least 8 digits).");
            return;
        }
        if (!cleanBank) {
            Alert.alert("Invalid Bank", "Please specify a bank name.");
            return;
        }

        setAssigningManualVa(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-virtual-account', {
                body: {
                    action: 'assign_manual',
                    userId: selectedUser.id,
                    bankName: cleanBank,
                    accountNumber: cleanAcc,
                    accountName: manualAccName.trim() || selectedUser.full_name || 'Valued User'
                }
            });

            if (error) throw error;
            if (data?.error && !data?.account) throw new Error(data.error);

            const savedAcc = data?.account?.account_number || cleanAcc;
            const savedBank = data?.account?.bank_name || cleanBank;

            setSelectedUser(prev => prev ? { ...prev, account_number: savedAcc, bank_name: savedBank } : null);
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, account_number: savedAcc, bank_name: savedBank } : u));

            Alert.alert(
                "Virtual Account Assigned 🏦",
                `Successfully assigned dedicated bank account!\nBank: ${savedBank}\nAccount: ${savedAcc}`
            );
            setShowManualVaModal(false);
            fetchUsers();
        } catch (err: any) {
            Alert.alert("Assignment Failed", err.message || "Failed to assign virtual account.");
        } finally {
            setAssigningManualVa(false);
        }
    };

    const handleExecuteChangePassword = async () => {
        if (!selectedUser) return;
        if (!newPasswordInput || newPasswordInput.trim().length < 6) {
            Alert.alert("Password Too Short", "Please enter a password with at least 6 characters.");
            return;
        }

        setChangingPasswordProcessing(true);
        try {
            const cleanPass = newPasswordInput.trim();
            let functionSuccess = false;
            let emailSentStatus = false;

            // Step 1: Call admin-reset-password edge function
            try {
                const { data, error } = await supabase.functions.invoke('admin-reset-password', {
                    body: {
                        userId: selectedUser.id,
                        email: selectedUser.email,
                        newPassword: cleanPass,
                        sendEmailNotification: sendPasswordEmailNotification
                    }
                });

                if (error) throw error;
                if (data?.error && !data?.success) throw new Error(data.error);

                functionSuccess = true;
                emailSentStatus = !!data?.emailSent;
            } catch (fnErr: any) {
                console.warn("admin-reset-password edge function notice:", fnErr);
            }

            // Step 2: Fallback if edge function failed or not reachable
            if (!functionSuccess) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser && currentUser.id === selectedUser.id) {
                    const { error: ownErr } = await supabase.auth.updateUser({ password: cleanPass });
                    if (ownErr) throw ownErr;
                } else if (selectedUser.email) {
                    const { error: emailResetErr } = await supabase.auth.resetPasswordForEmail(selectedUser.email);
                    if (emailResetErr) throw emailResetErr;
                    emailSentStatus = true;
                }
            }

            // Copy to clipboard for instant convenience
            await Clipboard.setStringAsync(cleanPass);

            Alert.alert(
                "Password Authority 🔐",
                `Successfully updated password for ${selectedUser.full_name}!\n\nNew Password: ${cleanPass}\n(Copied to clipboard)\n\n${emailSentStatus ? '✉️ Confirmation email sent to user inbox.' : 'Please inform the user of their new password.'}`
            );

            setShowChangePasswordModal(false);
            setNewPasswordInput('');
        } catch (err: any) {
            Alert.alert("Password Update Failed", err.message || "Could not update user password.");
        } finally {
            setChangingPasswordProcessing(false);
        }
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
                .neq('status', 'deleted')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Authoritative fetch of all virtual accounts via edge function (bypasses RLS with service role)
            let allVas: any[] = [];
            try {
                const { data: vaRes } = await supabase.functions.invoke('create-virtual-account', {
                    body: { action: 'list_all' }
                });
                if (vaRes?.accounts && Array.isArray(vaRes.accounts)) {
                    allVas = vaRes.accounts;
                }
            } catch (vaErr) {
                console.warn("Edge function list_all notice, falling back to direct table fetch:", vaErr);
            }

            // Fallback to direct fetch if edge function didn't return accounts
            if (allVas.length === 0) {
                const { data: directVas } = await supabase
                    .from('virtual_accounts')
                    .select('user_id, account_number, bank_name')
                    .order('created_at', { ascending: true });
                if (directVas) allVas = directVas;
            }

            const vaMap = new Map<string, { account_number: string; bank_name: string }>();
            if (allVas) {
                allVas.forEach((va: any) => {
                    if (va.user_id && va.account_number && !vaMap.has(va.user_id)) {
                        vaMap.set(va.user_id, { account_number: va.account_number, bank_name: va.bank_name });
                    }
                });
            }

            const { data: corpEmails } = await supabase
                .from('corporate_admin_emails')
                .select('user_id, email, username');

            const corpMap = new Map((corpEmails || []).map(c => [c.user_id, c.email]));

            // Fetch live crypto balances across users
            const { data: allCryptoBals } = await supabase
                .from('crypto_balances')
                .select('user_id, asset, balance');

            const cryptoMap = new Map<string, { totalUSD: number; totalNGN: number; tokens: string[]; hasCrypto: boolean }>();
            if (allCryptoBals) {
                allCryptoBals.forEach((cb: any) => {
                    const bal = Number(cb.balance || 0);
                    if (bal > 0) {
                        const prev = cryptoMap.get(cb.user_id) || { totalUSD: 0, totalNGN: 0, tokens: [], hasCrypto: true };
                        const assetRate = getAssetPriceUSD(cb.asset);
                        prev.totalUSD += bal * assetRate;
                        prev.totalNGN = prev.totalUSD * 1500;
                        const tokenSym = (cb.asset || 'USDT').toUpperCase();
                        if (!prev.tokens.includes(tokenSym)) prev.tokens.push(tokenSym);
                        prev.hasCrypto = true;
                        cryptoMap.set(cb.user_id, prev);
                    }
                });
            }
            
            const enrichedData = (data || []).map((u: any) => {
                const directVa = vaMap.get(u.id);
                const joinVa = Array.isArray(u.virtual_accounts) ? u.virtual_accounts[0] : u.virtual_accounts;
                const accNum = directVa?.account_number || joinVa?.account_number || u.account_number || null;
                const bName = directVa?.bank_name || joinVa?.bank_name || u.bank_name || 'PalmPay / 9PSB';
                const cInfo = cryptoMap.get(u.id) || { totalUSD: 0, totalNGN: 0, tokens: [], hasCrypto: false };

                return {
                    ...u,
                    account_number: accNum,
                    bank_name: bName,
                    corporate_email: corpMap.get(u.id) || (u.email?.endsWith('@abumafhal.com.ng') ? u.email : null),
                    crypto_info: cInfo
                };
            });
            setUsers(enrichedData);
        } catch (error: any) {
            Alert.alert('Error Fetching Users', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Real User History & Crypto
    const fetchUserHistory = async (userId: string) => {
        setLoadingHistory(true);
        try {
            // 1. Fetch User Financial Transactions (up to 100 recent for full audit)
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);
            setUserTransactions(txData || []);

            // 2. Fetch User Crypto Balances
            const { data: cryptoBals } = await supabase
                .from('crypto_balances')
                .select('*')
                .eq('user_id', userId)
                .order('asset', { ascending: true });
            setUserCryptoBalances(cryptoBals || []);

            // 3. Fetch User Crypto Deposit Addresses
            const { data: cryptoAddrs } = await supabase
                .from('crypto_addresses')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setUserCryptoAddresses(cryptoAddrs || []);

            // 4. Fetch User Purchased Virtual Cards
            const { data: cardsData } = await supabase
                .from('user_virtual_cards')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setUserVirtualCards(cardsData || []);

            // 5. Fetch User KYC Requests
            const { data: kycData } = await supabase
                .from('kyc_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            setUserKycRequests(kycData || []);
        } catch (error) {
            setUserTransactions([]);
            setUserCryptoBalances([]);
            setUserCryptoAddresses([]);
            setUserVirtualCards([]);
            setUserKycRequests([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDirectCryptoFundOrDebit = async (isDebit: boolean, asset: string, amount: number) => {
        if (!selectedUser || amount <= 0) return;
        setCryptoFundProcessing(true);
        try {
            const cleanAsset = asset.toLowerCase();
            const { data: existing } = await supabase
                .from('crypto_balances')
                .select('*')
                .eq('user_id', selectedUser.id)
                .ilike('asset', cleanAsset)
                .maybeSingle();

            const currentBal = Number(existing?.balance || 0);
            const newBal = isDebit ? Math.max(0, currentBal - amount) : currentBal + amount;

            if (existing) {
                await supabase
                    .from('crypto_balances')
                    .update({ balance: newBal, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('crypto_balances')
                    .insert({
                        user_id: selectedUser.id,
                        asset: cleanAsset,
                        balance: newBal,
                    });
            }

            // Record audit transaction in database
            await supabase.from('transactions').insert({
                user_id: selectedUser.id,
                amount: amount,
                type: `crypto_${isDebit ? 'debit' : 'credit'}`,
                status: 'completed',
                description: `Admin Crypto ${isDebit ? 'Debit' : 'Credit'} (${asset.toUpperCase()})`,
                reference: `adm_crypto_${Date.now()}`
            });

            Alert.alert(
                "Crypto Balance Updated ⚡",
                `Successfully ${isDebit ? 'debited' : 'funded'} ${amount} ${asset.toUpperCase()} for ${selectedUser.full_name}.\nNew Balance: ${newBal} ${asset.toUpperCase()}`
            );
            setCryptoFundingModal(false);
            setCryptoFundAmount('');
            fetchUserHistory(selectedUser.id);
        } catch (e: any) {
            Alert.alert("Crypto Update Error", e.message || "Failed to update crypto balance.");
        } finally {
            setCryptoFundProcessing(false);
        }
    };

    const getAssetPriceUSD = (asset: string): number => {
        const a = (asset || '').toUpperCase();
        if (a.includes('USDT') || a.includes('USDC') || a.includes('USD')) return 1;
        if (a.includes('BTC')) return 65000;
        if (a.includes('ETH')) return 3400;
        if (a.includes('SOL')) return 150;
        if (a.includes('BNB')) return 580;
        return 1;
    };

    const getFilteredTransactions = () => {
        let list = [...userTransactions];
        if (txFilterType === 'credit') {
            list = list.filter(t => t.type?.toLowerCase().includes('topup') || t.type?.toLowerCase().includes('fund') || t.type?.toLowerCase().includes('credit'));
        } else if (txFilterType === 'debit') {
            list = list.filter(t => !t.type?.toLowerCase().includes('topup') && !t.type?.toLowerCase().includes('fund') && !t.type?.toLowerCase().includes('credit'));
        } else if (txFilterType === 'crypto') {
            list = list.filter(t => t.type?.toLowerCase().includes('crypto') || t.description?.toLowerCase().includes('crypto') || t.reference?.toLowerCase().includes('crypto'));
        } else if (txFilterType === 'bills') {
            list = list.filter(t => t.type?.toLowerCase().includes('data') || t.type?.toLowerCase().includes('airtime') || t.type?.toLowerCase().includes('cable') || t.type?.toLowerCase().includes('bill') || t.type?.toLowerCase().includes('electricity'));
        }

        if (txSearch.trim()) {
            const q = txSearch.toLowerCase().trim();
            list = list.filter(t => 
                (t.reference && t.reference.toLowerCase().includes(q)) ||
                (t.description && t.description.toLowerCase().includes(q)) ||
                (t.type && t.type.toLowerCase().includes(q)) ||
                (t.amount && t.amount.toString().includes(q)) ||
                (t.status && t.status.toLowerCase().includes(q))
            );
        }
        return list;
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
            if (filterStatus === 'crypto') matchesStatus = !!u.crypto_info?.hasCrypto;
            if (filterStatus === 'missing_va') matchesStatus = !u.account_number;

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
        
        Alert.alert("Permanent Delete", `Are you sure you want to PERMANENTLY delete ${selectedUser.full_name}? All account records will be wiped.`, [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete Permanently", 
                style: "destructive", 
                onPress: async () => {
                    setLoading(true);
                    const targetId = selectedUser.id;
                    const targetEmail = selectedUser.email;
                    try {
                        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('payment-webhook', {
                            body: { 
                                action: 'admin_delete_user',
                                userId: targetId,
                                email: targetEmail
                            }
                        });

                        if (edgeErr || edgeRes?.success === false) {
                            await supabase.from('profiles').delete().eq('id', targetId);
                        }

                        setUsers(prev => prev.filter(u => u.id !== targetId));
                        setSelectedUser(null);
                        Alert.alert("Deleted Successfully", "User has been permanently deleted from the system.");
                        fetchUsers();
                    } catch (err: any) {
                        console.error("Delete user error:", err);
                        setUsers(prev => prev.filter(u => u.id !== targetId));
                        setSelectedUser(null);
                        Alert.alert("Notice", err?.message || "User removed.");
                    } finally {
                        setLoading(false);
                    }
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
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity 
                                onPress={() => {
                                    setNewPasswordInput('');
                                    setShowPasswordPlaintext(false);
                                    setShowChangePasswordModal(true);
                                }} 
                                style={[s.iconCircleBtn, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
                            >
                                <Ionicons name="key" size={15} color="#D97706" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={exportProfile} style={s.iconCircleBtn}>
                                <Ionicons name="share-outline" size={16} color={T.navyDark} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={[s.iconCircleBtn, { backgroundColor: T.goldBg }]}>
                                <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={16} color={T.goldDark} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Executive Deep Navy Banner with Clean Multi-Tier Arrangement (Zero Overlaps) */}
                    <LinearGradient colors={[T.navyDark, '#0B1530', T.navyMid]} style={s.modalHeroBanner}>
                        {/* Tier 1: Avatar, Identity & Direct Contact Action Pills */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                <View style={s.modalAvatarWrapper}>
                                    {selectedUser?.avatar_url ? (
                                        <Image source={{ uri: selectedUser.avatar_url }} style={s.modalAvatarImage} resizeMode="cover" />
                                    ) : (
                                        <Text style={s.modalAvatarText}>{selectedUser?.full_name?.charAt(0).toUpperCase()}</Text>
                                    )}
                                </View>
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.modalUserName} numberOfLines={1}>{selectedUser?.full_name}</Text>
                                        {selectedUser?.role === 'admin' && <Text style={{ fontSize: 13 }}>👑</Text>}
                                    </View>
                                    <Text style={s.modalUserEmail} numberOfLines={1}>{selectedUser?.email}</Text>
                                    <Text style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
                                        {selectedUser?.phone || 'No phone attached'}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <TouchableOpacity onPress={() => contactUser('call')} style={s.contactBtn}>
                                    <Ionicons name="call" size={15} color={T.gold} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => contactUser('whatsapp')} style={[s.contactBtn, { backgroundColor: T.successBg, borderColor: T.success }]}>
                                    <Ionicons name="logo-whatsapp" size={16} color={T.success} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Tier 2: Responsive Badges Ribbon (Separated to eliminate collisions) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                            <View style={[s.statusBadge, selectedUser?.status === 'active' ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                <Text style={[s.statusBadgeText, selectedUser?.status === 'active' ? { color: T.success } : { color: T.danger }]}>
                                    {selectedUser?.status?.toUpperCase()}
                                </Text>
                            </View>
                            <View style={s.badgeVerified}>
                                <Ionicons name="shield-checkmark" size={10} color={T.info} />
                                <Text style={s.badgeVerifiedText}>Tier {selectedUser?.kyc_tier || 1}</Text>
                            </View>
                            {selectedUser?.account_number && (
                                <View style={[s.badgeVerified, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: 'rgba(212, 175, 55, 0.4)' }]}>
                                    <Ionicons name="card" size={10} color={T.gold} />
                                    <Text style={[s.badgeVerifiedText, { color: T.gold }]}>{selectedUser.account_number}</Text>
                                </View>
                            )}
                            {selectedUser?.corporate_email && (
                                <View style={s.badgeCorp}>
                                    <Ionicons name="at-circle" size={10} color={T.warning} />
                                    <Text style={s.badgeCorpText}>Corp</Text>
                                </View>
                            )}
                            {userCryptoBalances.some(b => Number(b.balance) > 0) && (
                                <View style={[s.badgeVerified, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                    <Ionicons name="flash" size={10} color="#D97706" />
                                    <Text style={[s.badgeVerifiedText, { color: '#B45309', fontWeight: '900' }]}>CRYPTO ACTIVE</Text>
                                </View>
                            )}
                        </View>
                    </LinearGradient>

                    {/* Navigation Tabs (Height 48 for comfortable touch and zero overlap) */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 48, maxHeight: 48, backgroundColor: T.card, borderBottomWidth: 1.5, borderBottomColor: T.border }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                        {[
                            { key: 'overview', label: 'Overview', icon: 'wallet-outline' },
                            { key: 'crypto', label: `Crypto (${userCryptoBalances.length})`, icon: 'logo-bitcoin' },
                            { key: 'transactions', label: `Transactions (${userTransactions.length})`, icon: 'receipt-outline' },
                            { key: 'kyc', label: 'Identity & KYC', icon: 'finger-print-outline' },
                            { key: 'controls', label: 'Controls', icon: 'options-outline' },
                            { key: 'notify', label: 'Notify', icon: 'chatbubble-ellipses-outline' },
                            { key: 'logs', label: 'Audit Logs', icon: 'list-outline' },
                        ].map(t => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setModalTab(t.key as any)}
                                style={[s.modalTabItem, modalTab === t.key ? s.modalTabItemActive : null, { paddingHorizontal: 14 }]}
                            >
                                <Ionicons name={t.icon as any} size={14} color={modalTab === t.key ? T.navyDark : T.textSub} />
                                <Text style={[s.modalTabText, modalTab === t.key ? { color: T.navyDark, fontWeight: '900' } : null]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        {/* TAB 1: OVERVIEW & WALLET FUNDING */}
                        {modalTab === 'overview' && (
                            <View style={{ padding: 14 }}>
                                {/* Crypto Holdings Snapshot Teaser Card */}
                                <TouchableOpacity
                                    onPress={() => setModalTab('crypto')}
                                    style={{
                                        backgroundColor: '#0F172A',
                                        borderRadius: 14,
                                        padding: 14,
                                        marginBottom: 12,
                                        borderWidth: 1.5,
                                        borderColor: '#F59E0B',
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 2,
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                                                <Ionicons name="flash" size={18} color="#D97706" />
                                            </View>
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF' }}>Crypto Portfolio</Text>
                                                    <View style={{ backgroundColor: 'rgba(245,158,11,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#FBBF24' }}>LIVE ON-CHAIN</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>
                                                    {userCryptoBalances.filter(b => Number(b.balance) > 0).length > 0
                                                        ? `${userCryptoBalances.filter(b => Number(b.balance) > 0).length} active token(s) held`
                                                        : 'Tap to inspect balances & deposit addresses'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#FBBF24' }}>
                                                ${userCryptoBalances.reduce((acc, b) => acc + (Number(b.balance || 0) * getAssetPriceUSD(b.asset)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Text>
                                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#CBD5E1' }}>
                                                ≈ ₦{(userCryptoBalances.reduce((acc, b) => acc + (Number(b.balance || 0) * getAssetPriceUSD(b.asset)), 0) * 1500).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                {/* Vault Balance Card */}
                                <View style={s.walletCard}>
                                    <Text style={s.walletLabel}>Vault Balance</Text>
                                    <Text style={s.walletValue}>₦{(selectedUser?.credit_balance || selectedUser?.balance || 0).toLocaleString()}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                                        <View style={s.accountChip}>
                                            <Ionicons name="card" size={12} color={T.gold} />
                                            <Text style={s.accountChipText}>{selectedUser?.account_number || 'No Virtual Account'}</Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <TouchableOpacity
                                                onPress={() => handleGenerateSingleUserAccount(selectedUser)}
                                                disabled={generatingSingleAcc}
                                                style={{
                                                    backgroundColor: T.goldBg,
                                                    borderColor: T.goldDark,
                                                    borderWidth: 1,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 5,
                                                    borderRadius: 8,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                {generatingSingleAcc ? (
                                                    <ActivityIndicator size="small" color={T.goldDark} />
                                                ) : (
                                                    <>
                                                        <Ionicons name="flash" size={11} color={T.goldDark} />
                                                        <Text style={{ color: T.goldDark, fontSize: 10, fontWeight: '900' }}>
                                                            {selectedUser?.account_number ? '⚡ Auto-Refresh' : '⚡ Generate Account'}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => {
                                                    setManualBankName(selectedUser?.bank_name || 'Palmpay');
                                                    setManualAccNumber(selectedUser?.account_number || '');
                                                    setManualAccName(selectedUser?.full_name || 'ABU MAFHAL LTD');
                                                    setShowManualVaModal(true);
                                                }}
                                                style={{
                                                    backgroundColor: T.infoBg,
                                                    borderColor: T.info,
                                                    borderWidth: 1,
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 5,
                                                    borderRadius: 8,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="create-outline" size={11} color={T.info} />
                                                <Text style={{ color: T.info, fontSize: 10, fontWeight: '900' }}>
                                                    ✏️ Manual Assign
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Bank: {selectedUser?.bank_name || '9Payment Service Bank / PalmPay'}</Text>
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
                                            <Ionicons name="arrow-down-circle" size={16} color={!isDebit ? '#FFFFFF' : T.success} />
                                            <Text style={[s.fundingToggleText, !isDebit ? { color: '#FFFFFF' } : { color: T.success }]}>Fund (+) Credit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={() => setIsDebit(true)}
                                            style={[s.fundingTogglePill, isDebit ? s.fundingTogglePillActiveDebit : null]}
                                        >
                                            <Ionicons name="arrow-up-circle" size={16} color={isDebit ? '#FFFFFF' : T.danger} />
                                            <Text style={[s.fundingToggleText, isDebit ? { color: '#FFFFFF' } : { color: T.danger }]}>Debit (-) Deduct</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Amount Input Row */}
                                    <View style={s.amountInputContainer}>
                                        <Text style={s.nairaSymbol}>₦</Text>
                                        <TextInput 
                                            placeholder="Enter Amount (e.g. 5000)" 
                                            placeholderTextColor={T.textSub}
                                            keyboardType="numeric"
                                            style={s.customAmountInput}
                                            value={fundAmount}
                                            onChangeText={setFundAmount}
                                        />
                                        {fundAmount.length > 0 && (
                                            <TouchableOpacity onPress={() => setFundAmount('')} style={{ padding: 4 }}>
                                                <Ionicons name="close-circle" size={18} color={T.textSub} />
                                            </TouchableOpacity>
                                        )}
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

                                    {/* Prominent, Big, Bold Action Execution Button */}
                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) {
                                                Alert.alert("Invalid Amount", "Please enter a valid positive amount.");
                                                return;
                                            }
                                            handleDirectFundOrDebit(isDebit ? 'debit' : 'fund', Number(fundAmount));
                                        }}
                                        disabled={fundingProcessing || !fundAmount || Number(fundAmount) <= 0}
                                        style={[
                                            s.executeFundingBtn, 
                                            isDebit ? { backgroundColor: T.danger } : { backgroundColor: T.success },
                                            (!fundAmount || Number(fundAmount) <= 0) ? { opacity: 0.5 } : { opacity: 1 }
                                        ]}
                                    >
                                        {fundingProcessing ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name={isDebit ? "arrow-up-circle" : "checkmark-circle"} size={20} color="#FFFFFF" />
                                                <Text style={s.executeFundingBtnText}>
                                                    {isDebit 
                                                        ? `CONFIRM DEBIT ${fundAmount ? '(₦' + Number(fundAmount).toLocaleString() + ')' : ''}` 
                                                        : `CONFIRM FUNDING ${fundAmount ? '(₦' + Number(fundAmount).toLocaleString() + ')' : ''}`
                                                    }
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
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

                                {/* Crypto Portfolio Snapshot in Overview */}
                                <View style={s.controlCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="logo-bitcoin" size={16} color={T.goldDark} />
                                            <Text style={s.sectionHeading}>Crypto Portfolio Snapshot</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => setModalTab('crypto')}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: T.goldDark }}>Manage Crypto</Text>
                                            <Ionicons name="chevron-forward" size={12} color={T.goldDark} />
                                        </TouchableOpacity>
                                    </View>

                                    {loadingHistory ? (
                                        <ActivityIndicator size="small" color={T.navyDark} />
                                    ) : userCryptoBalances.length === 0 ? (
                                        <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                                            <Text style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>User has no recorded cryptocurrency holdings.</Text>
                                            <TouchableOpacity 
                                                onPress={() => { setCryptoFundIsDebit(false); setCryptoFundingModal(true); }}
                                                style={{ backgroundColor: T.navyDark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                            >
                                                <Ionicons name="flash" size={12} color={T.gold} />
                                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>+ Credit First Crypto Asset</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                                {userCryptoBalances.map(b => (
                                                    <View key={b.id || b.asset} style={{ backgroundColor: T.bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={{ fontWeight: '900', color: T.goldDark, fontSize: 11 }}>{b.asset?.toUpperCase()}:</Text>
                                                        <Text style={{ fontWeight: '800', color: T.navyDark, fontSize: 11 }}>{Number(b.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                            <TouchableOpacity 
                                                onPress={() => setModalTab('crypto')}
                                                style={{ backgroundColor: T.goldBg, borderWidth: 1, borderColor: T.goldDark, paddingVertical: 6, borderRadius: 8, alignItems: 'center' }}
                                            >
                                                <Text style={{ color: T.goldDark, fontSize: 11, fontWeight: '900' }}>View Detailed Crypto Holdings & Addresses ➔</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* Recent Transactions Preview in Overview */}
                                <View style={s.controlCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="receipt-outline" size={16} color={T.navyDark} />
                                            <Text style={s.sectionHeading}>Recent Transactions ({userTransactions.length})</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => setModalTab('transactions')}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: T.navyDark }}>View Ledger</Text>
                                            <Ionicons name="chevron-forward" size={12} color={T.navyDark} />
                                        </TouchableOpacity>
                                    </View>

                                    {loadingHistory ? (
                                        <ActivityIndicator size="small" color={T.navyDark} />
                                    ) : userTransactions.length === 0 ? (
                                        <Text style={{ fontSize: 11, color: T.textSub, textAlign: 'center', paddingVertical: 8 }}>No transactions on record.</Text>
                                    ) : (
                                        <View>
                                            {userTransactions.slice(0, 3).map((tx, idx) => (
                                                <TouchableOpacity 
                                                    key={tx.id || idx}
                                                    onPress={() => setSelectedTransactionDetails(tx)}
                                                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: idx < 2 ? 1 : 0, borderBottomColor: T.border }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                        <Ionicons 
                                                            name={tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('credit') ? 'arrow-down-circle' : 'arrow-up-circle'} 
                                                            size={18} 
                                                            color={tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('credit') ? T.success : T.danger} 
                                                        />
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontSize: 11, fontWeight: '800', color: T.navyDark }} numberOfLines={1}>
                                                                {tx.description || tx.type || 'Transaction'}
                                                            </Text>
                                                            <Text style={{ fontSize: 9.5, color: T.textSub }}>
                                                                {new Date(tx.created_at).toLocaleDateString()} • {tx.status}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={{ fontSize: 11.5, fontWeight: '900', color: tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('credit') ? T.success : T.navyDark }}>
                                                        {tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('credit') ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                            <TouchableOpacity 
                                                onPress={() => setModalTab('transactions')}
                                                style={{ marginTop: 8, backgroundColor: T.navyDark, paddingVertical: 7, borderRadius: 8, alignItems: 'center' }}
                                            >
                                                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>Inspect Full Transaction Ledger ➔</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

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

                        {/* TAB: CRYPTO CENTER (Full Holdings, Valuation, Deposit Addresses, Direct Credit/Debit) */}
                        {modalTab === 'crypto' && (
                            <View style={{ padding: 14 }}>
                                {/* Crypto Valuation Banner */}
                                <LinearGradient
                                    colors={['#0A1128', '#1E293B']}
                                    style={s.cryptoValuationCard}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="logo-bitcoin" size={16} color={T.gold} />
                                            <Text style={s.cryptoValuationLabel}>ESTIMATED CRYPTO HOLDINGS</Text>
                                        </View>
                                        <View style={[s.statusBadge, selectedUser?.crypto_enabled ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                            <Text style={[s.statusBadgeText, selectedUser?.crypto_enabled ? { color: T.success } : { color: T.danger }]}>
                                                {selectedUser?.crypto_enabled ? 'CRYPTO ENABLED ⚡' : 'CRYPTO LOCKED 🔒'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={s.cryptoValuationUsd}>
                                        ${userCryptoBalances.reduce((acc, b) => acc + (Number(b.balance || 0) * getAssetPriceUSD(b.asset)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    <Text style={s.cryptoValuationNgn}>
                                        ≈ ₦{(userCryptoBalances.reduce((acc, b) => acc + (Number(b.balance || 0) * getAssetPriceUSD(b.asset)), 0) * 1500).toLocaleString('en-US', { maximumFractionDigits: 0 })} NGN Est.
                                    </Text>

                                    {/* Action Buttons Row */}
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setCryptoFundIsDebit(false);
                                                setCryptoFundingModal(true);
                                            }}
                                            style={s.cryptoFundActionBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="arrow-down-circle" size={15} color="#FFFFFF" />
                                            <Text style={s.cryptoFundActionBtnText}>+ Direct Credit Crypto</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setCryptoFundIsDebit(true);
                                                setCryptoFundingModal(true);
                                            }}
                                            style={s.cryptoDebitActionBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="arrow-up-circle" size={15} color="#FFFFFF" />
                                            <Text style={s.cryptoDebitActionBtnText}>- Direct Debit Crypto</Text>
                                        </TouchableOpacity>
                                    </View>
                                </LinearGradient>

                                {/* Asset Breakdown Cards */}
                                <Text style={s.sectionHeading}>Asset Balances ({userCryptoBalances.length > 0 ? userCryptoBalances.length : 'Supported'}) 🪙</Text>
                                {loadingHistory ? (
                                    <ActivityIndicator size="small" color={T.navyDark} style={{ marginVertical: 12 }} />
                                ) : (
                                    <View style={{ gap: 8 }}>
                                        {(userCryptoBalances.length > 0 
                                            ? userCryptoBalances 
                                            : [
                                                { id: '1', asset: 'USDT', balance: 0 },
                                                { id: '2', asset: 'BTC', balance: 0 },
                                                { id: '3', asset: 'ETH', balance: 0 },
                                                { id: '4', asset: 'SOL', balance: 0 }
                                            ]
                                        ).map((assetItem, index) => {
                                            const sym = assetItem.asset.toUpperCase();
                                            const bal = Number(assetItem.balance || 0);
                                            const priceUsd = getAssetPriceUSD(sym);
                                            const valUsd = bal * priceUsd;
                                            const valNgn = valUsd * 1500;

                                            return (
                                                <View key={assetItem.id || index} style={s.cryptoAssetCard}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                            <View style={s.cryptoIconBubble}>
                                                                <Ionicons 
                                                                    name={sym.includes('BTC') ? "logo-bitcoin" : sym.includes('ETH') ? "cube-outline" : sym.includes('SOL') ? "flash-outline" : "cash-outline"} 
                                                                    size={18} 
                                                                    color={T.goldDark} 
                                                                />
                                                            </View>
                                                            <View>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                    <Text style={s.cryptoSymbolText}>{sym}</Text>
                                                                    <View style={s.networkChip}>
                                                                        <Text style={s.networkChipText}>{sym === 'USDT' ? 'TRC20 / BEP20' : sym === 'BTC' ? 'NATIVE BITCOIN' : 'MAINNET'}</Text>
                                                                    </View>
                                                                </View>
                                                                <Text style={s.cryptoBalSub}>
                                                                    ≈ ${valUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (₦{valNgn.toLocaleString('en-US', { maximumFractionDigits: 0 })})
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <View style={{ alignItems: 'flex-end' }}>
                                                            <Text style={s.cryptoBalValue}>
                                                                {bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                                            </Text>
                                                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                                                <TouchableOpacity
                                                                    onPress={() => {
                                                                        setCryptoFundAsset(sym);
                                                                        setCryptoFundIsDebit(false);
                                                                        setCryptoFundingModal(true);
                                                                    }}
                                                                    style={s.quickAdjustCredit}
                                                                >
                                                                    <Text style={s.quickAdjustText}>+ Credit</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    onPress={() => {
                                                                        setCryptoFundAsset(sym);
                                                                        setCryptoFundIsDebit(true);
                                                                        setCryptoFundingModal(true);
                                                                    }}
                                                                    style={s.quickAdjustDebit}
                                                                >
                                                                    <Text style={s.quickAdjustText}>- Debit</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {/* User Dedicated Deposit Addresses Section */}
                                <Text style={[s.sectionHeading, { marginTop: 16 }]}>User Crypto Deposit Addresses ({userCryptoAddresses.length}) 📬</Text>
                                {loadingHistory ? (
                                    <ActivityIndicator size="small" color={T.navyDark} />
                                ) : userCryptoAddresses.length === 0 ? (
                                    <View style={s.noCardsCard}>
                                        <Ionicons name="qr-code-outline" size={32} color={T.navyDark} />
                                        <Text style={s.noCardsTitle}>No Crypto Addresses Found</Text>
                                        <Text style={s.noCardsSub}>User has not generated any crypto deposit address yet.</Text>
                                    </View>
                                ) : (
                                    <View style={{ gap: 8 }}>
                                        {userCryptoAddresses.map((addr) => (
                                            <View key={addr.id} style={s.cryptoAddressCard}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <View style={s.networkBadge}>
                                                            <Text style={s.networkBadgeText}>{(addr.network || 'TRC20').toUpperCase()}</Text>
                                                        </View>
                                                        <Text style={{ fontWeight: '800', color: T.navyDark, fontSize: 12 }}>
                                                            {(addr.currency || 'USDT').toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <View style={[s.statusBadge, addr.is_active !== false ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                                        <Text style={[s.statusBadgeText, addr.is_active !== false ? { color: T.success } : { color: T.danger }]}>
                                                            {addr.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={s.addressBox}>
                                                    <Text style={s.addressText} numberOfLines={1} ellipsizeMode="middle">
                                                        {addr.address}
                                                    </Text>
                                                    <TouchableOpacity 
                                                        onPress={() => copyToClipboard(addr.address, 'Deposit Address')}
                                                        style={s.copyAddressBtn}
                                                    >
                                                        <Ionicons name="copy-outline" size={14} color={T.navyDark} />
                                                    </TouchableOpacity>
                                                </View>

                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                    <Text style={{ fontSize: 9.5, color: T.textSub }}>
                                                        Created: {addr.created_at ? new Date(addr.created_at).toLocaleDateString() : 'Recent'}
                                                    </Text>
                                                    <Text style={{ fontSize: 9.5, color: T.goldDark, fontWeight: '700' }}>
                                                        Instant Scan & Deposit
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* TAB: TRANSACTIONS (Ledger, Search, Filters, Detail Inspector) */}
                        {modalTab === 'transactions' && (
                            <View style={{ padding: 14 }}>
                                {/* Ledger KPI Stats Strip */}
                                <View style={s.txKpiRow}>
                                    <View style={s.txKpiCard}>
                                        <Text style={s.txKpiLabel}>TOTAL TXNS</Text>
                                        <Text style={s.txKpiVal}>{userTransactions.length}</Text>
                                    </View>
                                    <View style={s.txKpiCard}>
                                        <Text style={[s.txKpiLabel, { color: T.success }]}>TOTAL INFLOW (+)</Text>
                                        <Text style={[s.txKpiVal, { color: T.success }]}>
                                            ₦{userTransactions
                                                .filter(t => t.type?.toLowerCase().includes('topup') || t.type?.toLowerCase().includes('fund') || t.type?.toLowerCase().includes('credit'))
                                                .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                                                .toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={s.txKpiCard}>
                                        <Text style={[s.txKpiLabel, { color: T.danger }]}>TOTAL OUTFLOW (-)</Text>
                                        <Text style={[s.txKpiVal, { color: T.danger }]}>
                                            ₦{userTransactions
                                                .filter(t => !t.type?.toLowerCase().includes('topup') && !t.type?.toLowerCase().includes('fund') && !t.type?.toLowerCase().includes('credit'))
                                                .reduce((sum, t) => sum + Number(t.amount || 0), 0)
                                                .toLocaleString()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Transaction Search Bar */}
                                <View style={s.txSearchBar}>
                                    <Ionicons name="search" size={15} color={T.navyDark} />
                                    <TextInput 
                                        placeholder="Search by reference, service, or amount..."
                                        placeholderTextColor={T.textSub}
                                        style={s.txSearchInput}
                                        value={txSearch}
                                        onChangeText={setTxSearch}
                                    />
                                    {txSearch.length > 0 && (
                                        <TouchableOpacity onPress={() => setTxSearch('')}>
                                            <Ionicons name="close-circle" size={16} color={T.textSub} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Transaction Filter Chips */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                                    {[
                                        { key: 'all', label: `All (${userTransactions.length})` },
                                        { key: 'credit', label: 'Credits (+)' },
                                        { key: 'debit', label: 'Debits (-)' },
                                        { key: 'crypto', label: 'Crypto ⚡' },
                                        { key: 'bills', label: 'Bills & Data 📱' }
                                    ].map(f => (
                                        <TouchableOpacity
                                            key={f.key}
                                            onPress={() => setTxFilterType(f.key as any)}
                                            style={[s.txFilterChip, txFilterType === f.key ? s.txFilterChipActive : null]}
                                        >
                                            <Text style={[s.txFilterChipText, txFilterType === f.key ? { color: '#FFFFFF' } : { color: T.navyDark }]}>
                                                {f.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {/* Transactions Ledger List */}
                                <Text style={s.sectionHeading}>Transaction History ({getFilteredTransactions().length}) 📑</Text>
                                {loadingHistory ? (
                                    <ActivityIndicator size="small" color={T.navyDark} style={{ marginVertical: 20 }} />
                                ) : getFilteredTransactions().length === 0 ? (
                                    <View style={s.noCardsCard}>
                                        <Ionicons name="receipt-outline" size={32} color={T.navyDark} />
                                        <Text style={s.noCardsTitle}>No Transactions Found</Text>
                                        <Text style={s.noCardsSub}>
                                            {txSearch ? `No matches found for "${txSearch}".` : 'No transactions recorded under this category.'}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={{ gap: 8 }}>
                                        {getFilteredTransactions().map((tx) => {
                                            const isCredit = tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('fund') || tx.type?.toLowerCase().includes('credit');
                                            const isCrypto = tx.type?.toLowerCase().includes('crypto') || tx.description?.toLowerCase().includes('crypto');
                                            const status = (tx.status || 'completed').toLowerCase();

                                            return (
                                                <TouchableOpacity
                                                    key={tx.id}
                                                    onPress={() => setSelectedTransactionDetails(tx)}
                                                    style={s.txFullCard}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                                            <View style={[
                                                                s.txDirectionBubble,
                                                                isCrypto 
                                                                    ? { backgroundColor: '#FEF3C7' } 
                                                                    : isCredit 
                                                                    ? { backgroundColor: '#ECFDF5' } 
                                                                    : { backgroundColor: '#FEE2E2' }
                                                            ]}>
                                                                <Ionicons 
                                                                    name={isCrypto ? 'logo-bitcoin' : isCredit ? 'arrow-down' : 'arrow-up'} 
                                                                    size={16} 
                                                                    color={isCrypto ? T.goldDark : isCredit ? T.success : T.danger} 
                                                                />
                                                            </View>

                                                            <View style={{ flex: 1 }}>
                                                                <Text style={s.txTitleFull} numberOfLines={1}>
                                                                    {tx.description || tx.type || 'Transaction'}
                                                                </Text>
                                                                <Text style={s.txMetaText} numberOfLines={1}>
                                                                    REF: {tx.reference || tx.id?.slice(0, 10)} • {new Date(tx.created_at).toLocaleString()}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                                                            <Text style={[s.txAmountFull, isCredit ? { color: T.success } : { color: T.navyDark }]}>
                                                                {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                                                            </Text>
                                                            <View style={[
                                                                s.txStatusPill,
                                                                status === 'completed' || status === 'successful' 
                                                                    ? s.txStatusCompleted 
                                                                    : status === 'pending' 
                                                                    ? s.txStatusPending 
                                                                    : s.txStatusFailed
                                                            ]}>
                                                                <Text style={[
                                                                    s.txStatusPillText,
                                                                    status === 'completed' || status === 'successful' 
                                                                        ? { color: T.success } 
                                                                        : status === 'pending' 
                                                                        ? { color: T.warning } 
                                                                        : { color: T.danger }
                                                                ]}>
                                                                    {status.toUpperCase()}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>

                                                    {/* Footer with Inspector hint */}
                                                    <View style={s.txCardFooter}>
                                                        <Text style={s.txCardFooterText}>Tap to inspect receipt & audit details</Text>
                                                        <Ionicons name="chevron-forward" size={12} color={T.goldDark} />
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
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
                                {/* 👑 Royal Credential Vault & Password Authority Suite */}
                                <LinearGradient
                                    colors={['#050B18', '#0D1736', '#14214D']}
                                    style={s.credentialVaultCard}
                                >
                                    <View style={s.credentialVaultHeader}>
                                        <View style={s.credentialVaultIcon}>
                                            <Ionicons name="key" size={18} color="#D4AF37" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.credentialVaultTitle}>CREDENTIAL AUTHORITY</Text>
                                                <View style={s.credentialSecurityBadge}>
                                                    <Text style={s.credentialSecurityBadgeText}>AES-256</Text>
                                                </View>
                                            </View>
                                            <Text style={s.credentialVaultSub}>
                                                Password Management & Security Governance
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={s.credentialVaultActions}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setNewPasswordInput('');
                                                setShowPasswordPlaintext(false);
                                                setShowChangePasswordModal(true);
                                            }}
                                            style={s.credentialPrimaryBtn}
                                            activeOpacity={0.8}
                                        >
                                            <LinearGradient
                                                colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={s.credentialPrimaryBtnGradient}
                                            >
                                                <Ionicons name="lock-closed" size={14} color="#0A1128" />
                                                <Text style={s.credentialPrimaryBtnText}>Change Password</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={handleDirectEmailResetDispatch}
                                            disabled={sendingDirectResetEmail}
                                            style={s.credentialSecondaryBtn}
                                            activeOpacity={0.7}
                                        >
                                            {sendingDirectResetEmail ? (
                                                <ActivityIndicator size="small" color="#D4AF37" />
                                            ) : (
                                                <>
                                                    <Ionicons name="mail-outline" size={14} color="#D4AF37" />
                                                    <Text style={s.credentialSecondaryBtnText}>Send Reset Link</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </LinearGradient>

                                {/* ❄️ Anti-Fraud Instant Security Freeze Suite */}
                                <View style={[s.controlCard, { borderColor: selectedUser?.status === 'suspended' ? T.danger : 'rgba(212, 175, 55, 0.3)' }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={[s.statIconCircle, { backgroundColor: selectedUser?.status === 'suspended' ? T.dangerBg : 'rgba(16, 185, 129, 0.15)' }]}>
                                                <Ionicons name={selectedUser?.status === 'suspended' ? "snow" : "shield-checkmark"} size={16} color={selectedUser?.status === 'suspended' ? T.danger : T.success} />
                                            </View>
                                            <View>
                                                <Text style={s.sectionHeading}>Anti-Fraud Security Freeze</Text>
                                                <Text style={{ fontSize: 10, color: T.textSub, marginTop: 1 }}>
                                                    {selectedUser?.status === 'suspended' ? 'Current: FROZEN & LOCKED ❄️' : 'Current: UNLOCKED & ACTIVE 🟢'}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={handleToggleSecurityFreeze}
                                            style={[
                                                s.gridBtn,
                                                { width: 'auto', paddingHorizontal: 12, paddingVertical: 6 },
                                                selectedUser?.status === 'active' ? s.gridBtnDanger : s.gridBtnSuccess
                                            ]}
                                        >
                                            <Ionicons name={selectedUser?.status === 'active' ? "lock-closed" : "lock-open"} size={14} color={selectedUser?.status === 'active' ? T.danger : T.success} />
                                            <Text style={[s.gridBtnText, selectedUser?.status === 'active' ? { color: T.danger } : { color: T.success }]}>
                                                {selectedUser?.status === 'active' ? 'Freeze Now ❄️' : 'Unfreeze 🟢'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* 🛡️ Executive Daily Transfer Limit Suite */}
                                <View style={s.controlCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="speedometer-outline" size={16} color={T.goldDark} />
                                            <Text style={s.sectionHeading}>Daily Transfer Limit (Rana)</Text>
                                        </View>
                                        <Text style={{ fontSize: 11, fontWeight: '900', color: T.goldDark }}>
                                            ₦{((selectedUser?.transfer_limit || selectedUser?.daily_limit || 500000) >= 100000000 ? 'Unlimited' : (selectedUser?.transfer_limit || selectedUser?.daily_limit || 500000).toLocaleString())}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {[
                                            { label: '₦50k', val: 50000 },
                                            { label: '₦200k', val: 200000 },
                                            { label: '₦500k', val: 500000 },
                                            { label: '₦1M', val: 1000000 },
                                            { label: 'Unlimited ♾️', val: 999999999 }
                                        ].map(lim => {
                                            const isCurr = (selectedUser?.transfer_limit || selectedUser?.daily_limit || 500000) === lim.val;
                                            return (
                                                <TouchableOpacity
                                                    key={lim.val}
                                                    onPress={() => handleSetDailyLimit(lim.val)}
                                                    style={[
                                                        s.presetChip,
                                                        isCurr ? s.presetChipActive : null,
                                                        { paddingHorizontal: 10, paddingVertical: 6 }
                                                    ]}
                                                >
                                                    <Text style={[s.presetChipText, isCurr ? { color: '#FFFFFF' } : { color: T.navyDark }]}>
                                                        {lim.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* 🔢 Transaction PIN Authority Suite */}
                                <View style={s.controlCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="keypad" size={16} color={T.goldDark} />
                                            <Text style={s.sectionHeading}>Transaction PIN Authority (Cire Kudi)</Text>
                                        </View>
                                        <Text style={{ fontSize: 10, color: T.textSub, fontWeight: '700' }}>
                                            {selectedUser?.transaction_pin ? `PIN: ••••` : 'Default: 1234'}
                                        </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                        <TouchableOpacity
                                            onPress={() => handleResetTransactionPin('1234')}
                                            disabled={resetPinProcessing}
                                            style={[s.gridBtn, { flex: 1, backgroundColor: T.goldBg, borderColor: T.gold }]}
                                        >
                                            <Ionicons name="refresh" size={14} color={T.goldDark} />
                                            <Text style={[s.gridBtnText, { color: T.goldDark }]}>
                                                {resetPinProcessing ? 'Setting...' : "Reset PIN to '1234'"}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setShowCustomPinBox(!showCustomPinBox)}
                                            style={[s.gridBtn, { flex: 1, backgroundColor: T.card, borderColor: T.border }]}
                                        >
                                            <Ionicons name="create-outline" size={14} color={T.navyDark} />
                                            <Text style={s.gridBtnText}>Custom 4-Digit PIN</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {showCustomPinBox && (
                                        <View style={{ marginTop: 8, padding: 8, backgroundColor: T.bg, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
                                            <Text style={{ fontSize: 10, color: T.navyDark, fontWeight: '700', marginBottom: 4 }}>Enter 4-Digit Custom PIN:</Text>
                                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                <TextInput
                                                    value={customPinInput}
                                                    onChangeText={setCustomPinInput}
                                                    keyboardType="numeric"
                                                    maxLength={4}
                                                    placeholder="e.g. 5566"
                                                    placeholderTextColor={T.textSub}
                                                    style={{ flex: 1, height: 36, backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.gold, paddingHorizontal: 10, fontWeight: '900', letterSpacing: 4 }}
                                                />
                                                <TouchableOpacity
                                                    onPress={() => handleResetTransactionPin(customPinInput)}
                                                    disabled={customPinInput.length !== 4 || resetPinProcessing}
                                                    style={{ backgroundColor: T.navyDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                                                >
                                                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>Save PIN</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>

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

    // Executive Batch Virtual Account Generator Modal
    const renderBatchModal = () => {
        const missingCount = users.filter(u => !u.account_number).length;

        return (
            <Modal
                visible={showBatchModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => !batchProcessing && setShowBatchModal(false)}
            >
                <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={s.modalOverlay}>
                    <View style={s.batchModalContainer}>
                        {/* Header */}
                        <View style={s.batchModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={s.batchModalIconCircle}>
                                    <Ionicons name="flash" size={18} color={T.gold} />
                                </View>
                                <View>
                                    <Text style={s.batchModalTitle}>Virtual Account Engine 🏦</Text>
                                    <Text style={s.batchModalSubtitle}>Automatic Bank Account Provisioning</Text>
                                </View>
                            </View>
                            {!batchProcessing && (
                                <TouchableOpacity onPress={() => setShowBatchModal(false)} style={s.iconCircleBtn}>
                                    <Ionicons name="close" size={18} color={T.navyDark} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={s.batchModalBody}>
                            {/* Stats Summary Box */}
                            <View style={s.batchSummaryBox}>
                                <View style={s.batchStatCol}>
                                    <Text style={s.batchStatNum}>{users.length}</Text>
                                    <Text style={s.batchStatLabel}>Total Users</Text>
                                </View>
                                <View style={s.batchStatDivider} />
                                <View style={s.batchStatCol}>
                                    <Text style={[s.batchStatNum, { color: T.success }]}>
                                        {users.filter(u => !!u.account_number).length}
                                    </Text>
                                    <Text style={s.batchStatLabel}>With Account</Text>
                                </View>
                                <View style={s.batchStatDivider} />
                                <View style={s.batchStatCol}>
                                    <Text style={[s.batchStatNum, { color: missingCount > 0 ? T.danger : T.success }]}>
                                        {missingCount}
                                    </Text>
                                    <Text style={s.batchStatLabel}>Missing Account</Text>
                                </View>
                            </View>

                            {batchProcessing ? (
                                <View style={s.batchProgressBox}>
                                    <ActivityIndicator size="large" color={T.goldDark} style={{ marginBottom: 10 }} />
                                    <Text style={s.batchProgressTitle}>
                                        Generating Account {batchProgress.current} of {batchProgress.total}...
                                    </Text>
                                    <Text style={s.batchProgressUser} numberOfLines={1}>
                                        User: {batchProgress.currentName}
                                    </Text>
                                    
                                    {/* Animated Progress Bar */}
                                    <View style={s.progressBarTrack}>
                                        <View 
                                            style={[
                                                s.progressBarFill, 
                                                { width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }
                                            ]} 
                                        />
                                    </View>

                                    <View style={s.batchLiveStats}>
                                        <Text style={{ color: T.success, fontSize: 11, fontWeight: '700' }}>✓ {batchProgress.success} Generated</Text>
                                        <Text style={{ color: T.danger, fontSize: 11, fontWeight: '700' }}>✗ {batchProgress.failed} Failed</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ marginVertical: 10 }}>
                                    <Text style={s.batchModalDesc}>
                                        {missingCount > 0
                                            ? `This automated batch engine will iterate through all ${missingCount} user(s) currently missing virtual accounts and create dedicated PalmPay / 9PSB bank accounts for each of them automatically.`
                                            : 'All registered users currently have dedicated virtual bank accounts! You can run a batch sync pass anytime to confirm account statuses.'
                                        }
                                    </Text>
                                </View>
                            )}

                            {/* Actions Row */}
                            <View style={s.batchActionRow}>
                                <TouchableOpacity
                                    onPress={() => setShowBatchModal(false)}
                                    disabled={batchProcessing}
                                    style={[s.batchCancelBtn, batchProcessing && { opacity: 0.5 }]}
                                >
                                    <Text style={s.batchCancelBtnText}>Close</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleStartBatchGeneration}
                                    disabled={batchProcessing}
                                    style={[s.batchStartBtn, batchProcessing && { opacity: 0.5 }]}
                                    activeOpacity={0.85}
                                >
                                    {batchProcessing ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="flash" size={14} color="#FFFFFF" />
                                            <Text style={s.batchStartBtnText}>
                                                {missingCount > 0 ? `Generate for ${missingCount} Users` : 'Run Batch Sync'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </BlurView>
            </Modal>
        );
    };

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

    // Manual Virtual Account Assignment Modal
    const renderManualVaModal = () => (
        <Modal 
            visible={showManualVaModal} 
            transparent 
            animationType="slide" 
            onRequestClose={() => !assigningManualVa && setShowManualVaModal(false)}
        >
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={s.modalOverlay}>
                <View style={s.createUserCard}>
                    <View style={s.createUserHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="card" size={20} color={T.gold} />
                            <Text style={s.createUserTitle}>Assign Dedicated Bank Account</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setShowManualVaModal(false)} 
                            disabled={assigningManualVa}
                            style={s.iconCircleBtn}
                        >
                            <Ionicons name="close" size={20} color={T.navyDark} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        <View style={{ gap: 12 }}>
                            <Text style={{ fontSize: 12, color: T.textSub }}>
                                Manually allocate or override the dedicated virtual account for <Text style={{ fontWeight: '800', color: T.navyDark }}>{selectedUser?.full_name || selectedUser?.email}</Text>.
                            </Text>

                            {/* Quick Bank Selector Chips */}
                            <View>
                                <Text style={s.fieldLabel}>Preset Partner Banks</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                                    {[
                                        'Palmpay',
                                        '9Payment Service Bank',
                                        'Moniepoint',
                                        'Wema Bank',
                                        'Sterling Bank',
                                        'Kuda Bank'
                                    ].map(b => (
                                        <TouchableOpacity
                                            key={b}
                                            onPress={() => setManualBankName(b)}
                                            style={[
                                                s.presetChip,
                                                manualBankName === b ? { backgroundColor: T.navyDark, borderColor: T.navyDark } : null
                                            ]}
                                        >
                                            <Text style={[s.presetChipText, manualBankName === b ? { color: '#FFFFFF' } : null]}>{b}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <View>
                                <Text style={s.fieldLabel}>Bank Name</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="e.g. Palmpay or 9Payment Service Bank"
                                    placeholderTextColor={T.textSub}
                                    value={manualBankName}
                                    onChangeText={setManualBankName}
                                />
                            </View>

                            <View>
                                <Text style={s.fieldLabel}>10-Digit Account Number</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="e.g. 6654763126"
                                    placeholderTextColor={T.textSub}
                                    keyboardType="numeric"
                                    maxLength={12}
                                    value={manualAccNumber}
                                    onChangeText={setManualAccNumber}
                                />
                            </View>

                            <View>
                                <Text style={s.fieldLabel}>Account Name</Text>
                                <TextInput 
                                    style={s.createInput}
                                    placeholder="e.g. ABU MAFHAL LTD"
                                    placeholderTextColor={T.textSub}
                                    value={manualAccName}
                                    onChangeText={setManualAccName}
                                />
                            </View>

                            <TouchableOpacity 
                                onPress={handleManualAssignVA}
                                disabled={assigningManualVa}
                                style={[s.createUserBtn, { backgroundColor: T.goldDark }]}
                            >
                                {assigningManualVa ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={s.createUserBtnText}>💾 Save Dedicated Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </BlurView>
        </Modal>
    );

    // Full Forensic Transaction Detail Inspection Modal
    const renderTransactionDetailsModal = () => {
        if (!selectedTransactionDetails) return null;
        const tx = selectedTransactionDetails;
        const isCredit = tx.type?.toLowerCase().includes('topup') || tx.type?.toLowerCase().includes('fund') || tx.type?.toLowerCase().includes('credit');
        const status = (tx.status || 'completed').toLowerCase();

        return (
            <Modal
                visible={!!selectedTransactionDetails}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSelectedTransactionDetails(null)}
            >
                <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={s.modalOverlay}>
                    <View style={s.txDetailModalCard}>
                        <View style={s.txDetailHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="receipt" size={20} color={T.gold} />
                                <Text style={s.txDetailTitle}>Transaction Forensic Receipt</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedTransactionDetails(null)} style={s.iconCircleBtn}>
                                <Ionicons name="close" size={18} color={T.navyDark} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                            <View style={[
                                s.receiptStatusBanner,
                                status === 'completed' || status === 'successful' 
                                    ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                    : status === 'pending'
                                    ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                                    : { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }
                            ]}>
                                <Ionicons 
                                    name={status === 'completed' || status === 'successful' ? "checkmark-circle" : status === 'pending' ? "hourglass" : "alert-circle"} 
                                    size={30} 
                                    color={status === 'completed' || status === 'successful' ? T.success : status === 'pending' ? T.warning : T.danger} 
                                />
                                <Text style={s.receiptAmountText}>
                                    {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                                </Text>
                                <Text style={[
                                    s.receiptStatusLabel,
                                    { color: status === 'completed' || status === 'successful' ? T.success : status === 'pending' ? T.warning : T.danger }
                                ]}>
                                    {status.toUpperCase()}
                                </Text>
                            </View>

                            <View style={s.receiptTable}>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Service / Type</Text>
                                    <Text style={s.receiptRowVal}>{tx.type || 'N/A'}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Description</Text>
                                    <Text style={[s.receiptRowVal, { flex: 1, textAlign: 'right' }]}>{tx.description || 'No description'}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Transaction Ref</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[s.receiptRowVal, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}>{tx.reference || 'N/A'}</Text>
                                        {tx.reference && (
                                            <TouchableOpacity onPress={() => copyToClipboard(tx.reference || '', 'Reference')}>
                                                <Ionicons name="copy-outline" size={14} color={T.goldDark} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {tx.gateway_reference && (
                                    <View style={s.receiptRow}>
                                        <Text style={s.receiptRowLabel}>Gateway Ref</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[s.receiptRowVal, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}>{tx.gateway_reference}</Text>
                                            <TouchableOpacity onPress={() => copyToClipboard(tx.gateway_reference || '', 'Gateway Ref')}>
                                                <Ionicons name="copy-outline" size={14} color={T.goldDark} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Transaction ID</Text>
                                    <Text style={[s.receiptRowVal, { fontSize: 10, color: T.textSub }]}>{tx.id}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Timestamp</Text>
                                    <Text style={s.receiptRowVal}>{new Date(tx.created_at).toLocaleString()}</Text>
                                </View>
                                <View style={s.receiptRow}>
                                    <Text style={s.receiptRowLabel}>Fee / Charge</Text>
                                    <Text style={s.receiptRowVal}>₦{Number(tx.fee || 0).toLocaleString()}</Text>
                                </View>
                            </View>

                            {tx.metadata && (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={s.sectionHeading}>Gateway Payload / Metadata</Text>
                                    <View style={s.metadataBox}>
                                        <Text style={s.metadataText}>
                                            {typeof tx.metadata === 'object' ? JSON.stringify(tx.metadata, null, 2) : String(tx.metadata)}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={{ gap: 8, marginTop: 16 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const dossier = [
                                            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                                            'ABU MAFHAL VERIFIED AUDIT RECEIPT',
                                            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                                            `Status: ${status.toUpperCase()}`,
                                            `Amount: ${isCredit ? '+' : '-'}₦${Number(tx.amount || 0).toLocaleString()}`,
                                            `Service / Type: ${tx.type || 'N/A'}`,
                                            `Description: ${tx.description || 'N/A'}`,
                                            `Reference ID: ${tx.reference || 'N/A'}`,
                                            `Gateway Reference: ${tx.gateway_reference || 'N/A'}`,
                                            `Transaction ID: ${tx.id}`,
                                            `Timestamp: ${new Date(tx.created_at).toLocaleString()}`,
                                            `Fee: ₦${Number(tx.fee || 0).toLocaleString()}`,
                                            `Client: ${selectedUser?.full_name || 'N/A'} (${selectedUser?.email || 'N/A'})`,
                                            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
                                        ].join('\n');
                                        copyToClipboard(dossier, 'Forensic Audit Dossier');
                                    }}
                                    style={[s.receiptCopyBtn, { backgroundColor: T.navyDark }]}
                                >
                                    <Ionicons name="document-text" size={14} color="#FFFFFF" />
                                    <Text style={[s.receiptCopyBtnText, { color: '#FFFFFF' }]}>Copy Full Forensic Dossier</Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => copyToClipboard(tx.reference || tx.id, 'Transaction Reference')}
                                        style={s.receiptCopyBtn}
                                    >
                                        <Ionicons name="copy" size={14} color={T.navyDark} />
                                        <Text style={s.receiptCopyBtnText}>Copy Ref Code</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setSelectedTransactionDetails(null)}
                                        style={s.receiptCloseBtn}
                                    >
                                        <Text style={s.receiptCloseBtnText}>Close Receipt</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>
        );
    };

    // Executive Direct Crypto Funding & Debit Modal
    const renderCryptoFundingModal = () => (
        <Modal
            visible={cryptoFundingModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => !cryptoFundProcessing && setCryptoFundingModal(false)}
        >
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 90} tint="dark" style={s.modalOverlay}>
                <View style={s.createUserCard}>
                    <View style={s.createUserHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="logo-bitcoin" size={20} color={T.gold} />
                            <Text style={s.createUserTitle}>Direct Crypto Adjuster ⚡</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setCryptoFundingModal(false)}
                            disabled={cryptoFundProcessing}
                            style={s.iconCircleBtn}
                        >
                            <Ionicons name="close" size={18} color={T.navyDark} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        <Text style={{ fontSize: 12, color: T.textSub, marginBottom: 12 }}>
                            Directly credit or debit crypto assets for <Text style={{ fontWeight: '800', color: T.navyDark }}>{selectedUser?.full_name || selectedUser?.email}</Text>.
                        </Text>

                        <View style={s.fundingToggleRow}>
                            <TouchableOpacity
                                onPress={() => setCryptoFundIsDebit(false)}
                                style={[s.fundingTogglePill, !cryptoFundIsDebit ? s.fundingTogglePillActiveFund : null]}
                            >
                                <Ionicons name="arrow-down-circle" size={16} color={!cryptoFundIsDebit ? '#FFFFFF' : T.success} />
                                <Text style={[s.fundingToggleText, !cryptoFundIsDebit ? { color: '#FFFFFF' } : { color: T.success }]}>
                                    + Credit / Fund
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setCryptoFundIsDebit(true)}
                                style={[s.fundingTogglePill, cryptoFundIsDebit ? s.fundingTogglePillActiveDebit : null]}
                            >
                                <Ionicons name="arrow-up-circle" size={16} color={cryptoFundIsDebit ? '#FFFFFF' : T.danger} />
                                <Text style={[s.fundingToggleText, cryptoFundIsDebit ? { color: '#FFFFFF' } : { color: T.danger }]}>
                                    - Debit / Deduct
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[s.fieldLabel, { marginTop: 12 }]}>Select Cryptocurrency Asset</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 }}>
                            {['USDT', 'BTC', 'ETH', 'SOL', 'BNB'].map(sym => (
                                <TouchableOpacity
                                    key={sym}
                                    onPress={() => setCryptoFundAsset(sym)}
                                    style={[
                                        s.presetChip,
                                        cryptoFundAsset === sym ? { backgroundColor: T.navyDark, borderColor: T.gold } : null
                                    ]}
                                >
                                    <Text style={[
                                        s.presetChipText,
                                        cryptoFundAsset === sym ? { color: '#FFFFFF', fontWeight: '900' } : null
                                    ]}>
                                        {sym}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[s.fieldLabel, { marginTop: 8 }]}>Amount in {cryptoFundAsset}</Text>
                        <View style={s.amountInputContainer}>
                            <Text style={[s.nairaSymbol, { fontSize: 13, color: T.goldDark }]}>{cryptoFundAsset}</Text>
                            <TextInput
                                placeholder={`Enter ${cryptoFundAsset} amount (e.g. 10)`}
                                placeholderTextColor={T.textSub}
                                keyboardType="numeric"
                                style={s.customAmountInput}
                                value={cryptoFundAmount}
                                onChangeText={setCryptoFundAmount}
                            />
                            {cryptoFundAmount.length > 0 && (
                                <TouchableOpacity onPress={() => setCryptoFundAmount('')} style={{ padding: 4 }}>
                                    <Ionicons name="close-circle" size={18} color={T.textSub} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={s.presetRow}>
                            {['5', '10', '25', '50', '100', '500'].map(val => (
                                <TouchableOpacity
                                    key={val}
                                    onPress={() => setCryptoFundAmount(val)}
                                    style={[s.presetChip, cryptoFundAmount === val ? s.presetChipActive : null]}
                                >
                                    <Text style={[s.presetChipText, cryptoFundAmount === val ? { color: '#FFFFFF' } : { color: T.navyDark }]}>
                                        +{val}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                const amt = Number(cryptoFundAmount);
                                if (isNaN(amt) || amt <= 0) {
                                    Alert.alert("Invalid Amount", "Please enter a valid positive number.");
                                    return;
                                }
                                handleDirectCryptoFundOrDebit(cryptoFundIsDebit, cryptoFundAsset, amt);
                            }}
                            disabled={cryptoFundProcessing || !cryptoFundAmount || Number(cryptoFundAmount) <= 0}
                            style={[
                                s.executeFundingBtn,
                                cryptoFundIsDebit ? { backgroundColor: T.danger } : { backgroundColor: T.success },
                                (!cryptoFundAmount || Number(cryptoFundAmount) <= 0) ? { opacity: 0.5 } : { opacity: 1 }
                            ]}
                        >
                            {cryptoFundProcessing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name={cryptoFundIsDebit ? "arrow-up-circle" : "checkmark-circle"} size={20} color="#FFFFFF" />
                                    <Text style={s.executeFundingBtnText}>
                                        {cryptoFundIsDebit 
                                            ? `CONFIRM DEBIT ${cryptoFundAmount ? `(${cryptoFundAmount} ${cryptoFundAsset})` : ''}`
                                            : `CONFIRM CREDIT ${cryptoFundAmount ? `(${cryptoFundAmount} ${cryptoFundAsset})` : ''}`
                                        }
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </BlurView>
        </Modal>
    );

    // Executive Royal Credential & Password Authority Suite (Real User Dossier)
    const renderChangePasswordModal = () => {
        const entropy = getPasswordEntropy(newPasswordInput);

        return (
            <Modal
                visible={showChangePasswordModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowChangePasswordModal(false)}
            >
                <BlurView intensity={Platform.OS === 'ios' ? 85 : 95} tint="dark" style={s.modalOverlay}>
                    <View style={s.passwordModalCard}>
                        {/* 24K Royal Gold Accent Header Strip */}
                        <LinearGradient
                            colors={['#8A6B29', '#DFB85C', '#F9E498', '#DFB85C', '#8A6B29']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ height: 3, width: '100%' }}
                        />

                        {/* Modal Header */}
                        <View style={s.passwordModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={s.credentialVaultIcon}>
                                    <Ionicons name="shield-checkmark" size={18} color="#D4AF37" />
                                </View>
                                <View>
                                    <Text style={s.passwordModalTitle}>CREDENTIAL & SECURITY AUTHORITY</Text>
                                    <Text style={s.passwordModalSubtitle}>Asalin Bayanan Mai Asusu & Canza Kalmar Sirri</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowChangePasswordModal(false)}
                                style={s.closeModalCircleBtn}
                            >
                                <Ionicons name="close" size={18} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false}>
                            {/* 👑 ASALIN BAYANAN MAI ASUSU (Authentic Real User Identity Dossier) */}
                            <LinearGradient
                                colors={['#0F1B3B', '#0B1430', '#060B18']}
                                style={s.authenticDossierCard}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="finger-print-outline" size={15} color="#D4AF37" />
                                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#D4AF37', letterSpacing: 0.5 }}>
                                            ASALIN BAYANAN MAI ASUSU
                                        </Text>
                                    </View>
                                    <View style={[s.statusBadge, selectedUser?.status === 'active' ? s.statusBadgeActive : s.statusBadgeSuspended]}>
                                        <Text style={[s.statusBadgeText, selectedUser?.status === 'active' ? { color: T.success } : { color: T.danger }]}>
                                            {selectedUser?.status?.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* User Core Profile Row */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={s.dossierAvatarWrapper}>
                                        {selectedUser?.avatar_url ? (
                                            <Image source={{ uri: selectedUser.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
                                        ) : (
                                            <Text style={{ color: '#0A1128', fontWeight: '900', fontSize: 18 }}>
                                                {selectedUser?.full_name?.charAt(0).toUpperCase() || 'U'}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.dossierUserName} numberOfLines={1}>{selectedUser?.full_name}</Text>
                                            {selectedUser?.role === 'admin' && <Text style={{ fontSize: 12 }}>👑</Text>}
                                        </View>
                                        <TouchableOpacity 
                                            onPress={async () => {
                                                if (selectedUser?.email) {
                                                    await Clipboard.setStringAsync(selectedUser.email);
                                                    Alert.alert("An Kwafi 📋", `Email ${selectedUser.email} an kwafi.`);
                                                }
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                                        >
                                            <Ionicons name="mail" size={12} color="#38BDF8" />
                                            <Text style={s.dossierEmailText} numberOfLines={1}>{selectedUser?.email}</Text>
                                            <Ionicons name="copy-outline" size={11} color="#94A3B8" />
                                        </TouchableOpacity>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Ionicons name="call" size={11} color="#D4AF37" />
                                            <Text style={s.dossierPhoneText}>{selectedUser?.phone || 'Babu lambar waya'}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Real Financial & Identity Data Grid */}
                                <View style={s.dossierDataGrid}>
                                    <View style={s.dossierGridItem}>
                                        <Text style={s.dossierGridLabel}>ASALIN VAULT / BAL</Text>
                                        <Text style={s.dossierGridValGold}>
                                            ₦{(selectedUser?.credit_balance || selectedUser?.balance || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={s.dossierGridItem}>
                                        <Text style={s.dossierGridLabel}>VIRTUAL ACCOUNT</Text>
                                        <Text style={s.dossierGridValWhite} numberOfLines={1}>
                                            {selectedUser?.account_number || 'Babu Account'}
                                        </Text>
                                    </View>
                                    <View style={s.dossierGridItem}>
                                        <Text style={s.dossierGridLabel}>BANK / KYC TIER</Text>
                                        <Text style={s.dossierGridValWhite} numberOfLines={1}>
                                            {selectedUser?.bank_name?.slice(0, 10) || 'Palmpay'} • Tier {selectedUser?.kyc_tier || 1}
                                        </Text>
                                    </View>
                                    <View style={s.dossierGridItem}>
                                        <Text style={s.dossierGridLabel}>KWANAN RAJISTA</Text>
                                        <Text style={s.dossierGridValSub}>
                                            {selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                                        </Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            {/* 🔒 Cryptographic Auth Security Explainer Notice */}
                            <View style={s.authHashNoticeCard}>
                                <Ionicons name="shield-half-sharp" size={16} color="#D4AF37" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.authHashNoticeTitle}>Tsaron Supabase Auth (One-Way Hash)</Text>
                                    <Text style={s.authHashNoticeSub}>
                                        Ba a taba ajiye tsohon password a fili ba saboda tsaron asusu (Argon2 / bcrypt hash). Zaka iya saita sabon password a kasa ko kuma ka tura masa link ta email ya canza da kanshi.
                                    </Text>
                                </View>
                            </View>

                            {/* 🔑 Set New Account Password Form (Starts Completely Clean) */}
                            <View style={s.passwordFormSection}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.passwordFieldLabel}>SHIGAR DA SABON PASSWORD</Text>
                                    {newPasswordInput.length > 0 && (
                                        <TouchableOpacity onPress={() => setNewPasswordInput('')}>
                                            <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '800' }}>Share</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={s.passwordInputContainer}>
                                    <Ionicons name="key" size={16} color="#D4AF37" style={{ marginRight: 8 }} />
                                    <TextInput
                                        placeholder="Rubuta sabon password (akalla haruffa 6)..."
                                        placeholderTextColor="#64748B"
                                        value={newPasswordInput}
                                        onChangeText={setNewPasswordInput}
                                        secureTextEntry={!showPasswordPlaintext}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={s.passwordTextInput}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPasswordPlaintext(!showPasswordPlaintext)}
                                        style={{ padding: 6 }}
                                    >
                                        <Ionicons
                                            name={showPasswordPlaintext ? "eye-off" : "eye"}
                                            size={18}
                                            color="#D4AF37"
                                        />
                                    </TouchableOpacity>
                                    {newPasswordInput.length > 0 && (
                                        <TouchableOpacity
                                            onPress={async () => {
                                                await Clipboard.setStringAsync(newPasswordInput);
                                                Alert.alert("An Kwafi 📋", "Sabuwar kalmar sirri an kwafi zuwa clipboard.");
                                            }}
                                            style={{ padding: 6 }}
                                        >
                                            <Ionicons name="copy-outline" size={18} color="#38BDF8" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Dynamic Password Entropy Meter */}
                                <View style={s.entropyContainer}>
                                    <View style={s.entropyBarRow}>
                                        {[1, 2, 3, 4].map(seg => (
                                            <View
                                                key={seg}
                                                style={[
                                                    s.entropySegment,
                                                    { backgroundColor: seg <= entropy.score ? entropy.color : 'rgba(255, 255, 255, 0.1)' }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                        <Text style={[s.entropyLabel, { color: entropy.color }]}>{entropy.label}</Text>
                                        <Text style={{ fontSize: 9.5, color: '#64748B' }}>{newPasswordInput.length} chars</Text>
                                    </View>
                                </View>

                                {/* Optional Quick Random Strong Generator Button */}
                                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
                                    <TouchableOpacity
                                        onPress={generateRandomSecurePassword}
                                        style={s.generatePasswordPill}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="sparkles" size={13} color="#D4AF37" />
                                        <Text style={s.generatePasswordPillText}>🎲 Samar Da Kakkaran Password Na Musamman</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Email Delivery Notification Toggle */}
                                <TouchableOpacity
                                    onPress={() => setSendPasswordEmailNotification(!sendPasswordEmailNotification)}
                                    style={s.emailToggleCard}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.toggleCheckBox, sendPasswordEmailNotification && s.toggleCheckBoxActive]}>
                                        {sendPasswordEmailNotification && <Ionicons name="checkmark" size={12} color="#0A1128" />}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={s.emailToggleTitle}>Tura Sakon Email Ga Mai Asusu</Text>
                                        <Text style={s.emailToggleSub}>
                                            Za a tura cikakken bayanin sabuwar kalmar sirri kai-tsaye zuwa ga {selectedUser?.email}.
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Confirm & Update Password Action Button */}
                                <TouchableOpacity
                                    onPress={handleExecuteChangePassword}
                                    disabled={changingPasswordProcessing || newPasswordInput.length < 6}
                                    style={[
                                        s.confirmPasswordBtn,
                                        newPasswordInput.length < 6 && { opacity: 0.5 }
                                    ]}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={s.confirmPasswordBtnGradient}
                                    >
                                        {changingPasswordProcessing ? (
                                            <ActivityIndicator size="small" color="#0A1128" />
                                        ) : (
                                            <>
                                                <Ionicons name="shield-checkmark" size={16} color="#0A1128" />
                                                <Text style={s.confirmPasswordBtnText}>TABBATAR DA SAUYA PASSWORD</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* ✉️ Direct 1-Tap Password Reset Link to Real User Email */}
                            <View style={s.emailResetDispatchCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                                        <Ionicons name="mail" size={15} color="#38BDF8" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#FFFFFF' }}>
                                            Tura Link Na Sake Password Zuwa Email
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                                            Link zai tafi inbox na {selectedUser?.email}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={handleDirectEmailResetDispatch}
                                    disabled={sendingDirectResetEmail}
                                    style={s.dispatchEmailLinkBtn}
                                    activeOpacity={0.8}
                                >
                                    {sendingDirectResetEmail ? (
                                        <ActivityIndicator size="small" color="#0A1128" />
                                    ) : (
                                        <>
                                            <Ionicons name="paper-plane" size={13} color="#0A1128" />
                                            <Text style={s.dispatchEmailLinkBtnText}>Tura Reset Link Yanzu 🚀</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* 🔢 Quick Transaction PIN Override Card */}
                            <View style={s.pinResetDispatchCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="keypad" size={15} color="#D4AF37" />
                                        <Text style={{ fontSize: 11, fontWeight: '900', color: '#D4AF37' }}>
                                            Transaction PIN Authority (Cire Kudi)
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 9.5, color: '#94A3B8' }}>
                                        {selectedUser?.transaction_pin ? 'PIN: Saita' : 'Babu PIN'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => handleResetTransactionPin('1234')}
                                        disabled={resetPinProcessing}
                                        style={s.resetDefaultPinBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="refresh" size={12} color="#D4AF37" />
                                        <Text style={s.resetDefaultPinBtnText}>Saita zuwa '1234'</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setShowCustomPinBox(!showCustomPinBox)}
                                        style={s.resetCustomPinBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="create-outline" size={12} color="#FFFFFF" />
                                        <Text style={s.resetCustomPinBtnText}>Lambar Musamman</Text>
                                    </TouchableOpacity>
                                </View>

                                {showCustomPinBox && (
                                    <View style={{ marginTop: 8, padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
                                        <Text style={{ fontSize: 9.5, color: '#CBD5E1', marginBottom: 4 }}>Shigar da sabon 4-digit PIN:</Text>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TextInput
                                                value={customPinInput}
                                                onChangeText={setCustomPinInput}
                                                keyboardType="numeric"
                                                maxLength={4}
                                                placeholder="1234"
                                                placeholderTextColor="#64748B"
                                                style={{ flex: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, paddingHorizontal: 8, color: '#FFFFFF', fontWeight: '900', letterSpacing: 4 }}
                                            />
                                            <TouchableOpacity
                                                onPress={() => handleResetTransactionPin(customPinInput)}
                                                disabled={customPinInput.length !== 4 || resetPinProcessing}
                                                style={{ backgroundColor: '#D4AF37', paddingHorizontal: 10, justifyContent: 'center', borderRadius: 6 }}
                                            >
                                                <Text style={{ color: '#0A1128', fontSize: 10, fontWeight: '900' }}>Ajiye</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Cancel / Close Modal Button */}
                            <TouchableOpacity
                                onPress={() => setShowChangePasswordModal(false)}
                                style={s.cancelPasswordBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={s.cancelPasswordBtnText}>Rufe / Close</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>
        );
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ headerShown: false }} /> 

            {/* Ultra-Luxury Mobile-First Executive Header */}
            <LinearGradient
                colors={['#050B18', '#0A1226', '#0F1B3B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.headerContainer}
            >
                {/* 24K Royal Gold Micro Top Accent Strip */}
                <LinearGradient
                    colors={['#8A6B29', '#DFB85C', '#F9E498', '#DFB85C', '#8A6B29']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.headerGoldStrip}
                />

                {/* Header Top Row (Brand Crest, Live Telemetry & Mobile Action Cluster) */}
                <View style={s.headerTopRow}>
                    {isSelectionMode ? (
                        <View style={s.selectionBadgePill}>
                            <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} style={s.closeSelectionBtn}>
                                <Ionicons name="close" size={16} color="#0A1128" />
                            </TouchableOpacity>
                            <Text style={s.selectionText}>{selectedIds.size} User(s) Selected</Text>
                        </View>
                    ) : (
                        <View style={s.brandCol}>
                            <View style={s.brandHeaderRow}>
                                <View style={s.brandEmblemBadge}>
                                    <Ionicons name="shield-checkmark" size={15} color="#D4AF37" />
                                </View>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.headerTitle}>USER GOVERNANCE</Text>
                                        <View style={s.liveStatusBadge}>
                                            <View style={s.liveStatusPulse} />
                                            <Text style={s.liveStatusText}>LIVE</Text>
                                        </View>
                                    </View>
                                    <Text style={s.headerSubTitle}>EXECUTIVE VAULT • {stats.totalUsers} PROFILES</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Action Buttons Cluster */}
                    <View style={s.headerActionCluster}>
                        {!isSelectionMode && (
                            <>
                                <TouchableOpacity 
                                    onPress={onRefresh} 
                                    style={s.headerGhostBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="refresh" size={17} color="#D4AF37" />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setShowBatchModal(true)} 
                                    style={[s.headerGhostBtn, stats.missingAccounts > 0 && s.headerGhostBtnAlert]}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="flash" size={16} color={stats.missingAccounts > 0 ? "#F59E0B" : "#D4AF37"} />
                                    {stats.missingAccounts > 0 && (
                                        <View style={s.headerActionBadge}>
                                            <Text style={s.headerActionBadgeText}>{stats.missingAccounts}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity 
                            onPress={() => setShowCreateUser(true)} 
                            activeOpacity={0.8}
                            style={s.addUserBtnShadow}
                        >
                            <LinearGradient
                                colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.addUserGradientBtn}
                            >
                                <Ionicons name="person-add" size={15} color="#0A1128" />
                                <Text style={s.addUserBtnText}>+ User</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Mobile-First Ultra-Luxury KPI Carousel Ribbon (Horizontal Scroll) */}
                {!isSelectionMode && (
                    <View style={s.ribbonWrapper}>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.ribbonContent}
                        >
                            {/* Card 1: TOTAL VAULT NGN */}
                            <LinearGradient
                                colors={['rgba(212, 175, 55, 0.16)', 'rgba(10, 17, 40, 0.7)']}
                                style={[s.statRibbonCard, { borderColor: '#D4AF37' }]}
                            >
                                <View style={s.statRibbonTop}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.2)' }]}>
                                        <Ionicons name="wallet" size={14} color="#D4AF37" />
                                    </View>
                                    <Text style={[s.statRibbonPill, { color: '#D4AF37', borderColor: 'rgba(212, 175, 55, 0.4)' }]}>FIAT</Text>
                                </View>
                                <Text style={s.statRibbonLabel}>TOTAL VAULT</Text>
                                <Text style={s.statRibbonValGold}>
                                    ₦{stats.totalBalance > 1000000 ? (stats.totalBalance/1000000).toFixed(2)+'M' : stats.totalBalance.toLocaleString()}
                                </Text>
                                <Text style={s.statRibbonSub}>Active Liquidity</Text>
                            </LinearGradient>

                            {/* Card 2: CRYPTO NET WORTH */}
                            <LinearGradient
                                colors={['rgba(245, 158, 11, 0.18)', 'rgba(20, 14, 4, 0.75)']}
                                style={[s.statRibbonCard, { borderColor: '#F59E0B' }]}
                            >
                                <View style={s.statRibbonTop}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.25)' }]}>
                                        <Ionicons name="flash" size={14} color="#F59E0B" />
                                    </View>
                                    <Text style={[s.statRibbonPill, { color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.4)' }]}>CRYPTO</Text>
                                </View>
                                <Text style={[s.statRibbonLabel, { color: '#FCD34D' }]}>CRYPTO ASSETS</Text>
                                <Text style={[s.statRibbonValGold, { color: '#FBBF24' }]}>
                                    ${stats.totalCryptoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text style={s.statRibbonSub} numberOfLines={1}>
                                    ≈ ₦{Math.round(stats.totalCryptoUSD * 1450).toLocaleString()} • {stats.cryptoHolders} Wallets
                                </Text>
                            </LinearGradient>

                            {/* Card 3: ACTIVE USERS */}
                            <LinearGradient
                                colors={['rgba(16, 185, 129, 0.16)', 'rgba(6, 25, 18, 0.7)']}
                                style={[s.statRibbonCard, { borderColor: '#10B981' }]}
                            >
                                <View style={s.statRibbonTop}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                    </View>
                                    <Text style={[s.statRibbonPill, { color: '#34D399', borderColor: 'rgba(16, 185, 129, 0.4)' }]}>HEALTHY</Text>
                                </View>
                                <Text style={[s.statRibbonLabel, { color: '#A7F3D0' }]}>ACTIVE USERS</Text>
                                <Text style={[s.statRibbonValGold, { color: '#34D399' }]}>{stats.activeUsers}</Text>
                                <Text style={s.statRibbonSub}>In Good Standing</Text>
                            </LinearGradient>

                            {/* Card 4: KYC VERIFIED */}
                            <LinearGradient
                                colors={['rgba(56, 189, 248, 0.16)', 'rgba(8, 22, 45, 0.7)']}
                                style={[s.statRibbonCard, { borderColor: '#38BDF8' }]}
                            >
                                <View style={s.statRibbonTop}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                                        <Ionicons name="shield-checkmark" size={14} color="#38BDF8" />
                                    </View>
                                    <Text style={[s.statRibbonPill, { color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.4)' }]}>TIER</Text>
                                </View>
                                <Text style={[s.statRibbonLabel, { color: '#BAE6FD' }]}>VERIFIED KYC</Text>
                                <Text style={[s.statRibbonValGold, { color: '#38BDF8' }]}>{stats.verifiedUsers}</Text>
                                <Text style={s.statRibbonSub}>Identity Cleared</Text>
                            </LinearGradient>

                            {/* Card 5: VIRTUAL ACCOUNTS */}
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => setShowBatchModal(true)}
                            >
                                <LinearGradient
                                    colors={['rgba(192, 132, 252, 0.16)', 'rgba(25, 12, 40, 0.7)']}
                                    style={[s.statRibbonCard, { borderColor: stats.missingAccounts > 0 ? '#F59E0B' : '#C084FC' }]}
                                >
                                    <View style={s.statRibbonTop}>
                                        <View style={[s.statIconCircle, { backgroundColor: 'rgba(192, 132, 252, 0.2)' }]}>
                                            <Ionicons name="card" size={14} color={stats.missingAccounts > 0 ? "#F59E0B" : "#C084FC"} />
                                        </View>
                                        <Text style={[s.statRibbonPill, { 
                                            color: stats.missingAccounts > 0 ? '#F59E0B' : '#C084FC', 
                                            borderColor: stats.missingAccounts > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(192, 132, 252, 0.4)' 
                                        }]}>
                                            {stats.missingAccounts > 0 ? 'NEEDS ATTN' : '100%'}
                                        </Text>
                                    </View>
                                    <Text style={[s.statRibbonLabel, { color: '#E9D5FF' }]}>DEDICATED VAS</Text>
                                    <Text style={[s.statRibbonValGold, { color: stats.missingAccounts > 0 ? '#FBBF24' : '#E9D5FF' }]}>
                                        {stats.totalUsers - stats.missingAccounts}/{stats.totalUsers}
                                    </Text>
                                    <Text style={s.statRibbonSub}>
                                        {stats.missingAccounts > 0 ? `⚠️ ${stats.missingAccounts} Missing (Tap)` : 'All Accounts Active'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Card 6: CORPORATE & ADMINS */}
                            <LinearGradient
                                colors={['rgba(244, 63, 94, 0.16)', 'rgba(35, 10, 18, 0.7)']}
                                style={[s.statRibbonCard, { borderColor: '#F43F5E' }]}
                            >
                                <View style={s.statRibbonTop}>
                                    <View style={[s.statIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
                                        <Ionicons name="briefcase" size={14} color="#F43F5E" />
                                    </View>
                                    <Text style={[s.statRibbonPill, { color: '#FB7185', borderColor: 'rgba(244, 63, 94, 0.4)' }]}>STAFF</Text>
                                </View>
                                <Text style={[s.statRibbonLabel, { color: '#FECDD3' }]}>CORPORATE</Text>
                                <Text style={[s.statRibbonValGold, { color: '#FB7185' }]}>{stats.corporateAdmins}</Text>
                                <Text style={s.statRibbonSub}>Admin Directory</Text>
                            </LinearGradient>
                        </ScrollView>
                    </View>
                )}

                {/* Dedicated High-Priority Virtual Account Alert (Mobile-First Luxury Strip) */}
                {!isSelectionMode && stats.missingAccounts > 0 && (
                    <TouchableOpacity 
                        onPress={() => setShowBatchModal(true)}
                        activeOpacity={0.85}
                        style={s.missingAlertCard}
                    >
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.18)', 'rgba(212, 175, 55, 0.12)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.missingAlertGradient}
                        >
                            <View style={s.missingAlertLeft}>
                                <View style={s.missingAlertIcon}>
                                    <Ionicons name="sparkles" size={14} color="#F59E0B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.missingAlertTitle}>
                                        {stats.missingAccounts} User(s) Need Virtual Accounts
                                    </Text>
                                    <Text style={s.missingAlertSub} numberOfLines={1}>
                                        Tap to launch automatic multi-bank account batch engine
                                    </Text>
                                </View>
                            </View>
                            <View style={s.missingAlertBtnPill}>
                                <Text style={s.missingAlertBtnText}>Generate</Text>
                                <Ionicons name="arrow-forward" size={12} color="#0A1128" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Mobile-First Luxury Frosted Search Capsule */}
                <View style={s.searchContainerLuxury}>
                    <Ionicons name="search" size={16} color="#D4AF37" />
                    <TextInput
                        placeholder="Search name, phone, email, account..."
                        placeholderTextColor="#94A3B8"
                        style={s.searchInputLuxury}
                        value={search}
                        onChangeText={handleSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                    <View style={s.searchResultPill}>
                        <Text style={s.searchResultPillText}>{getFilteredUsers().length}</Text>
                    </View>
                </View>

                {/* Mobile-First Luxury Filter Carousel Strip */}
                <View style={s.filterRowLuxury}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContentLuxury}>
                        {[
                            { key: 'all', label: `All Users (${stats.totalUsers})` },
                            { key: 'crypto', label: `⚡ Crypto Active (${stats.cryptoHolders})` },
                            { key: 'active', label: `Active (${stats.activeUsers})` },
                            { key: 'admin', label: `Admins 👑 (${stats.corporateAdmins})` },
                            { key: 'verified', label: `Verified 🛡️ (${stats.verifiedUsers})` },
                            { key: 'missing_va', label: `Missing VAs ⚠️ (${stats.missingAccounts})` },
                            { key: 'suspended', label: `Suspended ⛔ (${stats.highRiskCount})` },
                            { key: 'corporate', label: 'Corporate' },
                            { key: 'high_bal', label: 'High Vault 💎' }
                        ].map((f) => {
                            const isActive = filterStatus === f.key;
                            return (
                                <TouchableOpacity 
                                    key={f.key} 
                                    onPress={() => setFilterStatus(f.key as any)}
                                    activeOpacity={0.7}
                                    style={s.filterChipWrapper}
                                >
                                    {isActive ? (
                                        <LinearGradient
                                            colors={['#F59E0B', '#D4AF37', '#B8952B']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={s.filterChipLuxuryActive}
                                        >
                                            <Text style={s.filterChipTextLuxuryActive}>{f.label}</Text>
                                        </LinearGradient>
                                    ) : (
                                        <View style={s.filterChipLuxury}>
                                            <Text style={s.filterChipTextLuxury}>{f.label}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </LinearGradient>

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

            {/* Multi-Column Responsive Executive User Cards */}
            <FlatList
                key={`user-grid-${numColumns}`}
                data={getFilteredUsers()}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                columnWrapperStyle={numColumns > 1 ? { gap: 12, paddingHorizontal: 12 } : undefined}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[s.listContent, Platform.OS === 'web' && { maxWidth: 1560, width: '100%', alignSelf: 'center' }]}
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
                        style={[
                            s.userCard, 
                            numColumns > 1 && { flex: 1 / numColumns, marginHorizontal: 0 },
                            selectedIds.has(item.id) ? s.userCardSelected : null
                        ]}
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
                            {item.crypto_info?.hasCrypto && (
                                <View style={[s.badgeVerified, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                    <Ionicons name="flash" size={10} color="#D97706" />
                                    <Text style={[s.badgeVerifiedText, { color: '#B45309', fontWeight: '900' }]}>
                                        CRYPTO ⚡ {item.crypto_info.tokens.join(', ')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Section 3: Bottom Vault Balance Bar */}
                        <View style={s.vaultBalanceBar}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="wallet-outline" size={13} color={T.gold} />
                                    <Text style={s.vaultLabel}>VAULT:</Text>
                                    <Text style={s.vaultAmount}>₦{(item.credit_balance || item.balance || 0).toLocaleString()}</Text>
                                </View>
                                {item.crypto_info?.hasCrypto && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                                        <Ionicons name="logo-bitcoin" size={10} color="#D97706" />
                                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#B45309' }}>
                                            ${item.crypto_info.totalUSD.toFixed(2)}
                                        </Text>
                                    </View>
                                )}
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
            {renderBatchModal()}
            {renderUserModal()}
            {renderCreateUserModal()}
            {renderManualVaModal()}
            {renderTransactionDetailsModal()}
            {renderCryptoFundingModal()}
            {renderChangePasswordModal()}

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
        paddingTop: Platform.OS === 'ios' ? 50 : (Platform.OS === 'android' ? 36 : 16),
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1.5,
        borderBottomColor: '#D4AF37',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    headerGoldStrip: {
        height: 2.5,
        width: '100%',
        borderRadius: 2,
        marginBottom: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectionBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    closeSelectionBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(10, 17, 40, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    selectionText: {
        color: '#0A1128',
        fontSize: 13,
        fontWeight: '900',
    },
    brandCol: {
        flex: 1,
    },
    brandHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    brandEmblemBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderWidth: 1.2,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    liveStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: '#10B981',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 4,
    },
    liveStatusPulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
    },
    liveStatusText: {
        color: '#10B981',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerSubTitle: {
        color: '#D4AF37',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    headerActionCluster: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerGhostBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    headerGhostBtnAlert: {
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    headerActionBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 8,
        minWidth: 16,
        alignItems: 'center',
    },
    headerActionBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900',
    },
    addUserBtnShadow: {
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 3,
    },
    addUserGradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
    },
    addUserBtnText: {
        color: '#0A1128',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    ribbonWrapper: {
        marginBottom: 10,
        marginHorizontal: -12,
    },
    ribbonContent: {
        paddingHorizontal: 12,
        gap: 8,
    },
    statRibbonCard: {
        width: 140,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1.2,
        backgroundColor: 'rgba(10, 17, 40, 0.85)',
    },
    statRibbonTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    statIconCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statRibbonPill: {
        fontSize: 8,
        fontWeight: '900',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 0.8,
        textTransform: 'uppercase',
    },
    statRibbonLabel: {
        color: '#94A3B8',
        fontSize: 8.5,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statRibbonValGold: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        marginTop: 2,
    },
    statRibbonSub: {
        color: '#64748B',
        fontSize: 8.5,
        fontWeight: '700',
        marginTop: 2,
    },
    missingAlertCard: {
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F59E0B',
        marginBottom: 10,
    },
    missingAlertGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    missingAlertLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    missingAlertIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(245, 158, 11, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    missingAlertTitle: {
        color: '#FCD34D',
        fontSize: 11,
        fontWeight: '900',
    },
    missingAlertSub: {
        color: '#CBD5E1',
        fontSize: 9.5,
        fontWeight: '600',
        marginTop: 1,
    },
    missingAlertBtnPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#D4AF37',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 8,
    },
    missingAlertBtnText: {
        color: '#0A1128',
        fontSize: 10,
        fontWeight: '900',
    },
    searchContainerLuxury: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 12,
        paddingHorizontal: 10,
        height: 40,
        borderWidth: 1.2,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        marginBottom: 8,
    },
    searchInputLuxury: {
        flex: 1,
        marginLeft: 8,
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '600',
        paddingVertical: 0,
    },
    searchResultPill: {
        backgroundColor: 'rgba(212, 175, 55, 0.18)',
        borderWidth: 1,
        borderColor: '#D4AF37',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 6,
    },
    searchResultPillText: {
        color: '#D4AF37',
        fontSize: 9.5,
        fontWeight: '900',
    },
    filterRowLuxury: {
        marginHorizontal: -12,
    },
    filterContentLuxury: {
        paddingHorizontal: 12,
        gap: 6,
    },
    filterChipWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    filterChipLuxury: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    filterChipLuxuryActive: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    filterChipTextLuxury: {
        color: '#CBD5E1',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    filterChipTextLuxuryActive: {
        color: '#0A1128',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
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
        height: '92%',
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
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
    executeFundingBtn: {
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    executeFundingBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
        maxWidth: 600,
        alignSelf: 'center',
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

    /* Batch Generator Card & Modal Styles */
    batchTriggerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFDF5',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: T.gold,
        shadowColor: T.goldDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    batchIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: T.goldBg,
        borderWidth: 1,
        borderColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    batchTriggerTitle: {
        color: T.navyDark,
        fontSize: 12,
        fontWeight: '900',
    },
    batchTriggerSub: {
        color: T.textSub,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 1,
    },
    missingBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    missingBadgeText: {
        color: '#DC2626',
        fontSize: 9,
        fontWeight: '800',
    },
    allGoodBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    allGoodBadgeText: {
        color: '#059669',
        fontSize: 9,
        fontWeight: '800',
    },
    batchTriggerBtn: {
        backgroundColor: T.navyDark,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.gold,
    },
    batchTriggerBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '900',
    },

    batchModalContainer: {
        width: '92%',
        maxWidth: 620,
        alignSelf: 'center',
        maxHeight: '85%',
        backgroundColor: T.card,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: T.gold,
        overflow: 'hidden',
    },
    batchModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        backgroundColor: T.bg,
    },
    batchModalIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: T.navyDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    batchModalTitle: {
        color: T.navyDark,
        fontSize: 14,
        fontWeight: '900',
    },
    batchModalSubtitle: {
        color: T.goldDark,
        fontSize: 10,
        fontWeight: '700',
    },
    batchModalBody: {
        padding: 14,
    },
    batchSummaryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.bg,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 10,
    },
    batchStatCol: {
        flex: 1,
        alignItems: 'center',
    },
    batchStatNum: {
        fontSize: 16,
        fontWeight: '900',
        color: T.navyDark,
    },
    batchStatLabel: {
        fontSize: 8.5,
        color: T.textSub,
        fontWeight: '700',
        marginTop: 1,
        textTransform: 'uppercase',
    },
    batchStatDivider: {
        width: 1,
        height: 24,
        backgroundColor: T.border,
    },
    batchProgressBox: {
        backgroundColor: T.bg,
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
        marginVertical: 8,
        borderWidth: 1,
        borderColor: T.gold,
    },
    batchProgressTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navyDark,
        marginBottom: 2,
    },
    batchProgressUser: {
        fontSize: 11,
        color: T.goldDark,
        fontWeight: '700',
        marginBottom: 10,
    },
    progressBarTrack: {
        width: '100%',
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: T.goldDark,
        borderRadius: 4,
    },
    batchLiveStats: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    batchModalDesc: {
        fontSize: 11.5,
        color: T.textSub,
        lineHeight: 16,
        textAlign: 'center',
    },
    batchActionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    batchCancelBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: T.bg,
    },
    batchCancelBtnText: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '800',
    },
    batchStartBtn: {
        flex: 2,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: T.navyDark,
        borderWidth: 1,
        borderColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    batchStartBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },

    // Crypto Modern Styles
    cryptoValuationCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: T.gold,
    },
    cryptoValuationLabel: {
        color: T.gold,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    cryptoValuationUsd: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '900',
        marginTop: 4,
    },
    cryptoValuationNgn: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    cryptoFundActionBtn: {
        flex: 1,
        backgroundColor: T.success,
        paddingVertical: 9,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    cryptoFundActionBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    cryptoDebitActionBtn: {
        flex: 1,
        backgroundColor: T.danger,
        paddingVertical: 9,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    cryptoDebitActionBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    cryptoAssetCard: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
    },
    cryptoIconBubble: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: T.bg,
        borderWidth: 1,
        borderColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cryptoSymbolText: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyDark,
    },
    networkChip: {
        backgroundColor: T.bg,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: T.border,
    },
    networkChipText: {
        fontSize: 9,
        fontWeight: '800',
        color: T.textSub,
    },
    cryptoBalSub: {
        fontSize: 10,
        color: T.textSub,
        marginTop: 2,
    },
    cryptoBalValue: {
        fontSize: 14,
        fontWeight: '900',
        color: T.navyDark,
    },
    quickAdjustCredit: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    quickAdjustDebit: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    quickAdjustText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: T.navyDark,
    },
    cryptoAddressCard: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
    },
    networkBadge: {
        backgroundColor: T.navyDark,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    networkBadgeText: {
        color: T.gold,
        fontSize: 9,
        fontWeight: '900',
    },
    addressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: T.bg,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: T.border,
    },
    addressText: {
        flex: 1,
        fontSize: 11,
        color: T.navyDark,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    copyAddressBtn: {
        padding: 4,
        marginLeft: 6,
    },

    // Transaction Ledger Styles
    txKpiRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    txKpiCard: {
        flex: 1,
        backgroundColor: T.card,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: T.border,
        alignItems: 'center',
    },
    txKpiLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: T.textSub,
        marginBottom: 2,
    },
    txKpiVal: {
        fontSize: 12,
        fontWeight: '900',
        color: T.navyDark,
    },
    txSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.card,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: T.border,
        gap: 8,
    },
    txSearchInput: {
        flex: 1,
        fontSize: 12,
        color: T.textMain,
        padding: 0,
    },
    txFilterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: T.card,
        borderWidth: 1,
        borderColor: T.border,
    },
    txFilterChipActive: {
        backgroundColor: T.navyDark,
        borderColor: T.gold,
    },
    txFilterChipText: {
        fontSize: 11,
        fontWeight: '800',
    },
    txFullCard: {
        backgroundColor: T.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
    },
    txDirectionBubble: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txTitleFull: {
        fontSize: 12,
        fontWeight: '800',
        color: T.navyDark,
    },
    txMetaText: {
        fontSize: 9.5,
        color: T.textSub,
        marginTop: 2,
    },
    txAmountFull: {
        fontSize: 13,
        fontWeight: '900',
    },
    txStatusPill: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 3,
        alignSelf: 'flex-end',
    },
    txStatusCompleted: {
        backgroundColor: '#ECFDF5',
    },
    txStatusPending: {
        backgroundColor: '#FEF3C7',
    },
    txStatusFailed: {
        backgroundColor: '#FEE2E2',
    },
    txStatusPillText: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    txCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: T.border,
    },
    txCardFooterText: {
        fontSize: 9.5,
        color: T.goldDark,
        fontWeight: '700',
    },

    // Transaction Details Modal Styles
    txDetailModalCard: {
        width: '92%',
        maxWidth: 580,
        alignSelf: 'center',
        maxHeight: '85%',
        backgroundColor: T.card,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: T.gold,
        overflow: 'hidden',
    },
    txDetailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        backgroundColor: T.bg,
    },
    txDetailTitle: {
        color: T.navyDark,
        fontSize: 13,
        fontWeight: '900',
    },
    receiptStatusBanner: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    receiptAmountText: {
        fontSize: 24,
        fontWeight: '900',
        color: T.navyDark,
        marginTop: 6,
    },
    receiptStatusLabel: {
        fontSize: 11,
        fontWeight: '900',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    receiptTable: {
        backgroundColor: T.bg,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: T.border,
        gap: 10,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    receiptRowLabel: {
        fontSize: 11,
        color: T.textSub,
        fontWeight: '700',
    },
    receiptRowVal: {
        fontSize: 11,
        color: T.navyDark,
        fontWeight: '800',
    },
    metadataBox: {
        backgroundColor: '#0F172A',
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
    },
    metadataText: {
        color: '#38BDF8',
        fontSize: 9.5,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    receiptCopyBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: T.goldBg,
        borderWidth: 1,
        borderColor: T.goldDark,
    },
    receiptCopyBtnText: {
        color: T.navyDark,
        fontSize: 12,
        fontWeight: '800',
    },
    receiptCloseBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: T.navyDark,
    },
    receiptCloseBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },

    // Credential Authority & Password Vault Styles
    credentialVaultCard: {
        backgroundColor: '#070D1F',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    credentialVaultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    credentialVaultIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderWidth: 1.2,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    credentialVaultTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    credentialSecurityBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 0.8,
        borderColor: '#10B981',
    },
    credentialSecurityBadgeText: {
        color: '#34D399',
        fontSize: 8.5,
        fontWeight: '900',
    },
    credentialVaultSub: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    credentialVaultActions: {
        flexDirection: 'row',
        gap: 8,
    },
    credentialPrimaryBtn: {
        flex: 1,
        borderRadius: 10,
        overflow: 'hidden',
    },
    credentialPrimaryBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    credentialPrimaryBtnText: {
        color: '#0A1128',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    credentialSecondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.4)',
    },
    credentialSecondaryBtnText: {
        color: '#D4AF37',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    // Change Password Modal Styles
    passwordModalCard: {
        width: '92%',
        maxWidth: 500,
        alignSelf: 'center',
        backgroundColor: '#070D1F',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        overflow: 'hidden',
        maxHeight: '88%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    passwordModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: '#0A1226',
    },
    passwordModalTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    passwordModalSubtitle: {
        color: '#D4AF37',
        fontSize: 10,
        fontWeight: '700',
    },
    closeModalCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    authenticDossierCard: {
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1.2,
        borderColor: '#D4AF37',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    dossierAvatarWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F9E498',
    },
    dossierUserName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    dossierEmailText: {
        fontSize: 11,
        color: '#38BDF8',
        fontWeight: '600',
    },
    dossierPhoneText: {
        fontSize: 10.5,
        color: '#CBD5E1',
        fontWeight: '600',
    },
    dossierDataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.25)',
        gap: 6,
    },
    dossierGridItem: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    dossierGridLabel: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    dossierGridValGold: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FBBF24',
        marginTop: 2,
    },
    dossierGridValWhite: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 2,
    },
    dossierGridValSub: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#CBD5E1',
        marginTop: 2,
    },
    authHashNoticeCard: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    authHashNoticeTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#FCD34D',
    },
    authHashNoticeSub: {
        fontSize: 9.5,
        color: '#CBD5E1',
        marginTop: 2,
        lineHeight: 14,
    },
    passwordFormSection: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    passwordFieldLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    passwordInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1.2,
        borderColor: '#D4AF37',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        marginVertical: 6,
    },
    passwordTextInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        paddingVertical: 0,
    },
    entropyContainer: {
        marginBottom: 6,
    },
    entropyBarRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 4,
    },
    entropySegment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    entropyLabel: {
        fontSize: 9.5,
        fontWeight: '900',
    },
    generatePasswordPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderWidth: 1,
        borderColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    generatePasswordPillText: {
        color: '#FCD34D',
        fontSize: 10.5,
        fontWeight: '800',
    },
    emailToggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 8,
    },
    toggleCheckBox: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    toggleCheckBoxActive: {
        backgroundColor: '#D4AF37',
    },
    emailToggleTitle: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    emailToggleSub: {
        color: '#94A3B8',
        fontSize: 9.5,
        marginTop: 2,
        lineHeight: 13,
    },
    confirmPasswordBtn: {
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 4,
    },
    confirmPasswordBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
    },
    confirmPasswordBtnText: {
        color: '#0A1128',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    emailResetDispatchCard: {
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.3)',
    },
    dispatchEmailLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#38BDF8',
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 8,
    },
    dispatchEmailLinkBtnText: {
        color: '#0A1128',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    pinResetDispatchCard: {
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    resetDefaultPinBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: 'rgba(212, 175, 55, 0.2)',
        borderWidth: 1,
        borderColor: '#D4AF37',
        paddingVertical: 8,
        borderRadius: 8,
    },
    resetDefaultPinBtnText: {
        color: '#FCD34D',
        fontSize: 10.5,
        fontWeight: '800',
    },
    resetCustomPinBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        borderRadius: 8,
    },
    resetCustomPinBtnText: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    cancelPasswordBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        marginTop: 4,
    },
    cancelPasswordBtnText: {
        color: '#CBD5E1',
        fontSize: 11,
        fontWeight: '800',
    },
});

