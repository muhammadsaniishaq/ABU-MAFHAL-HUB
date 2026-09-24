import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
  Image,
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';

import { supabase } from '../../services/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import SecurityModal from '../../components/SecurityModal';
import ErrorBoundary from '../../components/ErrorBoundary';
import { createAppNotification } from '../../services/notificationsHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Luxury Fintech Design Tokens ─────────────────────────────────────────────
const T = {
  navyDark: '#060B18',
  navy: '#0D1B3E',
  navyMid: '#142258',
  navyLight: '#1E2D60',
  gold: '#F5A623',
  goldDark: '#D4890E',
  goldLight: '#FDE3A7',
  emerald: '#10B981',
  emeraldDark: '#059669',
  rose: '#EF4444',
  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeFormatCurrency = (val: any) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const safeFormatDate = (dateStr: any) => {
  try {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

// ─── Bulletproof QR Code Component with Dual Rendering Engine ─────────────────
function SafeQRCode({ value, size = 180 }: { value: string; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const encodedVal = encodeURIComponent(value || 'https://abumafhalsub.com');
  const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodedVal}&margin=1&color=0D1B3E`;

  if (hasError || Platform.OS === 'web') {
    return (
      <Image
        source={{ uri: fallbackUrl }}
        style={{ width: size, height: size, borderRadius: 12 }}
        resizeMode="contain"
      />
    );
  }

  try {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <QRCode
          value={value || 'https://abumafhalsub.com'}
          size={size}
          color={T.navy}
          backgroundColor={T.white}
          onError={() => setHasError(true)}
        />
      </View>
    );
  } catch {
    return (
      <Image
        source={{ uri: fallbackUrl }}
        style={{ width: size, height: size, borderRadius: 12 }}
        resizeMode="contain"
      />
    );
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function QRPayScreen() {
  return (
    <ErrorBoundary
      fallbackTitle="QR Pay Unavailable"
      fallbackSubtitle="An unexpected issue occurred. Tap below to reload the QR Pay screen."
    >
      <QRPayContent />
    </ErrorBoundary>
  );
}

// ─── Inner Screen Component ───────────────────────────────────────────────────
function QRPayContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useAppSettings();

  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'scan' | 'mycode'>('scan');

  // Camera & Permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanned, setScanned] = useState(false);
  const isScanningLocked = useRef(false);

  // Animated Laser Beam
  const laserAnim = useRef(new Animated.Value(0)).current;

  // User & Balances
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [recentPayees, setRecentPayees] = useState<any[]>([]);

  // Recipient Resolution & Payment Flow
  const [recipientUser, setRecipientUser] = useState<any>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [amountModalVisible, setAmountModalVisible] = useState(false);

  // Inputs
  const [manualInput, setManualInput] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [tempAmountInput, setTempAmountInput] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Final Receipt Details
  const [receiptData, setReceiptData] = useState<{
    ref: string;
    amount: number;
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    date: string;
    note: string;
  } | null>(null);

  // ─── Initial Data Fetching ──────────────────────────────────────────────────
  const fetchUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url, balance')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setCurrentUser(profile);
        setUserBalance(Number(profile.balance) || 0);
      }

      // Fetch 4 recent unique transfer recipients
      const { data: txList } = await supabase
        .from('transactions')
        .select('details, description, metadata, created_at')
        .eq('user_id', user.id)
        .in('type', ['transfer', 'p2p_transfer'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (txList && txList.length > 0) {
        const uniqueMap = new Map();
        for (const t of txList) {
          const recName = t.details?.recipient_name || t.metadata?.target_name || t.description;
          const recId = t.details?.target_id || t.metadata?.target_id;
          if (recId && !uniqueMap.has(recId)) {
            uniqueMap.set(recId, {
              id: recId,
              name: recName || 'Mafhal Member',
              email: t.details?.target_email || t.metadata?.target_email || '',
              avatarUrl: t.details?.avatar_url || null,
            });
          }
        }
        setRecentPayees(Array.from(uniqueMap.values()).slice(0, 4));
      }
    } catch (err) {
      console.warn('Error fetching user data in QR Pay:', err);
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // ─── Oscillating Laser Beam Animation ───────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'scan' && !scanned) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [activeTab, scanned, laserAnim]);

  // ─── Unlock Scanning When State Resets ──────────────────────────────────────
  const resetScanner = () => {
    setScanned(false);
    isScanningLocked.current = false;
  };

  // ─── Recipient Resolver Engine (Postgres-Safe) ──────────────────────────────
  const resolveRecipient = async (inputStr: string) => {
    const raw = (inputStr || '').trim();
    if (!raw) return null;

    let targetUserId = '';
    let targetEmail = '';
    let targetPhone = '';
    let targetUsername = '';
    let prefilledAmount = '';

    // 1. Try parsing JSON payload
    try {
      const parsed = JSON.parse(raw);
      if (parsed.userId) targetUserId = parsed.userId;
      if (parsed.email) targetEmail = parsed.email;
      if (parsed.phone) targetPhone = parsed.phone;
      if (parsed.amount && Number(parsed.amount) > 0) prefilledAmount = String(parsed.amount);
    } catch {
      // 2. Format checks
      if (raw.toUpperCase().startsWith('MAF-')) {
        const clean = raw.replace(/^MAF-/i, '').trim();
        targetUserId = clean;
      } else if (raw.includes('@')) {
        targetEmail = raw.toLowerCase();
      } else if (/^[0-9+]+$/.test(raw)) {
        targetPhone = raw.replace(/\D/g, '');
      } else if (raw.length === 36 && raw.includes('-')) {
        targetUserId = raw;
      } else {
        targetUsername = raw.toLowerCase();
      }
    }

    let profile = null;

    // A. Direct UUID match (Exact 36 chars)
    if (targetUserId && targetUserId.length === 36) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .eq('id', targetUserId)
        .maybeSingle();
      if (data) profile = data;
    }

    // B. Match by Email
    if (!profile && targetEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .ilike('email', targetEmail)
        .maybeSingle();
      if (data) profile = data;
    }

    // C. Match by Phone Number (Last 8 digits)
    if (!profile && targetPhone) {
      const last8 = targetPhone.slice(-8);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .ilike('phone', `%${last8}%`)
        .limit(1)
        .maybeSingle();
      if (data) profile = data;
    }

    // D. Match by Username
    if (!profile && targetUsername) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .ilike('username', targetUsername)
        .maybeSingle();
      if (data) profile = data;
    }

    // E. Fallback OR search
    if (!profile && raw.length >= 3) {
      const cleanQ = raw.toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .or(`email.ilike.%${cleanQ}%,username.ilike.%${cleanQ}%,phone.ilike.%${cleanQ}%`)
        .limit(1)
        .maybeSingle();
      if (data) profile = data;
    }

    return { profile, prefilledAmount };
  };

  // ─── Process Scanned or Selected Recipient ──────────────────────────────────
  const handleProcessRecipient = async (dataPayload: string) => {
    setIsResolving(true);
    try {
      const result = await resolveRecipient(dataPayload);
      if (!result || !result.profile) {
        Alert.alert(
          "Recipient Not Found",
          "Could not locate an active Abu Mafhal account matching this QR code or input. Please verify the details."
        );
        resetScanner();
        return;
      }

      if (currentUser && result.profile.id === currentUser.id) {
        Alert.alert("Self-Payment Notice", "You cannot transfer funds to your own wallet account.");
        resetScanner();
        return;
      }

      setRecipientUser(result.profile);
      if (result.prefilledAmount) {
        setTransferAmount(result.prefilledAmount);
      } else {
        setTransferAmount('');
      }
      setTransferNote('');
      setConfirmModalVisible(true);
    } catch (err: any) {
      Alert.alert("Scan Error", "Failed to process recipient information. Please try again.");
      resetScanner();
    } finally {
      setIsResolving(false);
    }
  };

  // ─── Camera Barcode Scanned Handler ─────────────────────────────────────────
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanningLocked.current || scanned) return;
    isScanningLocked.current = true;
    setScanned(true);

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    await handleProcessRecipient(data);
  };

  // ─── Gallery QR Picker & Analyzer ───────────────────────────────────────────
  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Access Required", "Please grant photo library access to upload a QR code image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setIsAnalyzingImage(true);
      const uri = result.assets[0].uri;

      // Online API analyzer with graceful error handling
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'qr_image.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      setIsAnalyzingImage(false);

      const codeText = json?.[0]?.symbol?.[0]?.data;
      if (codeText) {
        await handleProcessRecipient(codeText);
      } else {
        Alert.alert(
          "No QR Code Detected",
          "Could not detect a clear QR code in this image. Please crop closer to the square QR code and try again."
        );
      }
    } catch {
      setIsAnalyzingImage(false);
      Alert.alert(
        "Upload Notice",
        "Could not decode QR image. You can also use the 'Pay by Phone/Email' option below."
      );
    }
  };

  // ─── Manual Search Trigger ──────────────────────────────────────────────────
  const handleManualSearch = async () => {
    if (!manualInput.trim()) {
      Alert.alert("Input Required", "Please enter a phone number, email, or username.");
      return;
    }
    setManualModalVisible(false);
    await handleProcessRecipient(manualInput.trim());
    setManualInput('');
  };

  // ─── Step 1: Confirm Payment Initiation ─────────────────────────────────────
  const handleProceedToPin = () => {
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt < 100) {
      Alert.alert("Invalid Amount", "Minimum transfer amount is ₦100.00.");
      return;
    }
    if (amt > userBalance) {
      Alert.alert("Insufficient Balance", "Your available wallet balance is insufficient for this payment.");
      return;
    }
    setSecurityModalVisible(true);
  };

  // ─── Step 2: Execute Transfer via Supabase RPC ──────────────────────────────
  const handleExecuteTransfer = async (authPin?: string) => {
    if (!recipientUser || !currentUser) return;
    const amt = parseFloat(transferAmount);

    setSecurityModalVisible(false);
    setIsProcessing(true);

    try {
      let rpcRes = await supabase.rpc('execute_wallet_transfer', {
        sender_id: currentUser.id,
        target_id: recipientUser.id,
        amount: amt,
        p_pin: authPin || '',
      });

      if (rpcRes.error) {
        rpcRes = await supabase.rpc('execute_p2p_transfer', {
          sender_id: currentUser.id,
          target_id: recipientUser.id,
          amount: amt,
          p_pin: authPin || '',
        });
      }

      const { data, error } = rpcRes;
      if (error) throw new Error(error.message || 'P2P transfer failed.');
      if (data && data.success === false) throw new Error(data.message || 'P2P transfer failed.');

      const newBal = data?.new_balance ?? Math.max(0, userBalance - amt);
      setUserBalance(newBal);

      const refNumber = data?.reference || `TRF-QR-${Date.now().toString().slice(-8)}`;

      // Immediate in-app notification
      createAppNotification(
        currentUser.id,
        `Debit Alert: ₦${safeFormatCurrency(amt)}`,
        `₦${safeFormatCurrency(amt)} transferred to ${recipientUser.full_name || recipientUser.email}. Ref: ${refNumber}`,
        'transfer',
        'high'
      ).catch(() => {});

      setReceiptData({
        ref: refNumber,
        amount: amt,
        recipientName: recipientUser.full_name || 'Mafhal Member',
        recipientEmail: recipientUser.email || '',
        recipientPhone: recipientUser.phone || '',
        date: new Date().toISOString(),
        note: transferNote || 'QR Code Payment',
      });

      setConfirmModalVisible(false);
      setSuccessModalVisible(true);

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err: any) {
      Alert.alert("Payment Failed", err.message || "An error occurred while processing your transfer.");
    } finally {
      setIsProcessing(false);
      resetScanner();
    }
  };

  // ─── Share Receipt ──────────────────────────────────────────────────────────
  const handleShareReceipt = async () => {
    if (!receiptData) return;
    try {
      const message = `━━━━━━━━━━━━━━━━━━━━━━━━━━
   ABU MAFHAL HUB - PAYMENT RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ₦${safeFormatCurrency(receiptData.amount)}
To: ${receiptData.recipientName}
Email: ${receiptData.recipientEmail || '-'}
Reference: ${receiptData.ref}
Date: ${safeFormatDate(receiptData.date)}
Type: Instant QR Transfer
Status: SUCCESSFUL (Instant Settlement)
━━━━━━━━━━━━━━━━━━━━━━━━━━
Thank you for transacting with Abu Mafhal Hub!
https://abumafhalsub.com`;

      await Share.share({
        title: `Receipt - ${receiptData.ref}`,
        message,
      });
    } catch {}
  };

  // ─── Copy Wallet ID ─────────────────────────────────────────────────────────
  const handleCopyWalletId = async () => {
    if (!currentUser?.id) return;
    const walletId = `MAF-${currentUser.id.substring(0, 8).toUpperCase()}`;
    await Clipboard.setStringAsync(walletId);
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // ─── Share My QR Details ────────────────────────────────────────────────────
  const handleShareMyCode = async () => {
    if (!currentUser) return;
    const walletId = `MAF-${currentUser.id.substring(0, 8).toUpperCase()}`;
    const amountStr = requestedAmount && parseFloat(requestedAmount) > 0 
      ? `\nRequested Amount: ₦${safeFormatCurrency(requestedAmount)}`
      : '';
    const shareText = `Hi! You can pay me instantly on Abu Mafhal Hub:
Name: ${currentUser.full_name}
Wallet ID: ${walletId}${amountStr}
Email: ${currentUser.email}

Open Abu Mafhal Hub app > QR Pay to send money in seconds!
https://abumafhalsub.com`;

    try {
      await Share.share({
        title: `Pay ${currentUser.full_name} on Abu Mafhal`,
        message: shareText,
      });
    } catch {}
  };

  // ─── Build User QR Payload ──────────────────────────────────────────────────
  const myCodePayload = useMemo(() => {
    if (!currentUser) return 'https://abumafhalsub.com';
    return JSON.stringify({
      app: 'abumafhal',
      type: 'p2p_transfer',
      userId: currentUser.id,
      name: currentUser.full_name,
      email: currentUser.email,
      phone: currentUser.phone || '',
      ...(requestedAmount && parseFloat(requestedAmount) > 0
        ? { amount: parseFloat(requestedAmount) }
        : {}),
    });
  }, [currentUser, requestedAmount]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20) + 8;
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      {/* ─── Ultra-Sleek Executive Header ───────────────────────────────────── */}
      <LinearGradient colors={[T.navyDark, T.navy]} style={[s.header, { paddingTop: topPadding }]}>
        <View style={s.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.headerIconBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={T.white} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={s.headerTitle}>QR Pay & Transfer</Text>
            <Text style={s.headerSubtitle}>Instant Zero-Fee P2P Settlements</Text>
          </View>

          {activeTab === 'scan' && permission?.granted ? (
            <TouchableOpacity
              onPress={() => setTorchEnabled(!torchEnabled)}
              style={[s.headerIconBtn, torchEnabled && { backgroundColor: T.gold }]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={torchEnabled ? 'flash' : 'flash-outline'}
                size={18}
                color={torchEnabled ? T.navyDark : T.white}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setManualModalVisible(true)}
              style={s.headerIconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={18} color={T.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* ─── 2-Tab Segmented Controller ───────────────────────────────────── */}
        <View style={s.tabContainer}>
          <TouchableOpacity
            style={[s.tabButton, activeTab === 'scan' && s.tabButtonActive]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setActiveTab('scan');
              resetScanner();
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="scan"
              size={17}
              color={activeTab === 'scan' ? T.navyDark : T.slate400}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.tabButtonText, activeTab === 'scan' && s.tabButtonTextActive]}>
              Scan to Pay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabButton, activeTab === 'mycode' && s.tabButtonActive]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setActiveTab('mycode');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="qr-code"
              size={17}
              color={activeTab === 'mycode' ? T.navyDark : T.slate400}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.tabButtonText, activeTab === 'mycode' && s.tabButtonTextActive]}>
              My QR Pass
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ─── Main Content Views ────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'scan' ? (
          /* ══════════════════════════════════════════════════════════════════
             TAB 1: SCAN TO PAY (CAMERA VIEW & TOOLS)
             ══════════════════════════════════════════════════════════════════ */
          <View style={s.scanTabWrapper}>
            {/* Viewfinder Frame */}
            <View style={s.viewfinderContainer}>
              {permission?.granted ? (
                <View style={StyleSheet.absoluteFillObject}>
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    enableTorch={torchEnabled}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                  />

                  {/* Laser Scanning Beam */}
                  {!scanned && (
                    <Animated.View
                      style={[
                        s.laserBeam,
                        {
                          transform: [
                            {
                              translateY: laserAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [24, 216],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}

                  {/* Corner Targets */}
                  <View style={s.viewfinderCorners}>
                    <View style={[s.cornerBracket, s.cornerTL]} />
                    <View style={[s.cornerBracket, s.cornerTR]} />
                    <View style={[s.cornerBracket, s.cornerBL]} />
                    <View style={[s.cornerBracket, s.cornerBR]} />
                  </View>

                  {/* Instructional Tip Overlay */}
                  <View style={s.viewfinderHint}>
                    <Ionicons name="sparkles" size={13} color={T.gold} style={{ marginRight: 5 }} />
                    <Text style={s.viewfinderHintText}>
                      {scanned ? "Processing code..." : "Align QR code inside the frame"}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Permission Request Card */
                <View style={s.permissionBox}>
                  <View style={s.permissionIconRing}>
                    <Ionicons name="camera" size={32} color={T.gold} />
                  </View>
                  <Text style={s.permissionTitle}>Camera Access Required</Text>
                  <Text style={s.permissionSubtitle}>
                    Grant camera permission to instantly scan Abu Mafhal merchant and peer QR codes.
                  </Text>
                  <TouchableOpacity
                    onPress={requestPermission}
                    style={s.permissionBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={s.permissionBtnText}>Enable Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Quick Action Buttons Below Camera */}
            <View style={s.actionRow}>
              <TouchableOpacity
                onPress={handlePickFromGallery}
                style={s.actionCard}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconBadge, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
                  {isAnalyzingImage ? (
                    <ActivityIndicator size="small" color={T.gold} />
                  ) : (
                    <Ionicons name="images" size={20} color={T.gold} />
                  )}
                </View>
                <Text style={s.actionCardTitle}>From Gallery</Text>
                <Text style={s.actionCardSubtitle}>Scan QR from Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setManualModalVisible(true)}
                style={s.actionCard}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="search" size={20} color={T.emerald} />
                </View>
                <Text style={s.actionCardTitle}>Manual Search</Text>
                <Text style={s.actionCardSubtitle}>Pay via Phone or Email</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Payees Quick Row */}
            {recentPayees.length > 0 && (
              <View style={s.recentPayeesSection}>
                <Text style={s.sectionHeading}>RECENT RECIPIENTS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.recentPayeesRow}>
                  {recentPayees.map((rec) => (
                    <TouchableOpacity
                      key={rec.id}
                      style={s.recentPayeeChip}
                      onPress={() => handleProcessRecipient(rec.id)}
                      activeOpacity={0.7}
                    >
                      <View style={s.recentAvatarCircle}>
                        <Text style={s.recentAvatarText}>
                          {(rec.name || 'M')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={s.recentPayeeName} numberOfLines={1}>
                        {(rec.name || '').split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Security Guarantee Banner */}
            <View style={s.securityBanner}>
              <Ionicons name="shield-checkmark" size={18} color={T.emerald} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.securityBannerTitle}>Protected by 256-Bit P2P Security</Text>
                <Text style={s.securityBannerSubtitle}>
                  Zero transfer fees. Payments are debited and credited instantly.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             TAB 2: MY QR PASS (EXECUTIVE RECEIVE CARD)
             ══════════════════════════════════════════════════════════════════ */
          <View style={s.myCodeTabWrapper}>
            {/* Luxury Executive Pass Card */}
            <LinearGradient
              colors={[T.navyDark, T.navy, T.navyMid]}
              style={s.executiveCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Card Header */}
              <View style={s.cardHeader}>
                <View style={s.brandLogoWrapper}>
                  <Image
                    source={require('../../assets/images/logo.png')}
                    style={s.brandLogoImg}
                    resizeMode="contain"
                  />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={s.brandTitle}>ABU MAFHAL HUB</Text>
                    <Text style={s.brandBadge}>OFFICIAL VIP PAYMENT PASS</Text>
                  </View>
                </View>

                <View style={s.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={11} color={T.gold} style={{ marginRight: 4 }} />
                  <Text style={s.verifiedTagText}>Verified</Text>
                </View>
              </View>

              {/* User Account Info */}
              <View style={s.cardUserInfo}>
                <Text style={s.userNameText}>{currentUser?.full_name || 'Valued Member'}</Text>
                <Text style={s.userEmailText}>{currentUser?.email || 'user@abumafhalsub.com'}</Text>
              </View>

              {/* Wallet ID Pill with 1-Tap Copy */}
              <TouchableOpacity
                onPress={handleCopyWalletId}
                style={s.walletIdPill}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.walletIdLabel}>WALLET ID: </Text>
                  <Text style={s.walletIdValue}>
                    {currentUser?.id
                      ? `MAF-${currentUser.id.substring(0, 8).toUpperCase()}`
                      : 'MAF-ACCOUNT'}
                  </Text>
                </View>
                <Ionicons name="copy-outline" size={14} color={T.gold} style={{ marginLeft: 8 }} />
              </TouchableOpacity>

              {/* The Razor-Sharp QR Code Card */}
              <View style={s.qrWrapperCard}>
                <SafeQRCode value={myCodePayload} size={190} />
              </View>

              {/* Dynamic Requested Amount Tag */}
              {requestedAmount && parseFloat(requestedAmount) > 0 ? (
                <View style={s.requestedRibbon}>
                  <Ionicons name="pricetag" size={13} color={T.navyDark} style={{ marginRight: 6 }} />
                  <Text style={s.requestedRibbonText}>
                    Requesting: ₦{safeFormatCurrency(requestedAmount)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setRequestedAmount('')}
                    style={s.requestedRibbonClose}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={13} color={T.navyDark} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setTempAmountInput('');
                    setAmountModalVisible(true);
                  }}
                  style={s.setAmountBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={14} color={T.gold} style={{ marginRight: 5 }} />
                  <Text style={s.setAmountBtnText}>Request Specific Amount (₦)</Text>
                </TouchableOpacity>
              )}

              {/* Card Footer Security Seal */}
              <View style={s.cardFooter}>
                <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.4)" style={{ marginRight: 4 }} />
                <Text style={s.cardFooterText}>Secured by Abu Mafhal Automated Core</Text>
              </View>
            </LinearGradient>

            {/* Quick Card Action Buttons */}
            <View style={s.cardActionRow}>
              <TouchableOpacity
                onPress={handleShareMyCode}
                style={s.primaryActionBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[T.gold, T.goldDark]}
                  style={s.primaryActionGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="share-social" size={17} color={T.navyDark} style={{ marginRight: 8 }} />
                  <Text style={s.primaryActionText}>Share QR Pass</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyWalletId}
                style={s.secondaryActionBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={17} color={T.navy} style={{ marginRight: 8 }} />
                <Text style={s.secondaryActionText}>Copy ID</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── Toast for Copied ID ────────────────────────────────────────────── */}
      {copiedToast && (
        <View style={s.toastPill}>
          <Ionicons name="checkmark-circle" size={16} color={T.emerald} style={{ marginRight: 6 }} />
          <Text style={s.toastText}>Wallet ID copied to clipboard!</Text>
        </View>
      )}

      {/* ─── MODAL 1: Payment Confirmation & Amount Input ────────────────────── */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setConfirmModalVisible(false);
          resetScanner();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.confirmModalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalHeading}>Confirm Transfer</Text>

            {/* Recipient Details Badge */}
            {recipientUser && (
              <View style={s.recipientBadge}>
                <LinearGradient colors={[T.gold, T.goldDark]} style={s.recipientAvatarRing}>
                  <View style={s.recipientAvatarInner}>
                    <Text style={s.recipientAvatarLetter}>
                      {(recipientUser.full_name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                </LinearGradient>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.recipientFullName} numberOfLines={1}>
                    {recipientUser.full_name || 'Abu Mafhal User'}
                  </Text>
                  <Text style={s.recipientSubtext} numberOfLines={1}>
                    {recipientUser.email || recipientUser.phone || 'Verified Account'}
                  </Text>
                </View>
              </View>
            )}

            {/* Amount Field */}
            <Text style={s.inputLabel}>AMOUNT TO SEND (₦)</Text>
            <View style={s.amountInputRow}>
              <Text style={s.nairaPrefix}>₦</Text>
              <TextInput
                style={s.amountInputField}
                keyboardType="numeric"
                value={transferAmount}
                onChangeText={setTransferAmount}
                placeholder="0.00"
                placeholderTextColor={T.slate400}
                autoFocus
              />
            </View>

            {/* Quick Amount Chips */}
            <View style={s.chipRow}>
              {['500', '1000', '2000', '5000'].map((chip) => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setTransferAmount(chip);
                  }}
                  style={[s.amountChip, transferAmount === chip && s.amountChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.amountChipText, transferAmount === chip && s.amountChipTextActive]}>
                    ₦{safeFormatCurrency(chip)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  setTransferAmount(userBalance > 0 ? String(userBalance) : '0');
                }}
                style={[s.amountChip, s.maxChip]}
                activeOpacity={0.7}
              >
                <Text style={s.maxChipText}>Max</Text>
              </TouchableOpacity>
            </View>

            {/* Balance Indicator */}
            <View style={s.balanceRow}>
              <Ionicons name="wallet-outline" size={13} color={T.gold} style={{ marginRight: 4 }} />
              <Text style={s.balanceInfoText}>
                Wallet Balance: <Text style={{ fontWeight: '800', color: T.navy }}>₦{safeFormatCurrency(userBalance)}</Text>
              </Text>
            </View>

            {/* Optional Note Field */}
            <Text style={s.inputLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={s.noteInput}
              value={transferNote}
              onChangeText={setTransferNote}
              placeholder="e.g. Dinner, groceries, subscription"
              placeholderTextColor={T.slate400}
              maxLength={40}
            />

            {/* Modal Actions */}
            <View style={s.modalActionRow}>
              <TouchableOpacity
                onPress={() => {
                  setConfirmModalVisible(false);
                  resetScanner();
                }}
                style={s.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleProceedToPin}
                style={s.modalSubmitBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[T.gold, T.goldDark]}
                  style={s.modalSubmitGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={s.modalSubmitText}>Proceed to Pay</Text>
                  <Ionicons name="arrow-forward" size={15} color={T.navyDark} style={{ marginLeft: 6 }} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL 2: Manual Recipient Search ─────────────────────────────────── */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.manualModalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalHeading}>Pay by Details</Text>
            <Text style={s.manualModalSubtitle}>
              Enter recipient's phone number, email address, or Wallet ID (e.g. MAF-12345678).
            </Text>

            <TextInput
              style={s.manualInputField}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Phone, Email, or Wallet ID"
              placeholderTextColor={T.slate400}
              autoCapitalize="none"
              autoFocus
            />

            <View style={s.modalActionRow}>
              <TouchableOpacity
                onPress={() => setManualModalVisible(false)}
                style={s.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleManualSearch}
                style={s.modalSubmitBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[T.navy, T.navyMid]}
                  style={s.modalSubmitGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[s.modalSubmitText, { color: T.white }]}>Find Account</Text>
                  <Ionicons name="search" size={14} color={T.white} style={{ marginLeft: 6 }} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL 3: Set Requested Amount on QR ─────────────────────────────── */}
      <Modal
        visible={amountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAmountModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.manualModalCard}>
            <View style={s.modalHandle} />
            <Text style={s.modalHeading}>Request Specific Amount</Text>
            <Text style={s.manualModalSubtitle}>
              Anyone scanning your QR code will have this amount automatically filled in.
            </Text>

            <View style={s.amountInputRow}>
              <Text style={s.nairaPrefix}>₦</Text>
              <TextInput
                style={s.amountInputField}
                keyboardType="numeric"
                value={tempAmountInput}
                onChangeText={setTempAmountInput}
                placeholder="0.00"
                placeholderTextColor={T.slate400}
                autoFocus
              />
            </View>

            <View style={s.modalActionRow}>
              <TouchableOpacity
                onPress={() => setAmountModalVisible(false)}
                style={s.modalCancelBtn}
                activeOpacity={0.7}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setRequestedAmount(tempAmountInput);
                  setAmountModalVisible(false);
                }}
                style={s.modalSubmitBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[T.gold, T.goldDark]}
                  style={s.modalSubmitGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={s.modalSubmitText}>Apply to QR</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── MODAL 4: 4-Digit Security PIN Modal ─────────────────────────────── */}
      <SecurityModal
        visible={securityModalVisible}
        onClose={() => {
          setSecurityModalVisible(false);
          resetScanner();
        }}
        onSuccess={handleExecuteTransfer}
        title="Authorize QR Transfer"
        description={`Enter your 4-digit Transaction PIN to transfer ₦${safeFormatCurrency(transferAmount)} to ${recipientUser?.full_name || 'Recipient'}.`}
      />

      {/* ─── MODAL 5: Transaction Success & Receipt ──────────────────────────── */}
      <Modal
        visible={successModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSuccessModalVisible(false);
          resetScanner();
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.receiptCard}>
            <View style={s.receiptSuccessRing}>
              <Ionicons name="checkmark" size={32} color={T.white} />
            </View>

            <Text style={s.receiptHeading}>Transfer Successful!</Text>
            <Text style={s.receiptAmountText}>
              ₦{safeFormatCurrency(receiptData?.amount || 0)}
            </Text>

            <View style={s.receiptDetailsBox}>
              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Recipient</Text>
                <Text style={s.receiptValue}>{receiptData?.recipientName}</Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Reference</Text>
                <Text style={[s.receiptValue, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                  {receiptData?.ref}
                </Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Date & Time</Text>
                <Text style={s.receiptValue}>{safeFormatDate(receiptData?.date)}</Text>
              </View>

              <View style={s.receiptRow}>
                <Text style={s.receiptLabel}>Payment Type</Text>
                <Text style={s.receiptValue}>Instant P2P Transfer</Text>
              </View>

              <View style={[s.receiptRow, { borderBottomWidth: 0 }]}>
                <Text style={s.receiptLabel}>Status</Text>
                <View style={s.statusTag}>
                  <Text style={s.statusTagText}>SETTLED</Text>
                </View>
              </View>
            </View>

            <View style={s.modalActionRow}>
              <TouchableOpacity
                onPress={handleShareReceipt}
                style={s.receiptShareBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={16} color={T.navy} style={{ marginRight: 6 }} />
                <Text style={s.receiptShareText}>Share Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSuccessModalVisible(false);
                  resetScanner();
                }}
                style={s.receiptDoneBtn}
                activeOpacity={0.8}
              >
                <Text style={s.receiptDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Loading Overlay ─────────────────────────────────────────────────── */}
      {(isResolving || isProcessing) && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={T.gold} />
            <Text style={s.loadingText}>
              {isResolving ? 'Resolving recipient...' : 'Processing secure transfer...'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.slate100,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: T.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: T.gold,
  },
  tabButtonText: {
    color: T.slate400,
    fontSize: 13,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: T.navyDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ─── Tab 1: Scanner Styles ──────────────────────────────────────────────────
  scanTabWrapper: {
    alignItems: 'center',
  },
  viewfinderContainer: {
    width: '100%',
    height: 310,
    backgroundColor: T.navyDark,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.25)',
  },
  viewfinderCorners: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
  },
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: T.gold,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3.5, borderLeftWidth: 3.5, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3.5, borderRightWidth: 3.5, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3.5, borderLeftWidth: 3.5, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3.5, borderRightWidth: 3.5, borderBottomRightRadius: 10 },
  laserBeam: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2.5,
    backgroundColor: T.gold,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  viewfinderHint: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 11, 24, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  viewfinderHintText: {
    color: T.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  permissionTitle: {
    color: T.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  permissionSubtitle: {
    color: T.slate400,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  permissionBtn: {
    backgroundColor: T.gold,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: T.navyDark,
    fontSize: 13,
    fontWeight: '900',
  },

  // Action Cards Below Camera
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 14,
  },
  actionCard: {
    flex: 1,
    backgroundColor: T.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: T.slate200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    color: T.slate900,
    fontSize: 13,
    fontWeight: '800',
  },
  actionCardSubtitle: {
    color: T.slate500,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },

  // Recent Payees
  recentPayeesSection: {
    width: '100%',
    marginTop: 18,
  },
  sectionHeading: {
    color: T.slate500,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  recentPayeesRow: {
    flexDirection: 'row',
  },
  recentPayeeChip: {
    alignItems: 'center',
    marginRight: 14,
    width: 60,
  },
  recentAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: T.gold,
    marginBottom: 4,
  },
  recentAvatarText: {
    color: T.gold,
    fontSize: 16,
    fontWeight: '900',
  },
  recentPayeeName: {
    color: T.slate700,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Security Banner
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginTop: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  securityBannerTitle: {
    color: T.emeraldDark,
    fontSize: 12,
    fontWeight: '800',
  },
  securityBannerSubtitle: {
    color: T.slate700,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },

  // ─── Tab 2: My QR Code Styles ───────────────────────────────────────────────
  myCodeTabWrapper: {
    alignItems: 'center',
  },
  executiveCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  brandLogoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  brandTitle: {
    color: T.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  brandBadge: {
    color: T.gold,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  verifiedTagText: {
    color: T.gold,
    fontSize: 9.5,
    fontWeight: '800',
  },
  cardUserInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  userNameText: {
    color: T.white,
    fontSize: 17,
    fontWeight: '900',
  },
  userEmailText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  walletIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    marginBottom: 16,
  },
  walletIdLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
  },
  walletIdValue: {
    color: T.gold,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrWrapperCard: {
    backgroundColor: T.white,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 14,
  },
  requestedRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
  },
  requestedRibbonText: {
    color: T.navyDark,
    fontSize: 11.5,
    fontWeight: '900',
  },
  requestedRibbonClose: {
    marginLeft: 6,
    padding: 2,
  },
  setAmountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 10,
  },
  setAmountBtnText: {
    color: T.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardFooterText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9.5,
    fontWeight: '600',
  },
  cardActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  primaryActionBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryActionGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: T.navyDark,
    fontSize: 13.5,
    fontWeight: '900',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: T.white,
    borderWidth: 1.5,
    borderColor: T.slate200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: T.navy,
    fontSize: 13,
    fontWeight: '800',
  },

  // Toast
  toastPill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.navyDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: T.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // ─── Modal Components ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 11, 24, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: T.slate200,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: T.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  manualModalCard: {
    width: '92%',
    backgroundColor: T.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 40,
  },
  modalHeading: {
    color: T.slate900,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 14,
  },
  manualModalSubtitle: {
    color: T.slate500,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.slate50,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.slate200,
    marginBottom: 16,
  },
  recipientAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: T.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarLetter: {
    color: T.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  recipientFullName: {
    color: T.slate900,
    fontSize: 14,
    fontWeight: '800',
  },
  recipientSubtext: {
    color: T.slate500,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inputLabel: {
    color: T.slate500,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: T.slate200,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: T.slate50,
    marginBottom: 10,
  },
  nairaPrefix: {
    color: T.goldDark,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 6,
  },
  amountInputField: {
    flex: 1,
    color: T.slate900,
    fontSize: 22,
    fontWeight: '900',
  },
  manualInputField: {
    borderWidth: 1.5,
    borderColor: T.slate200,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: T.slate50,
    color: T.slate900,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  amountChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: T.slate100,
    borderWidth: 1,
    borderColor: T.slate200,
    alignItems: 'center',
  },
  amountChipActive: {
    backgroundColor: T.goldLight,
    borderColor: T.gold,
  },
  amountChipText: {
    color: T.slate700,
    fontSize: 10.5,
    fontWeight: '800',
  },
  amountChipTextActive: {
    color: T.navyDark,
  },
  maxChip: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: T.gold,
  },
  maxChipText: {
    color: T.goldDark,
    fontSize: 11,
    fontWeight: '900',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  balanceInfoText: {
    color: T.slate500,
    fontSize: 11.5,
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: T.slate200,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: T.slate50,
    color: T.slate800,
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: T.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: T.slate700,
    fontSize: 13,
    fontWeight: '800',
  },
  modalSubmitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalSubmitGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: T.navyDark,
    fontSize: 13.5,
    fontWeight: '900',
  },

  // ─── Receipt Modal ──────────────────────────────────────────────────────────
  receiptCard: {
    width: '90%',
    backgroundColor: T.white,
    borderRadius: 26,
    padding: 22,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  receiptSuccessRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: T.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: T.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  receiptHeading: {
    color: T.slate900,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  receiptAmountText: {
    color: T.emeraldDark,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 16,
  },
  receiptDetailsBox: {
    width: '100%',
    backgroundColor: T.slate50,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.slate200,
    marginBottom: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: T.slate200,
  },
  receiptLabel: {
    color: T.slate500,
    fontSize: 11,
    fontWeight: '700',
  },
  receiptValue: {
    color: T.slate800,
    fontSize: 12,
    fontWeight: '800',
  },
  statusTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTagText: {
    color: T.emeraldDark,
    fontSize: 10,
    fontWeight: '900',
  },
  receiptShareBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: T.slate100,
    borderWidth: 1,
    borderColor: T.slate200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptShareText: {
    color: T.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  receiptDoneBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: T.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDoneText: {
    color: T.white,
    fontSize: 13,
    fontWeight: '800',
  },

  // ─── Loading Overlay ────────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 11, 24, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: T.navyMid,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  loadingText: {
    color: T.white,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
});
