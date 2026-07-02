import { View, Text, Switch, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

const ToggleRow = ({ title, subtitle, value, onValueChange, icon, color }: any) => (
    <View style={s.toggleRow}>
        <View style={s.toggleLeft}>
            <View style={[s.iconBox, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={18} color={color} />
            </View>
            <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.toggleTitle}>{title}</Text>
                <Text style={s.toggleSubtitle}>{subtitle}</Text>
            </View>
        </View>
        <Switch 
            value={value} 
            onValueChange={(val) => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                onValueChange(val);
            }} 
            trackColor={{ true: color, false: '#e2e8f0' }} 
            thumbColor="#fff" 
        />
    </View>
);

const InputRow = ({ label, value, onChangeText, prefix, placeholder = "", keyboardType = "default" }: any) => (
    <View style={s.inputGroup}>
        <Text style={s.label}>{label}</Text>
        <View style={s.inputWrapper}>
            {prefix && (
                <View style={s.prefixBox}>
                    <Text style={s.inputPrefix}>{prefix}</Text>
                </View>
            )}
            <TextInput 
                value={value} 
                onChangeText={onChangeText} 
                style={s.input} 
                keyboardType={keyboardType}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
            />
        </View>
    </View>
);

const ApiInputRow = ({ placeholder, value, onChangeText, isSecret = false }: any) => (
    <TextInput 
        value={value} 
        onChangeText={onChangeText} 
        placeholder={placeholder} 
        secureTextEntry={isSecret} 
        style={s.inputMono} 
        placeholderTextColor="#94a3b8" 
    />
);

export default function AdminSettings() {
    const router = useRouter();
    
    // Core Settings
    const [maintenance, setMaintenance] = useState(false);
    const [registrations, setRegistrations] = useState(true);
    const [requireEmailVerif, setRequireEmailVerif] = useState(false);
    const [forceAppUpdate, setForceAppUpdate] = useState(false);
    const [allowBiometrics, setAllowBiometrics] = useState(true);
    const [autoApproveKyc, setAutoApproveKyc] = useState(false);
    const [hideUserBalances, setHideUserBalances] = useState(false);

    // Economics
    const [usdNgnRate, setUsdNgnRate] = useState('1450.00');
    const [agentCommission, setAgentCommission] = useState('2.5');
    const [dailyWithdrawalLimit, setDailyWithdrawalLimit] = useState('50000');
    const [minWithdrawal, setMinWithdrawal] = useState('1000');
    const [referralBonus, setReferralBonus] = useState('500');
    const [welcomeBonus, setWelcomeBonus] = useState('0');
    const [fundingFeeValue, setFundingFeeValue] = useState('0');
    const [fundingFeeType, setFundingFeeType] = useState('percentage');

    // Comms
    const [supportWhatsapp, setSupportWhatsapp] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    
    // Global Announcement
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementUrl, setAnnouncementUrl] = useState('');
    const [announcementType, setAnnouncementType] = useState('image');
    const [announcementActive, setAnnouncementActive] = useState(false);
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [keysLoading, setKeysLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'system' | 'economics' | 'api'>('system');
    const [expandedApi, setExpandedApi] = useState<string | null>('payments');

    // Virtual Accounts & Payment Keys
    const [payvesselKey, setPayvesselKey] = useState('');
    const [payvesselSecret, setPayvesselSecret] = useState('');
    const [payvesselBusinessId, setPayvesselBusinessId] = useState('');
    const [paystackKey, setPaystackKey] = useState('');
    const [monnifyKey, setMonnifyKey] = useState('');
    const [flutterwaveKey, setFlutterwaveKey] = useState('');

    // VTU & Bills Keys
    const [vtpassKey, setVtpassKey] = useState('');
    const [vtpassPublicKey, setVtpassPublicKey] = useState('');
    
    // Identity & Communication Keys
    const [identityApiKey, setIdentityApiKey] = useState('');
    const [smileIdKey, setSmileIdKey] = useState('');
    const [termiiKey, setTermiiKey] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // Economics
            const { data } = await supabase.from('exchange_rates').select('sell_rate').eq('pair', 'USDT / NGN').single();
            if (data) setUsdNgnRate(String(data.sell_rate));

            const { data: appSettings } = await supabase.from('app_settings').select('*');
            if (appSettings) {
                appSettings.forEach(s => {
                    if (s.key === 'maintenance_mode') setMaintenance(s.value === 'true');
                    if (s.key === 'allow_registrations') setRegistrations(s.value === 'true');
                    if (s.key === 'require_email_verif') setRequireEmailVerif(s.value === 'true');
                    if (s.key === 'force_app_update') setForceAppUpdate(s.value === 'true');
                    if (s.key === 'allow_biometrics') setAllowBiometrics(s.value === 'true');
                    if (s.key === 'auto_approve_kyc') setAutoApproveKyc(s.value === 'true');
                    if (s.key === 'hide_user_balances') setHideUserBalances(s.value === 'true');
                    
                    if (s.key === 'agent_commission') setAgentCommission(s.value);
                    if (s.key === 'daily_withdrawal_limit') setDailyWithdrawalLimit(s.value);
                    if (s.key === 'min_withdrawal') setMinWithdrawal(s.value);
                    if (s.key === 'referral_bonus') setReferralBonus(s.value);
                    if (s.key === 'welcome_bonus') setWelcomeBonus(s.value);
                    if (s.key === 'funding_fee_percentage') setFundingFeeValue(s.value); // Legacy migration
                    if (s.key === 'funding_fee_value') setFundingFeeValue(s.value);
                    if (s.key === 'funding_fee_type') setFundingFeeType(s.value);
                    
                    if (s.key === 'support_whatsapp') setSupportWhatsapp(s.value);
                    if (s.key === 'support_email') setSupportEmail(s.value);
                    if (s.key === 'global_announcement') {
                        try {
                            const parsed = JSON.parse(s.value);
                            setAnnouncementText(parsed.text || '');
                            setAnnouncementUrl(parsed.mediaUrl || '');
                            setAnnouncementType(parsed.mediaType || 'image');
                            setAnnouncementActive(parsed.isActive === true);
                        } catch (e) {
                            setAnnouncementText(s.value);
                        }
                    }
                });
            }

            // API Keys
            const { data: secrets } = await supabase.from('system_secrets').select('key, value');
            if (secrets) {
                secrets.forEach((secret) => {
                    if (secret.key === 'PAYSTACK_SECRET_KEY') setPaystackKey(secret.value);
                    if (secret.key === 'MONNIFY_API_KEY') setMonnifyKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_KEY') setPayvesselKey(secret.value);
                    if (secret.key === 'PAYVESSEL_API_SECRET') setPayvesselSecret(secret.value);
                    if (secret.key === 'PAYVESSEL_BUSINESS_ID') setPayvesselBusinessId(secret.value);
                    if (secret.key === 'FLUTTERWAVE_SECRET_KEY') setFlutterwaveKey(secret.value);
                    
                    if (secret.key === 'VTPASS_API_KEY') setVtpassKey(secret.value);
                    if (secret.key === 'VTPASS_PUBLIC_KEY') setVtpassPublicKey(secret.value);
                    
                    if (secret.key === 'IDENTITY_API_KEY') setIdentityApiKey(secret.value);
                    if (secret.key === 'SMILE_ID_KEY') setSmileIdKey(secret.value);
                    if (secret.key === 'TERMII_API_KEY') setTermiiKey(secret.value);
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleSaveKeys = async () => {
        setKeysLoading(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const keysToSave = [
                { key: 'PAYSTACK_SECRET_KEY', value: paystackKey, description: 'Paystack Secret Key' },
                { key: 'MONNIFY_API_KEY', value: monnifyKey, description: 'Monnify API Key' },
                { key: 'PAYVESSEL_API_KEY', value: payvesselKey, description: 'Payvessel API Key' },
                { key: 'PAYVESSEL_API_SECRET', value: payvesselSecret, description: 'Payvessel API Secret' },
                { key: 'PAYVESSEL_BUSINESS_ID', value: payvesselBusinessId, description: 'Payvessel Business ID' },
                { key: 'FLUTTERWAVE_SECRET_KEY', value: flutterwaveKey, description: 'Flutterwave Secret Key' },
                { key: 'VTPASS_API_KEY', value: vtpassKey, description: 'VTPass Secret Key' },
                { key: 'VTPASS_PUBLIC_KEY', value: vtpassPublicKey, description: 'VTPass Public Key' },
                { key: 'IDENTITY_API_KEY', value: identityApiKey, description: 'Identity Provider API Key' },
                { key: 'SMILE_ID_KEY', value: smileIdKey, description: 'SmileID API Key' },
                { key: 'TERMII_API_KEY', value: termiiKey, description: 'Termii SMS API Key' }
            ].filter(k => k.value && k.value.trim() !== '');

            if (keysToSave.length > 0) {
                const { error } = await supabase.from('system_secrets').upsert(keysToSave);
                if (error) throw error;
            }
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'API keys have been securely encrypted and stored.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setKeysLoading(false);
        }
    };

    const handleUpdateSettings = async () => {
        setLoading(true);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            // Update Economics
            await supabase
                .from('exchange_rates')
                .update({ sell_rate: parseFloat(usdNgnRate), updated_at: new Date().toISOString() })
                .eq('pair', 'USDT / NGN');

            // Update System Settings
            const settingsToSave = [
                { key: 'maintenance_mode', value: String(maintenance) },
                { key: 'allow_registrations', value: String(registrations) },
                { key: 'require_email_verif', value: String(requireEmailVerif) },
                { key: 'force_app_update', value: String(forceAppUpdate) },
                { key: 'allow_biometrics', value: String(allowBiometrics) },
                { key: 'auto_approve_kyc', value: String(autoApproveKyc) },
                { key: 'hide_user_balances', value: String(hideUserBalances) },
                { key: 'agent_commission', value: agentCommission },
                { key: 'daily_withdrawal_limit', value: dailyWithdrawalLimit },
                { key: 'min_withdrawal', value: minWithdrawal },
                { key: 'referral_bonus', value: referralBonus },
                { key: 'welcome_bonus', value: welcomeBonus },
                { key: 'funding_fee_value', value: fundingFeeValue },
                { key: 'funding_fee_type', value: fundingFeeType },
                { key: 'support_whatsapp', value: supportWhatsapp },
                { key: 'support_email', value: supportEmail },
                { key: 'global_announcement', value: JSON.stringify({
                    text: announcementText,
                    mediaUrl: announcementUrl,
                    mediaType: announcementType,
                    isActive: announcementActive
                }) }
            ];
            
            const { error } = await supabase.from('app_settings').upsert(settingsToSave, { onConflict: 'key' });
            if (error) throw error;
            
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'System preferences saved and synced across all devices.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const pickAnnouncementMedia = async () => {
        try {
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                quality: 0.8,
                videoMaxDuration: 60,
            });

            if (!result.canceled && result.assets[0].uri) {
                setLoading(true);
                const asset = result.assets[0];
                const isVideo = asset.type === 'video' || asset.uri.endsWith('.mp4') || asset.uri.endsWith('.mov');
                
                // For expo web, we might need a different approach, but for native we use fetch
                const response = await fetch(asset.uri);
                const blob = await response.blob();
                
                const fileExt = isVideo ? 'mp4' : 'jpg';
                const fileName = `announcement_${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars') 
                    .upload(`announcements/${fileName}`, blob, {
                        contentType: isVideo ? 'video/mp4' : 'image/jpeg'
                    });
                    
                if (uploadError) {
                    Alert.alert('Upload Error', uploadError.message);
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(`announcements/${fileName}`);
                        
                    setAnnouncementType(isVideo ? 'video' : 'image');
                    setAnnouncementUrl(publicUrlData.publicUrl);
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };



    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header */}
            <LinearGradient colors={['#060d21', '#121F42']} style={s.header}>
                <SafeAreaView edges={['top']}>
                    <View style={s.headerContent}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Admin Settings</Text>
                            <Text style={s.headerSubtitle}>System Control Panel</Text>
                        </View>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Custom Tabs */}
                    <View style={s.tabContainer}>
                        <TouchableOpacity onPress={() => setActiveTab('system')} style={[s.tabBtn, activeTab === 'system' && s.tabBtnActive]}>
                            <Ionicons name="settings-outline" size={14} color={activeTab === 'system' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />
                            <Text style={[s.tabText, activeTab === 'system' && s.tabTextActive]}>System</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('economics')} style={[s.tabBtn, activeTab === 'economics' && s.tabBtnActive]}>
                            <Ionicons name="cash-outline" size={14} color={activeTab === 'economics' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />
                            <Text style={[s.tabText, activeTab === 'economics' && s.tabTextActive]}>Economics</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('api')} style={[s.tabBtn, activeTab === 'api' && s.tabBtnActive]}>
                            <Ionicons name="key-outline" size={14} color={activeTab === 'api' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />
                            <Text style={[s.tabText, activeTab === 'api' && s.tabTextActive]}>API Keys</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
                
                {activeTab === 'system' && (
                    <View style={s.section}>
                        <View style={s.card}>
                            <ToggleRow 
                                title="Maintenance Mode" subtitle="Disable app access for all regular users"
                                icon="power" color="#EF4444" value={maintenance} onValueChange={setMaintenance}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Allow Registrations" subtitle="Open the gates for new users to sign up"
                                icon="person-add" color="#10B981" value={registrations} onValueChange={setRegistrations}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Require Email Verif." subtitle="Users must verify their email before using the app"
                                icon="mail-unread" color="#4F46E5" value={requireEmailVerif} onValueChange={setRequireEmailVerif}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Allow Biometrics" subtitle="Allow fingerprint or face ID for quick login"
                                icon="finger-print" color="#D97706" value={allowBiometrics} onValueChange={setAllowBiometrics}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Force App Update" subtitle="Require users to download the latest version"
                                icon="cloud-download" color="#DB2777" value={forceAppUpdate} onValueChange={setForceAppUpdate}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Auto Approve KYC" subtitle="Automatically verify valid BVN/NIN without manual review"
                                icon="checkmark-done" color="#0284C7" value={autoApproveKyc} onValueChange={setAutoApproveKyc}
                            />
                            <View style={s.divider} />
                            <ToggleRow 
                                title="Hide User Balances" subtitle="Conceal wallet balances on the dashboard globally"
                                icon="eye-off" color="#4B5563" value={hideUserBalances} onValueChange={setHideUserBalances}
                            />
                        </View>

                        <Text style={s.groupLabel}>App Communication</Text>
                        <View style={s.card}>
                            <InputRow label="WhatsApp Support" value={supportWhatsapp} onChangeText={setSupportWhatsapp} prefix="WA" keyboardType="phone-pad" />
                            <InputRow label="Support Email" value={supportEmail} onChangeText={setSupportEmail} placeholder="help@abumafhal.com" keyboardType="email-address" />
                        </View>

                        <Text style={s.groupLabel}>Global Announcement</Text>
                        <View style={s.card}>
                            <ToggleRow title="Enable Announcement" subtitle="Show this to all users on app launch" icon="megaphone" color="#8B5CF6" value={announcementActive} onValueChange={setAnnouncementActive} />
                            <View style={s.divider} />
                            <InputRow label="Announcement Text" value={announcementText} onChangeText={setAnnouncementText} placeholder="Message displayed to all users" />
                            
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Media URL or Upload Image</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ flex: 1 }}>
                                        <TextInput 
                                            value={announcementUrl} 
                                            onChangeText={setAnnouncementUrl} 
                                            style={s.inputMono} 
                                            placeholder="https://... or upload ->"
                                            placeholderTextColor="#94a3b8" 
                                        />
                                    </View>
                                    <TouchableOpacity onPress={pickAnnouncementMedia} style={s.uploadBtn} activeOpacity={0.7}>
                                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Media Type</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity onPress={() => setAnnouncementType('image')} style={[s.typeBtn, announcementType === 'image' && s.typeBtnActive]}>
                                        <Ionicons name="image" size={16} color={announcementType === 'image' ? '#fff' : '#64748b'} />
                                        <Text style={[s.typeText, announcementType === 'image' && { color: '#fff' }]}>Image</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setAnnouncementType('video')} style={[s.typeBtn, announcementType === 'video' && s.typeBtnActive]}>
                                        <Ionicons name="videocam" size={16} color={announcementType === 'video' ? '#fff' : '#64748b'} />
                                        <Text style={[s.typeText, announcementType === 'video' && { color: '#fff' }]}>Video</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                        
                        <TouchableOpacity onPress={handleUpdateSettings} style={s.saveBtn} activeOpacity={0.8}>
                            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={s.saveBtnText}>Save System Config</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {activeTab === 'economics' && (
                    <View style={s.section}>
                        <View style={s.card}>
                            <InputRow label="USD/NGN Exchange Rate" value={usdNgnRate} onChangeText={setUsdNgnRate} prefix="₦" keyboardType="numeric" />
                            <InputRow label="Agent Commission Rate" value={agentCommission} onChangeText={setAgentCommission} prefix="%" keyboardType="numeric" />
                            
                            <View style={s.inputGroup}>
                                <Text style={s.label}>Funding Fee Type</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity onPress={() => setFundingFeeType('percentage')} style={[s.typeBtn, fundingFeeType === 'percentage' && s.typeBtnActive]}>
                                        <Text style={[s.typeText, fundingFeeType === 'percentage' && { color: '#fff' }]}>Percentage (%)</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setFundingFeeType('fixed')} style={[s.typeBtn, fundingFeeType === 'fixed' && s.typeBtnActive]}>
                                        <Text style={[s.typeText, fundingFeeType === 'fixed' && { color: '#fff' }]}>Fixed Amount (₦)</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <InputRow label={`Funding Fee Deduction`} value={fundingFeeValue} onChangeText={setFundingFeeValue} prefix={fundingFeeType === 'fixed' ? '₦' : '%'} keyboardType="numeric" />
                        </View>
                        
                        <Text style={s.groupLabel}>Wallet & Withdrawals</Text>
                        <View style={s.card}>
                            <InputRow label="Daily Withdrawal Limit" value={dailyWithdrawalLimit} onChangeText={setDailyWithdrawalLimit} prefix="₦" keyboardType="numeric" />
                            <InputRow label="Minimum Withdrawal" value={minWithdrawal} onChangeText={setMinWithdrawal} prefix="₦" keyboardType="numeric" />
                        </View>

                        <Text style={s.groupLabel}>Bonuses</Text>
                        <View style={s.card}>
                            <InputRow label="Referral Bonus" value={referralBonus} onChangeText={setReferralBonus} prefix="₦" keyboardType="numeric" />
                            <InputRow label="Welcome Bonus (New Users)" value={welcomeBonus} onChangeText={setWelcomeBonus} prefix="₦" keyboardType="numeric" />
                        </View>
                        
                        <TouchableOpacity onPress={handleUpdateSettings} style={s.saveBtn} activeOpacity={0.8}>
                            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={s.saveBtnText}>Save Economics</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {activeTab === 'api' && (
                    <View style={s.section}>
                        
                        {/* Payments Accordion */}
                        <TouchableOpacity onPress={() => setExpandedApi(expandedApi === 'payments' ? null : 'payments')} style={[s.accordionHeader, expandedApi === 'payments' && s.accordionHeaderActive]} activeOpacity={0.8}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="card" size={18} color={expandedApi === 'payments' ? '#fff' : '#0d1b3e'} style={{ marginRight: 8 }} />
                                <Text style={[s.accordionTitle, expandedApi === 'payments' && { color: '#fff' }]}>Payments & Virtual Accounts</Text>
                            </View>
                            <Ionicons name={expandedApi === 'payments' ? "chevron-up" : "chevron-down"} size={18} color={expandedApi === 'payments' ? '#fff' : '#64748b'} />
                        </TouchableOpacity>
                        {expandedApi === 'payments' && (
                            <View style={s.accordionBody}>
                                <ApiInputRow placeholder="Payvessel API Key" value={payvesselKey} onChangeText={setPayvesselKey} isSecret={true} />
                                <ApiInputRow placeholder="Payvessel API Secret" value={payvesselSecret} onChangeText={setPayvesselSecret} isSecret={true} />
                                <ApiInputRow placeholder="Payvessel Business ID" value={payvesselBusinessId} onChangeText={setPayvesselBusinessId} />
                                <View style={s.divider} />
                                <ApiInputRow placeholder="Paystack Secret Key" value={paystackKey} onChangeText={setPaystackKey} isSecret={true} />
                                <ApiInputRow placeholder="Monnify API Key" value={monnifyKey} onChangeText={setMonnifyKey} isSecret={true} />
                                <ApiInputRow placeholder="Flutterwave Secret Key" value={flutterwaveKey} onChangeText={setFlutterwaveKey} isSecret={true} />
                            </View>
                        )}

                        {/* VTPASS Accordion */}
                        <TouchableOpacity onPress={() => setExpandedApi(expandedApi === 'vtu' ? null : 'vtu')} style={[s.accordionHeader, expandedApi === 'vtu' && s.accordionHeaderActive]} activeOpacity={0.8}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="phone-portrait" size={18} color={expandedApi === 'vtu' ? '#fff' : '#0d1b3e'} style={{ marginRight: 8 }} />
                                <Text style={[s.accordionTitle, expandedApi === 'vtu' && { color: '#fff' }]}>VTU & Bills (VTPass)</Text>
                            </View>
                            <Ionicons name={expandedApi === 'vtu' ? "chevron-up" : "chevron-down"} size={18} color={expandedApi === 'vtu' ? '#fff' : '#64748b'} />
                        </TouchableOpacity>
                        {expandedApi === 'vtu' && (
                            <View style={s.accordionBody}>
                                <ApiInputRow placeholder="VTPass Public Key" value={vtpassPublicKey} onChangeText={setVtpassPublicKey} />
                                <ApiInputRow placeholder="VTPass Secret Key" value={vtpassKey} onChangeText={setVtpassKey} isSecret={true} />
                            </View>
                        )}

                        {/* Identity Accordion */}
                        <TouchableOpacity onPress={() => setExpandedApi(expandedApi === 'identity' ? null : 'identity')} style={[s.accordionHeader, expandedApi === 'identity' && s.accordionHeaderActive]} activeOpacity={0.8}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="finger-print" size={18} color={expandedApi === 'identity' ? '#fff' : '#0d1b3e'} style={{ marginRight: 8 }} />
                                <Text style={[s.accordionTitle, expandedApi === 'identity' && { color: '#fff' }]}>Identity & SMS</Text>
                            </View>
                            <Ionicons name={expandedApi === 'identity' ? "chevron-up" : "chevron-down"} size={18} color={expandedApi === 'identity' ? '#fff' : '#64748b'} />
                        </TouchableOpacity>
                        {expandedApi === 'identity' && (
                            <View style={s.accordionBody}>
                                <ApiInputRow placeholder="Identity Provider Key (NIN/BVN)" value={identityApiKey} onChangeText={setIdentityApiKey} isSecret={true} />
                                <ApiInputRow placeholder="SmileID API Key" value={smileIdKey} onChangeText={setSmileIdKey} isSecret={true} />
                                <View style={s.divider} />
                                <ApiInputRow placeholder="Termii SMS API Key" value={termiiKey} onChangeText={setTermiiKey} isSecret={true} />
                            </View>
                        )}

                        <TouchableOpacity onPress={handleSaveKeys} style={s.saveBtn} activeOpacity={0.8}>
                            {keysLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Ionicons name="lock-closed" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={s.saveBtnText}>Encrypt & Save Keys</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },
    
    header: {
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 16,
    },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
    backBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 },
    
    tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: 20, marginBottom: 20, borderRadius: 12, padding: 4 },
    tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
    tabText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    tabTextActive: { color: '#0d1b3e' },

    scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
    section: { paddingBottom: 24 },
    
    groupLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8, marginLeft: 4 },
    
    card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#e2e8f0' },
    
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    toggleTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    toggleSubtitle: { fontSize: 11, color: '#64748b', lineHeight: 16 },
    
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
    
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 8, marginLeft: 4 },
    inputWrapper: { backgroundColor: '#f8fafc', borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    prefixBox: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, height: 48, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#e2e8f0' },
    inputPrefix: { fontSize: 14, fontWeight: '800', color: '#475569' },
    input: { height: 48, flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A', paddingHorizontal: 16 },
    
    inputMono: { height: 48, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 16, fontSize: 12, fontWeight: '600', color: '#0F172A', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
    
    accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
    accordionHeaderActive: { backgroundColor: '#0d1b3e', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
    accordionTitle: { fontSize: 13, fontWeight: '800', color: '#0d1b3e', letterSpacing: 0.5 },
    accordionBody: { backgroundColor: '#ffffff', padding: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },

    saveBtn: { backgroundColor: '#060d21', height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, shadowColor: '#060d21', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
    saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
    
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', height: 44, borderRadius: 12, gap: 8 },
    typeBtnActive: { backgroundColor: '#060d21' },
    typeText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    
    uploadBtn: { width: 48, height: 48, backgroundColor: '#8B5CF6', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }
});
