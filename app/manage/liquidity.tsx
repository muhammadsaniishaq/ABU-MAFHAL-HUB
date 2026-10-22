import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, ActivityIndicator, 
    Alert, Modal, TextInput, StyleSheet, useWindowDimensions, Platform, Switch, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

// Official Brand Design Tokens (Navy & Gold - Crisp & Ultra Clean)
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
    borderLight: '#e2e8f0',
    bg: '#f4f6fb',
    cardBg: '#ffffff',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#0284c7'
};

export interface ProviderWallet {
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
    const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
    const isTabletWeb = Platform.OS === 'web' && width >= 768 && width < 1024;
    const isDesktop = Platform.OS === 'web' && width >= 768;

    const providerCardWidth: any = isDesktopWeb ? '32.3%' : isTabletWeb ? '48.8%' : '100%';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalBalance, setTotalBalance] = useState(0);
    const [usdBalance, setUsdBalance] = useState(0);
    const [providers, setProviders] = useState<ProviderWallet[]>([]);
    const [vaultSecrets, setVaultSecrets] = useState<Record<string, string>>({});
    const [activeFilter, setActiveFilter] = useState<string>('Active');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);

    // Modal States
    const [selectedDepositProvider, setSelectedDepositProvider] = useState<ProviderWallet | null>(null);
    const [selectedWithdrawProvider, setSelectedWithdrawProvider] = useState<ProviderWallet | null>(null);
    const [selectedTokenProvider, setSelectedTokenProvider] = useState<ProviderWallet | null>(null);

    // Vault Token Edit Form States
    const [tokenKeyName, setTokenKeyName] = useState('');
    const [tokenValue, setTokenValue] = useState('');
    const [tokenSaving, setTokenSaving] = useState(false);

    // BilalSadaSub credentials
    const [bilalUsername, setBilalUsername] = useState('');
    const [bilalPassword, setBilalPassword] = useState('');

    // BigiSub credentials
    const [bigiUsername, setBigiUsername] = useState('');
    const [bigiPassword, setBigiPassword] = useState('');

    // SKBTECH credentials
    const [skbTechKey, setSkbTechKey] = useState('');

    // NineBoost credentials
    const [nineBoostKey, setNineBoostKey] = useState('');

    // Flutterwave credentials
    const [flwSecretKey, setFlwSecretKey] = useState('');
    const [flwPublicKey, setFlwPublicKey] = useState('');
    const [flwSecretHash, setFlwSecretHash] = useState('');

    // Termii credentials
    const [termiiApiKey, setTermiiApiKey] = useState('');
    const [termiiSenderId, setTermiiSenderId] = useState('AbuMafhal');

    // Monnify credentials
    const [monnifyApiKey, setMonnifyApiKey] = useState('');
    const [monnifySecret, setMonnifySecret] = useState('');
    const [monnifyContractCode, setMonnifyContractCode] = useState('');

    // Paystack credentials
    const [paystackSecret, setPaystackSecret] = useState('');
    const [paystackPublic, setPaystackPublic] = useState('');

    // Low Float Email & SMS Alert States
    const [alertEmail, setAlertEmail] = useState('');
    const [alertPhone, setAlertPhone] = useState('');
    const [alertThreshold, setAlertThreshold] = useState('5000');
    const [alertIntervalMins, setAlertIntervalMins] = useState('30');
    const [alertEnabled, setAlertEnabled] = useState(false);
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

    const hasLoadedAlertConfig = useRef(false);

    useEffect(() => {
        if (vaultSecrets && Object.keys(vaultSecrets).length > 0 && !hasLoadedAlertConfig.current) {
            hasLoadedAlertConfig.current = true;
            if (vaultSecrets['LOW_BALANCE_ALERT_EMAIL']) setAlertEmail(vaultSecrets['LOW_BALANCE_ALERT_EMAIL']);
            if (vaultSecrets['LOW_BALANCE_ALERT_THRESHOLD']) setAlertThreshold(vaultSecrets['LOW_BALANCE_ALERT_THRESHOLD']);
            if (vaultSecrets['LOW_BALANCE_ALERT_INTERVAL_MINS']) setAlertIntervalMins(vaultSecrets['LOW_BALANCE_ALERT_INTERVAL_MINS']);
            
            const isEnabled = vaultSecrets['LOW_BALANCE_ALERT_ENABLED'] === 'true' || vaultSecrets['LOW_BALANCE_ALERT_ENABLE'] === 'true';
            setAlertEnabled(isEnabled);

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

    useEffect(() => {
        fetchProviderBalances(false);
        const autoPoll = setInterval(() => {
            fetchProviderBalances(true); // background silent sync (non-blocking)
        }, 120000); // 2 minutes interval
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

    const handleToggleAlertSwitch = async (newValue: boolean) => {
        setAlertEnabled(newValue);
        const strVal = newValue ? 'true' : 'false';
        try {
            const keysToUpdate = ['LOW_BALANCE_ALERT_ENABLED', 'low_balance_alert_enabled'];
            for (const k of keysToUpdate) {
                await supabase.from('system_secrets').upsert({
                    key: k,
                    value: strVal,
                    description: 'Enable Auto Low Balance Email Alerts',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

                await supabase.from('app_settings').upsert({
                    key: k,
                    value: strVal,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
            }

            setVaultSecrets(prev => ({
                ...prev,
                'LOW_BALANCE_ALERT_ENABLED': strVal,
                'low_balance_alert_enabled': strVal
            }));

            if (newValue) {
                if (alertEmail.trim()) {
                    supabase.functions.invoke('check-provider-balances', {
                        body: { triggerAlertCheck: true, force: true }
                    });
                    Alert.alert("Alerts Enabled ⚡", `Automated low float alerts are active for ${alertEmail.trim()}.`);
                } else {
                    Alert.alert("Alerts Enabled ⚡", "Please enter your notification email address below and click Save.");
                    setShowAlertCard(true);
                }
            } else {
                Alert.alert("Alerts Disabled 🔕", "Automated low balance email & SMS notifications have been turned OFF.");
            }
        } catch (e: any) {
            Alert.alert("Error", "Failed to update alert toggle state.");
        }
    };

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
                await supabase.functions.invoke('check-provider-balances', {
                    body: { triggerAlertCheck: true, force: true }
                });
                Alert.alert(
                    "Alert Settings Saved! ⚡",
                    `Low Float Email & SMS Alerts are active for ${alertEmail.trim()}.\n\nWhenever any API wallet drops below ₦${Number(alertThreshold).toLocaleString()}, automated alerts will be dispatched.`
                );
            } else {
                Alert.alert(
                    "Alerts Disabled 🔕",
                    "Automated low balance email & SMS notifications have been saved as disabled."
                );
            }
            setShowAlertCard(false);
            fetchProviderBalances(true);
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Failed to save alert settings.");
        } finally {
            setSavingAlerts(false);
        }
    };

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
            fetchProviderBalances(true);
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Failed to save bank account details.");
        } finally {
            setFundSaving(false);
        }
    };

    const fetchProviderBalances = async (isSilent = false) => {
        if (!isSilent) setRefreshing(true);
        try {
            // 1. Invoke Edge Function (uses SERVICE_ROLE_KEY to bypass RLS & parallel fetches)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('check-provider-balances', {
                body: {}
            });

            if (!edgeError && edgeData?.success && edgeData?.providers && edgeData.providers.length > 0) {
                setTotalBalance(edgeData.totalBalance || 0);
                setProviders(edgeData.providers);
                
                // Calculate USD balance for NineBoost
                const usd = edgeData.providers
                    .filter((p: any) => p.currency === 'USD')
                    .reduce((acc: number, curr: any) => acc + (Number(curr.balance) || 0), 0);
                setUsdBalance(usd);

                if (edgeData.secrets) {
                    setVaultSecrets(edgeData.secrets);
                }
                return;
            }

            // 2. Direct client DB query fallback
            const secretsMap: Record<string, string> = {};

            const parseValue = (val: any): string => {
                if (val === null || val === undefined) return '';
                if (typeof val === 'string') return val.trim();
                if (typeof val === 'object') {
                    return val.apiKey || val.key || val.token || val.api_key || val.value || val.secret || val.vendor || JSON.stringify(val);
                }
                return String(val);
            };

            const { data: settingsData } = await supabase.from('app_settings').select('*');
            if (settingsData) {
                settingsData.forEach(s => {
                    const parsed = parseValue(s.value);
                    if (parsed) secretsMap[s.key.toUpperCase()] = parsed;
                });
            }

            const { data: secretsData } = await supabase.from('system_secrets').select('*');
            if (secretsData) {
                secretsData.forEach(s => {
                    const parsed = parseValue(s.value);
                    if (parsed) secretsMap[s.key.toUpperCase()] = parsed;
                });
            }

            setVaultSecrets(secretsMap);

            const bilalToken = secretsMap['BILALSADASUB_TOKEN'] || secretsMap['BILAL_TOKEN'] || secretsMap['BILALSADASUB_API_KEY'] || '';
            const bilalUser = secretsMap['BILALSADASUB_USERNAME'] || secretsMap['BILAL_USERNAME'] || '';
            const bigiToken = secretsMap['BIGI_API_TOKEN'] || secretsMap['BIGI_TOKEN'] || '';
            const bigiUser = secretsMap['BIGISUB_USERNAME'] || secretsMap['BIGI_USERNAME'] || '';
            const skbKey = secretsMap['SKBTECH_API_KEY'] || secretsMap['SKB_API_KEY'] || secretsMap['SKBTECH_KEY'] || '';
            const nineBoostKey = secretsMap['NINEBOOST_API_KEY'] || secretsMap['NINEBOOST_KEY'] || secretsMap['NINEBOOST_TOKEN'] || '';
            const termiiKey = secretsMap['TERMII_API_KEY'] || secretsMap['TERMII_KEY'] || '';
            const flwKey = secretsMap['FLUTTERWAVE_SECRET_KEY'] || secretsMap['FLUTTERWAVE_KEY'] || secretsMap['FLUTTERWAVE_SECRET'] || '';
            const paystackSecret = secretsMap['PAYSTACK_SECRET_KEY'] || secretsMap['PAYSTACK_KEY'] || '';
            const monnifyKey = secretsMap['MONNIFY_API_KEY'] || secretsMap['MONNIFY_KEY'] || '';
            const payVesselKey = secretsMap['PAYVESSEL_API_KEY'] || secretsMap['PAYVESSEL_KEY'] || '';

            const fallbackList: ProviderWallet[] = [
                {
                    id: 'bilalsadasub',
                    name: 'BilalSadaSub Telecom (Data, Airtime, Bills)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: (bilalUser || bilalToken) ? 'healthy' : 'unconfigured',
                    error: (bilalUser || bilalToken) ? undefined : 'Username/Password not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: secretsMap['BILALSADASUB_BANK_NAME'] || 'Sterling Bank / Payvessel',
                        accountNumber: secretsMap['BILALSADASUB_ACCOUNT_NUMBER'] || '8910293841',
                        accountName: secretsMap['BILALSADASUB_ACCOUNT_NAME'] || 'BilalSadaSub Telecom',
                        instructions: 'Dedicated auto-funding bank account for BilalSadaSub VTU balance.'
                    }
                },
                {
                    id: 'bigi',
                    name: 'Bigi VTU Portal (SME Data & Airtime)',
                    category: 'VTU Telecom',
                    balance: 0,
                    currency: 'NGN',
                    status: (bigiUser || bigiToken) ? 'healthy' : 'unconfigured',
                    error: (bigiUser || bigiToken) ? undefined : 'Username/Password not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: secretsMap['BIGI_BANK_NAME'] || 'Wema Bank / BigiSub',
                        accountNumber: secretsMap['BIGI_ACCOUNT_NUMBER'] || '1029384756',
                        accountName: secretsMap['BIGI_ACCOUNT_NAME'] || 'BigiSub Telecom Funding',
                        instructions: 'Direct bank transfer to top up Bigi SME Data float.'
                    }
                },
                {
                    id: 'skbtech',
                    name: 'SKBTECH (NIN, BVN & Identity Portal)',
                    category: 'Digital Identity & CAC',
                    balance: 0,
                    currency: 'NGN',
                    status: skbKey ? 'healthy' : 'unconfigured',
                    error: skbKey ? undefined : 'SKBTECH_API_KEY not configured in Vault (skbtech.com.ng)',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: secretsMap['SKBTECH_BANK_NAME'] || 'Monnify / Sterling Bank',
                        accountNumber: secretsMap['SKBTECH_ACCOUNT_NUMBER'] || '9081234567',
                        accountName: secretsMap['SKBTECH_ACCOUNT_NAME'] || 'SKBTECH Services / ABUMAFHAL',
                        instructions: 'Transfer to this virtual account to top up SKBTECH NIN/BVN balance.'
                    }
                },
                {
                    id: 'nineboost',
                    name: 'NineBoost (Social Media Marketing SMM Panel)',
                    category: 'Marketing Services',
                    balance: 0,
                    currency: 'NGN',
                    status: nineBoostKey ? 'healthy' : 'unconfigured',
                    error: nineBoostKey ? undefined : 'NINEBOOST_API_KEY not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: secretsMap['NINEBOOST_BANK_NAME'] || 'Moniepoint / Sterling',
                        accountNumber: secretsMap['NINEBOOST_ACCOUNT_NUMBER'] || '5051523456',
                        accountName: secretsMap['NINEBOOST_ACCOUNT_NAME'] || 'NineBoost SMM Portal',
                        instructions: 'Transfer to top up SMM panel wallet balance.'
                    }
                },
                {
                    id: 'termii',
                    name: 'Termii (SMS & OTP Messaging Gateway)',
                    category: 'SMS & Communications',
                    balance: 0,
                    currency: 'NGN',
                    status: termiiKey ? 'healthy' : 'unconfigured',
                    error: termiiKey ? undefined : 'TERMII_API_KEY not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: false,
                    depositAccount: {
                        bankName: secretsMap['TERMII_BANK_NAME'] || 'Providus Bank / Termii',
                        accountNumber: secretsMap['TERMII_ACCOUNT_NUMBER'] || '1122334455',
                        accountName: secretsMap['TERMII_ACCOUNT_NAME'] || 'Termii Messaging Corporate',
                        instructions: 'Direct bank transfer to top up Termii SMS/OTP balance.'
                    }
                },
                {
                    id: 'flutterwave',
                    name: 'Flutterwave (Payouts & Gateway Collections)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: flwKey ? 'healthy' : 'unconfigured',
                    error: flwKey ? undefined : 'FLUTTERWAVE_SECRET_KEY not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true,
                    depositAccount: {
                        bankName: secretsMap['FLUTTERWAVE_BANK_NAME'] || 'Access Bank / Flutterwave',
                        accountNumber: secretsMap['FLUTTERWAVE_ACCOUNT_NUMBER'] || '0123456789',
                        accountName: secretsMap['FLUTTERWAVE_ACCOUNT_NAME'] || 'ABUMAFHAL Sub / Flutterwave',
                        instructions: 'Direct bank top-up for Flutterwave merchant balance.'
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
                    id: 'monnify',
                    name: 'Monnify / Moniepoint Gateway',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: monnifyKey ? 'healthy' : 'unconfigured',
                    error: monnifyKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                },
                {
                    id: 'payvessel',
                    name: 'PayVessel (Payment Gateway)',
                    category: 'Payment Gateway',
                    balance: 0,
                    currency: 'NGN',
                    status: payVesselKey ? 'healthy' : 'unconfigured',
                    error: payVesselKey ? undefined : 'API Key not configured in Vault',
                    allowDeposit: true,
                    allowWithdrawal: true
                }
            ];

            setProviders(fallbackList);
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
            bilalsadasub: 'BILALSADASUB_TOKEN',
            bigi: 'BIGI_API_TOKEN',
            skbtech: 'SKBTECH_API_KEY',
            nineboost: 'NINEBOOST_API_KEY',
            termii: 'TERMII_API_KEY',
            flutterwave: 'FLUTTERWAVE_SECRET_KEY',
            paystack: 'PAYSTACK_SECRET_KEY',
            monnify: 'MONNIFY_API_KEY',
            payvessel: 'PAYVESSEL_API_KEY'
        };
        const keyName = secretMap[p.id] || 'GENERIC_API_KEY';
        setTokenKeyName(keyName);

        let existingVal = vaultSecrets[keyName] || vaultSecrets[keyName.replace('_API_KEY', '_KEY').replace('_TOKEN', '_KEY')] || '';
        setTokenValue(existingVal);

        // Pre-fill BilalSadaSub
        if (p.id === 'bilalsadasub') {
            setBilalUsername(vaultSecrets['BILALSADASUB_USERNAME'] || vaultSecrets['BILAL_USERNAME'] || vaultSecrets['BILALSADASUB_USER'] || '');
            setBilalPassword(vaultSecrets['BILALSADASUB_PASSWORD'] || vaultSecrets['BILAL_PASSWORD'] || vaultSecrets['BILALSADASUB_PASS'] || '');
        }

        // Pre-fill BigiSub
        if (p.id === 'bigi') {
            setBigiUsername(vaultSecrets['BIGISUB_USERNAME'] || vaultSecrets['BIGI_USERNAME'] || vaultSecrets['BIGI_USER'] || '');
            setBigiPassword(vaultSecrets['BIGISUB_PASSWORD'] || vaultSecrets['BIGI_PASSWORD'] || vaultSecrets['BIGI_PASS'] || '');
        }

        // Pre-fill SKBTECH
        if (p.id === 'skbtech') {
            setSkbTechKey(vaultSecrets['SKBTECH_API_KEY'] || vaultSecrets['SKB_API_KEY'] || vaultSecrets['SKBTECH_KEY'] || '');
        }

        // Pre-fill NineBoost
        if (p.id === 'nineboost') {
            setNineBoostKey(vaultSecrets['NINEBOOST_API_KEY'] || vaultSecrets['NINEBOOST_KEY'] || vaultSecrets['NINEBOOST_TOKEN'] || '');
        }

        // Pre-fill Flutterwave
        if (p.id === 'flutterwave') {
            setFlwSecretKey(vaultSecrets['FLUTTERWAVE_SECRET_KEY'] || vaultSecrets['FLUTTERWAVE_KEY'] || vaultSecrets['FLUTTERWAVE_SECRET'] || '');
            setFlwPublicKey(vaultSecrets['FLUTTERWAVE_PUBLIC_KEY'] || vaultSecrets['FLUTTERWAVE_PUB'] || '');
            setFlwSecretHash(vaultSecrets['FLUTTERWAVE_SECRET_HASH'] || vaultSecrets['FLUTTERWAVE_HASH'] || '');
        }

        // Pre-fill Termii
        if (p.id === 'termii') {
            setTermiiApiKey(vaultSecrets['TERMII_API_KEY'] || vaultSecrets['TERMII_KEY'] || '');
            setTermiiSenderId(vaultSecrets['TERMII_SENDER_ID'] || vaultSecrets['TERMII_SENDER'] || 'AbuMafhal');
        }

        // Pre-fill Monnify
        if (p.id === 'monnify') {
            setMonnifyApiKey(vaultSecrets['MONNIFY_API_KEY'] || vaultSecrets['MONNIFY_KEY'] || '');
            setMonnifySecret(vaultSecrets['MONNIFY_SECRET_KEY'] || vaultSecrets['MONNIFY_SECRET'] || '');
            setMonnifyContractCode(vaultSecrets['MONNIFY_CONTRACT_CODE'] || vaultSecrets['MONNIFY_CODE'] || '');
        }

        // Pre-fill Paystack
        if (p.id === 'paystack') {
            setPaystackSecret(vaultSecrets['PAYSTACK_SECRET_KEY'] || vaultSecrets['PAYSTACK_KEY'] || '');
            setPaystackPublic(vaultSecrets['PAYSTACK_PUBLIC_KEY'] || vaultSecrets['PAYSTACK_PUB'] || '');
        }
    };

    const handleSaveVaultToken = async () => {
        if (!selectedTokenProvider) return;
        setTokenSaving(true);
        try {
            const pId = selectedTokenProvider.id;
            const updates: Array<{ key: string; value: string; desc: string }> = [];

            if (pId === 'bilalsadasub') {
                if (!bilalUsername.trim() || !bilalPassword.trim()) {
                    Alert.alert("Input Required", "Please enter both Username and Password for BilalSadaSub.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'BILALSADASUB_USERNAME', value: bilalUsername.trim(), desc: 'BilalSadaSub Username' });
                updates.push({ key: 'BILALSADASUB_PASSWORD', value: bilalPassword.trim(), desc: 'BilalSadaSub Password' });
                if (tokenValue.trim()) {
                    updates.push({ key: 'BILALSADASUB_TOKEN', value: tokenValue.trim(), desc: 'BilalSadaSub Token' });
                }
            } else if (pId === 'bigi') {
                if (!bigiUsername.trim() || !bigiPassword.trim()) {
                    Alert.alert("Input Required", "Please enter both Username and Password for Bigi VTU.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'BIGISUB_USERNAME', value: bigiUsername.trim(), desc: 'BigiSub Username' });
                updates.push({ key: 'BIGISUB_PASSWORD', value: bigiPassword.trim(), desc: 'BigiSub Password' });
                if (tokenValue.trim()) {
                    updates.push({ key: 'BIGI_API_TOKEN', value: tokenValue.trim(), desc: 'Bigi Token' });
                }
            } else if (pId === 'skbtech') {
                const keyVal = skbTechKey.trim() || tokenValue.trim();
                if (!keyVal) {
                    Alert.alert("Input Required", "Please enter your official SKBTECH API Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'SKBTECH_API_KEY', value: keyVal, desc: 'SKBTECH Official API Key (skbtech.com.ng)' });
                updates.push({ key: 'SKB_API_KEY', value: keyVal, desc: 'SKBTECH API Key Alias' });
            } else if (pId === 'nineboost') {
                const keyVal = nineBoostKey.trim() || tokenValue.trim();
                if (!keyVal) {
                    Alert.alert("Input Required", "Please enter your NineBoost API Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'NINEBOOST_API_KEY', value: keyVal, desc: 'NineBoost SMM Panel API Key' });
                updates.push({ key: 'NINEBOOST_KEY', value: keyVal, desc: 'NineBoost API Key Alias' });
            } else if (pId === 'flutterwave') {
                const secVal = flwSecretKey.trim() || tokenValue.trim();
                if (!secVal) {
                    Alert.alert("Input Required", "Please enter your Flutterwave Secret Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'FLUTTERWAVE_SECRET_KEY', value: secVal, desc: 'Flutterwave Secret Key' });
                if (flwPublicKey.trim()) {
                    updates.push({ key: 'FLUTTERWAVE_PUBLIC_KEY', value: flwPublicKey.trim(), desc: 'Flutterwave Public Key' });
                }
                if (flwSecretHash.trim()) {
                    updates.push({ key: 'FLUTTERWAVE_SECRET_HASH', value: flwSecretHash.trim(), desc: 'Flutterwave Secret Hash' });
                }
            } else if (pId === 'termii') {
                const keyVal = termiiApiKey.trim() || tokenValue.trim();
                if (!keyVal) {
                    Alert.alert("Input Required", "Please enter your Termii API Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'TERMII_API_KEY', value: keyVal, desc: 'Termii API Key' });
                if (termiiSenderId.trim()) {
                    updates.push({ key: 'TERMII_SENDER_ID', value: termiiSenderId.trim(), desc: 'Termii Sender ID' });
                }
            } else if (pId === 'monnify') {
                const apiVal = monnifyApiKey.trim() || tokenValue.trim();
                if (!apiVal) {
                    Alert.alert("Input Required", "Please enter your Monnify API Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'MONNIFY_API_KEY', value: apiVal, desc: 'Monnify API Key' });
                if (monnifySecret.trim()) {
                    updates.push({ key: 'MONNIFY_SECRET_KEY', value: monnifySecret.trim(), desc: 'Monnify Secret Key' });
                }
                if (monnifyContractCode.trim()) {
                    updates.push({ key: 'MONNIFY_CONTRACT_CODE', value: monnifyContractCode.trim(), desc: 'Monnify Contract Code' });
                }
            } else if (pId === 'paystack') {
                const secVal = paystackSecret.trim() || tokenValue.trim();
                if (!secVal) {
                    Alert.alert("Input Required", "Please enter your Paystack Secret Key.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: 'PAYSTACK_SECRET_KEY', value: secVal, desc: 'Paystack Secret Key' });
                if (paystackPublic.trim()) {
                    updates.push({ key: 'PAYSTACK_PUBLIC_KEY', value: paystackPublic.trim(), desc: 'Paystack Public Key' });
                }
            } else {
                if (!tokenValue.trim()) {
                    Alert.alert("Input Required", "Please enter a valid secret key value.");
                    setTokenSaving(false);
                    return;
                }
                updates.push({ key: tokenKeyName, value: tokenValue.trim(), desc: `Secret for ${selectedTokenProvider.name}` });
            }

            for (const item of updates) {
                await supabase.from('system_secrets').upsert({
                    key: item.key,
                    value: item.value,
                    description: item.desc,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

                await supabase.from('app_settings').upsert({
                    key: item.key,
                    value: item.value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

                setVaultSecrets(prev => ({ ...prev, [item.key]: item.value }));
            }

            // Immediately invoke fast background sync
            supabase.functions.invoke('check-provider-balances', { body: {} });

            Alert.alert("Saved Successfully 🎉", `${selectedTokenProvider.name} credentials saved to Vault! Balance will update now.`);
            setSelectedTokenProvider(null);
            fetchProviderBalances(true);
        } catch (e: any) {
            Alert.alert("Save Error", e.message || "Failed to save secret key to Vault.");
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
                fetchProviderBalances(true);
            } else {
                Alert.alert("Withdrawal Error", data?.error || "Failed to process withdrawal.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An error occurred during withdrawal processing.");
        } finally {
            setWithdrawLoading(false);
        }
    };

    // Individual provider sync
    const handleSyncProvider = async (p: ProviderWallet) => {
        setSyncingProviderId(p.id);
        try {
            const { data, error } = await supabase.functions.invoke('check-provider-balances', {
                body: { singleProviderId: p.id }
            });
            if (!error && data?.provider) {
                setProviders(prev => prev.map(pv => pv.id === p.id ? { ...pv, ...data.provider } : pv));
                // Recalc total
                setProviders(prev => {
                    const total = prev.filter(x => x.currency === 'NGN').reduce((acc, cur) => acc + (Number(cur.balance) || 0), 0);
                    setTotalBalance(total);
                    return prev;
                });
            }
        } catch (_) {}
        finally { setSyncingProviderId(null); }
    };

    // Primary core operational providers
    const CORE_IDS = ['bilalsadasub', 'bigi', 'skbtech', 'nineboost', 'termii', 'flutterwave'];

    // Filter providers based on search and category
    const filteredProviders = providers.filter(p => {
        // Core active filter
        if (activeFilter === 'Active') {
            if (!CORE_IDS.includes(p.id)) return false;
        } else if (activeFilter === 'VTU') {
            if (p.category !== 'VTU Telecom') return false;
        } else if (activeFilter === 'Identity') {
            if (!p.category?.includes('Identity')) return false;
        } else if (activeFilter === 'Gateways') {
            if (p.category !== 'Payment Gateway') return false;
        } else if (activeFilter === 'Comms') {
            if (!p.category?.includes('SMS') && !p.category?.includes('Marketing')) return false;
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
        }

        return true;
    });

    const activeCount = providers.filter(p => CORE_IDS.includes(p.id) && p.status === 'healthy').length;
    const totalCoreCount = CORE_IDS.length;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'Liquidity & API Float Vault',
                headerStyle: { backgroundColor: T.navyDark },
                headerTintColor: T.white,
                headerTitleStyle: { fontWeight: '900', fontSize: 16 },
                headerRight: () => (
                    <TouchableOpacity onPress={() => fetchProviderBalances(false)} style={{ paddingRight: 12 }}>
                        <Ionicons name="sync-outline" size={19} color={T.gold} />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopScrollContent]}
                showsVerticalScrollIndicator={false}
            >
                {/* Aggregate Real-Time Float Hero Banner */}
                <LinearGradient
                    colors={[T.navyDark, T.navy, T.navyMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroAccentStripe} />

                    <View style={styles.heroTopRow}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.heroBadgeRow}>
                                <Ionicons name="shield-checkmark" size={13} color={T.gold} />
                                <Text style={styles.heroSubTitle}>REAL-TIME AGGREGATE API LIQUIDITY</Text>
                            </View>
                            <Text style={styles.heroBalanceText} numberOfLines={1} adjustsFontSizeToFit>
                                ₦ {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                            {usdBalance > 0 && (
                                <Text style={styles.heroUsdText}>
                                    USD Float (SMM): ${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity 
                            onPress={() => fetchProviderBalances(false)} 
                            disabled={refreshing}
                            style={styles.refreshBtn}
                            activeOpacity={0.85}
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color={T.gold} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="sync" size={13} color={T.gold} style={{ marginRight: 4 }} />
                                    <Text style={styles.refreshBtnText}>Sync Float</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Operational Badges Grid */}
                    <View style={styles.badgeGridRow}>
                        <View style={styles.statBadge}>
                            <Ionicons name="checkmark-circle" size={13} color={T.success} />
                            <Text style={styles.statBadgeText}>
                                {activeCount} / {totalCoreCount} Core Pillars Active
                            </Text>
                        </View>

                        <View style={styles.statBadge}>
                            <Ionicons name="flash-outline" size={13} color={T.gold} />
                            <Text style={styles.statBadgeText}>
                                Fast Parallel Polling
                            </Text>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setShowAlertCard(!showAlertCard)}
                            style={[styles.statBadge, alertEnabled && { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
                        >
                            <Ionicons name={alertEnabled ? "notifications" : "notifications-outline"} size={13} color={alertEnabled ? T.success : T.gold} />
                            <Text style={styles.statBadgeText}>
                                {alertEnabled ? 'Auto Alerts ON' : 'Alerts Config'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Automated Low Float Email & SMS Alert Settings Banner/Card */}
                <View style={styles.alertCardContainer}>
                    <TouchableOpacity 
                        onPress={() => setShowAlertCard(!showAlertCard)}
                        style={styles.alertHeaderRow}
                        activeOpacity={0.85}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View style={styles.alertIconBadge}>
                                <Ionicons name="mail-unread-outline" size={16} color="#d97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.alertTitle}>
                                    ⚡ Automated Low Float Threshold Alerts
                                </Text>
                                <Text style={styles.alertSub} numberOfLines={1}>
                                    {alertEnabled && alertEmail ? `Active → ${alertEmail} (Min: ₦${Number(alertThreshold || 5000).toLocaleString()} | Every ${alertIntervalMins || 30}m)` : 'Click to set alert email, SMS phone & threshold'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name={showAlertCard ? "chevron-up" : "chevron-down"} size={16} color={T.navy} />
                    </TouchableOpacity>

                    {showAlertCard && (
                        <View style={styles.alertExpandedBox}>
                            <Text style={styles.alertExplainer}>
                                Receive instant email & SMS notifications whenever any provider wallet drops below your minimum safety float.
                            </Text>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Admin Notification Email</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="admin@abumafhal.com.ng"
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
                                        placeholder="08145853539"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        value={alertPhone}
                                        onChangeText={setAlertPhone}
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Minimum Float Threshold (₦)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="5000"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={alertThreshold}
                                        onChangeText={setAlertThreshold}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Cooldown Interval (Minutes)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="30"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                        value={alertIntervalMins}
                                        onChangeText={setAlertIntervalMins}
                                    />
                                </View>
                            </View>

                            {/* Custom SMTP / Zoho Config Accordion */}
                            <TouchableOpacity 
                                onPress={() => setShowSmtpConfig(!showSmtpConfig)}
                                style={styles.smtpToggleBtn}
                            >
                                <Text style={styles.smtpToggleText}>
                                    🔐 Custom SMTP / Zoho Email Setup (Direct Inbox)
                                </Text>
                                <Ionicons name={showSmtpConfig ? "chevron-up" : "chevron-down"} size={14} color="#92400e" />
                            </TouchableOpacity>

                            {showSmtpConfig && (
                                <View style={styles.smtpBox}>
                                    <Text style={styles.inputLabel}>Zoho Sender Email</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="admin@abumafhal.com.ng"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={smtpEmail}
                                        onChangeText={setSmtpEmail}
                                    />

                                    <Text style={styles.inputLabel}>Zoho App Password</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter Zoho App Password"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        value={smtpPass}
                                        onChangeText={setSmtpPass}
                                    />
                                </View>
                            )}

                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Enable Automated Low Float Alerts</Text>
                                <Switch
                                    value={alertEnabled}
                                    onValueChange={handleToggleAlertSwitch}
                                    trackColor={{ false: '#cbd5e1', true: T.gold }}
                                    thumbColor={alertEnabled ? T.navy : '#f1f5f9'}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={handleSaveAlertSettings}
                                disabled={savingAlerts}
                                style={styles.saveAlertBtn}
                                activeOpacity={0.85}
                            >
                                {savingAlerts ? (
                                    <ActivityIndicator color={T.navy} size="small" />
                                ) : (
                                    <Text style={styles.saveAlertBtnText}>Save & Apply Alert Preferences</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Quick Search Bar */}
                <View style={styles.searchBarBox}>
                    <Ionicons name="search-outline" size={15} color={T.textSub} style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search vendors by name or service (Bilal, SKB Tech, Bigi, Flutterwave)..."
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

                {/* Clean Category Navigation Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                    {[
                        { label: 'Core Active', key: 'Active' },
                        { label: 'VTU Telecom', key: 'VTU' },
                        { label: 'Identity & KYC', key: 'Identity' },
                        { label: 'Payment Gateways', key: 'Gateways' },
                        { label: 'Comms & SMM', key: 'Comms' },
                        { label: `All (${providers.length})`, key: 'All' },
                    ].map(f => (
                        <TouchableOpacity 
                            key={f.key}
                            onPress={() => setActiveFilter(f.key)}
                            style={[
                                styles.filterChip,
                                activeFilter === f.key && styles.filterChipActive
                            ]}
                        >
                            <Text style={[
                                styles.filterChipText,
                                activeFilter === f.key && styles.filterChipTextActive
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        {activeFilter === 'Active' ? '⭐ Core Active Operational Float' : `${activeFilter} Providers`}
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/manage/secrets')}>
                        <Text style={styles.manageVaultLink}>Manage All Vault Keys →</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={T.navy} />
                        <Text style={styles.loadingText}>Fetching real-time balances from active API gateways...</Text>
                    </View>
                ) : filteredProviders.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="search-outline" size={28} color={T.textSub} />
                        <Text style={styles.emptyTitle}>No Providers Found</Text>
                        <Text style={styles.emptySub}>No vendor matched your filter or search criteria.</Text>
                    </View>
                ) : (
                    <View style={[styles.providersGrid, isDesktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
                        {filteredProviders.map((p) => {
                            const isHealthy = p.status === 'healthy';
                            const isLow = p.status === 'low';
                            const isCritical = p.status === 'critical';
                            const isUnconfigured = p.status === 'unconfigured';

                            return (
                                <View key={p.id} style={[
                                    styles.providerCard,
                                    { width: providerCardWidth },
                                    p.status === 'low' && { borderColor: '#f59e0b' },
                                    p.status === 'critical' && { borderColor: '#ef4444' },
                                ]}>
                                    {/* Left Status Accent Bar */}
                                    <View style={[
                                        styles.providerCardLeftBar,
                                        { backgroundColor: 
                                            p.status === 'healthy' ? T.success :
                                            p.status === 'low' ? T.warning :
                                            p.status === 'critical' ? T.danger :
                                            p.status === 'unconfigured' ? '#f97316' : T.danger
                                        }
                                    ]} />

                                    <View style={styles.providerCardHeader}>
                                        <View style={{ flex: 1, paddingRight: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                <View style={styles.providerIconMini}>
                                                    <Ionicons 
                                                        name={
                                                            p.category?.includes('Identity') ? 'finger-print-outline' :
                                                            p.category?.includes('Telecom') ? 'cellular-outline' :
                                                            p.category?.includes('Payment') ? 'card-outline' :
                                                            p.category?.includes('SMS') ? 'chatbubble-ellipses-outline' : 'cube-outline'
                                                        } 
                                                        size={12} 
                                                        color={T.navy} 
                                                    />
                                                </View>
                                                <Text style={styles.providerCategory}>{p.category || 'API Vendor'}</Text>
                                                {p.latencyMs && (
                                                    <Text style={styles.latencyTag}>⚡ {p.latencyMs}ms</Text>
                                                )}
                                            </View>
                                            <Text style={styles.providerName} numberOfLines={1}>{p.name}</Text>
                                        </View>

                                        {/* Status Pill */}
                                        <View style={[
                                            styles.statusPill,
                                            p.status === 'healthy' && { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
                                            p.status === 'low' && { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
                                            p.status === 'critical' && { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
                                            p.status === 'unconfigured' && { backgroundColor: '#fff7ed', borderColor: '#f97316' },
                                            p.status === 'error' && { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
                                        ]}>
                                            <Text style={[
                                                styles.statusPillText,
                                                p.status === 'healthy' && { color: '#15803d' },
                                                p.status === 'low' && { color: '#b45309' },
                                                p.status === 'critical' && { color: '#b91c1c' },
                                                p.status === 'unconfigured' && { color: '#c2410c' },
                                                p.status === 'error' && { color: '#991b1b' },
                                            ]}>
                                                {p.status === 'healthy' ? '✓ HEALTHY' :
                                                 p.status === 'low' ? '⚠ LOW FLOAT' :
                                                 p.status === 'critical' ? '🔴 CRITICAL' :
                                                 p.status === 'error' ? '✗ ERROR' : 'SETUP NEEDED'}
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
                                                <Ionicons name="arrow-up-circle-outline" size={12} color={T.white} style={{ marginRight: 3 }} />
                                                <Text style={[styles.actionBtnText, { color: T.white }]} numberOfLines={1}>Withdraw</Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity 
                                            onPress={() => handleOpenTokenModal(p)}
                                            style={[styles.actionBtn, styles.tokenBtn, p.status === 'unconfigured' && styles.tokenBtnHighlight]}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="key-outline" size={12} color={p.status === 'unconfigured' ? T.white : T.navy} style={{ marginRight: 3 }} />
                                            <Text style={[styles.actionBtnText, { color: p.status === 'unconfigured' ? T.white : T.navy }]} numberOfLines={1}>
                                                {p.status === 'unconfigured' ? 'Set Token' : 'Vault Key'}
                                            </Text>
                                        </TouchableOpacity>

                                        {/* Individual Sync Button */}
                                        <TouchableOpacity
                                            onPress={() => handleSyncProvider(p)}
                                            disabled={syncingProviderId === p.id}
                                            style={[styles.actionBtn, styles.syncBtn]}
                                            activeOpacity={0.85}
                                        >
                                            {syncingProviderId === p.id ? (
                                                <ActivityIndicator size={12} color={T.navy} />
                                            ) : (
                                                <Ionicons name="sync-outline" size={13} color={T.navy} />
                                            )}
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
                                Transfer funds directly to the dedicated top-up bank account below to credit your {selectedDepositProvider?.name} balance.
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
                                        <Ionicons name="copy-outline" size={14} color={T.goldDk} />
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
                                    💡 {selectedDepositProvider?.depositAccount?.instructions || 'Transfer funds to this bank account to automatically top up provider float.'}
                                </Text>
                            </View>

                            {/* Inline Bank Details Customiser / Editor */}
                            {editingDepositBank ? (
                                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: T.border, marginBottom: 12 }}>
                                    <Text style={{ color: T.navy, fontWeight: '700', fontSize: 12, marginBottom: 8 }}>
                                        ✏️ Edit Top-Up Bank Account (Saved in Vault)
                                    </Text>

                                    <Text style={styles.inputLabel}>Bank Name</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Sterling Bank, Wema, Monnify, Access Bank"
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
                                    <Text style={{ color: T.navy, fontSize: 12.5, fontWeight: '700' }}>
                                        ✏️ Edit Top-Up Bank Account Details
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

            {/* Dedicated Tailored Vault Key Edit Modal */}
            <Modal transparent visible={!!selectedTokenProvider} animationType="fade" onRequestClose={() => setSelectedTokenProvider(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalDecorStripe} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={styles.modalTitle}>Vault Configuration — {selectedTokenProvider?.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedTokenProvider(null)}>
                                    <Ionicons name="close-circle" size={22} color={T.textSub} />
                                </TouchableOpacity>
                            </View>

                            {/* 1. BilalSadaSub / BigiSub Form */}
                            {(selectedTokenProvider?.id === 'bilalsadasub' || selectedTokenProvider?.id === 'bigi') ? (
                                <>
                                    <View style={styles.infoBanner}>
                                        <Text style={styles.infoBannerText}>
                                            🔐 {selectedTokenProvider?.name} uses Username + Password authentication. Enter your login credentials below:
                                        </Text>
                                    </View>

                                    <Text style={styles.inputLabel}>Portal Username</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder={`Enter your ${selectedTokenProvider?.name} username`}
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={selectedTokenProvider?.id === 'bigi' ? bigiUsername : bilalUsername}
                                        onChangeText={selectedTokenProvider?.id === 'bigi' ? setBigiUsername : setBilalUsername}
                                    />

                                    <Text style={styles.inputLabel}>Portal Password</Text>
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

                                    <Text style={[styles.inputLabel, { marginTop: 4 }]}>Access Token (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Optional token override if available"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={tokenValue}
                                        onChangeText={setTokenValue}
                                    />
                                </>
                            ) : selectedTokenProvider?.id === 'nineboost' ? (
                                /* NineBoost Form */
                                <>
                                    <View style={[styles.infoBanner, { borderLeftColor: '#8b5cf6' }]}>
                                        <Text style={styles.infoBannerText}>
                                            📱 NineBoost SMM Panel API Key for Social Media Marketing services.
                                        </Text>
                                    </View>

                                    <Text style={styles.inputLabel}>NineBoost API Key</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Paste your NineBoost API Key here"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        value={nineBoostKey || tokenValue}
                                        onChangeText={(val) => { setNineBoostKey(val); setTokenValue(val); }}
                                    />

                                    <TouchableOpacity 
                                        onPress={() => Linking.openURL('https://9boost.me/api')}
                                        style={{ marginVertical: 6, flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Ionicons name="open-outline" size={14} color={T.info} style={{ marginRight: 4 }} />
                                        <Text style={{ color: T.info, fontSize: 12, fontWeight: '700' }}>
                                            Open NineBoost API Dashboard (9boost.me)
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : selectedTokenProvider?.id === 'skbtech' ? (
                                /* 2. SKBTECH Official Form */
                                <>
                                    <View style={[styles.infoBanner, { borderLeftColor: T.success }]}>
                                        <Text style={styles.infoBannerText}>
                                            🛡️ Official SKBTECH API Key for NIN, BVN, Slip Printing and Identity Services.
                                        </Text>
                                    </View>

                                    <Text style={styles.inputLabel}>SKBTECH API Key (SKBTECH_API_KEY)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="skb_live_..."
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={skbTechKey || tokenValue}
                                        onChangeText={(val) => { setSkbTechKey(val); setTokenValue(val); }}
                                    />

                                    <TouchableOpacity 
                                        onPress={() => Linking.openURL('https://skbtech.com.ng/developer')}
                                        style={{ marginVertical: 6, flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Ionicons name="open-outline" size={14} color={T.info} style={{ marginRight: 4 }} />
                                        <Text style={{ color: T.info, fontSize: 12, fontWeight: '700' }}>
                                            Open SKBTECH Developer Portal (skbtech.com.ng)
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : selectedTokenProvider?.id === 'flutterwave' ? (
                                /* 3. Flutterwave Form */
                                <>
                                    <View style={[styles.infoBanner, { borderLeftColor: '#f59e0b' }]}>
                                        <Text style={styles.infoBannerText}>
                                            💳 Flutterwave Secret Key is required for live automated merchant payouts and collections.
                                        </Text>
                                    </View>

                                    <Text style={styles.inputLabel}>Flutterwave Secret Key (FLWSECK-...)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="FLWSECK_TEST-... or FLWSECK-..."
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={false}
                                        autoCapitalize="none"
                                        value={flwSecretKey || tokenValue}
                                        onChangeText={(val) => { setFlwSecretKey(val); setTokenValue(val); }}
                                    />

                                    <Text style={styles.inputLabel}>Flutterwave Public Key (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="FLWPUBK-..."
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={flwPublicKey}
                                        onChangeText={setFlwPublicKey}
                                    />

                                    <Text style={styles.inputLabel}>Webhook Secret Hash (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter secret hash for webhook verification"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={flwSecretHash}
                                        onChangeText={setFlwSecretHash}
                                    />

                                    <TouchableOpacity 
                                        onPress={() => Linking.openURL('https://dashboard.flutterwave.com/dashboard/settings/apis')}
                                        style={{ marginVertical: 6, flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        <Ionicons name="open-outline" size={14} color={T.info} style={{ marginRight: 4 }} />
                                        <Text style={{ color: T.info, fontSize: 12, fontWeight: '700' }}>
                                            Open Flutterwave API Dashboard
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : selectedTokenProvider?.id === 'termii' ? (
                                /* 4. Termii Form */
                                <>
                                    <Text style={styles.inputLabel}>Termii API Key</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter Termii API Key"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={termiiApiKey || tokenValue}
                                        onChangeText={(val) => { setTermiiApiKey(val); setTokenValue(val); }}
                                    />

                                    <Text style={styles.inputLabel}>Termii Sender ID</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. AbuMafhal"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={termiiSenderId}
                                        onChangeText={setTermiiSenderId}
                                    />
                                </>
                            ) : selectedTokenProvider?.id === 'monnify' ? (
                                /* 5. Monnify Form */
                                <>
                                    <Text style={styles.inputLabel}>Monnify API Key (MK_PROD_...)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="MK_PROD_..."
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={monnifyApiKey || tokenValue}
                                        onChangeText={(val) => { setMonnifyApiKey(val); setTokenValue(val); }}
                                    />

                                    <Text style={styles.inputLabel}>Monnify Secret Key</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Enter Monnify Secret Key"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        value={monnifySecret}
                                        onChangeText={setMonnifySecret}
                                    />

                                    <Text style={styles.inputLabel}>Monnify Contract Code (Optional)</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="1029384756"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        value={monnifyContractCode}
                                        onChangeText={setMonnifyContractCode}
                                    />
                                </>
                            ) : (
                                /* Generic Provider */
                                <>
                                    <Text style={styles.inputLabel}>Secret Key Name</Text>
                                    <TextInput
                                        style={[styles.modalInput, { backgroundColor: '#e2e8f0', color: T.textSub }]}
                                        value={tokenKeyName}
                                        editable={false}
                                    />

                                    <Text style={styles.inputLabel}>Secret Key Value</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Paste API Key or Token here..."
                                        placeholderTextColor="#94a3b8"
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
                                        Save Credentials to Vault
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setSelectedTokenProvider(null)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseBtnText}>Cancel</Text>
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
                                Transfer funds directly out of your {selectedWithdrawProvider?.name} merchant balance to your designated bank account.
                            </Text>

                            <Text style={styles.inputLabel}>Withdrawal Amount (₦)</Text>
                            <TextInput 
                                style={styles.modalInput}
                                placeholder="e.g. 50000"
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

                            <Text style={styles.inputLabel}>10-Digit Destination Account Number</Text>
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
                                    <Text style={styles.executeWithdrawBtnText}>Execute Live Transfer</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setSelectedWithdrawProvider(null)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseBtnText}>Cancel</Text>
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
        maxWidth: 1400,
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
        gap: 4,
        marginBottom: 2,
    },
    heroSubTitle: {
        color: T.gold,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    heroBalanceText: {
        color: T.white,
        fontWeight: '800',
        fontSize: 22,
        letterSpacing: 0.2,
    },
    heroUsdText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    refreshBtn: {
        backgroundColor: 'rgba(245, 166, 35, 0.18)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: T.gold,
    },
    refreshBtnText: {
        color: T.gold,
        fontSize: 12,
        fontWeight: '700',
    },
    badgeGridRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statBadgeText: {
        color: '#f1f5f9',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    alertCardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: T.border,
    },
    alertHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    alertIconBadge: {
        backgroundColor: '#fff7ed',
        padding: 6,
        borderRadius: 8,
        marginRight: 8,
    },
    alertTitle: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12.5,
    },
    alertSub: {
        color: T.textSub,
        fontSize: 12,
    },
    alertExpandedBox: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    alertExplainer: {
        color: T.textSub,
        fontSize: 12,
        marginBottom: 10,
        lineHeight: 16,
    },
    formRow: {
        flexDirection: 'row',
        gap: 10,
    },
    smtpToggleBtn: {
        backgroundColor: '#fffbeb',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#fef08a',
        marginVertical: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    smtpToggleText: {
        color: '#92400e',
        fontSize: 12,
        fontWeight: '700',
    },
    smtpBox: {
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 8,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 8,
    },
    switchLabel: {
        color: T.navy,
        fontWeight: '600',
        fontSize: 12,
    },
    saveAlertBtn: {
        height: 38,
        borderRadius: 8,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    saveAlertBtnText: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12.5,
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 8,
        paddingHorizontal: 9,
        height: 36,
        borderWidth: 1,
        borderColor: T.border,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: T.navy,
        fontWeight: '500',
    },
    filterBar: {
        marginBottom: 10,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 99,
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 6,
    },
    filterChipActive: {
        backgroundColor: T.navy,
        borderColor: T.navy,
    },
    filterChipText: {
        color: T.textSub,
        fontSize: 12,
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
        marginBottom: 8,
    },
    sectionTitle: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 13,
    },
    manageVaultLink: {
        color: T.goldDk,
        fontSize: 12,
        fontWeight: '700',
    },
    loadingBox: {
        padding: 24,
        alignItems: 'center',
    },
    loadingText: {
        color: T.textSub,
        marginTop: 6,
        fontWeight: '500',
        fontSize: 12.5,
    },
    emptyBox: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: T.cardBg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: T.border,
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: T.navy,
        marginTop: 4,
    },
    emptySub: {
        fontSize: 12,
        color: T.textSub,
        marginTop: 2,
    },
    providersGrid: {
        gap: 8,
    },
    providerCard: {
        backgroundColor: T.cardBg,
        borderRadius: 10,
        padding: 12,
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
        width: 3.5,
    },
    providerCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerIconMini: {
        width: 20,
        height: 20,
        borderRadius: 5,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    providerCategory: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    latencyTag: {
        color: T.success,
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
    },
    providerName: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 13,
        marginTop: 1,
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 99,
        borderWidth: 1,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 4,
    },
    currencySymbol: {
        fontSize: 13,
        fontWeight: '700',
        color: T.goldDk,
        marginRight: 2,
    },
    providerBalance: {
        color: T.navy,
        fontWeight: '800',
        fontSize: 17,
    },
    providerErrorText: {
        color: T.warning,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    actionBtn: {
        flex: 1,
        minWidth: 68,
        height: 32,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
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
        maxWidth: 88,
        flex: 0,
        minWidth: 68,
    },
    tokenBtnHighlight: {
        backgroundColor: T.warning,
        borderColor: T.warning,
        maxWidth: 88,
        flex: 0,
        minWidth: 68,
    },
    syncBtn: {
        backgroundColor: '#f1f5f9',
        borderColor: T.border,
        flex: 0,
        width: 32,
        minWidth: 32,
        paddingHorizontal: 0,
    },
    actionBtnText: {
        fontSize: 12,
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
        maxWidth: 440,
        maxHeight: '90%',
        backgroundColor: T.white,
        borderRadius: 14,
        padding: 16,
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
        fontSize: 14,
    },
    modalSubText: {
        color: T.textSub,
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 10,
    },
    infoBanner: {
        backgroundColor: '#fffbeb',
        borderRadius: 8,
        padding: 8,
        borderLeftWidth: 3,
        borderLeftColor: T.gold,
        marginBottom: 10,
    },
    infoBannerText: {
        color: '#92400e',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 15,
    },
    bankDetailCard: {
        backgroundColor: T.goldBg,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(245,166,35,0.3)',
        marginBottom: 12,
    },
    bankDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    bankLabel: {
        color: T.textSub,
        fontSize: 12,
        fontWeight: '500',
    },
    bankValue: {
        color: T.navy,
        fontSize: 12.5,
        fontWeight: '700',
    },
    copySuccessToast: {
        color: T.success,
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
    },
    bankInstructions: {
        color: T.navy,
        fontSize: 12,
        marginTop: 6,
        lineHeight: 15,
        fontWeight: '500',
    },
    modalCloseBtn: {
        height: 36,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    modalCloseBtnText: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12,
    },
    inputLabel: {
        color: T.navy,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 3,
    },
    modalInput: {
        height: 38,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: '#f8fafc',
        color: T.navy,
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 8,
    },
    bankChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: T.border,
        marginRight: 6,
    },
    bankChipSelected: {
        backgroundColor: T.gold,
        borderColor: T.goldDk,
    },
    bankChipText: {
        color: T.navy,
        fontSize: 12,
        fontWeight: '600',
    },
    executeWithdrawBtn: {
        height: 38,
        borderRadius: 8,
        backgroundColor: T.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    executeWithdrawBtnText: {
        color: T.navy,
        fontWeight: '700',
        fontSize: 12.5,
    },
});
