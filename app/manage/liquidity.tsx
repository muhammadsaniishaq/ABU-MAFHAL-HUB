import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, Modal, TextInput, StyleSheet, useWindowDimensions, Platform, Switch 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

// Official Brand Colors (Navy & Gold)
const T = {
    navy: '#0d1b3e',
    navyMid: '#142258',
    navyDark: '#09122c',
    gold: '#f5a623',
    goldDk: '#d4890e',
    goldLight: '#fffdf5',
    goldBg: 'rgba(245,166,35,0.12)',
    white: '#ffffff',
    text: '#0d1b3e',
    textSub: '#5a6890',
    border: '#cbd5e1',
    bg: '#f4f6fb',
    cardBg: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#0284c7'
};

interface ProviderWallet {
    id: string;
    name: string;
    category?: string;
    balance: number;
    currency: string;
    latencyMs?: number;
    status: 'healthy' | 'low' | 'critical' | 'error' | 'unconfigured';
    error?: string;
    allowDeposit: boolean;
    allowWithdrawal: boolean;
    depositAccount?: {
        bankName: string;
        accountNumber: string;
        accountName: string;
        instructions: string;
    };
}

const NIGERIAN_BANKS = [
    { name: 'Access Bank', code: '044' },
    { name: 'Guaranty Trust Bank (GTB)', code: '058' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'United Bank for Africa (UBA)', code: '033' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'Kuda Bank', code: '50211' },
    { name: 'OPay', code: '999992' },
    { name: 'Palmpay', code: '999991' },
    { name: 'Moniepoint', code: '50515' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Wema Bank (ALAT)', code: '035' },
];

export default function LiquidityVaultScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [providers, setProviders] = useState<ProviderWallet[]>([]);
    const [vaultSecrets, setVaultSecrets] = useState<Record<string, string>>({});
    const [activeFilter, setActiveFilter] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modal States
    const [selectedDepositProvider, setSelectedDepositProvider] = useState<ProviderWallet | null>(null);
    const [selectedWithdrawProvider, setSelectedWithdrawProvider] = useState<ProviderWallet | null>(null);
    const [selectedTokenProvider, setSelectedTokenProvider] = useState<ProviderWallet | null>(null);

    // Vault Token Edit Form
    const [tokenKeyName, setTokenKeyName] = useState('');
    const [tokenValue, setTokenValue] = useState('');
    const [tokenSaving, setTokenSaving] = useState(false);
    // BilalSadaSub-specific: username + password
    const [bilalUsername, setBilalUsername] = useState('');
    const [bilalPassword, setBilalPassword] = useState('');
    // BigiSub-specific: username + password
    const [bigiUsername, setBigiUsername] = useState('');
    const [bigiPassword, setBigiPassword] = useState('');

    // Low Float Email & SMS Alert States
    const [alertEmail, setAlertEmail] = useState('');
    const [alertPhone, setAlertPhone] = useState('');
    const [termiiApiKey, setTermiiApiKey] = useState('');
    const [termiiSenderId, setTermiiSenderId] = useState('AbuMafhal');
    const [alertThreshold, setAlertThreshold] = useState('5000');
    const [alertIntervalMins, setAlertIntervalMins] = useState('30');
    const [alertEnabled, setAlertEnabled] = useState(true);
    const [savingAlerts, setSavingAlerts] = useState(false);
    const [showAlertCard, setShowAlertCard] = useState(false);

    // SMTP Sender Credentials for Direct Inbox Delivery
    const [smtpEmail, setSmtpEmail] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [showSmtpConfig, setShowSmtpConfig] = useState(false);

    // Deposit Bank Account Form States
    const [editingDepositBank, setEditingDepositBank] = useState(false);
    const [fundBankName, setFundBankName] = useState('');
    const [fundAccountNumber, setFundAccountNumber] = useState('');
    const [fundAccountName, setFundAccountName] = useState('');
    const [fundSaving, setFundSaving] = useState(false);

    // Withdrawal Form States
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawAccount, setWithdrawAccount] = useState('');
    const [selectedBank, setSelectedBank] = useState(NIGERIAN_BANKS[0]);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [copiedText, setCopiedText] = useState(false);

    useEffect(() => {
        if (vaultSecrets) {
            if (vaultSecrets['LOW_BALANCE_ALERT_EMAIL']) setAlertEmail(vaultSecrets['LOW_BALANCE_ALERT_EMAIL']);
            if (vaultSecrets['LOW_BALANCE_ALERT_THRESHOLD']) setAlertThreshold(vaultSecrets['LOW_BALANCE_ALERT_THRESHOLD']);
            if (vaultSecrets['LOW_BALANCE_ALERT_INTERVAL_MINS']) setAlertIntervalMins(vaultSecrets['LOW_BALANCE_ALERT_INTERVAL_MINS']);
            if (vaultSecrets['LOW_BALANCE_ALERT_ENABLED'] !== undefined) {
                setAlertEnabled(vaultSecrets['LOW_BALANCE_ALERT_ENABLED'] === 'true');
            }
            if (vaultSecrets['ALERT_PHONE'] || vaultSecrets['SUPPORT_WHATSAPP']) {
                setAlertPhone(vaultSecrets['ALERT_PHONE'] || vaultSecrets['SUPPORT_WHATSAPP'] || '');
            }
            if (vaultSecrets['TERMII_API_KEY'] || vaultSecrets['TERMII_KEY']) {
                setTermiiApiKey(vaultSecrets['TERMII_API_KEY'] || vaultSecrets['TERMII_KEY'] || '');
            }
            if (vaultSecrets['TERMII_SENDER_ID'] || vaultSecrets['TERMII_SENDER']) {
                setTermiiSenderId(vaultSecrets['TERMII_SENDER_ID'] || vaultSecrets['TERMII_SENDER'] || 'AbuMafhal');
            }
            if (vaultSecrets['ZOHO_EMAIL'] || vaultSecrets['SMTP_USER']) {
                setSmtpEmail(vaultSecrets['ZOHO_EMAIL'] || vaultSecrets['SMTP_USER'] || '');
            }
            if (vaultSecrets['ZOHO_PASSWORD'] || vaultSecrets['SMTP_PASS']) {
                setSmtpPass(vaultSecrets['ZOHO_PASSWORD'] || vaultSecrets['SMTP_PASS'] || '');
            }
        }
    }, [vaultSecrets]);

    const handleSaveAlertSettings = async () => {
        if (alertEnabled && !alertEmail.trim()) {
            Alert.alert("Email Required", "Please enter a valid email address to receive low float alerts.");
            return;
        }
        setSavingAlerts(true);
        try {
            const updates = [
                { key: 'LOW_BALANCE_ALERT_EMAIL', value: alertEmail.trim(), description: 'Admin Email for Low Balance Alerts' },
                { key: 'LOW_BALANCE_ALERT_THRESHOLD', value: alertThreshold.trim() || '5000', description: 'Minimum API Balance Threshold in NGN' },
                { key: 'LOW_BALANCE_ALERT_INTERVAL_MINS', value: alertIntervalMins.trim() || '30', description: 'Low Float Alert Cooldown Interval in Minutes' },
                { key: 'LOW_BALANCE_ALERT_ENABLED', value: alertEnabled ? 'true' : 'false', description: 'Enable Auto Low Balance Email Alerts' }
            ];

            if (alertPhone.trim()) {
                updates.push({ key: 'ALERT_PHONE', value: alertPhone.trim(), description: 'Admin Phone Number for Low Balance SMS Alerts' });
            }
            if (termiiApiKey.trim()) {
                updates.push({ key: 'TERMII_API_KEY', value: termiiApiKey.trim(), description: 'Termii SMS Gateway API Key' });
                updates.push({ key: 'TERMII_KEY', value: termiiApiKey.trim(), description: 'Termii SMS Gateway API Key' });
            }
            if (termiiSenderId.trim()) {
                updates.push({ key: 'TERMII_SENDER_ID', value: termiiSenderId.trim(), description: 'Termii SMS Sender ID' });
            }
            if (smtpEmail.trim()) {
                updates.push({ key: 'ZOHO_EMAIL', value: smtpEmail.trim(), description: 'SMTP Sender Email' });
                updates.push({ key: 'SMTP_USER', value: smtpEmail.trim(), description: 'SMTP User' });
            }
            if (smtpPass.trim()) {
                updates.push({ key: 'ZOHO_PASSWORD', value: smtpPass.trim(), description: 'SMTP Password' });
                updates.push({ key: 'SMTP_PASS', value: smtpPass.trim(), description: 'SMTP Password' });
                updates.push({ key: 'SMTP_HOST', value: 'smtp.zoho.com', description: 'SMTP Host' });
                updates.push({ key: 'SMTP_PORT', value: '465', description: 'SMTP Port' });
            }

            for (const u of updates) {
                await supabase.from('system_secrets').upsert(u);
                await supabase.from('app_settings').upsert({ key: u.key, value: u.value });
            }

            setVaultSecrets(prev => ({
                ...prev,
                'LOW_BALANCE_ALERT_ENABLED': alertEnabled ? 'true' : 'false',
                'LOW_BALANCE_ALERT_EMAIL': alertEmail.trim(),
                'LOW_BALANCE_ALERT_THRESHOLD': alertThreshold.trim() || '5000',
                'LOW_BALANCE_ALERT_INTERVAL_MINS': alertIntervalMins.trim() || '30'
            }));

            if (alertEnabled) {
                // Force check and send test alert immediately when enabled
                await supabase.functions.invoke('check-provider-balances', {
                    body: { triggerAlertCheck: true, force: true }
                });
                Alert.alert(
                    "Alert Settings Saved! ⚡",
                    `Low Float Email & SMS Alerts are active for ${alertEmail.trim()}.\n\nWhenever any API wallet drops below ₦${Number(alertThreshold).toLocaleString()}, automated alerts will be sent every ${alertIntervalMins.trim() || 30} minutes.`
                );
            } else {
                Alert.alert(
                    "Alerts Disabled 🔕",
                    "Automated low balance email & SMS notifications have been turned OFF successfully."
                );
            }
            setShowAlertCard(false);
            fetchProviderBalances();
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Failed to save alert settings.");
        } finally {
            setSavingAlerts(false);
        }
    };

    useEffect(() => {
        fetchProviderBalances();
        const autoPoll = setInterval(() => {
            fetchProviderBalances();
        }, 30000); // Auto-check balances & email alerts every 30 seconds
        return () => clearInterval(autoPoll);
    }, []);

    useEffect(() => {
        if (selectedDepositProvider) {
            const pId = selectedDepositProvider.id.toUpperCase();
            setFundBankName(vaultSecrets[`${pId}_BANK_NAME`] || vaultSecrets[`${pId}_BANK`] || selectedDepositProvider.depositAccount?.bankName || '');
            setFundAccountNumber(vaultSecrets[`${pId}_ACCOUNT_NUMBER`] || vaultSecrets[`${pId}_ACCOUNT`] || selectedDepositProvider.depositAccount?.accountNumber || '');
            setFundAccountName(vaultSecrets[`${pId}_ACCOUNT_NAME`] || selectedDepositProvider.depositAccount?.accountName || '');
            setEditingDepositBank(false);
        }
    }, [selectedDepositProvider?.id]);

    const handleSaveDepositAccount = async () => {
        if (!selectedDepositProvider) return;
        setFundSaving(true);
        try {
            const pId = selectedDepositProvider.id.toUpperCase();
            const updates = [
                { key: `${pId}_BANK_NAME`, value: fundBankName.trim(), description: `${selectedDepositProvider.name} Top-up Bank Name` },
                { key: `${pId}_ACCOUNT_NUMBER`, value: fundAccountNumber.trim(), description: `${selectedDepositProvider.name} Top-up Account Number` },
                { key: `${pId}_ACCOUNT_NAME`, value: fundAccountName.trim(), description: `${selectedDepositProvider.name} Top-up Account Name` },
            ];

            for (const item of updates) {
                if (item.value) {
                    await supabase.from('system_secrets').upsert({ key: item.key, value: item.value, description: item.description });
                    await supabase.from('app_settings').upsert({ key: item.key, value: item.value });
                }
            }

            Alert.alert("Account Saved! 🎉", `Top-up bank account details for ${selectedDepositProvider.name} saved to Vault successfully.`);
            setEditingDepositBank(false);
            fetchProviderBalances();
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Failed to save bank account details.");
        } finally {
            setFundSaving(false);
        }
    };

    useEffect(() => {
        fetchProviderBalances();
    }, []);

    const fetchProviderBalances = async () => {
        setRefreshing(true);
        try {
            // 1. Invoke Edge Function first (uses SERVICE_ROLE_KEY to bypass RLS)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('check-provider-balances', {
                body: {}
            });

            if (!edgeError && edgeData?.success && edgeData?.providers && edgeData.providers.length > 0) {
                setTotalBalance(edgeData.totalBalance || 0);
                setProviders(edgeData.providers);
                if (edgeData.secrets) {
                    setVaultSecrets(edgeData.secrets);
                }
                return;
            }

            // 2. Direct client DB query fallback
            const secretsMap: Record<string, string> = {};

            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData) {
                settingsData.forEach(s => {
                    if (s.value && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                });
            }

            const { data: secretsData } = await supabase.from('system_secrets').select('*');
            if (secretsData) {
                secretsData.forEach(s => {
                    if (s.value && s.value.trim() !== '') secretsMap[s.key.toUpperCase()] = s.value.trim();
                });
            }

            setVaultSecrets(secretsMap);

            const agentHubKey = secretsMap['AGENTHUB_API_KEY'] || secretsMap['AGENTHUB_KEY'] || '';
            const bilalToken = secretsMap['BILALSADASUB_TOKEN'] || secretsMap['BILAL_TOKEN'] || secretsMap['BILALSADASUB_API_KEY'] || '';
            const paystackSecret = secretsMap['PAYSTACK_SECRET_KEY'] || secretsMap['PAYSTACK_KEY'] || '';
            const clubkonnectKey = secretsMap['CLUBKONNECT_API_KEY'] || secretsMap['CLUBKONNECT_KEY'] || '';
            const idProKey = secretsMap['IDPRO_API_KEY'] || secretsMap['IDPRO_KEY'] || '';
            const payVesselKey = secretsMap['PAYVESSEL_API_KEY'] || secretsMap['PAYVESSEL_KEY'] || secretsMap['PAYVESSEL_SECRET_KEY'] || secretsMap['PAYBESSEL_API_KEY'] || secretsMap['PAYBESSEL_KEY'] || '';
            const nineBoostKey = secretsMap['NINEBOOST_API_KEY'] || secretsMap['NINEBOOST_KEY'] || secretsMap['NINEBOOST_TOKEN'] || '';
            const nowPaymentsKey = secretsMap['NOWPAYMENTS_API_KEY'] || secretsMap['NOWPAYMENTS_KEY'] || '';
            const bigiToken = secretsMap['BIGI_API_TOKEN'] || secretsMap['BIGI_TOKEN'] || '';
            const termiiKey = secretsMap['TERMII_API_KEY'] || secretsMap['TERMII_KEY'] || '';
            const monnifyApiKey = secretsMap['MONNIFY_API_KEY'] || secretsMap['MONNIFY_KEY'] || '';

            const list: ProviderWallet[] = [
                {
                    id: 'agenthub',
                    name: 'AgentHub (Identity, NIN, BVN)',
                    category: 'Digital Identity',
                    balance: 0,
                    currency: 'NGN',
                    status: agentHubKey ? 'healthy' : 'unconfigured',
                    error: agentHubKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Sterling Bank / Monnify (AgentHub)',
                        accountNumber: '9081234567',
                        accountName: 'AgentHub Corporate / ABUMAFHAL',
                        instructions: 'Transfer to this virtual account to top up AgentHub balance.'
                    }
                },
                {
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub (Data, Airtime, Cable, Bills)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: bilalToken ? 'healthy' : 'unconfigured',
                    error: bilalToken ? undefined : 'Token not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: 'Sterling / Monnify (BilalSadaSub)',
                        accountNumber: '8910293841',
                        accountName: 'BilalSadaSub Telecom',
                        instructions: 'Auto-funding bank account for BilalSadaSub VTU portal.'
                    }
                },
                {
                    id: 'paystack',
                    name: 'Paystack (Payment Gateway & Settlements)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: paystackSecret ? 'healthy' : 'unconfigured',
                    error: paystackSecret ? undefined : 'Secret Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'clubkonnect',
                    name: 'Clubkonnect / NelloByte API (VTU Telecom)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: clubkonnectKey ? 'healthy' : 'unconfigured',
                    error: clubkonnectKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'idpro',
                    name: 'IDPro (Identity & KYC Verification API)',
                    category: 'Digital Identity & CAC',
                    balance: 0,
                    currency: 'NGN',
                    status: idProKey ? 'healthy' : 'unconfigured',
                    error: idProKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'payvessel',
                    name: 'PayVessel (Payment & Payout Gateway)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: payVesselKey ? 'healthy' : 'unconfigured',
                    error: payVesselKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'nineboost',
                    name: 'NineBoost (Social Media Marketing SMM Panel)',
                    category: 'Marketing Services',
                    balance: 0,
                    currency: 'USD',
                    status: nineBoostKey ? 'healthy' : 'unconfigured',
                    error: nineBoostKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'nowpayments',
                    name: 'NowPayments (Crypto Payment Gateway)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'USD',
                    status: nowPaymentsKey ? 'healthy' : 'unconfigured',
                    error: nowPaymentsKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'bigi',
                    name: 'Bigi VTU Portal (SME Data & Airtime)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: bigiToken ? 'healthy' : 'unconfigured',
                    error: bigiToken ? undefined : 'Token not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                },
                {
                    id: 'termii',
                    name: 'Termii (SMS & OTP Messaging Gateway)',
                    category: 'SMS & Communications',
                    balance: 0,
                    currency: 'NGN',
                    status: termiiKey ? 'healthy' : 'unconfigured',
                    error: termiiKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false
                }
            ];

            setProviders(list);
        } catch (e: any) {
            console.error("Provider Balance Fetch Error", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2000);
        } catch (_) {}
    };

    const handleOpenTokenModal = (p: ProviderWallet) => {
        setSelectedTokenProvider(p);
        const secretMap: Record<string, string> = {
            agenthub: 'AGENTHUB_API_KEY',
            bilalsadasub: 'BILALSADASUB_TOKEN',
            paystack: 'PAYSTACK_SECRET_KEY',
            clubkonnect: 'CLUBKONNECT_API_KEY',
            idpro: 'IDPRO_API_KEY',
            payvessel: 'PAYVESSEL_API_KEY',
            nineboost: 'NINEBOOST_API_KEY',
            nowpayments: 'NOWPAYMENTS_API_KEY',
            bigi: 'BIGI_API_TOKEN',
            termii: 'TERMII_API_KEY'
        };
        const keyName = secretMap[p.id] || 'GENERIC_API_KEY';
        setTokenKeyName(keyName);

        let existingVal = vaultSecrets[keyName] || vaultSecrets[keyName.replace('_API_KEY', '_KEY').replace('_TOKEN', '_KEY')] || '';
        if (p.id === 'payvessel' && !existingVal) {
            existingVal = vaultSecrets['PAYBESSEL_API_KEY'] || vaultSecrets['PAYBESSEL_KEY'] || '';
        }
        setTokenValue(existingVal);

        // Pre-fill BilalSadaSub username & password from vault
        if (p.id === 'bilalsadasub') {
            setBilalUsername(
                vaultSecrets['BILALSADASUB_USERNAME'] || vaultSecrets['BILAL_USERNAME'] || vaultSecrets['BILALSADASUB_USER'] || ''
            );
            setBilalPassword(
                vaultSecrets['BILALSADASUB_PASSWORD'] || vaultSecrets['BILAL_PASSWORD'] || vaultSecrets['BILALSADASUB_PASS'] || ''
            );
        } else {
            setBilalUsername('');
            setBilalPassword('');
        }

        // Pre-fill BigiSub username & password from vault
        if (p.id === 'bigi') {
            setBigiUsername(
                vaultSecrets['BIGISUB_USERNAME'] || vaultSecrets['BIGI_USERNAME'] || vaultSecrets['BIGI_USER'] || ''
            );
            setBigiPassword(
                vaultSecrets['BIGISUB_PASSWORD'] || vaultSecrets['BIGI_PASSWORD'] || vaultSecrets['BIGI_PASS'] || ''
            );
        } else {
            setBigiUsername('');
            setBigiPassword('');
        }
    };

    const handleSaveVaultToken = async () => {
        const isBilal = selectedTokenProvider?.id === 'bilalsadasub';
        const isBigi = selectedTokenProvider?.id === 'bigi';

        // For BilalSadaSub / BigiSub: require username + password (token is optional bonus)
        if (isBilal) {
            if (!bilalUsername.trim() || !bilalPassword.trim()) {
                Alert.alert("Invalid Input", "Please enter both Username and Password for BilalSadaSub.");
                return;
            }
        } else if (isBigi) {
            if (!bigiUsername.trim() || !bigiPassword.trim()) {
                Alert.alert("Invalid Input", "Please enter both Username and Password for BigiSub.");
                return;
            }
        } else {
            if (!tokenValue || tokenValue.trim() === '') {
                Alert.alert("Invalid Input", "Please enter a valid secret key value.");
                return;
            }
        }

        setTokenSaving(true);
        try {
            const secretKeyMap: Record<string, string> = {
                agenthub: 'AGENTHUB_API_KEY',
                bilalsadasub: 'BILALSADASUB_TOKEN',
                paystack: 'PAYSTACK_SECRET_KEY',
                clubkonnect: 'CLUBKONNECT_API_KEY',
                idpro: 'IDPRO_API_KEY',
                payvessel: 'PAYVESSEL_API_KEY',
                nineboost: 'NINEBOOST_API_KEY',
                nowpayments: 'NOWPAYMENTS_API_KEY',
                bigi: 'BIGI_API_TOKEN',
                termii: 'TERMII_API_KEY'
            };

            const secretKey = tokenKeyName || secretKeyMap[selectedTokenProvider?.id || ''] || 'GENERIC_API_KEY';

            if (isBilal) {
                // Save username & password to vault
                const credsToSave = [
                    { key: 'BILALSADASUB_USERNAME', value: bilalUsername.trim() },
                    { key: 'BILALSADASUB_PASSWORD', value: bilalPassword.trim() },
                ];
                if (tokenValue.trim()) {
                    credsToSave.push({ key: 'BILALSADASUB_TOKEN', value: tokenValue.trim() });
                }
                for (const cred of credsToSave) {
                    await supabase.from('system_secrets').upsert({
                        key: cred.key, value: cred.value,
                        description: `BilalSadaSub credential - ${cred.key}`,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    await supabase.from('app_settings').upsert({
                        key: cred.key, value: cred.value,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    setVaultSecrets(prev => ({ ...prev, [cred.key]: cred.value }));
                }
            } else if (isBigi) {
                // Save username & password to vault
                const credsToSave = [
                    { key: 'BIGISUB_USERNAME', value: bigiUsername.trim() },
                    { key: 'BIGISUB_PASSWORD', value: bigiPassword.trim() },
                ];
                if (tokenValue.trim()) {
                    credsToSave.push({ key: 'BIGI_API_TOKEN', value: tokenValue.trim() });
                }
                for (const cred of credsToSave) {
                    await supabase.from('system_secrets').upsert({
                        key: cred.key, value: cred.value,
                        description: `BigiSub credential - ${cred.key}`,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    await supabase.from('app_settings').upsert({
                        key: cred.key, value: cred.value,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                    setVaultSecrets(prev => ({ ...prev, [cred.key]: cred.value }));
                }
            } else {
                // Normal save for other providers
                await supabase.from('system_secrets').upsert({
                    key: secretKey,
                    value: tokenValue.trim(),
                    description: `Updated secret for ${selectedTokenProvider?.name}`,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
                await supabase.from('app_settings').upsert({
                    key: secretKey,
                    value: tokenValue.trim(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
                setVaultSecrets(prev => ({ ...prev, [secretKey]: tokenValue.trim() }));
            }

            await supabase.functions.invoke('check-provider-balances', { body: {} });

            Alert.alert("Success 🎉", (isBilal || isBigi)
                ? `${selectedTokenProvider?.name} credentials saved to Vault! Balance will update now.`
                : `Saved ${secretKey} to Vault successfully!`
            );
            setSelectedTokenProvider(null);
            setTokenValue('');
            setBilalUsername('');
            setBilalPassword('');
            setBigiUsername('');
            setBigiPassword('');
            fetchProviderBalances();
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save secret key to Vault.");
        } finally {
            setTokenSaving(false);
        }
    };

    const handleExecuteWithdrawal = async () => {
        if (!withdrawAmount || Number(withdrawAmount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
            return;
        }

        if (!withdrawAccount || withdrawAccount.length < 10) {
            Alert.alert("Invalid Account", "Please enter a valid 10-digit bank account number.");
            return;
        }

        setWithdrawLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('provider-wallet-action', {
                body: {
                    action: 'withdraw',
                    providerId: selectedWithdrawProvider?.id,
                    amount: Number(withdrawAmount),
                    bankCode: selectedBank.code,
                    accountNumber: withdrawAccount.trim(),
                    reason: withdrawReason || 'Super Admin Wallet Transfer'
                }
            });

            if (error) throw error;

            if (data?.success) {
                Alert.alert("Withdrawal Successful 🎉", data.message || "Funds transferred successfully.");
                setSelectedWithdrawProvider(null);
                setWithdrawAmount('');
                setWithdrawAccount('');
                fetchProviderBalances();
            } else {
                Alert.alert("Withdrawal Error", data?.error || "Failed to process withdrawal.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An error occurred during withdrawal processing.");
        } finally {
            setWithdrawLoading(false);
        }
    };

    // Filter providers
    const filteredProviders = providers.filter(p => {
        const matchesCategory = activeFilter === 'All'
            || (activeFilter === 'VTU' && p.category === 'VTU Telecom')
            || (activeFilter === 'Identity' && p.category === 'Digital Identity & CAC')
            || (activeFilter === 'Gateways' && p.category === 'Payment Gateway')
            || (activeFilter === 'Comms' && (p.category === 'SMS & Communications' || p.category === 'Marketing Services'));
        
        const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesSearch;
    });

    const healthyCount = providers.filter(p => p.status === 'healthy').length;
    const unconfiguredCount = providers.filter(p => p.status === 'unconfigured').length;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'API Wallet & Finance Hub',
                headerStyle: { backgroundColor: T.navyDark },
                headerTintColor: T.white,
                headerTitleStyle: { fontWeight: '900', fontSize: 16 },
                headerRight: () => (
                    <TouchableOpacity onPress={fetchProviderBalances} style={{ paddingRight: 12 }}>
                        <Ionicons name="sync-outline" size={19} color={T.gold} />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Aggregate Total Float Hero Banner */}
                <LinearGradient
                    colors={[T.navyDark, T.navy, T.navyMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    {/* Gold Decorative Accent Stripe */}
                    <View style={styles.heroAccentStripe} />

                    <View style={styles.heroTopRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.heroBadgeRow}>
                                <Ionicons name="wallet-outline" size={12} color={T.gold} />
                                <Text style={styles.heroSubTitle}>REAL-TIME AGGREGATE API FLOAT</Text>
                            </View>
                            <Text style={styles.heroBalanceText} numberOfLines={1} adjustsFontSizeToFit>
                                ₦ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={fetchProviderBalances} 
                            disabled={refreshing}
                            style={styles.refreshBtn}
                            activeOpacity={0.85}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color={T.gold} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="sync" size={12} color={T.gold} style={{ marginRight: 4 }} />
                                    <Text style={styles.refreshBtnText}>Sync</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Stat Badges Grid */}
                    <View style={styles.badgeGridRow}>
                        <View style={styles.statBadge}>
                            <Ionicons name="checkmark-circle" size={12} color={T.success} />
                            <Text style={styles.statBadgeText}>
                                {healthyCount} Active Vendors
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="alert-circle-outline" size={12} color={unconfiguredCount > 0 ? T.warning : T.gold} />
                            <Text style={styles.statBadgeText}>
                                {unconfiguredCount} Unconfigured
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="key-outline" size={12} color={T.gold} />
                            <Text style={styles.statBadgeText}>
                                {providers.length} Integrations
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* Automated Low Float Email Alert Settings Banner/Card */}
                <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: T.border }}>
                    <TouchableOpacity 
                        onPress={() => setShowAlertCard(!showAlertCard)}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={{ backgroundColor: '#fff7ed', padding: 6, borderRadius: 8, marginRight: 8 }}>
                                <Ionicons name="mail-unread-outline" size={16} color="#d97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: T.navy, fontWeight: '700', fontSize: 11.5 }}>
                                    ⚡ Low Float Auto Email Alerts
                                </Text>
                                <Text style={{ color: T.textSub, fontSize: 9.5 }} numberOfLines={1}>
                                    {alertEnabled && alertEmail ? `Alerts active → ${alertEmail} (Min: ₦${Number(alertThreshold || 5000).toLocaleString()} | Every ${alertIntervalMins || 30} mins)` : 'Configure email, minimum threshold & time interval'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name={showAlertCard ? "chevron-up" : "chevron-down"} size={16} color={T.navy} />
                    </TouchableOpacity>

                    {showAlertCard && (
                        <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                            <Text style={{ color: T.textSub, fontSize: 10, marginBottom: 10, lineHeight: 14 }}>
                                Receive automated email notifications whenever any API vendor wallet balance drops below your specified minimum threshold. Set your preferred check frequency in minutes!
                            </Text>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Notification Email</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. admin@abumafhal.com"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={alertEmail}
                                        onChangeText={setAlertEmail}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>SMS Phone (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. 08145853539"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        value={alertPhone}
                                        onChangeText={setAlertPhone}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1.5 }}>
                                    <Text style={styles.inputLabel}>Termii SMS API Key</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Termii API Key"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={termiiApiKey}
                                        onChangeText={setTermiiApiKey}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Sender ID</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. AbuMafhal"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={termiiSenderId}
                                        onChangeText={setTermiiSenderId}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Minimum Threshold (₦)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. 5000"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={alertThreshold}
                                        onChangeText={setAlertThreshold}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Interval (Minutes)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. 30"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={alertIntervalMins}
                                        onChangeText={setAlertIntervalMins}
                                    />
                                </View>
                            </View>

                            {/* SMTP Sender Setup for Direct Inbox Delivery */}
                            <TouchableOpacity 
                                onPress={() => setShowSmtpConfig(!showSmtpConfig)}
                                style={{
                                    backgroundColor: '#fffbeb', borderRadius: 8, padding: 8,
                                    borderWidth: 1, borderColor: '#fef08a', marginVertical: 8,
                                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
                                }}
                            >
                                <Text style={{ color: '#92400e', fontSize: 10, fontWeight: '700' }}>
                                    🔐 Configure Custom SMTP / Zoho Email (100% Direct Inbox)
                                </Text>
                                <Ionicons name={showSmtpConfig ? "chevron-up" : "chevron-down"} size={14} color="#92400e" />
                            </TouchableOpacity>

                            {showSmtpConfig && (
                                <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: T.border, marginBottom: 8 }}>
                                    <Text style={{ color: T.textSub, fontSize: 9.5, marginBottom: 8 }}>
                                        Enter your official Zoho or domain email credentials below to send alerts directly from your own domain and guarantee Inbox delivery without hitting Spam.
                                    </Text>

                                    <Text style={styles.inputLabel}>Sender Email (Zoho / Domain)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. admin@abumafhal.com.ng"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={smtpEmail}
                                        onChangeText={setSmtpEmail}
                                    />

                                    <Text style={styles.inputLabel}>SMTP / App Password</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter Zoho / SMTP App Password"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        value={smtpPass}
                                        onChangeText={setSmtpPass}
                                    />
                                </View>
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
                                <Text style={{ color: T.navy, fontWeight: '600', fontSize: 11 }}>Enable Auto Email & SMS Alerts</Text>
                                <Switch
                                    value={alertEnabled}
                                    onValueChange={setAlertEnabled}
                                    trackColor={{ false: '#cbd5e1', true: T.gold }}
                                    thumbColor={alertEnabled ? T.navy : '#f1f5f9'}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleSaveAlertSettings}
                                disabled={savingAlerts}
                                style={[styles.executeWithdrawBtn, { marginTop: 6 }]}
                                activeOpacity={0.85}
                            >
                                {savingAlerts ? (
                                    <ActivityIndicator color={T.navy} size="small" />
                                ) : (
                                    <Text style={styles.executeWithdrawBtnText}>Save & Enable Low Float Alerts</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Search Bar Input */}
                <View style={styles.searchBarBox}>
                    <Ionicons name="search-outline" size={15} color={T.textSub} style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search vendors by name or category..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={T.textSub} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Category Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                    {['All', 'VTU', 'Identity', 'Gateways', 'Comms'].map(f => (
                        <TouchableOpacity 
                            key={f}
                            onPress={() => setActiveFilter(f)}
                            style={[
                                styles.filterChip,
                                activeFilter === f && styles.filterChipActive
                            ]}
                        >
                            <Text style={[
                                styles.filterChipText,
                                activeFilter === f && styles.filterChipTextActive
                            ]}>
                                {f === 'All' ? `All (${providers.length})` : f}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>API Vendor Float & Vault</Text>
                    <TouchableOpacity onPress={() => router.push('/manage/api')}>
                        <Text style={styles.manageVaultLink}>Manage Credentials →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={T.navy} />
                        <Text style={styles.loadingText}>Fetching live balances from API Vault providers...</Text>
                    </View>
                ) : filteredProviders.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="search-outline" size={28} color={T.textSub} />
                        <Text style={styles.emptyTitle}>No API Providers Found</Text>
                        <Text style={styles.emptySub}>No vendor matched your search criteria.</Text>
                    </View>
                ) : (
                    <View style={styles.providersGrid}>
                        {filteredProviders.map((p) => {
                            const isHealthy = p.status === 'healthy';
                            const isLow = p.status === 'low';
                            const isCritical = p.status === 'critical';
                            const isUnconfigured = p.status === 'unconfigured';

                            return (
                                <View key={p.id} style={styles.providerCard}>
                                    {/* Left Accent Bar */}
                                    <View style={[
                                        styles.providerCardLeftBar,
                                        { backgroundColor: isHealthy ? T.success : isUnconfigured ? T.warning : T.danger }
                                    ]} />

                                    <View style={styles.providerCardHeader}>
                                        <View style={{ flex: 1, paddingRight: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <Text style={styles.providerCategory}>{p.category || 'API Vendor'}</Text>
                                                {p.latencyMs && (
                                                    <Text style={styles.latencyTag}>⚡ {p.latencyMs}ms</Text>
                                                )}
                                            </View>
                                            <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
                                        </View>

                                        {/* Status Badge */}
                                        <View style={[
                                            styles.statusPill,
                                            isHealthy && { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
                                            isLow && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
                                            isCritical && { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
                                            isUnconfigured && { backgroundColor: '#fff7ed', borderColor: '#f97316' }
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                isHealthy && { color: '#15803d' },
                                                isLow && { color: '#b45309' },
                                                isCritical && { color: '#b91c1c' },
                                                isUnconfigured && { color: '#c2410c' }
                                            ]}>
                                                {isUnconfigured ? 'UNCONFIGURED' : 'HEALTHY'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Balance Value */}
                                    <View style={styles.balanceContainer}>
                                        <Text style={styles.currencySymbol}>{p.currency === 'USD' ? '$' : '₦'}</Text>
                                        <Text style={styles.providerBalance} numberOfLines={1} adjustsFontSizeToFit>
                                            {p.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </Text>
                                    </View>

                                    {p.error && (
                                        <Text style={styles.providerErrorText} numberOfLines={2}>
                                            💡 {p.error}
                                        </Text>
                                    )}

                                    {/* Action Buttons Row */}
                                    <View style={styles.actionButtonsRow}>
                                        {p.allowDeposit && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedDepositProvider(p)}
                                                style={[styles.actionBtn, styles.depositBtn]}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="wallet-outline" size={12} color={T.navy} style={{ marginRight: 3 }} />
                                                <Text style={[styles.actionBtnText, { color: T.navy }]} numberOfLines={1}>Fund Wallet</Text>
                                            </TouchableOpacity>
                                        )}

                                        {p.allowWithdrawal && (
                                            <TouchableOpacity 
                                                onPress={() => setSelectedWithdrawProvider(p)}
                                                style={[styles.actionBtn, styles.withdrawBtn]}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="arrow-up-circle-outline" size={12} color={T.goldDk} style={{ marginRight: 3 }} />
                                                <Text style={[styles.actionBtnText, { color: T.goldDk }]} numberOfLines={1}>Withdraw</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity 
                                            onPress={() => handleOpenTokenModal(p)}
                                            style={[styles.actionBtn, styles.tokenBtn, isUnconfigured && styles.tokenBtnHighlight]}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="key-outline" size={12} color={isUnconfigured ? T.white : T.navy} style={{ marginRight: 3 }} />
                                            <Text style={[styles.actionBtnText, { color: isUnconfigured ? T.white : T.navy }]} numberOfLines={1}>
                                                {isUnconfigured ? 'Set Token' : 'Vault Key'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

            </ScrollView>

            {/* Deposit / Fund Account Modal */}
            <Modal transparent visible={!!selectedDepositProvider} animationType="fade" onRequestClose={() => setSelectedDepositProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Fund {selectedDepositProvider?.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedDepositProvider(null)}>
                                    <Ionicons name="close-circle" size={22} color={T.textSub} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalSubText}>
                                Transfer funds directly to the dedicated bank account details below to top up your {selectedDepositProvider?.name} merchant balance.
                            </Text>

                            <View style={styles.bankDetailCard}>
                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Bank Name:</Text>
                                    <Text style={styles.bankValue}>{fundBankName || selectedDepositProvider?.depositAccount?.bankName || 'Not Set'}</Text>
                                </View>

                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Account Number:</Text>
                                    <TouchableOpacity 
                                        onPress={() => copyToClipboard(fundAccountNumber || selectedDepositProvider?.depositAccount?.accountNumber || '')}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Text style={[styles.bankValue, { color: T.navy, marginRight: 5 }]}>
                                            {fundAccountNumber || selectedDepositProvider?.depositAccount?.accountNumber || 'Not Set'}
                                        </Text>
                                        <Ionicons name="copy-outline" size={13} color={T.goldDk} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.bankDetailRow}>
                                    <Text style={styles.bankLabel}>Account Name:</Text>
                                    <Text style={styles.bankValue}>{fundAccountName || selectedDepositProvider?.depositAccount?.accountName || 'Not Set'}</Text>
                                </View>

                                {copiedText && (
                                    <Text style={styles.copySuccessToast}>
                                        ✓ Account number copied to clipboard!
                                    </Text>
                                )}

                                <Text style={styles.bankInstructions}>
                                    💡 Transfer funds directly to this bank account number to top up your API balance.
                                </Text>
                            </View>

                            {/* Inline Bank Details Customiser / Editor */}
                            {editingDepositBank ? (
                                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.border, marginBottom: 12 }}>
                                    <Text style={{ color: T.navy, fontWeight: '700', fontSize: 11, marginBottom: 8 }}>
                                        ✏️ Edit Top-Up Bank Account (Saved in Vault)
                                    </Text>

                                    <Text style={styles.inputLabel}>Bank Name</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Sterling Bank, Wema, Monnify, etc."
                                        placeholderTextColor="#94a3b8"
                                        value={fundBankName}
                                        onChangeText={setFundBankName}
                                    />

                                    <Text style={styles.inputLabel}>Account Number</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter 10-digit Top-Up Account Number"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={fundAccountNumber}
                                        onChangeText={setFundAccountNumber}
                                    />

                                    <Text style={styles.inputLabel}>Account Name</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter Account Name"
                                        placeholderTextColor="#94a3b8"
                                        value={fundAccountName}
                                        onChangeText={setFundAccountName}
                                    />

                                    <TouchableOpacity
                                        onPress={handleSaveDepositAccount}
                                        disabled={fundSaving}
                                        style={styles.executeWithdrawBtn}
                                        activeOpacity={0.85}
                                    >
                                        {fundSaving ? (
                                            <ActivityIndicator color={T.navy} size="small" />
                                        ) : (
                                            <Text style={styles.executeWithdrawBtnText}>Save Account to Vault</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => setEditingDepositBank(true)}
                                    style={{
                                        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
                                        borderWidth: 1, borderColor: T.gold, backgroundColor: T.goldBg,
                                        alignItems: 'center', marginBottom: 10
                                    }}
                                >
                                    <Text style={{ color: T.navy, fontSize: 10.5, fontWeight: '700' }}>
                                        ✏️ Edit / Update Top-Up Bank Account Details
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={() => setSelectedDepositProvider(null)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseBtnText}>Close</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Vault Token Edit Modal */}
            <Modal transparent visible={!!selectedTokenProvider} animationType="fade" onRequestClose={() => setSelectedTokenProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Vault Key — {selectedTokenProvider?.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedTokenProvider(null)}>
                                    <Ionicons name="close-circle" size={22} color={T.textSub} />
                                </TouchableOpacity>
                            </View>

                            {selectedTokenProvider?.id === 'bilalsadasub' || selectedTokenProvider?.id === 'bigi' ? (
                                // BilalSadaSub & BigiSub: need Username + Password (Basic Auth / JWT)
                                <>
                                    <View style={{
                                        backgroundColor: '#fffbeb', borderRadius: 8, padding: 8,
                                        borderLeftWidth: 3, borderLeftColor: T.gold, marginBottom: 12
                                    }}>
                                        <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700' }}>
                                            🔐 {selectedTokenProvider?.name} uses Username + Password authentication.
                                            Enter your login credentials below — they are saved securely in Vault.
                                        </Text>
                                    </View>

                                    <Text style={styles.inputLabel}>Username (Login)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder={`Enter your ${selectedTokenProvider?.name} username`}
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={selectedTokenProvider?.id === 'bigi' ? bigiUsername : bilalUsername}
                                        onChangeText={selectedTokenProvider?.id === 'bigi' ? setBigiUsername : setBilalUsername}
                                    />

                                    <Text style={styles.inputLabel}>Password</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder={`Enter your ${selectedTokenProvider?.name} password`}
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={selectedTokenProvider?.id === 'bigi' ? bigiPassword : bilalPassword}
                                        onChangeText={selectedTokenProvider?.id === 'bigi' ? setBigiPassword : setBilalPassword}
                                    />

                                    <Text style={[styles.inputLabel, { marginTop: 6 }]}>Access Token (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Paste token if you have one (optional)"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={tokenValue}
                                        onChangeText={setTokenValue}
                                    />
                                </>
                            ) : (
                                // All other providers: just show Secret Key Name + Token Value
                                <>
                                    <Text style={styles.modalSubText}>
                                        View or update the secret API key for this vendor stored in Vault.
                                    </Text>

                                    <Text style={styles.inputLabel}>Secret Key Name</Text>
                                    <TextInput
                                        style={[styles.modalInput, { backgroundColor: '#e2e8f0', color: T.textSub }]}
                                        value={tokenKeyName}
                                        editable={false}
                                    />

                                    <Text style={styles.inputLabel}>Secret Token Value</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Paste API Key or Token here..."
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={false}
                                        value={tokenValue}
                                        onChangeText={setTokenValue}
                                    />
                                </>
                            )}

                            <TouchableOpacity
                                onPress={handleSaveVaultToken}
                                disabled={tokenSaving}
                                style={styles.executeWithdrawBtn}
                                activeOpacity={0.85}
                            >
                                {tokenSaving ? (
                                    <ActivityIndicator color={T.navy} size="small" />
                                ) : (
                                    <Text style={styles.executeWithdrawBtnText}>
                                        {(selectedTokenProvider?.id === 'bilalsadasub' || selectedTokenProvider?.id === 'bigi') ? 'Save Credentials to Vault' : 'Save Secret Key to Vault'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Withdrawal / Transfer Out Modal */}
            <Modal transparent visible={!!selectedWithdrawProvider} animationType="fade" onRequestClose={() => setSelectedWithdrawProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Withdraw from {selectedWithdrawProvider?.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedWithdrawProvider(null)}>
                                    <Ionicons name="close-circle" size={22} color={T.textSub} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalSubText}>
                                Transfer funds out of provider balance directly to your destination Nigerian bank account.
                            </Text>

                            <Text style={styles.inputLabel}>Amount (₦)</Text>
                            <TextInput 
                                style={styles.modalInput}
                                placeholder="50000"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={withdrawAmount}
                                onChangeText={setWithdrawAmount}
                            />

                            <Text style={styles.inputLabel}>Select Destination Bank</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                {NIGERIAN_BANKS.map((b) => (
                                    <TouchableOpacity 
                                        key={b.code}
                                        onPress={() => setSelectedBank(b)}
                                        style={[
                                            styles.bankChip,
                                            selectedBank.code === b.code && styles.bankChipSelected
                                        ]}
                                    >
                                        <Text style={[
                                            styles.bankChipText,
                                            selectedBank.code === b.code && { color: T.navy, fontWeight: '900' }
                                        ]}>{b.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.inputLabel}>10-Digit Account Number</Text>
                            <TextInput 
                                style={styles.modalInput}
                                placeholder="0123456789"
                                placeholderTextColor="#94a3b8"
                                keyboardType="number-pad"
                                maxLength={10}
                                value={withdrawAccount}
                                onChangeText={setWithdrawAccount}
                            />

                            <TouchableOpacity 
                                onPress={handleExecuteWithdrawal}
                                disabled={withdrawLoading}
                                style={styles.executeWithdrawBtn}
                                activeOpacity={0.85}
                            >
                                {withdrawLoading ? (
                                    <ActivityIndicator color={T.navy} size="small" />
                                ) : (
                                    <Text style={styles.executeWithdrawBtnText}>Execute Live Withdrawal Transfer</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: T.bg,
    },
    scrollContent: {
        padding: 10,
        paddingBottom: 28,
    },
    desktopScrollContent: {
        maxWidth: 740,
        alignSelf: 'center',
        width: '100%',
    },
    heroCard: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: T.navyDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
    },
    heroAccentStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: T.gold,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginBottom: 2,
    },
    heroSubTitle: {
        color: T.gold,
        fontSize: 8.5,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    heroBalanceText: {
        color: T.white,
        fontWeight: '700',
        fontSize: 18,
        letterSpacing: 0.2,
    },
    refreshBtn: {
        backgroundColor: 'rgba(245, 166, 35, 0.15)',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: T.gold,
    },
    refreshBtnText: {
        color: T.gold,
        fontSize: 9.5,
        fontWeight: '700',
    },
    badgeGridRow: {
        flexDirection: 'row',
        gap: 4,
        flexWrap: 'wrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statBadgeText: {
        color: '#e2e8f0',
        fontSize: 9,
        fontWeight: '600',
        marginLeft: 3,
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 8,
        paddingHorizontal: 9,
        height: 34,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 11,
        color: T.navy,
        fontWeight: '500',
    },
    filterBar: {
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 99,
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 5,
    },
    filterChipActive: {
        backgroundColor: T.navy,
        borderColor: T.navy,
    },
    filterChipText: {
        color: T.textSub,
        fontSize: 10,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: T.gold,
        fontWeight: '700',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    sectionTitle: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12,
    },
    manageVaultLink: {
        color: T.goldDk,
        fontSize: 10.5,
        fontWeight: '700',
    },
    loadingBox: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        color: T.textSub,
        marginTop: 5,
        fontWeight: '500',
        fontSize: 10.5,
    },
    emptyBox: {
        padding: 20,
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
    },
    emptyTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: T.navy,
        marginTop: 4,
    },
    emptySub: {
        fontSize: 10,
        color: T.textSub,
        marginTop: 2,
    },
    providersGrid: {
        gap: 7,
    },
    providerCard: {
        backgroundColor: T.cardBg,
        borderRadius: 10,
        padding: 10,
        paddingLeft: 14,
        borderWidth: 1,
        borderColor: T.border,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    providerCardLeftBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 3,
    },
    providerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    providerCategory: {
        color: T.textSub,
        fontSize: 8,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    latencyTag: {
        color: T.success,
        fontSize: 8,
        fontWeight: '700',
        marginLeft: 4,
    },
    providerName: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 11.5,
        marginTop: 1,
    },
    statusPill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 99,
        borderWidth: 1,
    },
    statusPillText: {
        fontSize: 7.5,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 2,
    },
    currencySymbol: {
        fontSize: 12,
        fontWeight: '700',
        color: T.goldDk,
        marginRight: 2,
    },
    providerBalance: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 15,
    },
    providerErrorText: {
        color: T.warning,
        fontSize: 9.5,
        fontWeight: '600',
        marginBottom: 3,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 4,
        flexWrap: 'wrap',
    },
    actionBtn: {
        flex: 1,
        minWidth: 75,
        height: 30,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    depositBtn: {
        backgroundColor: T.gold,
        borderColor: T.goldDk,
    },
    withdrawBtn: {
        backgroundColor: T.navy,
        borderColor: T.navyDark,
    },
    tokenBtn: {
        backgroundColor: T.goldBg,
        borderColor: T.gold,
        maxWidth: 90,
    },
    tokenBtnHighlight: {
        backgroundColor: T.warning,
        borderColor: T.warning,
        maxWidth: 90,
    },
    actionBtnText: {
        fontSize: 9,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 27, 62, 0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        maxHeight: '85%',
        backgroundColor: T.white,
        borderRadius: 12,
        padding: 13,
        borderWidth: 1.5,
        borderColor: T.gold,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: T.navyDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    modalDecorStripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: T.gold,
    },
    modalTitle: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12.5,
    },
    modalSubText: {
        color: T.textSub,
        fontSize: 10,
        lineHeight: 14,
        marginBottom: 8,
    },
    bankDetailCard: {
        backgroundColor: T.goldBg,
        borderRadius: 8,
        padding: 9,
        borderWidth: 1,
        borderColor: 'rgba(245,166,35,0.3)',
        marginBottom: 10,
    },
    bankDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    bankLabel: {
        color: T.textSub,
        fontSize: 9.5,
        fontWeight: '500',
    },
    bankValue: {
        color: T.navy,
        fontSize: 10,
        fontWeight: '700',
    },
    copySuccessToast: {
        color: T.success,
        fontSize: 9.5,
        fontWeight: '700',
        marginTop: 3,
        textAlign: 'center',
    },
    bankInstructions: {
        color: T.navy,
        fontSize: 9.5,
        marginTop: 5,
        lineHeight: 13,
        fontWeight: '500',
    },
    modalCloseBtn: {
        height: 32,
        borderRadius: 6,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    modalCloseBtnText: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 10.5,
    },
    inputLabel: {
        color: T.navy,
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    modalInput: {
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: '#f8fafc',
        color: T.navy,
        paddingHorizontal: 8,
        fontSize: 10.5,
        fontWeight: '500',
        marginBottom: 7,
    },
    bankChip: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 4,
    },
    bankChipSelected: {
        backgroundColor: T.gold,
        borderColor: T.goldDk,
    },
    bankChipText: {
        color: T.navy,
        fontSize: 10,
        fontWeight: '600',
    },
    executeWithdrawBtn: {
        height: 34,
        borderRadius: 6,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    executeWithdrawBtnText: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 10.5,
    },
});
