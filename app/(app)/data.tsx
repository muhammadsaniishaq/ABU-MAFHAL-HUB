import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, LayoutAnimation, Modal, FlatList, StyleSheet, Linking, Pressable } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { api } from '../../services/api';
import { supabase } from '../../services/supabase';
import { DataPlan } from '../../services/partners';
import { createAppNotification } from '../../services/notificationsHelper';
import SecurityModal from '../../components/SecurityModal';
import TransactionConfirmationModal from '../../components/TransactionConfirmationModal';
import DynamicBanners from '../../components/DynamicBanners';
import BrandAlertModal, { AlertType, BrandAlertState } from '../../components/BrandAlertModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { validateNigerianPhone } from '../../utils/securityUtils';
import { KetawancyService } from '../../services/ketawancy';

export interface ExtractedPlanInfo {
    volumeVal: string;
    volumeUnit: 'MB' | 'GB' | 'TB';
    volumeInGB: number;
    validity: string;
    validityCategory: 'Daily' | 'Weekly' | 'Monthly';
}

const parsePlanInfo = (volume: any, name: string, rawValidity?: string): ExtractedPlanInfo => {
    const rawName = String(name || '').trim();
    const rawVol = String(volume || '').trim();
    const rawVal = String(rawValidity || '').trim();

    // 1. Extract Validity Duration First
    let validity = (rawVal && rawVal !== '30 Days') ? rawVal : '';
    let validityCategory: 'Daily' | 'Weekly' | 'Monthly' = 'Monthly';

    // Matches e.g. "30 Days", "1 Day", "7 Days", "24 Hrs"
    const dayNameMatch = rawName.match(/(\d+)\s*(day|days|hrs|hours|hr)\b/i);
    const dayValMatch = rawVal.match(/(\d+)\s*(day|days|hrs|hours|hr)\b/i);

    const isDaily = /daily|1\s*day|2\s*days|3\s*days|24\s*hrs/i.test(`${rawName} ${rawVal}`);
    const isWeekly = /weekly|7\s*days|14\s*days/i.test(`${rawName} ${rawVal}`);

    if (dayNameMatch) {
        const numDays = parseInt(dayNameMatch[1]);
        if (numDays <= 3) {
            validity = `${numDays} ${numDays === 1 ? 'Day' : 'Days'}`;
            validityCategory = 'Daily';
        } else if (numDays <= 14) {
            validity = `${numDays} Days`;
            validityCategory = 'Weekly';
        } else {
            validity = `${numDays} Days`;
            validityCategory = 'Monthly';
        }
    } else if (isDaily) {
        validity = '1 Day';
        validityCategory = 'Daily';
    } else if (isWeekly) {
        validity = '7 Days';
        validityCategory = 'Weekly';
    } else if (dayValMatch) {
        const numDays = parseInt(dayValMatch[1]);
        if (numDays <= 3) {
            validity = `${numDays} ${numDays === 1 ? 'Day' : 'Days'}`;
            validityCategory = 'Daily';
        } else if (numDays <= 14) {
            validity = `${numDays} Days`;
            validityCategory = 'Weekly';
        } else {
            validity = `${numDays} Days`;
            validityCategory = 'Monthly';
        }
    } else {
        validity = validity || '30 Days';
        validityCategory = 'Monthly';
    }

    // 2. Clean text for Volume Parsing (REMOVE validity numbers to avoid "5GB + 30 Days = 530MB" bug!)
    const cleanText = `${rawVol} ${rawName}`
        .replace(/(\d+)\s*(day|days|hrs|hours|hr|month|months|wk|wks|week|weeks)\b/gi, '')
        .replace(/\(\s*\d+\s*(day|days|hrs|hours|hr)\s*\)/gi, '')
        .trim();

    let volumeVal = '';
    let volumeUnit: 'MB' | 'GB' | 'TB' = 'GB';
    let volumeInGB = 0;

    // Check for TB
    const tbMatch = cleanText.match(/(\d+(\.\d+)?)\s*(tb|terabyte|terabytes)(?![a-z])/i);
    if (tbMatch) {
        const val = parseFloat(tbMatch[1]);
        volumeVal = String(val);
        volumeUnit = 'TB';
        volumeInGB = val * 1024;
        return { volumeVal, volumeUnit, volumeInGB, validity, validityCategory };
    }

    // Check for MB
    const mbMatch = cleanText.match(/(\d+(\.\d+)?)\s*(mb|meg|megs|megabyte|megabytes)(?![a-z])/i);
    if (mbMatch) {
        const val = parseFloat(mbMatch[1]);
        if (val >= 1000) {
            const gbVal = (val >= 1024 && val % 1024 === 0) ? val / 1024 : Math.round((val / 1000) * 100) / 100;
            volumeVal = String(gbVal);
            volumeUnit = 'GB';
            volumeInGB = gbVal;
        } else {
            volumeVal = String(val);
            volumeUnit = 'MB';
            volumeInGB = val / 1024;
        }
        return { volumeVal, volumeUnit, volumeInGB, validity, validityCategory };
    }

    // Check for GB
    const gbMatch = cleanText.match(/(\d+(\.\d+)?)\s*(gb|gig|gigs|gigabyte|gigabytes|g)(?![a-z])/i);
    if (gbMatch) {
        const val = parseFloat(gbMatch[1]);
        volumeVal = String(val);
        volumeUnit = 'GB';
        volumeInGB = val;
        return { volumeVal, volumeUnit, volumeInGB, validity, validityCategory };
    }

    // Fallback: extract ONLY the first numeric token from cleanText
    const firstNumMatch = cleanText.match(/(\d+(\.\d+)?)/);
    if (firstNumMatch) {
        const numVal = parseFloat(firstNumMatch[1]);
        if (!isNaN(numVal) && numVal > 0) {
            if (numVal >= 1000) {
                const gbVal = (numVal >= 1024 && numVal % 1024 === 0) ? numVal / 1024 : Math.round((numVal / 1000) * 100) / 100;
                volumeVal = String(gbVal);
                volumeUnit = 'GB';
                volumeInGB = gbVal;
            } else if (numVal >= 100) {
                volumeVal = String(numVal);
                volumeUnit = 'MB';
                volumeInGB = numVal / 1024;
            } else {
                volumeVal = String(numVal);
                volumeUnit = 'GB';
                volumeInGB = numVal;
            }
        }
    }

    return { volumeVal, volumeUnit, volumeInGB, validity, validityCategory };
};

const parseVolumeToGB = (volume: any, name: string): number => {
    return parsePlanInfo(volume, name).volumeInGB;
};

// Network Logos
const NETWORK_LOGOS: Record<string, any> = {
    mtn: require('../../assets/images/mtn.png'),
    glo: require('../../assets/images/glo.png'),
    airtel: require('../../assets/images/airtel.png'),
    '9mobile': require('../../assets/images/9mobile.png'),
    smile: require('../../assets/images/smile_logo.png'),
    alpha: require('../../assets/images/alpha_logo.png'),
    kirani: require('../../assets/images/kirani.png'),
    ratel: require('../../assets/images/ratel_alat.png'),
    sahal: require('../../assets/images/sahal.png'),
    vitel: require('../../assets/images/vitel.png'),
};

const NETWORKS_DATA = [
    { id: 'mtn', name: 'MTN', color: '#FFCC00', status: '5G Ready', prefixes: ['0803', '0806', '0703', '0706', '0810', '0813', '0814', '0816', '0903', '0906', '0913', '0916', '0704'] },
    { id: 'airtel', name: 'Airtel', color: '#FF0000', status: '5G Ready', prefixes: ['0802', '0808', '0708', '0812', '0701', '0902', '0904', '0907', '0901', '0912', '0911'] },
    { id: 'glo', name: 'Glo', color: '#0F6A37', status: '4G LTE', prefixes: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'] },
    { id: '9mobile', name: '9mobile', color: '#006B3E', status: '4G Active', prefixes: ['0809', '0818', '0817', '0909', '0908'] },
    { id: 'smile', name: 'Smile 4G', color: '#ec4899', status: '4G LTE', prefixes: ['0702', '0709', '0707'] },
    { id: 'alpha', name: 'Alpha', color: '#DC2626', status: 'Fast Data', prefixes: [] },
    { id: 'kirani', name: 'Kirani', color: '#2563EB', status: '4G Fast', prefixes: [] },
    { id: 'ratel', name: 'Ratel', color: '#B45309', status: '4G Active', prefixes: [] },
    { id: 'sahal', name: 'Sahal', color: '#E11D48', status: '4G LTE', prefixes: [] },
    { id: 'vitel', name: 'VITAL', color: '#6366F1', status: '4G Active', prefixes: ['0804'] },
];

const getNetworkStyles = (netId: string, isSelected: boolean) => {
    if (!isSelected) {
        return { bg: '#ffffff', border: '#e2e8f0', text: '#64748b' };
    }
    switch (netId) {
        case 'mtn':
            return { bg: '#fffbeb', border: '#eab308', text: '#854d0e' };
        case 'airtel':
            return { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' };
        case 'glo':
            return { bg: '#f0fdf4', border: '#16a34a', text: '#166534' };
        case '9mobile':
            return { bg: '#ecfdf5', border: '#059669', text: '#065f46' };
        case 'smile':
            return { bg: '#fdf2f8', border: '#ec4899', text: '#be185d' };
        case 'alpha':
            return { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' };
        case 'kirani':
            return { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8' };
        case 'ratel':
            return { bg: '#fffbeb', border: '#b45309', text: '#78350f' };
        case 'sahal':
            return { bg: '#fff1f2', border: '#e11d48', text: '#be123c' };
        case 'vitel':
            return { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' };
        default:
            return { bg: '#f1f5f9', border: '#475569', text: '#1e293b' };
    }
};

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
};


const cleanNigerianPhone = (raw: string): string => {
    let p = (raw || '').replace(/\D/g, '');
    if (p.startsWith('2340') && p.length === 14) {
        p = '0' + p.slice(4);
    } else if (p.startsWith('234') && p.length === 13) {
        p = '0' + p.slice(3);
    } else if (p.length === 10 && !p.startsWith('0')) {
        p = '0' + p;
    }
    if (p.length > 11 && p.startsWith('0')) {
        p = p.slice(0, 11);
    }
    return p;
};
export default function DataScreen() {
    const insets = useSafeAreaInsets();
    const [network, setNetwork] = useState('');
    const [networksData, setNetworksData] = useState(NETWORKS_DATA);
    const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
    const [plans, setPlans] = useState<DataPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [loadingPurchase, setLoadingPurchase] = useState(false);
    
    // Smooth Brand Alert State
    const [brandAlert, setBrandAlert] = useState<BrandAlertState>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttonText: 'OK',
    });

    const showBrandAlert = useCallback((
        title: string, 
        message: string, 
        type: AlertType = 'info', 
        buttonText: string = 'OK', 
        onConfirm?: () => void,
        showCancel: boolean = false,
        cancelText: string = 'Cancel',
        onCancel?: () => void
    ) => {
        try {
            if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (_) {}

        setBrandAlert({
            visible: true,
            title,
            message,
            type,
            buttonText,
            onConfirm,
            showCancel,
            cancelText,
            onCancel
        });
    }, []);
    
    // Fetch dynamic networks & filter out networks hidden by admin
    useEffect(() => {
        const fetchNetworks = async () => {
            try {
                // 1. Fetch hidden networks configured by admin
                let hidden: string[] = [];
                try {
                    const { data: hiddenData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'hidden_data_networks')
                        .maybeSingle();
                    if (hiddenData && hiddenData.value) {
                        if (Array.isArray(hiddenData.value)) hidden = hiddenData.value;
                        else if (typeof hiddenData.value === 'string') {
                            try { hidden = JSON.parse(hiddenData.value); } catch (_) {}
                        }
                    }
                } catch (_) {}

                // 2. Fetch network rates
                let dynamic = NETWORKS_DATA;
                try {
                    const response = await fetch('https://www.nellobytesystems.com/APIDatabundleNetworkV2.asp?UserID=CK101269551');
                    const data = await response.json();
                    if (data && data.MOBILE_NETWORK) {
                        dynamic = NETWORKS_DATA.map((baseNet) => {
                            const match = data.MOBILE_NETWORK.find((net: any) => {
                                const n = (net.NETWORK_NAME || '').toLowerCase();
                                return n.includes(baseNet.id) || (baseNet.id === '9mobile' && (n.includes('mobile') || n.includes('t2')));
                            });
                            return match ? { ...baseNet, apiId: match.NETWORK_ID, discount: match.DISCOUNT } : baseNet;
                        });
                    }
                } catch (_) {}

                // 3. Exclude any network flagged as hidden by admin
                const visibleNetworks = dynamic.filter(n => !hidden.includes(n.id));
                setNetworksData(visibleNetworks);

                // If currently selected network was hidden, reset or select first visible
                setNetwork(curr => {
                    if (curr && hidden.includes(curr)) {
                        return visibleNetworks.length > 0 ? visibleNetworks[0].id : '';
                    }
                    return curr;
                });
            } catch (err) {
                console.warn('Failed to fetch dynamic networks', err);
            }
        };
        fetchNetworks();
    }, []);
    
    // UI states
    const [balance, setBalance] = useState<number | null>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [contactModalTab, setContactModalTab] = useState<'beneficiaries' | 'add' | 'phonebook'>('beneficiaries');
    const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);
    const [contactsPermissionGranted, setContactsPermissionGranted] = useState<boolean | null>(null);
    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [planFilter, setPlanFilter] = useState<'All' | 'Favorites' | 'Daily' | 'Weekly' | 'Monthly'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastTransaction, setLastTransaction] = useState<any>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [beneficiarySearch, setBeneficiarySearch] = useState('');

    // Beneficiary Manager States
    const [newBenName, setNewBenName] = useState('');
    const [newBenPhone, setNewBenPhone] = useState('');
    const [newBenNetwork, setNewBenNetwork] = useState('');
    const [savingBen, setSavingBen] = useState(false);
    const [dismissedMismatchPhone, setDismissedMismatchPhone] = useState('');
    
    // Premium features states
    const [autoRenew, setAutoRenew] = useState(false);
    const [isGift, setIsGift] = useState(false);
    const [recipientName, setRecipientName] = useState('');
    const [isSaveBeneficiary, setIsSaveBeneficiary] = useState(false);
    const [showEstimator, setShowEstimator] = useState(false);
    const [socialHours, setSocialHours] = useState(0);
    const [streamingHours, setStreamingHours] = useState(0);
    const [browsingHours, setBrowsingHours] = useState(0);
    const [minVolumeFilter, setMinVolumeFilter] = useState<number | null>(null);
    const [showUssdGuide, setShowUssdGuide] = useState(false);
    const [showRolloverTips, setShowRolloverTips] = useState(false);
    const [giftingBeneficiaryActive, setGiftingBeneficiaryActive] = useState(false);
    
    // Modern segmented control state
    const [purchaseMode, setPurchaseMode] = useState<'self' | 'others'>('self');
    const [userPhone, setUserPhone] = useState<string>('');
    
    // Plan Type Dropdown State
    const [planTypeFilter, setPlanTypeFilter] = useState<string>('All');
    const [showPlanTypeModal, setShowPlanTypeModal] = useState(false);

    // Contact Picker State
    const [deviceContacts, setDeviceContacts] = useState<any[]>([]);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    
    const router = useRouter();
    const isWeb = Platform.OS === 'web';
    const headerTopPadding = Math.max(insets.top, Platform.OS === 'android' ? 32 : 20) + 12;

    // Initial Data Load (Parallel Execution)
    useEffect(() => {
        Promise.allSettled([
            fetchUserData(),
            fetchBeneficiaries(),
            fetchLastTransaction(),
            loadFavorites()
        ]).catch(e => console.warn('Data init error:', e));
    }, []);

    const loadDeviceContacts = async (forceRequest = false) => {
        setLoadingDeviceContacts(true);
        try {
            let status = 'undetermined';
            if (forceRequest) {
                const req = await Contacts.requestPermissionsAsync();
                status = req.status;
            } else {
                const check = await Contacts.getPermissionsAsync();
                status = check.status;
                if (status !== 'granted') {
                    const req = await Contacts.requestPermissionsAsync();
                    status = req.status;
                }
            }

            setContactsPermissionGranted(status === 'granted');

            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                    pageSize: 600,
                });
                if (data && Array.isArray(data)) {
                    const validList: any[] = [];
                    const seenPhones = new Set<string>();
                    data.forEach(c => {
                        if (c.phoneNumbers && Array.isArray(c.phoneNumbers)) {
                            c.phoneNumbers.forEach((pn: any) => {
                                const cleaned = cleanNigerianPhone(pn.number || '');
                                if (cleaned && cleaned.length === 11 && !seenPhones.has(cleaned)) {
                                    seenPhones.add(cleaned);
                                    validList.push({
                                        id: `${c.id || Math.random()}-${cleaned}`,
                                        name: c.name || pn.label || 'Contact',
                                        phone: cleaned
                                    });
                                }
                            });
                        }
                    });
                    validList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    setDeviceContacts(validList);
                }
            }
        } catch (e) {
            console.warn("Device contacts loading note:", e);
        } finally {
            setLoadingDeviceContacts(false);
        }
    };

    // Open Beneficiary / Contact Modal
    const handleOpenContactModal = () => {
        setShowContactModal(true);
        loadDeviceContacts(false);
    };

    // Quick Paste from Clipboard
    const handlePasteFromClipboard = async () => {
        try {
            const clip = await Clipboard.getStringAsync();
            if (clip) {
                const cleaned = cleanNigerianPhone(clip);
                if (cleaned && cleaned.length === 11) {
                    setPhoneNumber(cleaned);
                    detectNetwork(cleaned);
                    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                    showBrandAlert("Phone Pasted", `Pasted: ${cleaned}`, "success");
                } else if (cleaned) {
                    setPhoneNumber(cleaned);
                    detectNetwork(cleaned);
                    showBrandAlert("Partial Number", `Pasted: ${cleaned}. Please ensure it is 11 digits.`, "info");
                } else {
                    showBrandAlert("Invalid Clipboard", "No valid mobile number found in clipboard.", "warning");
                }
            } else {
                showBrandAlert("Clipboard Empty", "Nothing found in clipboard.", "info");
            }
        } catch (_) {}
    };

    // Direct Native Contact Picker Launch
    const handleLaunchNativeContactPicker = async () => {
        try {
            if (Platform.OS === 'web') {
                handleOpenContactModal();
                return;
            }
            const { status } = await Contacts.requestPermissionsAsync();
            setContactsPermissionGranted(status === 'granted');
            if (status !== 'granted') {
                showBrandAlert(
                    'Contacts Permission Needed',
                    'Please allow contacts access in settings to select numbers directly from your address book.',
                    'warning',
                    'View In-App List',
                    () => handleOpenContactModal(),
                    true,
                    'Cancel'
                );
                return;
            }
            const contact = await Contacts.presentContactPickerAsync();
            if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                const rawPhone = contact.phoneNumbers[0].number || '';
                const cleaned = cleanNigerianPhone(rawPhone);
                if (cleaned) {
                    setPhoneNumber(cleaned);
                    detectNetwork(cleaned);
                    setShowContactModal(false);
                    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                }
            } else if (contact) {
                showBrandAlert('No Phone Number', 'The contact you selected does not have a valid mobile number.', 'warning');
            }
        } catch (e) { console.warn(e); }
    };


    const loadFavorites = async () => {
        try {
            const saved = await AsyncStorage.getItem('data_favorites');
            if (saved) {
                setFavorites(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load favorites", e);
        }
    };

    const fetchLastTransaction = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'data')
            .eq('status', 'success')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (data) setLastTransaction(data);
    };

    const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('balance, phone').eq('id', user.id).single();
            if (data) {
                setBalance(data.balance);
                if (data.phone) {
                    setUserPhone(data.phone);
                    // Pre-fill phone number if currently in 'self' mode
                    if (purchaseMode === 'self' && !phoneNumber) {
                        setPhoneNumber(data.phone);
                        detectNetwork(data.phone);
                    }
                }
            }
        }
    };

    const fetchBeneficiaries = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Instant load from local storage cache
            const cached = await AsyncStorage.getItem(`@data_beneficiaries_${user.id}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setBeneficiaries(parsed);
                    }
                } catch (_) {}
            }

            // 2. Fetch latest from Supabase
            const { data } = await supabase
                .from('beneficiaries')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data && Array.isArray(data)) {
                const normalized = data.map((b: any) => {
                    const rawPhone = b.phone_number || b.account_number || b.phone || '';
                    const cleanPhone = cleanNigerianPhone(rawPhone);
                    const rawNet = (b.bank_name || b.network || '').toLowerCase();
                    let netId = '';
                    if (rawNet.includes('mtn')) netId = 'mtn';
                    else if (rawNet.includes('airtel')) netId = 'airtel';
                    else if (rawNet.includes('glo')) netId = 'glo';
                    else if (rawNet.includes('9mobile') || rawNet.includes('etisalat')) netId = '9mobile';
                    else if (rawNet.includes('vitel') || rawNet.includes('vital')) netId = 'vitel';

                    return {
                        id: b.id ? String(b.id) : undefined,
                        name: b.name || 'Beneficiary',
                        phone: cleanPhone || rawPhone,
                        network: netId || undefined,
                        created_at: b.created_at,
                    };
                }).filter((b: any) => b.phone && b.phone.length >= 10);

                // Deduplicate by phone
                const uniqueBens: any[] = [];
                const seen = new Set<string>();
                normalized.forEach((b: any) => {
                    if (!seen.has(b.phone)) {
                        seen.add(b.phone);
                        uniqueBens.push(b);
                    }
                });

                setBeneficiaries(uniqueBens);
                await AsyncStorage.setItem(`@data_beneficiaries_${user.id}`, JSON.stringify(uniqueBens));
            }
        } catch (err) {
            console.warn("fetchBeneficiaries error:", err);
        }
    };

    // Save a new beneficiary directly
    const handleSaveNewBeneficiary = async (name: string, phone: string, netId?: string) => {
        const cleaned = cleanNigerianPhone(phone);
        if (!name.trim()) {
            showBrandAlert("Name Required", "Please enter a name or nickname for the beneficiary.", "warning");
            return;
        }
        if (!cleaned || cleaned.length !== 11) {
            showBrandAlert("Invalid Phone", "Please enter a valid 11-digit Nigerian mobile number.", "warning");
            return;
        }
        setSavingBen(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Please log in to save beneficiaries");

            const targetNet = netId || getCarrierForPhone(cleaned)?.id || network || 'mtn';
            const netName = NETWORKS_DATA.find(n => n.id === targetNet)?.name || targetNet.toUpperCase();

            const { data, error } = await supabase.from('beneficiaries').insert({
                user_id: user.id,
                account_number: cleaned,
                phone_number: cleaned,
                name: name.trim(),
                bank_name: netName,
                type: 'data'
            }).select().single();

            const newBen = {
                id: data?.id ? String(data.id) : `local-${Date.now()}`,
                name: name.trim(),
                phone: cleaned,
                network: targetNet
            };

            const updated = [newBen, ...beneficiaries.filter((b: any) => b.phone !== cleaned)];
            setBeneficiaries(updated);
            await AsyncStorage.setItem(`@data_beneficiaries_${user.id}`, JSON.stringify(updated));

            // Select this new beneficiary
            setPhoneNumber(cleaned);
            setNetwork(targetNet);
            setRecipientName(name.trim());
            setPurchaseMode('others');
            setNewBenName('');
            setNewBenPhone('');
            setNewBenNetwork('');
            setShowContactModal(false);

            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
            showBrandAlert("Beneficiary Saved", `${name.trim()} (${cleaned}) added successfully!`, "success");
        } catch (err: any) {
            console.error("Save beneficiary error:", err);
            showBrandAlert("Save Failed", err.message || "Failed to save beneficiary.", "error");
        } finally {
            setSavingBen(false);
        }
    };

    // Delete a beneficiary
    const handleDeleteBeneficiary = async (item: any) => {
        Alert.alert(
            "Delete Beneficiary",
            `Are you sure you want to remove ${item.name} (${item.phone})?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (user) {
                                if (item.id) {
                                    await supabase.from('beneficiaries').delete().eq('id', item.id);
                                } else {
                                    await supabase.from('beneficiaries').delete().eq('user_id', user.id).eq('account_number', item.phone);
                                }
                                const updated = beneficiaries.filter((b: any) => b.phone !== item.phone && b.id !== item.id);
                                setBeneficiaries(updated);
                                await AsyncStorage.setItem(`@data_beneficiaries_${user.id}`, JSON.stringify(updated));
                                showBrandAlert("Deleted", `${item.name} removed from beneficiaries.`, "info");
                            }
                        } catch (err) {
                            console.warn("Delete beneficiary error:", err);
                        }
                    }
                }
            ]
        );
    };

    // Helper to get network carrier based on 4-digit prefix
    const getCarrierForPhone = useCallback((phone: string) => {
        const cleanPhone = (phone || '').replace(/\D/g, '');
        if (cleanPhone.length < 4) return null;
        const prefix = cleanPhone.substring(0, 4);
        for (const net of networksData) {
            if (net.prefixes.includes(prefix)) {
                return net;
            }
        }
        return null;
    }, [networksData]);

    // Smart Carrier Detection & Mismatch Warning
    const detectedCarrier = useMemo(() => {
        return getCarrierForPhone(phoneNumber);
    }, [phoneNumber, getCarrierForPhone]);

    const isNetworkMismatch = Boolean(
        network &&
        !['alpha', 'kirani', 'ratel', 'sahal', 'vitel'].includes(network) &&
        detectedCarrier &&
        detectedCarrier.id !== network &&
        dismissedMismatchPhone !== phoneNumber &&
        phoneNumber.length >= 4
    );

    // AI Smart Pick / Value Advisor for current network
    const smartPickPlan = useMemo(() => {
        if (!plans || plans.length === 0) return null;
        const validPlans = plans.filter(p => {
            const info = parsePlanInfo(p.volume, p.originalName || p.name, p.validity);
            return info.volumeInGB >= 1 && p.price > 0;
        });
        if (validPlans.length === 0) return plans[0] || null;

        let best = validPlans[0];
        let bestRatio = Infinity;
        for (const p of validPlans) {
            const info = parsePlanInfo(p.volume, p.originalName || p.name, p.validity);
            const ratio = p.price / info.volumeInGB;
            // Prioritize popular everyday sizes (1GB, 2GB, 3GB, 5GB)
            const isPopular = [1, 2, 3, 5].includes(info.volumeInGB);
            const adjustedRatio = isPopular ? ratio * 0.9 : ratio;
            if (adjustedRatio < bestRatio) {
                bestRatio = adjustedRatio;
                best = p;
            }
        }
        return best;
    }, [plans]);

    // Auto-detect Network by prefix (respects user manual selection if non-empty or user picks a specialized vendor)
    const detectNetwork = useCallback((phone: string, force = false) => {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length >= 4) {
            const prefix = cleanPhone.substring(0, 4);
            const found = NETWORKS_DATA.find(n => n.prefixes.includes(prefix));
            if (found) {
                setNetwork(prev => {
                    // Don't override if the user already selected a specialized bundle provider unless forced
                    const isSpecialized = ['alpha', 'kirani', 'ratel', 'sahal', 'vitel'].includes(prev);
                    if (isSpecialized && !force) {
                        return prev;
                    }
                    return found.id;
                });
            }
        }
    }, []);

    const handlePhoneChange = (text: string) => {
        setPhoneNumber(text);
        detectNetwork(text);
    };

    const handlePickContact = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers],
                });

                if (data.length > 0) {
                    setDeviceContacts(data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0));
                    handleOpenContactModal();
                } else {
                    showBrandAlert("No Contacts", "Your contact list is empty.", "info");
                }
            } else {
                showBrandAlert('Permission Denied', 'Permission to access contacts was denied.', 'warning');
            }
        } catch (error) {
            console.log('Error fetching contacts:', error);
            showBrandAlert('Error', 'Failed to open contacts.', 'error');
        }
    };

    // Fetch plans when network changes
    useEffect(() => {
        if (network) {
            fetchPlans(network);
            setSelectedPlan(null); // Reset selection
            setPlanTypeFilter('All'); // Reset plan type filter on network change
            setPlanFilter('All'); // Reset duration filter too
        } else {
            setPlans([]);
        }
    }, [network]);

    // Update phone based on mode
    useEffect(() => {
        if (purchaseMode === 'self' && userPhone) {
            setPhoneNumber(userPhone);
            detectNetwork(userPhone);
        } else if (purchaseMode === 'others') {
            setPhoneNumber('');
            setNetwork('');
        }
    }, [purchaseMode, userPhone, detectNetwork]);

    // Derived State: Filtered Plans
    const filteredPlans = plans.filter(p => {
        // Search Filter
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // Min Volume Filter (from Data Usage Estimator)
        if (minVolumeFilter !== null) {
            const gb = parseVolumeToGB(p.volume, p.originalName || p.name);
            if (gb < minVolumeFilter) {
                return false;
            }
        }
        
        // Plan Type Filter (Dynamic)
        if (planTypeFilter !== 'All') {
            const planTypeDB = String(p.plan_type || '').toUpperCase();
            const nameUpper = (p.originalName || p.name).toUpperCase();
            const filterUpper = planTypeFilter.toUpperCase();

            if (planTypeDB === filterUpper || planTypeDB.includes(filterUpper) || nameUpper.includes(filterUpper)) {
                // Direct match
            } else if (filterUpper === 'CG' && (nameUpper.includes('CORPORATE') || nameUpper.includes('CG') || planTypeDB.includes('CORPORATE'))) {
                // Matched CG / Corporate
            } else if ((filterUpper === 'DIRECT' || filterUpper === 'GIFTING') && (nameUpper.includes('DIRECT') || nameUpper.includes('GIFT') || planTypeDB.includes('GIFT'))) {
                // Matched Direct / Gifting
            } else if (filterUpper === 'SME' && (nameUpper.includes('SME') || planTypeDB === 'SME')) {
                // Matched SME
            } else {
                return false;
            }
        }

        // Duration Filter
        if (planFilter === 'All') return true;
        if (planFilter === 'Favorites') return favorites.includes(p.id);
        
        const planInfo = parsePlanInfo(p.volume, p.originalName || p.name, p.validity);
        if (planFilter === 'Daily') return planInfo.validityCategory === 'Daily';
        if (planFilter === 'Weekly') return planInfo.validityCategory === 'Weekly';
        if (planFilter === 'Monthly') return planInfo.validityCategory === 'Monthly';
        return true;
    });

    const handleQuickRepeat = () => {
        if (!lastTransaction) return;
        
        const desc = lastTransaction.description || '';
        const parts = desc.split(' -> ');
        if (parts.length === 2) {
             const phone = parts[1];
             setPhoneNumber(phone);
             detectNetwork(phone);
             showBrandAlert("Quick Load", `Phone number ${phone} loaded. Please select your plan.`, "info");
        }
    };

    const toggleFavorite = async (planId: string) => {
        try {
            const updated = favorites.includes(planId) ? favorites.filter(id => id !== planId) : [...favorites, planId];
            setFavorites(updated);
            await AsyncStorage.setItem('data_favorites', JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to save favorites", e);
        }
    };

    const fetchPlans = async (netId: string) => {
        setLoadingPlans(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        try {
            const netLower = netId.toLowerCase();
            if (['smile', 'alpha', 'kirani', 'ratel', 'sahal'].includes(netLower)) {
                // Fetch markup config for this network first
                let markupVal = 0;
                let markupType = 'fixed';
                try {
                    const { data: cfg } = await supabase
                        .from('data_configs')
                        .select('markup_value, markup_type')
                        .ilike('network', netLower)
                        .maybeSingle();

                    if (cfg && cfg.markup_value !== null && cfg.markup_value !== undefined) {
                        markupVal = Number(cfg.markup_value) || 0;
                        markupType = cfg.markup_type || 'fixed';
                    } else {
                        // Check app_settings fallback
                        const { data: appCfg } = await supabase
                            .from('app_settings')
                            .select('value')
                            .or(`key.eq.data_markup_${netLower},key.eq.markup_${netLower}`)
                            .maybeSingle();
                        if (appCfg?.value) {
                            const val = appCfg.value;
                            if (typeof val === 'object') {
                                markupVal = Number(val.markup_value) || 0;
                                markupType = val.markup_type || 'fixed';
                            } else {
                                markupVal = Number(val) || 0;
                            }
                        }
                    }
                } catch (_) {}

                // Check if admin has configured plans in data_plans with custom selling_price / markup
                try {
                    const { data: dbPlans, error: dbErr } = await supabase
                        .from('data_plans')
                        .select('*')
                        .ilike('network', netLower)
                        .eq('is_active', true);

                    if (!dbErr && dbPlans && dbPlans.length > 0) {
                        const mapped = dbPlans.map(p => {
                            let sellPrice = Number(p.selling_price || 0);
                            const costPrice = Number(p.cost_price || p.price || 0);
                            
                            // If selling_price equals cost_price or is unset, apply markup
                            if ((!sellPrice || sellPrice <= costPrice) && markupVal > 0) {
                                if (markupType === 'percentage') {
                                    sellPrice = Math.round(costPrice * (1 + markupVal / 100));
                                } else {
                                    sellPrice = costPrice + markupVal;
                                }
                            } else if (!sellPrice) {
                                sellPrice = costPrice;
                            }

                            return {
                                id: String(p.plan_id || p.id),
                                name: p.name,
                                price: sellPrice,
                                volume: p.volume || p.name,
                                validity: p.validity || '30 Days',
                                network: netLower.toUpperCase(),
                                apiVendor: 'ketawancy'
                            };
                        }).sort((a, b) => a.price - b.price);

                        setPlans(mapped as any);
                        return;
                    }
                } catch (e) {
                    console.log('Error fetching DB plans for Ketawancy:', e);
                }

                // Fallback: Fetch directly from KetawancyService if not yet seeded
                let rawPlans: any[] = [];
                if (netLower === 'smile') rawPlans = await KetawancyService.getSmilePlans();
                else if (netLower === 'alpha') rawPlans = await KetawancyService.getAlphaPlans();
                else if (netLower === 'kirani') rawPlans = await KetawancyService.getKiraniPlans();
                else if (netLower === 'ratel') rawPlans = await KetawancyService.getRatelPlans();
                else if (netLower === 'sahal') rawPlans = [
                    { planId: 1, planName: 'Sahal 1GB', price: 600, validity: '30 Days' },
                    { planId: 2, planName: 'Sahal 2GB', price: 1100, validity: '30 Days' },
                    { planId: 3, planName: 'Sahal 5GB', price: 2500, validity: '30 Days' }
                ];

                const mapped = rawPlans.map(p => {
                    const cost = Number(p.price) || 0;
                    let selling = cost;
                    if (markupType === 'percentage' && markupVal > 0) {
                        selling = Math.round(cost * (1 + markupVal / 100));
                    } else if (markupVal > 0) {
                        selling = cost + markupVal;
                    }
                    return {
                        id: String(p.planId),
                        name: p.planName,
                        price: selling,
                        volume: p.planName,
                        validity: p.validity || '30 Days',
                        network: netLower.toUpperCase(),
                        apiVendor: 'ketawancy'
                    };
                }).sort((a, b) => a.price - b.price);
                setPlans(mapped as any);
                return;
            }

            const mappedPlans = await api.data.getPlans(netId);
            // Sort data plans neatly in ascending order by volume (e.g. 500MB, 1GB, 2GB, 5GB...) and price
            const sorted = [...mappedPlans].map(plan => {
                // Strip vendor tags from names for smooth UI
                const cleanName = (plan.name || '').replace(/\[BILAL\]|\[BIGI\]|\[CLUBKONNECT\]|\[GLO\]|\[MTN\]|\[AIRTEL\]|\[9MOBILE\]/gi, '').trim();
                const cleanOriginalName = (plan.originalName || plan.name || '').replace(/\[BILAL\]|\[BIGI\]|\[CLUBKONNECT\]|\[GLO\]|\[MTN\]|\[AIRTEL\]|\[9MOBILE\]/gi, '').trim();
                return {
                    ...plan,
                    name: cleanName,
                    originalName: cleanOriginalName
                };
            }).sort((a, b) => {
                const volA = parseVolumeToGB(a.volume, a.originalName || a.name);
                const volB = parseVolumeToGB(b.volume, b.originalName || b.name);
                if (volA !== volB) return volA - volB;
                return a.price - b.price;
            });
            setPlans(sorted);
        } catch (error) {
            console.error(error);
            showBrandAlert("Data Plans", "Failed to load data plans. Please try again.", "error");
            setPlans([]);
        } finally {
            setLoadingPlans(false);
        }
    };

    const handlePurchase = () => {
        if (!network || !phoneNumber || !selectedPlan) {
            showBrandAlert("Missing Details", "Please select a network, data plan, and enter a phone number.", "warning");
            return;
        }

        if (phoneNumber.length !== 11) {
            showBrandAlert("Incomplete Phone Number", `Phone number is incomplete (${phoneNumber.length}/11 digits). Please enter all 11 digits.`, "warning");
            return;
        }

        const phoneValidation = validateNigerianPhone(phoneNumber, network);
        if (!phoneValidation.isValid) {
            showBrandAlert("Invalid Phone Number", phoneValidation.error || "Please enter a valid 11-digit Nigerian mobile phone number.", "warning");
            return;
        }

        setShowConfirmation(true);
    };

    const processTransaction = async () => {
        if (!selectedPlan) return;
        setLoadingPurchase(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const planNameString = selectedPlan.name + 
                (autoRenew ? ' [Auto-Renew]' : '') + 
                (isGift ? ` (Gift to ${recipientName || 'Someone'})` : '');

            let result: { success: boolean; reference?: string };

            if (network === 'smile') {
                const res = await KetawancyService.buySmile({
                    userId: user.id,
                    phoneNumber,
                    planId: selectedPlan.id,
                    price: selectedPlan.price,
                    planName: planNameString
                });
                result = { success: true, reference: res.refNo };
            } else if (network === 'alpha') {
                const res = await KetawancyService.buyAlpha({
                    userId: user.id,
                    phone: phoneNumber,
                    planId: selectedPlan.id,
                    price: selectedPlan.price,
                    planName: planNameString
                });
                result = { success: true, reference: res.refNo };
            } else if (network === 'kirani') {
                const res = await KetawancyService.buyKirani({
                    userId: user.id,
                    phone: phoneNumber,
                    planId: selectedPlan.id,
                    price: selectedPlan.price,
                    planName: planNameString
                });
                result = { success: true, reference: res.refNo };
            } else if (network === 'ratel') {
                const res = await KetawancyService.buyRatel({
                    userId: user.id,
                    phone: phoneNumber,
                    planId: selectedPlan.id,
                    price: selectedPlan.price,
                    planName: planNameString
                });
                result = { success: true, reference: res.refNo };
            } else {
                result = await api.data.purchase(user.id, {
                    network,
                    phone: phoneNumber,
                    planId: selectedPlan.id,
                    amount: selectedPlan.price,
                    planName: planNameString,
                    vendor: (selectedPlan as any).apiVendor || 'bilalsadasub'
                });
            }

            if (result.success) {
                // Save Beneficiary if requested
                if (isSaveBeneficiary && phoneNumber) {
                    const benName = recipientName.trim() || `Beneficiary (${phoneNumber.slice(-4)})`;
                    const netName = NETWORKS_DATA.find(n => n.id === network)?.name || network.toUpperCase();
                    await supabase.from('beneficiaries').insert({
                        user_id: user.id,
                        account_number: phoneNumber,
                        phone_number: phoneNumber,
                        name: benName,
                        bank_name: netName,
                        type: 'data'
                    }).then(({ data, error }: any) => {
                        if (!error) {
                            const newBen = {
                                id: data?.id ? String(data.id) : `local-${Date.now()}`,
                                name: benName,
                                phone: phoneNumber,
                                network: network
                            };
                            const updated = [newBen, ...beneficiaries.filter((b: any) => b.phone !== phoneNumber)];
                            setBeneficiaries(updated);
                            AsyncStorage.setItem(`@data_beneficiaries_${user.id}`, JSON.stringify(updated)).catch(() => {});
                        }
                    });
                }

                // Send Notification
                await createAppNotification(
                    user.id,
                    "Data Purchase Successful",
                    `You have successfully purchased ${planNameString} for ${phoneNumber}. Amount: ₦${selectedPlan.price}.`,
                    "data",
                    "normal",
                    { route: "/(app)/history" }
                );

                router.replace({
                    pathname: '/success',
                    params: {
                        amount: `₦${selectedPlan.price}`,
                        type: 'Data Bundle',
                        reference: result.reference
                    }
                });
            }
        } catch (error: any) {
            console.error(error);
            showBrandAlert("Purchase Failed", error.message || "Something went wrong", "error");
        } finally {
            setLoadingPurchase(false);
        }
    };

    const getNetworkColor = (netId: string) => {
        return networksData.find(n => n.id === netId)?.color || '#0056D2';
    };

    return (
        <View style={s.pageWrapper}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
            >
                {/* Premium Curved Header */}
                <LinearGradient 
                    colors={['#060d21', '#0d1b3e']} 
                    style={[
                        s.headerContainer, 
                        { paddingTop: headerTopPadding },
                        isWeb && s.webPageContainer
                    ]}
                >
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                            <Ionicons name="arrow-back" size={20} color="white" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={s.headerTitle}>Internet Data</Text>
                            {balance !== null && (
                                <View style={s.balanceBadge}>
                                    <Ionicons name="wallet-outline" size={12} color="#f5a623" style={{ marginRight: 4 }} />
                                    <Text style={s.headerBalance}>
                                        ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[s.scrollContainer, isWeb && s.webPageContainer]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Dynamic Banners */}
                    <DynamicBanners placement="data" />
                    {/* Quick Repeat Card */}
                    {lastTransaction && (
                        <TouchableOpacity 
                            onPress={handleQuickRepeat}
                            style={s.quickRepeatCard}
                            activeOpacity={0.8}
                        >
                            <View style={s.quickRepeatLeft}>
                                <View style={s.quickRepeatIconCircle}>
                                    <Ionicons name="refresh" size={18} color="#F97316" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.quickRepeatTitle}>Repeat Last Purchase</Text>
                                    <Text style={s.quickRepeatDesc} numberOfLines={1} ellipsizeMode="tail">
                                        {lastTransaction.description ? lastTransaction.description.split('->')[0].trim() : 'Data Bundle'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    )}

                    {/* Network Selection - Premium Dropdown */}
                    <View style={s.sectionHeader}>
                        <Ionicons name="cellular-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                        <Text style={s.sectionTitle}>Select Network</Text>
                    </View>

                    {/* Dropdown Trigger Card */}
                    {(() => {
                        const currentNet = networksData.find(n => n.id === network);
                        const netStyles = currentNet ? getNetworkStyles(currentNet.id, true) : null;
                        return (
                            <TouchableOpacity
                                onPress={() => setShowNetworkDropdown(true)}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 16,
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    borderWidth: 1.5,
                                    borderColor: currentNet ? (netStyles?.border || '#E2E8F0') : '#E2E8F0',
                                    marginBottom: 16,
                                    shadowColor: '#0A1128',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 6,
                                    elevation: 2,
                                }}
                            >
                                {currentNet ? (
                                    <>
                                        <View style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            backgroundColor: '#F8FAFC',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            overflow: 'hidden',
                                            marginRight: 12
                                        }}>
                                            <Image 
                                                source={NETWORK_LOGOS[currentNet.id]} 
                                                style={{ width: '85%', height: '85%' }} 
                                                resizeMode="contain" 
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                                                    {currentNet.name}
                                                </Text>
                                                <View style={{
                                                    backgroundColor: netStyles?.border || '#0284C7',
                                                    paddingHorizontal: 6,
                                                    paddingVertical: 2,
                                                    borderRadius: 6
                                                }}>
                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF' }}>
                                                        {currentNet.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500', marginTop: 1 }}>
                                                Tap to change network provider
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <View style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            backgroundColor: '#F1F5F9',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12
                                        }}>
                                            <Ionicons name="cellular" size={20} color="#64748B" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                                                Choose Network Provider
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                                                MTN, Airtel, Glo, 9mobile, Smile, Alpha, Kirani, Ratel...
                                            </Text>
                                        </View>
                                    </>
                                )}
                                <View style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    backgroundColor: '#F8FAFC',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0'
                                }}>
                                    <Ionicons name="chevron-down" size={18} color="#64748B" />
                                </View>
                            </TouchableOpacity>
                        );
                    })()}

                    {/* Network Dropdown Selection Modal */}
                    <Modal
                        visible={showNetworkDropdown}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setShowNetworkDropdown(false)}
                    >
                        <Pressable 
                            style={{ flex: 1, backgroundColor: 'rgba(10, 17, 40, 0.65)', justifyContent: 'flex-end' }}
                            onPress={() => setShowNetworkDropdown(false)}
                        >
                            <Pressable 
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    borderTopLeftRadius: 28,
                                    borderTopRightRadius: 28,
                                    maxHeight: '80%',
                                    paddingBottom: insets.bottom + 16,
                                }}
                                onPress={(e) => e.stopPropagation()}
                            >
                                {/* Modal Drag Handle & Header */}
                                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                                    <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                                </View>

                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingHorizontal: 20,
                                    paddingVertical: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#F1F5F9'
                                }}>
                                    <View>
                                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A' }}>
                                            Select Network Provider
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 }}>
                                            Choose telecom network for data recharge
                                        </Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setShowNetworkDropdown(false)}
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 17,
                                            backgroundColor: '#F1F5F9',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Ionicons name="close" size={18} color="#475569" />
                                    </TouchableOpacity>
                                </View>

                                {/* Network List */}
                                <ScrollView 
                                    style={{ paddingHorizontal: 16, paddingTop: 10 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {networksData.map((net) => {
                                        const isSelected = network === net.id;
                                        const styles = getNetworkStyles(net.id, isSelected);
                                        return (
                                            <TouchableOpacity
                                                key={net.id}
                                                onPress={() => {
                                                    setNetwork(net.id);
                                                    setShowNetworkDropdown(false);
                                                }}
                                                activeOpacity={0.7}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    padding: 12,
                                                    borderRadius: 16,
                                                    marginBottom: 8,
                                                    backgroundColor: isSelected ? styles.bg : '#FFFFFF',
                                                    borderWidth: 1.5,
                                                    borderColor: isSelected ? styles.border : '#E2E8F0',
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: isSelected ? 0.05 : 0.02,
                                                    shadowRadius: 3,
                                                    elevation: isSelected ? 2 : 1,
                                                }}
                                            >
                                                <View style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 14,
                                                    backgroundColor: '#F8FAFC',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderWidth: 1,
                                                    borderColor: '#E2E8F0',
                                                    overflow: 'hidden',
                                                    marginRight: 14
                                                }}>
                                                    <Image 
                                                        source={NETWORK_LOGOS[net.id]} 
                                                        style={{ width: '80%', height: '80%' }}
                                                        resizeMode="contain" 
                                                    />
                                                </View>

                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={{
                                                            fontSize: 15,
                                                            fontWeight: isSelected ? '800' : '700',
                                                            color: isSelected ? styles.text : '#0F172A'
                                                        }}>
                                                            {net.name}
                                                        </Text>
                                                        <View style={{
                                                            backgroundColor: isSelected ? styles.border : '#F1F5F9',
                                                            paddingHorizontal: 6,
                                                            paddingVertical: 2,
                                                            borderRadius: 6
                                                        }}>
                                                            <Text style={{
                                                                fontSize: 8.5,
                                                                fontWeight: '800',
                                                                color: isSelected ? '#FFFFFF' : '#64748B'
                                                            }}>
                                                                {net.status}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                                        {net.id === 'smile' ? 'Smile 4G LTE broadband data' :
                                                         net.id === 'alpha' ? 'Alpha unlimited voice & high-speed data' :
                                                         net.id === 'kirani' ? 'Kirani 4G LTE voice & high-speed bundle' :
                                                         net.id === 'ratel' ? 'Ratel unlimited high-speed bundle' :
                                                         `${net.name} SME, Corporate Gifting & Direct Data`}
                                                    </Text>
                                                </View>

                                                <View style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 12,
                                                    borderWidth: 2,
                                                    borderColor: isSelected ? styles.border : '#CBD5E1',
                                                    backgroundColor: isSelected ? styles.border : 'transparent',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginLeft: 8
                                                }}>
                                                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    <View style={{ height: 20 }} />
                                </ScrollView>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    {/* Mode Segmented Control */}
                    <View style={s.segmentContainer}>
                        <TouchableOpacity 
                            style={[s.segmentBtn, purchaseMode === 'self' && s.segmentBtnActive]}
                            onPress={() => setPurchaseMode('self')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="person" size={16} color={purchaseMode === 'self' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                            <Text style={[s.segmentText, purchaseMode === 'self' && s.segmentTextActive]}>Buy for Me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[s.segmentBtn, purchaseMode === 'others' && s.segmentBtnActive]}
                            onPress={() => setPurchaseMode('others')}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="people" size={16} color={purchaseMode === 'others' ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                            <Text style={[s.segmentText, purchaseMode === 'others' && s.segmentTextActive]}>Buy for Others</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Phone Number Input & Smart Beneficiaries Bar */}
                    {purchaseMode === 'others' && (
                        <View style={{ marginBottom: 12 }}>
                            <View style={[s.sectionHeader, { justifyContent: 'space-between' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="phone-portrait-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={s.sectionTitle}>Phone Number</Text>
                                </View>
                                {beneficiaries.length > 0 && (
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setContactModalTab('beneficiaries');
                                            handleOpenContactModal();
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="people" size={13} color="#0056D2" style={{ marginRight: 3 }} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0056D2' }}>
                                            Manage ({beneficiaries.length})
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={[s.inputBoxContainer, phoneNumber.length > 0 && s.inputBoxFocused]}>
                                <View style={s.inputBoxLogoWrapper}>
                                    {network ? (
                                        <Image source={NETWORK_LOGOS[network]} style={s.inputBoxLogo as any} resizeMode="cover" />
                                    ) : (
                                        <Ionicons name="call-outline" size={16} color="#94a3b8" />
                                    )}
                                </View>
                                <TextInput
                                    style={s.textInput}
                                    keyboardType="phone-pad"
                                    placeholder="Enter 11-digit phone number"
                                    placeholderTextColor="#94a3b8"
                                    value={phoneNumber}
                                    onChangeText={handlePhoneChange}
                                    maxLength={11}
                                />
                                {phoneNumber.length === 0 ? (
                                    <TouchableOpacity 
                                        onPress={handlePasteFromClipboard}
                                        style={[s.beneficiaryBtn, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="clipboard-outline" size={15} color="#475569" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={() => handlePhoneChange('')} style={s.clearBtn}>
                                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity 
                                    onPress={handleLaunchNativeContactPicker}
                                    style={[s.beneficiaryBtn, { marginLeft: 4, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Open Phone Contacts"
                                >
                                    <Ionicons name="person-add" size={15} color="#16a34a" />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => {
                                        setGiftingBeneficiaryActive(false);
                                        setContactModalTab('beneficiaries');
                                        handleOpenContactModal();
                                    }}
                                    style={[s.beneficiaryBtn, { marginLeft: 4, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                                    activeOpacity={0.7}
                                    accessibilityLabel="Open Saved Beneficiaries"
                                >
                                    <Ionicons name="people" size={15} color="#0056D2" />
                                </TouchableOpacity>
                            </View>

                            {/* Smart Live Formatted Phone & Digit Counter */}
                            {phoneNumber.length > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -4, marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>
                                            {phoneNumber.length >= 4 
                                                ? `${phoneNumber.slice(0, 4)} ${phoneNumber.slice(4, 7)} ${phoneNumber.slice(7)}`.trim()
                                                : phoneNumber}
                                        </Text>
                                        {detectedCarrier && (
                                            <View style={{ marginLeft: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 9.5, fontWeight: '800', color: detectedCarrier.color || '#475569' }}>
                                                    {detectedCarrier.name}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: phoneNumber.length === 11 ? '#16a34a' : '#d97706' }}>
                                        {phoneNumber.length === 11 ? '✓ 11/11 digits' : `${phoneNumber.length}/11 digits`}
                                    </Text>
                                </View>
                            )}

                            {/* SMART FEATURE 1: Network Mismatch Warning & 1-Tap Switcher */}
                            {isNetworkMismatch && detectedCarrier && (
                                <View style={{
                                    backgroundColor: '#fffbeb',
                                    borderWidth: 1.5,
                                    borderColor: '#f59e0b',
                                    borderRadius: 14,
                                    padding: 10,
                                    marginBottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    shadowColor: '#f59e0b',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 4,
                                    elevation: 2,
                                }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                        <Ionicons name="warning" size={18} color="#d97706" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#92400e' }}>
                                            Network Mismatch Detected
                                        </Text>
                                        <Text style={{ fontSize: 10.5, color: '#b45309', marginTop: 1 }}>
                                            Number prefix ({phoneNumber.slice(0, 4)}) is <Text style={{ fontWeight: '800' }}>{detectedCarrier.name}</Text>, but you chose <Text style={{ fontWeight: '800' }}>{networksData.find(n => n.id === network)?.name || network.toUpperCase()}</Text>.
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setNetwork(detectedCarrier.id);
                                                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                                                showBrandAlert("Switched Network", `Switched to ${detectedCarrier.name} automatically!`, "success");
                                            }}
                                            style={{
                                                backgroundColor: '#d97706',
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                borderRadius: 8,
                                                alignSelf: 'flex-start',
                                                marginTop: 6,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Ionicons name="flash" size={11} color="#ffffff" style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#ffffff' }}>
                                                Switch to {detectedCarrier.name}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setDismissedMismatchPhone(phoneNumber)}
                                        style={{ padding: 4, alignSelf: 'flex-start' }}
                                    >
                                        <Ionicons name="close" size={16} color="#92400e" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Interactive Beneficiaries Quick Bar */}
                            <View style={{ marginTop: 2, marginBottom: 8 }}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
                                    {/* + Add Beneficiary Chip */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            setContactModalTab('add');
                                            setShowContactModal(true);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: '#eff6ff',
                                            borderColor: '#93c5fd',
                                            borderWidth: 1,
                                            borderStyle: 'dashed',
                                            paddingHorizontal: 10,
                                            paddingVertical: 6,
                                            borderRadius: 14,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="add-circle" size={14} color="#0056D2" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#0056D2' }}>
                                            + Add
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Beneficiary Chips */}
                                    {beneficiaries.map((b: any, i: number) => {
                                        const phone = b.phone_number || b.phone || b.account_number || b;
                                        const label = b.name || phone;
                                        const isSelected = phoneNumber === phone;
                                        const benNet = b.network || getCarrierForPhone(phone)?.id;

                                        return (
                                            <TouchableOpacity
                                                key={b.id || i}
                                                onPress={() => {
                                                    setPhoneNumber(phone);
                                                    if (benNet && NETWORKS_DATA.some(n => n.id === benNet)) {
                                                        setNetwork(benNet);
                                                    } else {
                                                        detectNetwork(phone);
                                                    }
                                                    if (b.name) setRecipientName(b.name);
                                                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                                                }}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    backgroundColor: isSelected ? '#0d1b3e' : '#ffffff',
                                                    borderColor: isSelected ? '#0d1b3e' : '#e2e8f0',
                                                    borderWidth: 1.5,
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 5,
                                                    borderRadius: 14,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 1 },
                                                    shadowOpacity: isSelected ? 0.12 : 0.02,
                                                    shadowRadius: 3,
                                                    elevation: isSelected ? 2 : 1,
                                                }}
                                                activeOpacity={0.75}
                                            >
                                                <View style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: 9,
                                                    backgroundColor: isSelected ? '#f5a623' : '#eff6ff',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginRight: 6,
                                                }}>
                                                    <Text style={{ fontSize: 9.5, fontWeight: '900', color: isSelected ? '#0d1b3e' : '#0056D2' }}>
                                                        {(label || 'B').charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#ffffff' : '#1e293b' }} numberOfLines={1}>
                                                        {label}
                                                    </Text>
                                                    <Text style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.7)' : '#64748b' }}>
                                                        {phone.slice(-4)} • {benNet ? benNet.toUpperCase() : 'SIM'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}

                                    {/* View All Button */}
                                    {beneficiaries.length > 3 && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setContactModalTab('beneficiaries');
                                                handleOpenContactModal();
                                            }}
                                            style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 6,
                                                borderRadius: 12,
                                                backgroundColor: '#f1f5f9',
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                                                View All →
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                            </View>
                        </View>
                    )}

                    {/* Modern Purchase Preferences (Auto-Renew, Send as Gift, Save as Beneficiary) */}
                    <View style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 18,
                        padding: 14,
                        borderWidth: 1.5,
                        borderColor: '#e2e8f0',
                        marginBottom: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 4,
                        elevation: 1,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                    <Ionicons name="sparkles" size={13} color="#0056D2" />
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d1b3e' }}>Purchase Preferences</Text>
                            </View>
                            {(autoRenew || isGift || isSaveBeneficiary) && (
                                <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
                                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#16a34a' }}>Active</Text>
                                </View>
                            )}
                        </View>

                        {/* Auto-Renew Bundle */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 }}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="repeat" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0d1b3e' }}>Auto-Renew Bundle</Text>
                                </View>
                                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Automatically renews this plan upon expiry</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setAutoRenew(!autoRenew);
                                }}
                                style={[s.customSwitch, autoRenew ? s.customSwitchOn : s.customSwitchOff]}
                                activeOpacity={0.8}
                            >
                                <View style={[s.customSwitchThumb, autoRenew ? s.customSwitchThumbOn : s.customSwitchThumbOff]} />
                            </TouchableOpacity>
                        </View>

                        {/* Send as a Gift */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 3 }}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="gift-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0d1b3e' }}>Send as a Gift</Text>
                                </View>
                                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Deliver as a personalized gift to recipient</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setIsGift(!isGift);
                                    if (isGift) setRecipientName('');
                                }}
                                style={[s.customSwitch, isGift ? s.customSwitchOn : s.customSwitchOff]}
                                activeOpacity={0.8}
                            >
                                <View style={[s.customSwitchThumb, isGift ? s.customSwitchThumbOn : s.customSwitchThumbOff]} />
                            </TouchableOpacity>
                        </View>

                        {/* Recipient Name Input when Send as Gift is toggled on */}
                        {isGift && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#f8fafc',
                                borderWidth: 1.5,
                                borderColor: '#cbd5e1',
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                height: 42,
                                marginTop: 6,
                                marginBottom: 4,
                            }}>
                                <Ionicons name="heart" size={15} color="#f43f5e" style={{ marginRight: 8 }} />
                                <TextInput 
                                    style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: '#0d1b3e' }}
                                    placeholder="Recipient's Name (e.g. Sani Sadiq)"
                                    placeholderTextColor="#94a3b8"
                                    value={recipientName}
                                    onChangeText={setRecipientName}
                                />
                                <TouchableOpacity 
                                    onPress={() => {
                                        setGiftingBeneficiaryActive(true);
                                        handleOpenContactModal();
                                    }}
                                    style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 8,
                                        backgroundColor: '#eff6ff',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="people" size={13} color="#0056D2" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#0056D2' }}>Contacts</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Save as Beneficiary (when buying for others) */}
                        {purchaseMode === 'others' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 3 }}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="person-add-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0d1b3e' }}>Save as Beneficiary</Text>
                                    </View>
                                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>Save this number for easy 1-tap top-ups</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setIsSaveBeneficiary(!isSaveBeneficiary);
                                    }}
                                    style={[s.customSwitch, isSaveBeneficiary ? s.customSwitchOn : s.customSwitchOff]}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.customSwitchThumb, isSaveBeneficiary ? s.customSwitchThumbOn : s.customSwitchThumbOff]} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Modern Smart Utilities Bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 12 }}>
                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowUssdGuide(!showUssdGuide);
                                if (!showUssdGuide) {
                                    setShowEstimator(false);
                                    setShowRolloverTips(false);
                                }
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 4,
                                borderRadius: 12,
                                backgroundColor: showUssdGuide ? '#0d1b3e' : '#ffffff',
                                borderWidth: 1.5,
                                borderColor: showUssdGuide ? '#0d1b3e' : '#e2e8f0',
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="flash-outline" size={13} color={showUssdGuide ? '#f5a623' : '#d97706'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: showUssdGuide ? '#ffffff' : '#334155' }}>USSD Codes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowEstimator(!showEstimator);
                                if (!showEstimator) {
                                    setShowUssdGuide(false);
                                    setShowRolloverTips(false);
                                }
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 4,
                                borderRadius: 12,
                                backgroundColor: showEstimator ? '#0d1b3e' : '#ffffff',
                                borderWidth: 1.5,
                                borderColor: showEstimator ? '#0d1b3e' : '#e2e8f0',
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="calculator-outline" size={13} color={showEstimator ? '#60a5fa' : '#2563eb'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: showEstimator ? '#ffffff' : '#334155' }}>Estimator</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowRolloverTips(!showRolloverTips);
                                if (!showRolloverTips) {
                                    setShowUssdGuide(false);
                                    setShowEstimator(false);
                                }
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 4,
                                borderRadius: 12,
                                backgroundColor: showRolloverTips ? '#0d1b3e' : '#ffffff',
                                borderWidth: 1.5,
                                borderColor: showRolloverTips ? '#0d1b3e' : '#e2e8f0',
                            }}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="shield-checkmark-outline" size={13} color={showRolloverTips ? '#4ade80' : '#16a34a'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: showRolloverTips ? '#ffffff' : '#334155' }}>Rollover</Text>
                        </TouchableOpacity>
                    </View>

                    {/* USSD Check Codes Content */}
                    {showUssdGuide && (
                        <View style={[s.ussdContainer, { marginTop: 0, marginBottom: 12 }]}>
                            <View style={s.ussdContent}>
                                {[
                                    { net: 'MTN', code: '*323#', legacy: '*312*4#' },
                                    { net: 'Airtel', code: '*323#', legacy: '*140#' },
                                    { net: 'Glo', code: '*323#', legacy: '*127*0#' },
                                    { net: '9mobile', code: '*323#', legacy: '*228#' }
                                ].map((item, index) => (
                                    <View key={index} style={s.ussdRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.ussdNetName}>{item.net}</Text>
                                            <Text style={s.ussdSubText}>Unified: {item.code} | Legacy: {item.legacy}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity 
                                                style={s.ussdActionBtn} 
                                                onPress={async () => {
                                                    await Clipboard.setStringAsync(item.code);
                                                    showBrandAlert("Copied", `${item.code} copied to clipboard!`, "success");
                                                }}
                                            >
                                                <Ionicons name="copy-outline" size={13} color="#0d1b3e" />
                                                <Text style={s.ussdActionText}>Copy</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={[s.ussdActionBtn, { backgroundColor: '#f4f6fb' }]} 
                                                onPress={() => Linking.openURL(`tel:${encodeURIComponent(item.code)}`)}
                                            >
                                                <Ionicons name="call-outline" size={13} color="#0d1b3e" />
                                                <Text style={[s.ussdActionText, { color: '#0d1b3e' }]}>Dial</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Data Usage Estimator Content */}
                    {showEstimator && (
                        <View style={[s.estimatorContainer, { marginTop: 0, marginBottom: 12 }]}>
                            <View style={s.estimatorContent}>
                                <Text style={s.estimatorIntro}>
                                    Adjust your daily usage estimation below to find the best data bundle.
                                </Text>

                                {/* Social Slider Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Social & Chatting</Text>
                                        <Text style={s.estimatorSubLabel}>WhatsApp, IG, TikTok, FB (~150MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setSocialHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{socialHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setSocialHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Video Streaming Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Video Streaming</Text>
                                        <Text style={s.estimatorSubLabel}>YouTube, Netflix, HD Video (~600MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setStreamingHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{streamingHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setStreamingHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Web Browsing Row */}
                                <View style={s.estimatorRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.estimatorLabel}>Web & Emails</Text>
                                        <Text style={s.estimatorSubLabel}>Browsing, reading, downloading (~80MB/hr)</Text>
                                    </View>
                                    <View style={s.counterGroup}>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setBrowsingHours(h => Math.max(0, h - 1))}
                                        >
                                            <Ionicons name="remove" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                        <Text style={s.counterValue}>{browsingHours}h</Text>
                                        <TouchableOpacity 
                                            style={s.counterBtn}
                                            onPress={() => setBrowsingHours(h => Math.min(24, h + 1))}
                                        >
                                            <Ionicons name="add" size={14} color="#0d1b3e" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Calculation Results */}
                                {(() => {
                                    const hourlyGB = (socialHours * 0.15) + (streamingHours * 0.60) + (browsingHours * 0.08);
                                    const weeklyGB = Math.round(hourlyGB * 7 * 10) / 10;
                                    const monthlyGB = Math.round(hourlyGB * 30 * 10) / 10;

                                    return (
                                        <View style={s.estimatorResultsCard}>
                                            <View style={s.resultBox}>
                                                <Text style={s.resultVal}>{weeklyGB} GB</Text>
                                                <Text style={s.resultLbl}>Weekly Est.</Text>
                                            </View>
                                            <View style={[s.resultBox, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0' }]}>
                                                <Text style={[s.resultVal, { color: '#0d1b3e' }]}>{monthlyGB} GB</Text>
                                                <Text style={s.resultLbl}>Monthly Est.</Text>
                                            </View>
                                            
                                            {monthlyGB > 0 && (
                                                <TouchableOpacity 
                                                    style={s.recommendBtn}
                                                    onPress={() => {
                                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                        setMinVolumeFilter(monthlyGB);
                                                        setShowEstimator(false); // Collapse
                                                    }}
                                                >
                                                    <Ionicons name="sparkles" size={12} color="white" style={{ marginRight: 4 }} />
                                                    <Text style={s.recommendBtnText}>Recommend</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>
                    )}

                    {/* Recommendation Banner */}
                    {minVolumeFilter !== null && (
                        <View style={s.recommendationBanner}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="sparkles" size={16} color="#d97706" style={{ marginRight: 6 }} />
                                <Text style={s.recommendationBannerText}>
                                    Showing plans with at least <Text style={{ fontWeight: '800' }}>{minVolumeFilter} GB</Text>
                                </Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setMinVolumeFilter(null);
                                }}
                                style={s.recommendationBannerClose}
                            >
                                <Text style={s.recommendationBannerCloseText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {/* Data Rollover Guard Content */}
                    {showRolloverTips && (
                        <View style={[s.rolloverContainer, { marginTop: 0, marginBottom: 12 }]}>
                            <View style={s.rolloverContent}>
                                <Text style={s.rolloverText}>
                                    Don't lose your unused data! Most networks support rolling over your remaining balance if you purchase a new bundle before the current one expires:
                                </Text>
                                <View style={s.rolloverTipItem}>
                                    <Text style={s.rolloverBullet}>•</Text>
                                    <Text style={s.rolloverTipText}>
                                        <Text style={{ fontWeight: '800' }}>MTN & Airtel</Text>: Renew with any plan within 24 hours of expiration to auto-merge balances.
                                    </Text>
                                </View>
                                <View style={s.rolloverTipItem}>
                                    <Text style={s.rolloverBullet}>•</Text>
                                    <Text style={s.rolloverTipText}>
                                        <Text style={{ fontWeight: '800' }}>Glo</Text>: Supports full rollover if you renew with a plan of equal or higher value.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Data Plans Grid */}
                    {loadingPlans ? (
                        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator size="large" color="#0d1b3e" />
                            <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>Loading plans...</Text>
                        </View>
                    ) : (
                        <View>
                            {plans.length > 0 && (
                                <View style={{ marginBottom: 20 }}>
                                
                                    {/* Modern Plan Type Horizontal Selector */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="layers-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                            <Text style={s.sectionTitle}>Plan Category</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => setShowPlanTypeModal(true)}
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2 }}
                                        >
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0056D2', marginRight: 2 }}>
                                                {planTypeFilter === 'All' ? 'More Types' : `${planTypeFilter} Active`}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={13} color="#0056D2" />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                                        {[
                                            { id: 'All', label: 'All Plans', icon: 'apps-outline' },
                                            { id: 'SME', label: 'SME', icon: 'business-outline' },
                                            { id: 'CG', label: 'Corporate (CG)', icon: 'briefcase-outline' },
                                            { id: 'GIFTING', label: 'Gifting', icon: 'gift-outline' },
                                            { id: 'DIRECT', label: 'Direct', icon: 'flash-outline' },
                                            { id: 'MEGA', label: 'Mega Data', icon: 'rocket-outline' },
                                        ].map((t) => {
                                            const isActive = planTypeFilter === t.id;
                                            return (
                                                <TouchableOpacity
                                                    key={t.id}
                                                    onPress={() => {
                                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                        setPlanTypeFilter(t.id);
                                                    }}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        backgroundColor: isActive ? '#0d1b3e' : '#ffffff',
                                                        borderWidth: 1.5,
                                                        borderColor: isActive ? '#0d1b3e' : '#e2e8f0',
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 7,
                                                        borderRadius: 20,
                                                        marginRight: 6,
                                                        shadowColor: '#000',
                                                        shadowOffset: { width: 0, height: 1 },
                                                        shadowOpacity: isActive ? 0.1 : 0.02,
                                                        shadowRadius: 2,
                                                        elevation: isActive ? 2 : 1,
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons 
                                                        name={t.icon as any} 
                                                        size={12} 
                                                        color={isActive ? '#f5a623' : '#64748b'} 
                                                        style={{ marginRight: 5 }} 
                                                    />
                                                    <Text style={{
                                                        fontSize: 11,
                                                        fontWeight: isActive ? '800' : '600',
                                                        color: isActive ? '#ffffff' : '#334155'
                                                    }}>
                                                        {t.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>

                                    {/* Search Bar */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#ffffff',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        height: 44,
                                        marginBottom: 16,
                                        borderWidth: 1.5,
                                        borderColor: '#e2e8f0',
                                    }}>
                                        <Ionicons name="search-outline" size={18} color="#94a3b8" />
                                        <TextInput 
                                            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0d1b3e', fontWeight: '500' }}
                                            placeholder="Search plans (e.g. 1GB, Weekend)..."
                                            placeholderTextColor="#94a3b8"
                                            value={searchQuery}
                                            onChangeText={text => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSearchQuery(text);
                                            }}
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                <Ionicons name="close-circle" size={16} color="#D1D5DB" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={s.sectionHeader}>
                                        <Ionicons name="funnel-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                        <Text style={s.sectionTitle}>Filter Plans</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                        {[
                                            { name: 'All', icon: 'grid-outline' },
                                            { name: 'Favorites', icon: 'heart' },
                                            { name: 'Daily', icon: 'today-outline' },
                                            { name: 'Weekly', icon: 'calendar-outline' },
                                            { name: 'Monthly', icon: 'time-outline' },
                                        ].map((f) => {
                                            const isActive = planFilter === f.name;
                                            return (
                                                <TouchableOpacity
                                                    key={f.name}
                                                    onPress={() => setPlanFilter(f.name as any)}
                                                    style={[s.filterPill, isActive && s.filterPillActive]}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons 
                                                            name={f.icon as any} 
                                                            size={13} 
                                                            color={isActive ? '#ffffff' : '#64748b'} 
                                                            style={{ marginRight: 5 }} 
                                                        />
                                                        <Text style={[s.filterPillText, isActive && s.filterPillTextActive]}>
                                                            {f.name}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                            
                            {plans.length > 0 && (
                                <View style={s.sectionHeader}>
                                    <Ionicons name="flash-outline" size={14} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={s.sectionTitle}>Available Plans</Text>
                                </View>
                            )}
                            
                            {!network ? (
                                 <View style={{
                                     height: 120,
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     backgroundColor: '#eff6ff',
                                     borderRadius: 20,
                                     borderStyle: 'dashed',
                                     borderWidth: 1.5,
                                     borderColor: '#bfdbfe',
                                     paddingHorizontal: 20,
                                 }}>
                                     <Ionicons name="cellular-outline" size={28} color="#3b82f6" />
                                        <Text style={{ color: '#3b82f6', marginTop: 8, fontWeight: '700', fontSize: 13 }}>
                                         Select a network to see plans
                                     </Text>
                                 </View>
                            ) : (
                                <View style={s.plansListContainer}>
                                    {/* Quick Features Hub Bar */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="filter-circle" size={14} color="#64748b" />
                                            <Text style={{ fontSize: 12, color: '#64748b', marginLeft: 4, fontWeight: '600' }}>{filteredPlans.length} Plans Available</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#15803d', marginRight: 4 }} />
                                                <Text style={{ fontSize: 10, color: '#475569' }}>Best Price/GB</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316', marginRight: 4 }} />
                                                <Text style={{ fontSize: 10, color: '#475569' }}>Top Value</Text>
                                            </View>
                                        </View>
                                    </View>
                                    {/* SMART FEATURE 2: AI Smart Pick Recommendation */}
                                    {network && smartPickPlan && (
                                        <View style={{
                                            backgroundColor: '#ffffff',
                                            borderRadius: 16,
                                            borderWidth: 1.5,
                                            borderColor: '#fde68a',
                                            padding: 12,
                                            marginBottom: 12,
                                            shadowColor: '#d97706',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.08,
                                            shadowRadius: 6,
                                            elevation: 2,
                                            overflow: 'hidden',
                                        }}>
                                            <LinearGradient
                                                colors={['#fffbeb', '#fef3c7']}
                                                style={[StyleSheet.absoluteFillObject, { opacity: 0.95 }]}
                                            />
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ backgroundColor: '#f5a623', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginRight: 6 }}>
                                                        <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#0d1b3e', letterSpacing: 0.5 }}>⚡ AI SMART PICK</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#78350f' }}>Recommended Value Bundle</Text>
                                                </View>
                                                <Text style={{ fontSize: 13, fontWeight: '900', color: '#b45309' }}>
                                                    ₦{smartPickPlan.price.toLocaleString()}
                                                </Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flex: 1, marginRight: 10 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d1b3e' }} numberOfLines={1}>
                                                        {smartPickPlan.name}
                                                    </Text>
                                                    <Text style={{ fontSize: 10.5, color: '#92400e', marginTop: 1 }}>
                                                        {smartPickPlan.validity || '30 Days'} • Lowest rate per GB on {networksData.find(n => n.id === network)?.name || network.toUpperCase()}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSelectedPlan(smartPickPlan);
                                                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                                                    }}
                                                    style={{
                                                        backgroundColor: selectedPlan?.id === smartPickPlan.id ? '#0d1b3e' : '#f5a623',
                                                        paddingHorizontal: 12,
                                                        paddingVertical: 7,
                                                        borderRadius: 10,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons 
                                                        name={selectedPlan?.id === smartPickPlan.id ? "checkmark-circle" : "flash"} 
                                                        size={12} 
                                                        color={selectedPlan?.id === smartPickPlan.id ? "#ffffff" : "#0d1b3e"} 
                                                        style={{ marginRight: 4 }} 
                                                    />
                                                    <Text style={{ fontSize: 11, fontWeight: '800', color: selectedPlan?.id === smartPickPlan.id ? '#ffffff' : '#0d1b3e' }}>
                                                        {selectedPlan?.id === smartPickPlan.id ? 'Selected' : 'Select'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {filteredPlans.map((plan) => {
                                        const isSelected = selectedPlan?.id === plan.id;
                                        const isFav = favorites.includes(plan.id);
                                        const planInfo = parsePlanInfo(plan.volume, plan.originalName || plan.name, plan.validity);
                                        const isBestValue = (planInfo.validityCategory === 'Monthly' && plan.price < 1000);
                                        const isMega = plan.name.toLowerCase().includes('mega');
                                        const isGBPlan = planInfo.volumeInGB >= 1;
                                        const costPerGB = isGBPlan ? Math.round(plan.price / planInfo.volumeInGB) : null;
                                        
                                        return (
                                        <TouchableOpacity
                                            key={plan.id}
                                            onPress={() => {
                                                if (Platform.OS !== 'web') {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                }
                                                setSelectedPlan(plan);
                                            }}
                                            style={[s.planListCard, isSelected && s.planListCardSelected]}
                                            activeOpacity={0.7}
                                        >
                                            <LinearGradient
                                                colors={isSelected ? ['#102258', '#0b163a'] : ['#ffffff', '#ffffff']}
                                                style={s.planListCardGradient}
                                            >
                                                {/* Left: Volume Badge */}
                                                <View style={[s.planVolumeBadge, isSelected && s.planVolumeBadgeSelected]}>
                                                    <Text style={[s.planVolumeValue, isSelected && { color: '#ffffff' }]}>
                                                        {planInfo.volumeVal || 'Data'}
                                                    </Text>
                                                    <Text style={[s.planVolumeUnit, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                                                        {planInfo.volumeUnit}
                                                    </Text>
                                                </View>
                                                
                                                {/* Middle: Details */}
                                                <View style={s.planDetailsMid}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap', gap: 4 }}>
                                                        <Text style={[s.planListName, isSelected && s.planListNameSelected]} numberOfLines={2}>
                                                            {plan.name}
                                                        </Text>
                                                        {isBestValue && (
                                                            <View style={[s.tinyBadge, { backgroundColor: '#f97316' }]}>
                                                                <Text style={s.tinyBadgeText}>BEST VALUE</Text>
                                                            </View>
                                                        )}
                                                        {isMega && (
                                                            <View style={[s.tinyBadge, { backgroundColor: '#8b5cf6' }]}>
                                                                <Text style={s.tinyBadgeText}>MEGA</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                        <View style={s.planListValidityContainer}>
                                                            <Ionicons name="time-outline" size={10} color={isSelected ? '#fde047' : '#64748b'} style={{ marginRight: 3 }} />
                                                            <Text style={[s.planListValidity, isSelected && s.planListValiditySelected]}>
                                                                {planInfo.validity}
                                                            </Text>
                                                        </View>

                                                        {/* Plan Type Badge (SME, CG, GIFTING, DIRECT) */}
                                                        {plan.plan_type ? (
                                                            <View style={{
                                                                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : (plan.plan_type === 'SME' ? '#ecfdf5' : plan.plan_type === 'CG' ? '#eff6ff' : '#fef3c7'),
                                                                borderColor: isSelected ? 'rgba(255,255,255,0.3)' : (plan.plan_type === 'SME' ? '#a7f3d0' : plan.plan_type === 'CG' ? '#bfdbfe' : '#fde68a'),
                                                                borderWidth: 1,
                                                                paddingHorizontal: 6,
                                                                paddingVertical: 1,
                                                                borderRadius: 8,
                                                            }}>
                                                                <Text style={{
                                                                    fontSize: 9,
                                                                    fontWeight: '700',
                                                                    color: isSelected ? '#ffffff' : (plan.plan_type === 'SME' ? '#047857' : plan.plan_type === 'CG' ? '#1d4ed8' : '#b45309'),
                                                                }}>
                                                                    {plan.plan_type}
                                                                </Text>
                                                            </View>
                                                        ) : null}

                                                        {/* Cost Badge for GB plans or Quick Pass for MB plans */}
                                                        {costPerGB !== null ? (
                                                            <View style={{
                                                                backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : '#f0fdf4',
                                                                borderColor: isSelected ? 'rgba(255,255,255,0.2)' : '#bbf7d0',
                                                                borderWidth: 1,
                                                                paddingHorizontal: 6,
                                                                paddingVertical: 1,
                                                                borderRadius: 8,
                                                            }}>
                                                                <Text style={{
                                                                    fontSize: 9,
                                                                    fontWeight: '700',
                                                                    color: isSelected ? '#4ade80' : '#15803d',
                                                                }}>
                                                                    ₦{costPerGB}/GB
                                                                </Text>
                                                            </View>
                                                        ) : (
                                                            <View style={{
                                                                backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : '#eff6ff',
                                                                borderColor: isSelected ? 'rgba(255,255,255,0.2)' : '#bfdbfe',
                                                                borderWidth: 1,
                                                                paddingHorizontal: 6,
                                                                paddingVertical: 1,
                                                                borderRadius: 8,
                                                            }}>
                                                                <Text style={{
                                                                    fontSize: 9,
                                                                    fontWeight: '700',
                                                                    color: isSelected ? '#93c5fd' : '#1d4ed8',
                                                                }}>
                                                                    ⚡ Quick Pass
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Right: Price & Fav */}
                                                <View style={s.planRightSide}>
                                                    <Text style={[s.planListPrice, isSelected && s.planListPriceSelected]}>
                                                        ₦{plan.price.toLocaleString()}
                                                    </Text>
                                                    <TouchableOpacity onPress={() => toggleFavorite(plan.id)} style={{ padding: 4 }}>
                                                        <Ionicons 
                                                            name={isFav ? "heart" : "heart-outline"} 
                                                            size={18} 
                                                            color={isFav ? (isSelected ? "#f87171" : "#ef4444") : (isSelected ? "rgba(255,255,255,0.4)" : "#94a3b8")} 
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )})}
                                    
                                    {plans.length > 0 && filteredPlans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No matching plans found.</Text>
                                         </View>
                                    )}
                                    
                                    {plans.length === 0 && (
                                         <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No active plans found for this network.</Text>
                                         </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Dynamic Cost-per-GB Metric */}
                    {selectedPlan && (() => {
                        const gb = parseVolumeToGB(selectedPlan.volume, selectedPlan.originalName || selectedPlan.name);
                        if (gb <= 0) return null;
                        
                        const costPerGB = Math.round(selectedPlan.price / gb);
                        
                        // Rating helper
                        let rating = 'Standard Value';
                        let ratingColor = '#475569';
                        let ratingBg = '#f1f5f9';
                        
                        if (costPerGB < 250) {
                            rating = 'Super Saver Value 🔥';
                            ratingColor = '#166534';
                            ratingBg = '#dcfce7';
                        } else if (costPerGB < 400) {
                            rating = 'Highly Cost-Efficient ⭐';
                            ratingColor = '#0d1b3e';
                            ratingBg = '#f4f6fb';
                        } else if (costPerGB < 600) {
                            rating = 'Good Value 👍';
                            ratingColor = '#854d0e';
                            ratingBg = '#fef9c3';
                        }

                        return (
                            <View style={s.efficiencyContainer}>
                                <View style={s.efficiencyLeft}>
                                    <Ionicons name="stats-chart" size={15} color="#0d1b3e" style={{ marginRight: 6 }} />
                                    <Text style={s.efficiencyTitle}>Plan Cost-Efficiency</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={s.efficiencyText}>₦{costPerGB.toLocaleString()} <Text style={{ fontSize: 9, color: '#64748b' }}>/ GB</Text></Text>
                                    <View style={[s.efficiencyRatingBadge, { backgroundColor: ratingBg }]}>
                                        <Text style={[s.efficiencyRatingText, { color: ratingColor }]}>{rating}</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })()}

                </ScrollView>

                {/* Bottom Floating Bar */}
                <View style={[
                    s.bottomButtonWrapper,
                    { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) + 12 },
                    isWeb && s.webPageContainer
                ]}>
                    {selectedPlan && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#ffffff',
                            borderRadius: 14,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                        }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d1b3e' }} numberOfLines={1}>
                                    {selectedPlan.name}
                                </Text>
                                <Text style={{ fontSize: 10, color: '#64748b' }}>
                                    Validity: {selectedPlan.validity || '30 Days'}
                                </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0d1b3e' }}>
                                    ₦{selectedPlan.price.toLocaleString()}
                                </Text>
                                {balance !== null && (
                                    balance < selectedPlan.price ? (
                                        <TouchableOpacity 
                                            onPress={() => router.push('/(app)/wallet')}
                                            style={{ flexDirection: 'row', alignItems: 'center' }}
                                        >
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>
                                                Low (₦{balance.toLocaleString()}) • Top Up
                                            </Text>
                                            <Ionicons name="add-circle" size={12} color="#dc2626" style={{ marginLeft: 2 }} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#16a34a' }}>
                                            ₦{(balance - selectedPlan.price).toLocaleString()} left after pay
                                        </Text>
                                    )
                                )}
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            s.purchaseBtn,
                            network && phoneNumber.length === 11 && selectedPlan && { shadowColor: '#d97706', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
                            !(network && phoneNumber.length === 11 && selectedPlan && !loadingPurchase) && { backgroundColor: '#cbd5e1', shadowOpacity: 0 }
                        ]}
                        onPress={handlePurchase}
                        disabled={!network || phoneNumber.length !== 11 || !selectedPlan || loadingPurchase}
                        activeOpacity={0.85}
                    >
                        {loadingPurchase ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <LinearGradient
                                colors={network && phoneNumber.length === 11 && selectedPlan ? ['#eab308', '#d97706'] : ['#cbd5e1', '#cbd5e1']}
                                style={s.purchaseBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={s.purchaseBtnText}>
                                    {selectedPlan ? `Confirm & Pay ₦${selectedPlan.price.toLocaleString()}` : 'Select a Bundle to Continue'}
                                </Text>
                                <Ionicons name="arrow-forward" size={16} color="white" style={{ marginLeft: 6 }} />
                            </LinearGradient>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <TransactionConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={() => {
                    setShowConfirmation(false);
                    setTimeout(() => setShowSecurityModal(true), 500);
                }}
                title="Confirm Data Purchase"
                network={network}
                details={[
                    { label: 'Transaction Type', value: 'Data Bundle' },
                    { label: 'Network', value: NETWORKS_DATA.find(n => n.id === network)?.name || network },
                    { label: 'Phone Number', value: phoneNumber },
                    { label: 'Data Plan', value: selectedPlan?.name || '-' },
                    { label: 'Validity', value: selectedPlan?.validity || '-' },
                    ...(autoRenew ? [{ label: 'Auto-Renew', value: 'Enabled (Every ' + (selectedPlan?.validity || 'month') + ')' }] : []),
                    ...(isGift ? [{ label: 'Gifting To', value: recipientName || 'Anonymous' }] : []),
                    { label: 'Original Price', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isAmount: true },
                    { label: 'Total To Pay', value: `₦${selectedPlan?.price?.toLocaleString() || '0'}`, isTotal: true },
                ]}
            />

            <SecurityModal 
                visible={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onSuccess={() => {
                    setShowSecurityModal(false);
                    setTimeout(() => processTransaction(), 500);
                }}
                title="Authorize Purchase"
                description={selectedPlan ? `Confirm purchase of ${selectedPlan.name} for ${phoneNumber} @ ₦${selectedPlan.price}` : "Enter PIN"}
                requiredFor="purchase"
            />

            <BrandAlertModal
                visible={brandAlert.visible}
                title={brandAlert.title}
                message={brandAlert.message}
                type={brandAlert.type}
                buttonText={brandAlert.buttonText || 'OK'}
                onClose={() => {
                    const cb = brandAlert.onConfirm;
                    setBrandAlert(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
                showCancel={brandAlert.showCancel}
                cancelText={brandAlert.cancelText}
                onCancel={() => {
                    const cb = brandAlert.onCancel;
                    setBrandAlert(prev => ({ ...prev, visible: false }));
                    if (cb) cb();
                }}
            />
            
            {PlanTypeModal()}
            {ContactModal()}
        </View>
    );

    function ContactModal() {
        const filteredBeneficiaries = beneficiaries.filter(b => {
            const query = (contactSearch || '').toLowerCase();
            return (b.name || '').toLowerCase().includes(query) || (b.phone || '').includes(query);
        });

        const filteredDeviceContacts = (deviceContacts || []).filter((c: any) => {
            const query = (contactSearch || '').toLowerCase();
            return (c.name || '').toLowerCase().includes(query) || (c.phone || '').includes(query);
        });

        const handleSelectRecipient = (phoneVal: string, nameVal?: string, netVal?: string) => {
            const cleaned = cleanNigerianPhone(phoneVal);
            if (cleaned) {
                setPhoneNumber(cleaned);
                if (netVal && NETWORKS_DATA.some(n => n.id === netVal)) {
                    setNetwork(netVal);
                } else {
                    detectNetwork(cleaned);
                }
                if (nameVal) setRecipientName(nameVal);
                setPurchaseMode('others');
                try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
                setShowContactModal(false);
            }
        };

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showContactModal}
                onRequestClose={() => setShowContactModal(false)}
                statusBarTranslucent={true}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    pointerEvents="box-none"
                >
                    {/* Sibling Backdrop - pressing outside closes, but never intercepts inputs inside sheet */}
                    <Pressable 
                        style={StyleSheet.absoluteFillObject}
                        onPress={() => setShowContactModal(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'rgba(13, 27, 62, 0.65)' }} />
                    </Pressable>

                    {/* Modern Bottom Sheet Container */}
                    <View 
                        style={{
                            backgroundColor: '#ffffff',
                            borderTopLeftRadius: 32,
                            borderTopRightRadius: 32,
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 24) : 20,
                            height: '88%',
                            maxHeight: '94%',
                            width: '100%',
                            maxWidth: 620,
                            alignSelf: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: -6 },
                            shadowOpacity: 0.15,
                            shadowRadius: 16,
                            elevation: 20,
                        }}
                    >
                        {/* Top Grab Handle */}
                        <View style={{ alignItems: 'center', paddingVertical: 4, marginBottom: 8 }}>
                            <View style={{ width: 44, height: 5, borderRadius: 2.5, backgroundColor: '#cbd5e1' }} />
                        </View>

                        {/* Modal Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: '#eff6ff',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 10,
                                }}>
                                    <Ionicons 
                                        name={contactModalTab === 'add' ? "person-add" : "people"} 
                                        size={20} 
                                        color="#0056D2" 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#0d1b3e' }}>
                                        {contactModalTab === 'add' ? 'Add Data Beneficiary' : 'Beneficiaries & Contacts'}
                                    </Text>
                                    <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                                        {contactModalTab === 'add' ? 'Save contact for instant 1-tap top-ups' : 'Pick a saved recipient or phone contact'}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => setShowContactModal(false)}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    backgroundColor: '#f1f5f9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        {/* Modern Segmented Tab Pills */}
                        <View style={{
                            flexDirection: 'row',
                            backgroundColor: '#f1f5f9',
                            borderRadius: 14,
                            padding: 4,
                            marginBottom: 12,
                            gap: 4,
                        }}>
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingVertical: 9,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: contactModalTab === 'beneficiaries' ? '#ffffff' : 'transparent',
                                    shadowColor: contactModalTab === 'beneficiaries' ? '#000' : 'transparent',
                                    shadowOpacity: contactModalTab === 'beneficiaries' ? 0.08 : 0,
                                    shadowRadius: 4,
                                    elevation: contactModalTab === 'beneficiaries' ? 2 : 0,
                                    flexDirection: 'row',
                                }}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setContactModalTab('beneficiaries');
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons 
                                    name="bookmark" 
                                    size={13} 
                                    color={contactModalTab === 'beneficiaries' ? '#0056D2' : '#64748b'} 
                                    style={{ marginRight: 4 }} 
                                />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: contactModalTab === 'beneficiaries' ? '#0056D2' : '#64748b' }}>
                                    Saved ({beneficiaries.length})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingVertical: 9,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: contactModalTab === 'add' ? '#ffffff' : 'transparent',
                                    shadowColor: contactModalTab === 'add' ? '#000' : 'transparent',
                                    shadowOpacity: contactModalTab === 'add' ? 0.08 : 0,
                                    shadowRadius: 4,
                                    elevation: contactModalTab === 'add' ? 2 : 0,
                                    flexDirection: 'row',
                                }}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setContactModalTab('add');
                                    if (phoneNumber && !newBenPhone) {
                                        setNewBenPhone(phoneNumber);
                                    }
                                    if (network && !newBenNetwork) {
                                        setNewBenNetwork(network);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons 
                                    name="add-circle" 
                                    size={13} 
                                    color={contactModalTab === 'add' ? '#0056D2' : '#64748b'} 
                                    style={{ marginRight: 4 }} 
                                />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: contactModalTab === 'add' ? '#0056D2' : '#64748b' }}>
                                    + Add New
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    paddingVertical: 9,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: contactModalTab === 'phonebook' ? '#ffffff' : 'transparent',
                                    shadowColor: contactModalTab === 'phonebook' ? '#000' : 'transparent',
                                    shadowOpacity: contactModalTab === 'phonebook' ? 0.08 : 0,
                                    shadowRadius: 4,
                                    elevation: contactModalTab === 'phonebook' ? 2 : 0,
                                    flexDirection: 'row',
                                }}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setContactModalTab('phonebook');
                                    if (deviceContacts.length === 0) {
                                        loadDeviceContacts(false);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons 
                                    name="call" 
                                    size={13} 
                                    color={contactModalTab === 'phonebook' ? '#0056D2' : '#64748b'} 
                                    style={{ marginRight: 4 }} 
                                />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: contactModalTab === 'phonebook' ? '#0056D2' : '#64748b' }}>
                                    Phonebook
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar for Saved & Phonebook Tabs */}
                        {contactModalTab !== 'add' && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#f8fafc',
                                borderWidth: 1.5,
                                borderColor: '#e2e8f0',
                                borderRadius: 14,
                                paddingHorizontal: 12,
                                height: 42,
                                marginBottom: 12,
                            }}>
                                <Ionicons name="search" size={17} color="#94a3b8" />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, fontSize: 13.5, color: '#0f172a' }}
                                    placeholder={contactModalTab === 'beneficiaries' ? "Search saved beneficiaries..." : "Search phone contacts..."}
                                    placeholderTextColor="#94a3b8"
                                    value={contactSearch}
                                    onChangeText={setContactSearch}
                                    autoCapitalize="none"
                                />
                                {contactSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setContactSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* TAB 1: SAVED BENEFICIARIES */}
                        {contactModalTab === 'beneficiaries' && (
                            filteredBeneficiaries.length === 0 ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20 }}>
                                    <View style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 36,
                                        backgroundColor: '#eff6ff',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 14,
                                    }}>
                                        <Ionicons name="people-outline" size={36} color="#0056D2" />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
                                        {contactSearch ? 'No matching beneficiaries found' : 'No saved beneficiaries yet'}
                                    </Text>
                                    <Text style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 18, marginBottom: 20 }}>
                                        {contactSearch 
                                            ? 'Try searching with another name or phone number.'
                                            : 'Save your family, friends, and office numbers to top up data instantly with 1 tap.'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setContactSearch('');
                                            setContactModalTab('add');
                                        }}
                                        style={{
                                            backgroundColor: '#0d1b3e',
                                            paddingHorizontal: 22,
                                            paddingVertical: 12,
                                            borderRadius: 14,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            shadowColor: '#0d1b3e',
                                            shadowOffset: { width: 0, height: 3 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 6,
                                            elevation: 3,
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13.5 }}>Add New Beneficiary</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredBeneficiaries}
                                    keyExtractor={(item, index) => item.id ? String(item.id) : `ben-${index}`}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 16 }}
                                    renderItem={({ item }) => {
                                        const benNet = item.network || getCarrierForPhone(item.phone)?.id;
                                        const netColor = benNet === 'mtn' ? '#f5a623' : benNet === 'airtel' ? '#ef4444' : benNet === 'glo' ? '#16a34a' : benNet === '9mobile' ? '#10b981' : '#0056D2';
                                        return (
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 10,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 16,
                                                    backgroundColor: '#ffffff',
                                                    borderWidth: 1.2,
                                                    borderColor: '#f1f5f9',
                                                    marginBottom: 8,
                                                }}
                                            >
                                                {/* Avatar */}
                                                <View style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: '#eff6ff',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 12,
                                                    borderWidth: 2,
                                                    borderColor: netColor,
                                                }}>
                                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0d1b3e' }}>
                                                        {(item.name || 'B').charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>

                                                {/* Info */}
                                                <TouchableOpacity 
                                                    style={{ flex: 1, marginRight: 8 }}
                                                    onPress={() => handleSelectRecipient(item.phone, item.name, item.network)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{item.name || 'Beneficiary'}</Text>
                                                        {benNet && (
                                                            <View style={{ backgroundColor: `${netColor}18`, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                                                                <Text style={{ fontSize: 9, fontWeight: '900', color: netColor }}>{benNet.toUpperCase()}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' }}>
                                                        {item.phone.length >= 4 
                                                            ? `${item.phone.slice(0, 4)} ${item.phone.slice(4, 7)} ${item.phone.slice(7)}` 
                                                            : item.phone}
                                                    </Text>
                                                </TouchableOpacity>

                                                {/* Use Button */}
                                                <TouchableOpacity
                                                    onPress={() => handleSelectRecipient(item.phone, item.name, item.network)}
                                                    style={{
                                                        backgroundColor: '#0d1b3e',
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 7,
                                                        borderRadius: 10,
                                                        marginRight: 6,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#ffffff', marginRight: 2 }}>Use</Text>
                                                    <Ionicons name="arrow-forward" size={11} color="#ffffff" />
                                                </TouchableOpacity>

                                                {/* Delete Button */}
                                                <TouchableOpacity 
                                                    onPress={() => handleDeleteBeneficiary(item)}
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: 8,
                                                        backgroundColor: '#fef2f2',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    }}
                                />
                            )
                        )}

                        {/* TAB 2: ADD NEW BENEFICIARY */}
                        {contactModalTab === 'add' && (
                            <ScrollView 
                                keyboardShouldPersistTaps="handled" 
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 24 }}
                            >
                                <View style={{ paddingTop: 4 }}>
                                    {/* Name Input */}
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0d1b3e', marginBottom: 6 }}>
                                        Beneficiary Name / Nickname
                                    </Text>
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#f8fafc',
                                        borderWidth: 1.5,
                                        borderColor: '#e2e8f0',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        height: 48,
                                        marginBottom: 14,
                                    }}>
                                        <Ionicons name="person-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={{ flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '600' }}
                                            placeholder="e.g. Mum MTN, Brother Sani, WiFi"
                                            placeholderTextColor="#94a3b8"
                                            value={newBenName}
                                            onChangeText={setNewBenName}
                                        />
                                    </View>

                                    {/* Phone Number Input */}
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0d1b3e', marginBottom: 6 }}>
                                        Phone Number (11 Digits)
                                    </Text>
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: '#f8fafc',
                                        borderWidth: 1.5,
                                        borderColor: '#e2e8f0',
                                        borderRadius: 14,
                                        paddingHorizontal: 12,
                                        marginBottom: 8,
                                        height: 48,
                                    }}>
                                        <Ionicons name="call-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={{ flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '700', letterSpacing: 0.5 }}
                                            placeholder="0803 123 4567"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="phone-pad"
                                            value={newBenPhone}
                                            maxLength={11}
                                            onChangeText={(t) => {
                                                const cleaned = t.replace(/\D/g, '');
                                                setNewBenPhone(cleaned);
                                                const carrier = getCarrierForPhone(cleaned);
                                                if (carrier) setNewBenNetwork(carrier.id);
                                            }}
                                        />
                                        <TouchableOpacity
                                            onPress={async () => {
                                                try {
                                                    const clip = await Clipboard.getStringAsync();
                                                    if (clip) {
                                                        const clean = cleanNigerianPhone(clip);
                                                        setNewBenPhone(clean);
                                                        const carrier = getCarrierForPhone(clean);
                                                        if (carrier) setNewBenNetwork(carrier.id);
                                                    }
                                                } catch {}
                                            }}
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 5,
                                                backgroundColor: '#eff6ff',
                                                borderRadius: 8,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="clipboard-outline" size={13} color="#0056D2" style={{ marginRight: 3 }} />
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#0056D2' }}>Paste</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Auto Carrier Detection Indicator */}
                                    {newBenPhone.length >= 4 && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 }}>
                                            {(() => {
                                                const detected = getCarrierForPhone(newBenPhone);
                                                if (detected) {
                                                    return (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                                                            <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '700' }}>
                                                                Detected: {detected.name} Network
                                                            </Text>
                                                        </View>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </View>
                                    )}

                                    {/* Mobile Network Selector */}
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0d1b3e', marginBottom: 8, marginTop: 4 }}>
                                        Mobile Network
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                        {networksData.map((net) => {
                                            const isSelected = newBenNetwork === net.id;
                                            return (
                                                <TouchableOpacity
                                                    key={net.id}
                                                    onPress={() => {
                                                        Haptics.selectionAsync();
                                                        setNewBenNetwork(net.id);
                                                    }}
                                                    style={{
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 9,
                                                        borderRadius: 14,
                                                        borderWidth: 1.5,
                                                        borderColor: isSelected ? '#0d1b3e' : '#e2e8f0',
                                                        backgroundColor: isSelected ? '#0d1b3e' : '#ffffff',
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                    }}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: net.color || '#cbd5e1', marginRight: 7 }} />
                                                    <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#ffffff' : '#334155' }}>
                                                        {net.name}
                                                    </Text>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark" size={13} color="#ffffff" style={{ marginLeft: 5 }} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Save Button */}
                                    <TouchableOpacity
                                        onPress={() => handleSaveNewBeneficiary(newBenName, newBenPhone, newBenNetwork)}
                                        disabled={savingBen}
                                        style={{
                                            backgroundColor: '#0d1b3e',
                                            paddingVertical: 14,
                                            borderRadius: 16,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            shadowColor: '#0d1b3e',
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        {savingBen ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="checkmark-circle" size={18} color="#f5a623" style={{ marginRight: 8 }} />
                                                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14.5 }}>
                                                    Save Beneficiary
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        )}

                        {/* TAB 3: PHONE CONTACTS */}
                        {contactModalTab === 'phonebook' && (
                            loadingDeviceContacts ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                                    <ActivityIndicator size="large" color="#0056D2" />
                                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 12, fontWeight: '600' }}>Reading device contacts...</Text>
                                </View>
                            ) : contactsPermissionGranted === false ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20 }}>
                                    <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                        <Ionicons name="lock-closed" size={32} color="#d97706" />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
                                        Contacts Access Needed
                                    </Text>
                                    <Text style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 18, marginBottom: 20 }}>
                                        Grant permission to quickly pick and recharge any number from your phonebook.
                                    </Text>
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#0056D2', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 }}
                                        onPress={() => loadDeviceContacts(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13.5 }}>Grant Permission</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : filteredDeviceContacts.length === 0 ? (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                                    <Ionicons name="call-outline" size={44} color="#cbd5e1" />
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748b', marginTop: 10 }}>
                                        {contactSearch ? 'No matching phone contacts' : 'No contacts found on device'}
                                    </Text>
                                    <TouchableOpacity 
                                        style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                                        onPress={() => loadDeviceContacts(true)}
                                    >
                                        <Ionicons name="refresh" size={15} color="#0056D2" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#0056D2', fontWeight: '800', fontSize: 12.5 }}>Reload Contacts</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <FlatList
                                    data={filteredDeviceContacts}
                                    keyExtractor={(item) => item.id}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingVertical: 11,
                                                paddingHorizontal: 12,
                                                borderRadius: 14,
                                                backgroundColor: '#ffffff',
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#f1f5f9',
                                            }}
                                            onPress={() => handleSelectRecipient(item.phone, item.name)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: '#f1f5f9',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginRight: 12,
                                            }}>
                                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#475569' }}>
                                                    {(item.name || 'C').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#0f172a' }}>{item.name}</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' }}>{item.phone}</Text>
                                            </View>
                                            <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#0056D2' }}>Select</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            )
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    }

    function PlanTypeModal() {
        // Dynamically get available types from current loaded plans & DB plan_type
        const availableTypes = new Set<string>();
        plans.forEach(p => {
             const dbType = p.plan_type ? String(p.plan_type).trim().toUpperCase() : '';
             if (dbType) {
                 availableTypes.add(dbType);
             }
             const n = (p.originalName || p.name).toUpperCase();
             if (n.includes('SME')) availableTypes.add('SME');
             else if (n.includes('CG') || n.includes('CORPORATE')) availableTypes.add('CG');
             else if (n.includes('DIRECT') || n.includes('GIFTING')) availableTypes.add('DIRECT');
             else if (n.includes('AWOOF')) availableTypes.add('AWOOF');
             else if (n.includes('MEGA')) availableTypes.add('MEGA');
        });

        if (availableTypes.size === 0) {
            availableTypes.add('SME');
            availableTypes.add('CG');
            availableTypes.add('GIFTING');
        }

        const typeMap: Record<string, { name: string; desc: string }> = {
             'SME': { name: 'SME Data', desc: 'Small and Medium Enterprise plans' },
             'CG': { name: 'Corporate Gifting (CG)', desc: 'Corporate Gifting data plans' },
             'DIRECT': { name: 'Direct Data', desc: 'Direct network gifting plans' },
             'GIFTING': { name: 'Gifting Data', desc: 'Direct network gifting plans' },
             'AWOOF': { name: 'Awoof Data', desc: 'Special promo Awoof plans' },
             'MEGA': { name: 'Mega Plans', desc: 'Large volume data plans' },
             'STANDARD': { name: 'Standard Data', desc: 'Regular network data plans' },
        };

        const planTypes = [
            { id: 'All', name: 'All Plan Types', desc: 'Show all available data plans' },
            ...Array.from(availableTypes).map(t => ({
                id: t,
                name: typeMap[t]?.name || `${t} Data Plans`,
                desc: typeMap[t]?.desc || `Custom ${t} network data plans`
            }))
        ];

        return (
            <Modal
                animationType="fade"
                transparent={true}
                visible={showPlanTypeModal}
                onRequestClose={() => setShowPlanTypeModal(false)}
            >
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                    activeOpacity={1}
                    onPress={() => setShowPlanTypeModal(false)}
                >
                    <View style={s.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Plan Type</Text>
                            <TouchableOpacity onPress={() => setShowPlanTypeModal(false)}>
                                <Ionicons name="close-circle" size={26} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        
                        {planTypes.map((type, idx) => (
                            <TouchableOpacity
                                key={type.id}
                                style={[s.planTypeOption, idx < planTypes.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}
                                onPress={() => {
                                    setPlanTypeFilter(type.id);
                                    setShowPlanTypeModal(false);
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.planTypeOptionName, planTypeFilter === type.id && { color: '#0d1b3e', fontWeight: '800' }]}>{type.name}</Text>
                                    <Text style={s.planTypeOptionDesc}>{type.desc}</Text>
                                </View>
                                {planTypeFilter === type.id && (
                                    <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    }

    

    
}

const s = StyleSheet.create({
  pageWrapper: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  webPageContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 920,
  },
  headerContainer: {
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingHorizontal: 16,
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  headerBalance: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    paddingBottom: 140,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0d1b3e',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  networksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    width: '100%',
  },
  networkCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '23.5%',
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
    position: 'relative',
  },
  networkCardSelected: {
    borderWidth: 1.5,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  networkLogoWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  networkLogo: {
    width: '80%',
    height: '80%',
  },
  networkName: {
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 2,
    color: '#64748b',
  },
  networkNameSelected: {
    color: '#0d1b3e',
    fontWeight: '800',
  },
  checkBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    borderRadius: 6,
    padding: 1,
  },
  inputBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
    width: '100%',
  },
  inputBoxFocused: {
    borderColor: '#0d1b3e',
  },
  inputBoxLogoWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  inputBoxLogo: {
    width: '100%',
    height: '100%',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0d1b3e',
  },
  beneficiaryBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  clearBtn: {
    padding: 4,
  },
  filterPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  filterPillActive: {
    backgroundColor: '#0d1b3e',
    borderColor: '#0d1b3e',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#0d1b3e',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1.5,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  plansListContainer: {
    width: '100%',
    marginTop: 8,
  },
  planListCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  planListCardSelected: {
    borderColor: '#f5a623',
    borderWidth: 2,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  planListCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  planVolumeBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  planVolumeBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  planVolumeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 16,
  },
  planVolumeUnit: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  planDetailsMid: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  planListName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 1,
  },
  planListNameSelected: {
    color: '#ffffff',
  },
  planListValidityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planListValidity: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  planListValiditySelected: {
    color: '#fde047',
  },
  tinyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tinyBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  planRightSide: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 70,
  },
  planListPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
  },
  planListPriceSelected: {
    color: '#f5a623',
  },
  quickRepeatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  quickRepeatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  quickRepeatIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickRepeatTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  quickRepeatDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bottomButtonWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
  },
  purchaseBtn: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d1b3e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  purchaseBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  purchaseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // USSD Codes styles
  ussdContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  ussdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fffdf9',
  },
  ussdHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350f',
  },
  ussdContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    backgroundColor: '#ffffff',
  },
  ussdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  ussdNetName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  ussdSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  ussdActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  ussdActionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d1b3e',
    marginLeft: 3,
  },

  // Estimator styles
  estimatorContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  estimatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
  },
  estimatorHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  estimatorContent: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  estimatorIntro: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  estimatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  estimatorLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  estimatorSubLabel: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 2,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  counterValue: {
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '800',
    color: '#0d1b3e',
    textAlign: 'center',
    minWidth: 32,
  },
  estimatorResultsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  resultLbl: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  recommendBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  recommendBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Recommendation Banner styles
  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  recommendationBannerText: {
    color: '#78350f',
    fontSize: 11,
    fontWeight: '600',
  },
  recommendationBannerClose: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendationBannerCloseText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },

  // Options switch styles
  optionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginTop: 16,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  optionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  optionDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  customSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchOn: {
    backgroundColor: '#0d1b3e',
  },
  customSwitchOff: {
    backgroundColor: '#cbd5e1',
  },
  customSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  customSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  customSwitchThumbOff: {
    alignSelf: 'flex-start',
  },
  giftInputContainer: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
  },
  giftInput: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0d1b3e',
  },
  capabilityBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  capabilityText: {
    fontSize: 6,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  giftRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  giftBeneficiaryBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  efficiencyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginTop: 16,
    width: '100%',
  },
  efficiencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  efficiencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  efficiencyText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0d1b3e',
  },
  efficiencyRatingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
  },
  efficiencyRatingText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  rolloverContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginTop: 16,
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  rolloverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f0fdf4',
  },
  rolloverHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534',
  },
  rolloverContent: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  rolloverText: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 14,
  },
  rolloverTipItem: {
    flexDirection: 'row',
    marginTop: 6,
    paddingLeft: 4,
  },
  rolloverBullet: {
    fontSize: 10.5,
    color: '#16a34a',
    marginRight: 6,
  },
  rolloverTipText: {
    fontSize: 10.5,
    color: '#475569',
    flex: 1,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    width: '100%',
  },
  dropdownBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d1b3e',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 450,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  planTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  planTypeOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  planTypeOptionDesc: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
