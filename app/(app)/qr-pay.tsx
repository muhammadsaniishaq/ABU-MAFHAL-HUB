import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, Alert, Modal, TextInput, Share, Vibration, Image, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import SecurityModal from '../../components/SecurityModal';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import ViewShot from 'react-native-view-shot';

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

export default function QRPayScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const [activeTab, setActiveTab] = useState<'scan' | 'mycode'>('scan');
    const [permission, requestPermission] = useCameraPermissions();
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    
    // User data
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userBalance, setUserBalance] = useState(0);
    
    // Transaction UI states
    const [scannedUser, setScannedUser] = useState<any>(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [securityModalVisible, setSecurityModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Manual Input states
    const [manualInputVisible, setManualInputVisible] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [isVerifyingManual, setIsVerifyingManual] = useState(false);
    
    // Gallery Upload states
    const [isReadingGallery, setIsReadingGallery] = useState(false);
    const [isSharingReceipt, setIsSharingReceipt] = useState(false);
    
    // Form Inputs
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    // Scanner animation & Flyer Ref
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const flyerRef = useRef<ViewShot>(null);

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'scan' && permission?.granted && isFocused && !scanned) {
            // Laser line looping animation
            scanLineAnim.setValue(0);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanLineAnim, {
                        toValue: 240,
                        duration: 2500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanLineAnim, {
                        toValue: 0,
                        duration: 2500,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        } else {
            scanLineAnim.stopAnimation();
        }
    }, [activeTab, permission, isFocused, scanned]);

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, balance, avatar_url')
                    .eq('id', user.id)
                    .single();
                if (profile) {
                    setCurrentUser(profile);
                    setUserBalance(parseFloat(profile.balance?.toString() || '0'));
                }
            }
        } catch (e) {
            console.error("Error loading user profile:", e);
        }
    };

    const handleShareMyCode = async () => {
        if (!currentUser) return;
        
        setIsSubmitting(true);
        try {
            // Use ViewShot to capture the beautifully rendered native UI into a high-quality PNG
            if (flyerRef.current && flyerRef.current.capture) {
                const uri = await flyerRef.current.capture();
                
                if (Platform.OS === 'web') {
                    // On Web, trigger a download of the captured PNG image
                    const link = document.createElement('a');
                    link.href = uri;
                    link.download = `mafhal_pay_qr_${currentUser.full_name.replace(/\s+/g, '_')}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    // On Mobile, share the captured PNG directly
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: `Pay ${currentUser.full_name} - Mafhal Sub`,
                    });
                }
            } else {
                throw new Error("Unable to capture QR Flyer");
            }
        } catch (error: any) {
            console.error("Flyer share error:", error);
            // Fallback to text sharing
            try {
                await Share.share({
                    title: `Pay ${currentUser.full_name}`,
                    message: `Assalamu alaikum, scan this QR code or use my email to send me money instantly on Mafhal Sub:\n\n👤 Name: ${currentUser.full_name}\n📧 Email: ${currentUser.email}`,
                });
            } catch (fallbackError: any) {
                Alert.alert("Share Error", fallbackError.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUploadFromGallery = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("Permission Denied", "We need access to your gallery to upload QR images.");
                return;
            }

            const pickerResult = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 1,
            });

            if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
                return;
            }

            const selectedImage = pickerResult.assets[0];
            setIsReadingGallery(true);

            // Create form data to send to the qrserver decoding API
            const formData = new FormData();
            
            if (Platform.OS === 'web') {
                const response = await fetch(selectedImage.uri);
                const blob = await response.blob();
                formData.append('file', blob, 'qr.png');
            } else {
                formData.append('file', {
                    uri: selectedImage.uri,
                    name: 'qr.png',
                    type: 'image/png',
                } as any);
            }

            const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            setIsReadingGallery(false);

            const qrText = result[0]?.symbol[0]?.data;
            if (qrText) {
                onBarcodeScanned({ data: qrText });
            } else {
                Alert.alert("Scan Failed", "No valid QR code was detected in the selected image. Please make sure it is clear.");
            }
        } catch (e: any) {
            setIsReadingGallery(false);
            console.error("Gallery scan error:", e);
            Alert.alert("Scan Error", "Failed to scan QR code from gallery. Check your network connection.");
        }
    };

    const onBarcodeScanned = async ({ data }: { data: string }) => {
        if (scanned || confirmModalVisible || successModalVisible) return;
        setScanned(true);
        setCameraActive(false);
        Vibration.vibrate(100);
        
        try {
            let userId = '';
            let email = '';
            
            try {
                const parsed = JSON.parse(data);
                if (parsed.userId) {
                    userId = parsed.userId;
                    email = parsed.email || '';
                }
            } catch (jsonErr) {
                const trimmedData = data.trim();
                if (trimmedData.includes('@')) {
                    email = trimmedData.toLowerCase();
                } else if (trimmedData.length === 36) {
                    userId = trimmedData;
                } else {
                    email = trimmedData.toLowerCase();
                }
            }

            let query = supabase.from('profiles').select('id, full_name, email, avatar_url');
            if (userId) {
                query = query.eq('id', userId);
            } else if (email) {
                query = query.eq('email', email);
            } else {
                Alert.alert("Invalid QR", "This QR code does not contain a valid user ID or email.", [
                    { text: "OK", onPress: () => setScanned(false) }
                ]);
                return;
            }

            const { data: recipient, error } = await query.maybeSingle();
            
            if (error || !recipient) {
                Alert.alert("User Not Found", "No registered user was found matching this QR code.", [
                    { text: "OK", onPress: () => setScanned(false) }
                ]);
                return;
            }

            if (currentUser && recipient.id === currentUser.id) {
                Alert.alert("Scan Error", "You cannot transfer money to yourself!", [
                    { text: "OK", onPress: () => setScanned(false) }
                ]);
                return;
            }

            setScannedUser({
                userId: recipient.id,
                name: recipient.full_name,
                email: recipient.email,
                avatarUrl: recipient.avatar_url
            });
            setConfirmModalVisible(true);
        } catch (err: any) {
            Alert.alert("Scan Error", "Failed to process QR code details.", [
                { text: "OK", onPress: () => setScanned(false) }
            ]);
        }
    };

    const handleVerifyManualRecipient = async () => {
        if (!manualInput) {
            Alert.alert("Error", "Please enter an email address.");
            return;
        }
        
        setIsVerifyingManual(true);
        try {
            const { data: recipient, error } = await supabase.rpc('find_profile_by_email', {
                email_query: manualInput.trim().toLowerCase()
            });
                
            if (error) throw error;
            
            if (!recipient) {
                Alert.alert("Not Found", "No user found with this email address. Please make sure the email is typed correctly.");
                return;
            }

            if (currentUser && recipient.id === currentUser.id) {
                Alert.alert("Error", "You cannot transfer money to yourself!");
                return;
            }

            setScannedUser({
                userId: recipient.id,
                name: recipient.full_name,
                email: recipient.email,
                avatarUrl: recipient.avatar_url
            });
            setManualInputVisible(false);
            setManualInput('');
            setConfirmModalVisible(true);
        } catch (e: any) {
            Alert.alert("Verification Failed", e.message || "An error occurred.");
        } finally {
            setIsVerifyingManual(false);
        }
    };

    const handleConfirmTransfer = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }

        const transferAmt = parseFloat(amount);
        if (transferAmt > userBalance) {
            Alert.alert("Insufficient Balance", `Your balance is ₦${userBalance.toLocaleString()}, which is less than ₦${transferAmt.toLocaleString()}.`);
            return;
        }

        setConfirmModalVisible(false);
        setSecurityModalVisible(true);
    };

    const executeTransfer = async () => {
        setSecurityModalVisible(false);
        setIsSubmitting(true);
        
        try {
            const transferAmt = parseFloat(amount);
            const senderId = currentUser.id;
            const recipientId = scannedUser.userId;

            const { data, error } = await supabase.rpc('execute_wallet_transfer', {
                sender_id: senderId,
                target_id: recipientId,
                amount: transferAmt,
                note: description
            });

            if (error) throw error;

            Vibration.vibrate([0, 100, 50, 100]);
            
            // Refresh local balance
            await loadUserProfile();
            
            setSuccessModalVisible(true);
        } catch (e: any) {
            Alert.alert("Transfer Failed", e.message || "An error occurred during payment.");
            setScanned(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuccessDone = () => {
        setSuccessModalVisible(false);
        setAmount('');
        setDescription('');
        setScanned(false);
        setCameraActive(false);
        setScannedUser(null);
    };

    const handleShareReceipt = async () => {
        if (!scannedUser || !amount || isSharingReceipt) return;
        
        setIsSharingReceipt(true);
        const transferAmt = parseFloat(amount);
        const formattedAmount = transferAmt.toLocaleString('en-US', { minimumFractionDigits: 2 });
        const dateStr = new Date().toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const reference = 'QR-' + Math.floor(Date.now() / 1000);
        
        // 1. Download logo asset locally for rendering inside the document
        let logoSrc = '';
        try {
            const logoAsset = Asset.fromModule(require('../../assets/images/logo.png'));
            await logoAsset.downloadAsync();
            logoSrc = logoAsset.localUri || logoAsset.uri;
        } catch (logoErr) {
            console.error("Failed to load logo asset:", logoErr);
        }

        // 2. Prepare profile photos (avatars) for both Sender and Recipient
        const senderName = currentUser?.full_name || 'Mafhal User';
        const senderEmail = currentUser?.email || 'sender@abumafhal.com.ng';
        const senderAvatarHtml = currentUser?.avatar_url
            ? `<img src="${currentUser.avatar_url}" class="profile-avatar" />`
            : `<div class="profile-avatar-placeholder">${senderName[0].toUpperCase()}</div>`;

        const recipientName = scannedUser.name;
        const recipientEmail = scannedUser.email || '-';
        const recipientAvatarHtml = scannedUser.avatarUrl
            ? `<img src="${scannedUser.avatarUrl}" class="profile-avatar" />`
            : `<div class="profile-avatar-placeholder">${recipientName[0].toUpperCase()}</div>`;

        // 3. Construct the full PDF HTML receipt document mirroring the Jobber template structure
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Transaction Receipt</title>
                <style>
                    body {
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        margin: 0;
                        padding: 30px;
                        color: #1e293b;
                        background-color: #ffffff;
                        -webkit-print-color-adjust: exact;
                    }
                    .container {
                        max-width: 640px;
                        margin: 0 auto;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 28px;
                    }
                    .brand-info {
                        display: flex;
                        flex-direction: column;
                    }
                    .logo-container {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .logo-img {
                        width: 44px;
                        height: 44px;
                        border-radius: 22px;
                        background-color: #0d1b3e;
                        margin-right: 10px;
                    }
                    .brand-name {
                        font-size: 20px;
                        font-weight: 800;
                        color: #0d1b3e;
                    }
                    .brand-address, .brand-contact {
                        font-size: 11px;
                        color: #475569;
                        margin: 1px 0;
                    }
                    .meta-box {
                        width: 220px;
                        border: 1px solid #cbd5e1;
                        border-radius: 4px;
                        overflow: hidden;
                    }
                    .meta-header {
                        background-color: #7cae12;
                        color: #ffffff;
                        padding: 8px 10px;
                        font-size: 12.5px;
                        font-weight: 800;
                    }
                    .meta-body {
                        background-color: #f1f5f9;
                        padding: 6px 10px;
                        font-size: 10.5px;
                        font-weight: 600;
                        color: #334155;
                    }
                    .profiles-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 28px;
                        gap: 12px;
                    }
                    .profile-card {
                        flex: 1;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 12px;
                        background-color: #f8fafc;
                        display: flex;
                        align-items: center;
                    }
                    .profile-avatar {
                        width: 50px;
                        height: 50px;
                        border-radius: 25px;
                        border: 2.5px solid #7cae12;
                        margin-right: 12px;
                        object-fit: cover;
                        background-color: #cbd5e1;
                    }
                    .profile-avatar-placeholder {
                        width: 50px;
                        height: 50px;
                        border-radius: 25px;
                        border: 2.5px solid #7cae12;
                        margin-right: 12px;
                        background-color: #0d1b3e;
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        font-weight: bold;
                    }
                    .profile-info {
                        display: flex;
                        flex-direction: column;
                    }
                    .profile-role {
                        font-size: 8px;
                        font-weight: 800;
                        color: #7cae12;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                        letter-spacing: 0.5px;
                    }
                    .profile-name {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0f172a;
                        margin-bottom: 2px;
                    }
                    .profile-email {
                        font-size: 10px;
                        color: #475569;
                    }
                    .transfer-arrow {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #7cae12;
                        font-size: 18px;
                        font-weight: bold;
                        width: 24px;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 28px;
                    }
                    .table th {
                        background-color: #7cae12;
                        color: #ffffff;
                        padding: 8px 10px;
                        font-size: 10px;
                        font-weight: 800;
                        text-align: left;
                        text-transform: uppercase;
                    }
                    .table td {
                        padding: 12px 10px;
                        font-size: 11px;
                        border-bottom: 1px solid #cbd5e1;
                        vertical-align: top;
                    }
                    .font-bold {
                        font-weight: 700;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .bottom-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 36px;
                    }
                    .thanks-msg {
                        font-size: 12px;
                        color: #475569;
                        font-style: italic;
                    }
                    .totals-box {
                        width: 220px;
                    }
                    .totals-title {
                        font-size: 13px;
                        font-weight: 800;
                        color: #334155;
                        margin-bottom: 8px;
                    }
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        padding: 4px 0;
                    }
                    .totals-label {
                        color: #64748b;
                    }
                    .totals-value {
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .divider {
                        height: 1px;
                        background-color: #cbd5e1;
                        margin: 4px 0;
                    }
                    .footer {
                        border-top: 1px solid #f1f5f9;
                        padding-top: 18px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }
                    .powered-label {
                        font-size: 8px;
                        font-weight: 700;
                        color: #94a3b8;
                        letter-spacing: 1px;
                        margin-bottom: 2px;
                    }
                    .powered-brand {
                        display: flex;
                        align-items: center;
                        font-size: 10px;
                        font-weight: 800;
                        color: #475569;
                        letter-spacing: 1px;
                    }
                    .powered-logo {
                        width: 12px;
                        height: 12px;
                        margin-right: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="brand-info">
                            <div class="logo-container">
                                ${logoSrc ? `<img src="${logoSrc}" class="logo-img" />` : ''}
                                <span class="brand-name">Mafhal Sub</span>
                            </div>
                            <div class="brand-address">Plot 124, Gwarinpa Road, Kano, Nigeria</div>
                            <div class="brand-contact">+234 803 123 4567 | hello@abumafhal.com.ng</div>
                        </div>
                        <div class="meta-box">
                            <div class="meta-header">Receipt for #${reference}</div>
                            <div class="meta-body">Transaction Date: ${dateStr}</div>
                        </div>
                    </div>

                    <!-- PROFILES WITH SENDER AND RECIPIENT FACES -->
                    <div class="profiles-section">
                        <!-- Sender -->
                        <div class="profile-card">
                            ${senderAvatarHtml}
                            <div class="profile-info">
                                <span class="profile-role">Sender</span>
                                <span class="profile-name">${senderName}</span>
                                <span class="profile-email">${senderEmail}</span>
                            </div>
                        </div>
                        
                        <!-- Arrow -->
                        <div class="transfer-arrow">⚡</div>

                        <!-- Recipient -->
                        <div class="profile-card">
                            ${recipientAvatarHtml}
                            <div class="profile-info">
                                <span class="profile-role">Recipient</span>
                                <span class="profile-name">${recipientName}</span>
                                <span class="profile-email">${recipientEmail}</span>
                            </div>
                        </div>
                    </div>

                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 25%">Product / Service</th>
                                <th style="width: 40%">Description</th>
                                <th style="width: 10%" class="text-center">Qty.</th>
                                <th style="width: 12.5%" class="text-right">Cost</th>
                                <th style="width: 12.5%" class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="font-bold">Wallet Transfer</td>
                                <td style="color: #475569; font-size: 11px; line-height: 1.4">
                                    Instant secure peer-to-peer wallet transfer to ${recipientName}.
                                </td>
                                <td class="text-center">1</td>
                                <td class="text-right">₦${formattedAmount}</td>
                                <td class="text-right font-bold">₦${formattedAmount}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="bottom-section">
                        <div class="thanks-msg">Thanks for your business!</div>
                        <div class="totals-box">
                            <div class="totals-title">Receipt for Payment</div>
                            <div class="totals-row">
                                <span class="totals-label">Subtotal</span>
                                <span class="totals-value">₦${formattedAmount}</span>
                            </div>
                            <div class="totals-row">
                                <span class="totals-label">Fee (0%)</span>
                                <span class="totals-value">₦0.00</span>
                            </div>
                            <div class="divider"></div>
                            <div class="totals-row" style="margin-top: 4px;">
                                <span class="totals-label font-bold" style="font-size: 14px; color: #0f172a;">Total</span>
                                <span class="totals-value font-bold" style="font-size: 14px; color: #0f172a;">₦${formattedAmount}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="powered-label">POWERED BY</div>
                        <div class="powered-brand">
                            ${logoSrc ? `<img src="${logoSrc}" class="powered-logo" />` : ''}
                            <span>MAFHAL SUB</span>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        try {
            if (Platform.OS === 'web') {
                // On Web, trigger native print / save as PDF dialog directly in the browser
                await Print.printAsync({ html });
            } else {
                // On Mobile (Android/iOS), print the HTML to a PDF file locally, then share the PDF file!
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri, {
                    UTI: '.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: `Mafhal Sub Receipt - Ref: ${reference}`,
                });
            }
        } catch (error: any) {
            console.error("PDF Receipt share error:", error);
            // Fallback to text sharing if PDF printing/sharing fails
            try {
                const receiptText = `*MAFHAL SUB - TRANSACTION RECEIPT*\n\n` +
                    `👤 *Sender*: ${senderName}\n` +
                    `👤 *Recipient*: ${recipientName}\n` +
                    `📧 *Email*: ${recipientEmail}\n` +
                    `💵 *Amount*: ₦${formattedAmount}\n` +
                    `📅 *Date*: ${dateStr}\n` +
                    `📌 *Ref*: ${reference}\n` +
                    `⚡ *Status*: SUCCESSFUL\n\n` +
                    `Secured by Mafhal Sub Transfer System.`;
                
                await Share.share({
                    title: `Transaction Receipt`,
                    message: receiptText,
                });
            } catch (fallbackError: any) {
                Alert.alert("Share Error", fallbackError.message);
            }
        } finally {
            setIsSharingReceipt(false);
        }
    };

    if (!permission) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#0056D2" />
            </View>
        );
    }

    // Build user QR code payload
    const myCodePayload = currentUser ? JSON.stringify({
        type: 'transfer',
        userId: currentUser.id,
        name: currentUser.full_name,
        email: currentUser.email
    }) : '';

    return (
        <View className="flex-1 bg-[#f4f6fb]">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Premium Curved Header */}
            <LinearGradient 
              colors={['#060d21', '#0d1b3e']} 
              style={s.headerContainer}
            >
              <View style={s.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="white" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.headerTitle}>QR Payment</Text>
                  <Text style={s.headerBalance}>₦{userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={{ width: 32 }} />
              </View>

              {/* Tab Switcher */}
              <View style={s.tabContainer}>
                <TouchableOpacity
                    onPress={() => { setActiveTab('scan'); setCameraActive(false); }}
                    style={[s.tabItem, activeTab === 'scan' && s.tabItemActive]}
                >
                    <Text style={[s.tabText, activeTab === 'scan' && s.tabTextActive]}>Scan Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { setActiveTab('mycode'); setCameraActive(false); }}
                    style={[s.tabItem, activeTab === 'mycode' && s.tabItemActive]}
                >
                    <Text style={[s.tabText, activeTab === 'mycode' && s.tabTextActive]}>My QR Code</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {activeTab === 'scan' ? (
                <View style={{ flex: 1, marginTop: -16 }}>
                    {!cameraActive ? (
                        <ScrollView contentContainerStyle={s.scanDashboardContainer} className="flex-1 px-6 pt-8 pb-12">
                            {/* Glassmorphic card for QR options */}
                            <LinearGradient
                                colors={['#102258', '#0b163a']}
                                style={s.dashboardCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={s.dashboardCardHeader}>
                                    <View style={s.dashboardIconWrapper}>
                                        <Ionicons name="qr-code-outline" size={28} color="#f5a623" />
                                    </View>
                                    <Text style={s.dashboardCardTitle}>Instant QR Transfer</Text>
                                    <Text style={s.dashboardCardSub}>Select how you want to initiate your payment.</Text>
                                </View>

                                {/* Option 1: Scan with Camera */}
                                <TouchableOpacity 
                                    onPress={async () => {
                                        if (!permission?.granted) {
                                            const res = await requestPermission();
                                            if (res.granted) {
                                                setCameraActive(true);
                                            }
                                        } else {
                                            setCameraActive(true);
                                        }
                                    }}
                                    style={s.dashboardOptionBtn}
                                    activeOpacity={0.8}
                                >
                                    <View style={s.optionIconWrapper}>
                                        <Ionicons name="camera" size={22} color="white" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.optionTitle}>Scan QR Code</Text>
                                        <Text style={s.optionSub}>Use camera to scan recipient's code</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>

                                {/* Option 2: Upload from Gallery */}
                                <TouchableOpacity 
                                    onPress={handleUploadFromGallery}
                                    style={s.dashboardOptionBtn}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.optionIconWrapper, { backgroundColor: '#10b981' }]}>
                                        <Ionicons name="image" size={22} color="white" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.optionTitle}>Upload from Gallery</Text>
                                        <Text style={s.optionSub}>Select a QR image from your photos</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>

                                {/* Option 3: Pay via Email */}
                                <TouchableOpacity 
                                    onPress={() => setManualInputVisible(true)}
                                    style={s.dashboardOptionBtn}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.optionIconWrapper, { backgroundColor: '#4f46e5' }]}>
                                        <Ionicons name="mail" size={22} color="white" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.optionTitle}>Pay via Email</Text>
                                        <Text style={s.optionSub}>Type registered email manually</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Info Section */}
                            <View className="mt-8 bg-white p-5 rounded-2xl border border-slate-100 flex-row items-start">
                                <Ionicons name="shield-checkmark" size={20} color="#0056D2" style={{ marginTop: 2, marginRight: 10 }} />
                                <View className="flex-1">
                                    <Text className="text-slate-800 font-bold text-sm mb-1">Secure Payments</Text>
                                    <Text className="text-slate-400 text-xs font-semibold leading-relaxed">
                                        All transactions are fully encrypted. Funds are transferred instantly to the recipient's wallet balance.
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>
                    ) : !permission?.granted ? (
                        <View style={s.permissionCard}>
                            <TouchableOpacity 
                                onPress={() => setCameraActive(false)}
                                style={{ position: 'absolute', top: 20, right: 20 }}
                            >
                                <Ionicons name="close" size={24} color="#0d1b3e" />
                            </TouchableOpacity>
                            <View style={s.permissionIconWrapper}>
                                <Ionicons name="camera-outline" size={48} color="#0056D2" />
                            </View>
                            <Text style={s.permissionTitle}>Camera Access Required</Text>
                            <Text style={s.permissionDesc}>
                                We need access to your camera to scan QR codes for instant wallet payments.
                            </Text>
                            
                            <TouchableOpacity 
                                onPress={requestPermission}
                                style={s.grantBtn}
                                activeOpacity={0.9}
                            >
                                <LinearGradient colors={['#0056D2', '#1e40af']} style={s.gradientBtn} start={{x:0, y:0}} end={{x:1, y:0}}>
                                    <Text style={s.grantBtnText}>Grant Permission</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-1 bg-black relative">
                            {/* Render Camera ONLY when screen is focused to release GPU/camera hardware and prevent lag */}
                            {isFocused && !scanned ? (
                                <CameraView
                                    style={StyleSheet.absoluteFillObject}
                                    facing="back"
                                    enableTorch={torchEnabled}
                                    onBarcodeScanned={onBarcodeScanned}
                                    barcodeScannerSettings={{
                                        barcodeTypes: ["qr"],
                                    }}
                                />
                            ) : (
                                <View className="flex-1 items-center justify-center bg-black/95">
                                    <ActivityIndicator size="large" color="#f5a623" />
                                    <Text className="text-white font-bold mt-4">Processing scan...</Text>
                                </View>
                            )}

                            {/* Viewfinder overlay */}
                            {!scanned && (
                                <View style={s.overlayContainer}>
                                    {/* Top Overlay Section with back button inside camera */}
                                    <View style={s.overlayTop}>
                                        <TouchableOpacity 
                                            onPress={() => setCameraActive(false)}
                                            style={s.floatingBackBtn}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="close" size={24} color="white" />
                                        </TouchableOpacity>
                                        <Text style={s.cameraTitleText}>QR Scanner</Text>
                                    </View>
                                    <View style={s.overlayMiddle}>
                                        <View style={s.overlaySide} />
                                        <View style={s.scanWindow}>
                                            <View style={[s.corner, s.topLeft]} />
                                            <View style={[s.corner, s.topRight]} />
                                            <View style={[s.corner, s.bottomLeft]} />
                                            <View style={[s.corner, s.bottomRight]} />
                                            
                                            <Animated.View style={[s.laserLine, { transform: [{ translateY: scanLineAnim }] }]} />
                                        </View>
                                        <View style={s.overlaySide} />
                                    </View>
                                    <View style={s.overlayBottom}>
                                        <Text style={s.overlayText}>Align the QR code within the frame to pay</Text>
                                        
                                        <View style={s.buttonRow}>
                                            <TouchableOpacity 
                                                onPress={() => setTorchEnabled(!torchEnabled)}
                                                style={s.torchBtn}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name={torchEnabled ? "flash" : "flash-off"} size={14} color="white" />
                                                <Text style={s.torchBtnText}>{torchEnabled ? "Flash" : "Flash"}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                onPress={handleUploadFromGallery}
                                                style={s.torchBtn}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="image-outline" size={14} color="white" />
                                                <Text style={s.torchBtnText}>Gallery</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                onPress={() => setManualInputVisible(true)}
                                                style={s.torchBtn}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="create-outline" size={14} color="white" />
                                                <Text style={s.torchBtnText}>Email</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, marginTop: -16 }}>
                    {currentUser ? (
                        <>
                            <ViewShot ref={flyerRef} options={{ format: 'png', quality: 1 }}>
                                <LinearGradient 
                                    colors={['#102258', '#0b163a']} 
                                    style={s.myCodeCard}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <View style={s.myCodeWatermark}>
                                        <Image source={require('../../assets/images/logo.png')} style={{ width: '100%', height: '100%', opacity: 0.05 }} resizeMode="contain" />
                                    </View>

                                    <View style={s.myCodeHeader}>
                                        <View style={s.avatarWrapper}>
                                            <Ionicons name="person" size={24} color="#0056D2" />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={s.myCodeName}>{currentUser.full_name}</Text>
                                            <Text style={s.myCodeEmail}>{currentUser.email}</Text>
                                        </View>
                                    </View>

                                    {/* Live QR Code Box */}
                                    <View style={s.qrWrapper}>
                                        <Image
                                            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(myCodePayload)}&color=0d1b3e&margin=2` }}
                                            style={{ width: 170, height: 170 }}
                                            resizeMode="contain"
                                        />
                                    </View>

                                    <Text style={s.qrHintText}>
                                        Scan this code to send money to this wallet instantly.
                                    </Text>
                                </LinearGradient>
                            </ViewShot>

                            <TouchableOpacity 
                                onPress={handleShareMyCode}
                                style={[s.shareBtn, { marginTop: 24, width: '100%', maxWidth: 300 }]}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="share-social-outline" size={18} color={T.navy} />
                                <Text style={s.shareBtnText}>Share My Code</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <ActivityIndicator size="large" color="#0056D2" />
                    )}
                </View>
            )}

            {/* CONFIRM / AMOUNT INPUT MODAL */}
            <Modal visible={confirmModalVisible} transparent animationType="slide" onRequestClose={() => { setConfirmModalVisible(false); setScanned(false); }}>
                <View style={s.modalOverlay}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                    
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                    >
                        <LinearGradient
                            colors={['#102258', '#0b163a']}
                            style={s.decoratedModalCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={s.modalPill} />
                            
                            <Text style={s.decoratedModalTitle}>Send Wallet Transfer</Text>

                            {scannedUser && (
                                <View style={s.recipientBadge}>
                                    <LinearGradient 
                                        colors={['#f5a623', '#d4890e']}
                                        style={s.recipientAvatarRing}
                                    >
                                        <View style={s.recipientAvatarInner}>
                                            {scannedUser.avatarUrl ? (
                                                <Image 
                                                    source={{ uri: scannedUser.avatarUrl }} 
                                                    style={{ width: '100%', height: '100%', borderRadius: 20 }}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <Text style={s.recipientAvatarText}>
                                                    {scannedUser.name ? scannedUser.name[0].toUpperCase() : 'U'}
                                                </Text>
                                            )}
                                        </View>
                                    </LinearGradient>
                                    <View style={{ marginLeft: 12, flex: 1 }}>
                                        <Text style={s.recipientNameText} numberOfLines={1}>{scannedUser.name}</Text>
                                        <Text style={s.recipientEmailText} numberOfLines={1}>{scannedUser.email}</Text>
                                    </View>
                                </View>
                            )}

                            {/* Amount */}
                            <Text style={s.inputLabelDecorated}>Amount to Send</Text>
                            <View style={s.inputContainerDecorated}>
                                <Text style={s.currencySymbol}>₦</Text>
                                <TextInput
                                    style={s.amountInputDecorated}
                                    keyboardType="number-pad"
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder="0.00"
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                    autoFocus
                                />
                            </View>
                            
                            <View style={s.balanceWrapper}>
                                <Ionicons name="wallet-outline" size={14} color="#f5a623" />
                                <Text style={s.balanceTextDecorated}>
                                    Available: <Text style={{ color: 'white', fontWeight: '900' }}>₦{userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                </Text>
                            </View>

                            {/* Action buttons */}
                            <View style={s.btnRowDecorated}>
                                <TouchableOpacity 
                                    onPress={() => { setConfirmModalVisible(false); setScanned(false); setCameraActive(false); }}
                                    style={s.cancelBtnDecorated}
                                    activeOpacity={0.7}
                                >
                                    <Text style={s.cancelBtnTextDecorated}>Cancel</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={handleConfirmTransfer}
                                    style={s.sendBtnDecorated}
                                    activeOpacity={0.9}
                                >
                                    <LinearGradient 
                                        colors={['#f5a623', '#d4890e']}
                                        style={s.sendBtnGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={s.sendBtnText}>Send Money</Text>
                                        <Ionicons name="paper-plane" size={14} color={T.navy} style={{ marginLeft: 6 }} />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* GLASSMORPHIC MANUAL RECIPIENT INPUT MODAL */}
            <Modal visible={manualInputVisible} transparent animationType="fade" onRequestClose={() => setManualInputVisible(false)}>
                <View style={s.modalOverlay}>
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
                    
                    <Animated.View style={s.modalCard}>
                        {/* Drag indicator */}
                        <View style={s.modalPill} />

                        <View style={s.modalHeaderWrapper}>
                            <View style={s.modalIconWrapper}>
                                <Ionicons name="mail" size={22} color="#0056D2" />
                            </View>
                            <View style={{ marginLeft: 12 }}>
                                <Text style={s.modalTitle}>Enter Recipient</Text>
                                <Text style={s.modalSub}>Type the registered user email address.</Text>
                            </View>
                        </View>

                        {/* Text Input */}
                        <Text style={s.inputLabel}>Recipient Email</Text>
                        <View style={s.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={{ marginRight: 10 }} />
                            <TextInput
                                style={s.textInput}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={manualInput}
                                onChangeText={setManualInput}
                                placeholder="name@domain.com"
                                placeholderTextColor="#cbd5e1"
                            />
                        </View>

                        {/* Actions */}
                        <View style={s.btnRow}>
                            <TouchableOpacity 
                                onPress={() => { setManualInputVisible(false); setManualInput(''); }}
                                style={s.cancelBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={s.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={handleVerifyManualRecipient}
                                style={s.actionBtn}
                                disabled={isVerifyingManual}
                                activeOpacity={0.9}
                            >
                                <LinearGradient colors={['#0056D2', '#1e40af']} style={s.actionBtnGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
                                    {isVerifyingManual ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Text style={s.actionBtnText}>Verify User</Text>
                                            <Ionicons name="checkmark-circle-outline" size={16} color="white" style={{ marginLeft: 4 }} />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* SECURITY VERIFICATION MODAL */}
            <SecurityModal
                visible={securityModalVisible}
                onClose={() => { setSecurityModalVisible(false); setScanned(false); }}
                onSuccess={executeTransfer}
                title="Verify PIN"
                description="Enter transaction PIN to authorize QR payment."
            />

            {/* TRANSACTION SUCCESS MODAL */}
            <Modal visible={successModalVisible} transparent animationType="fade" onRequestClose={handleSuccessDone}>
                <View className="flex-1 bg-black/60 items-center justify-center p-6">
                    <View className="bg-white rounded-[32px] p-6 items-center w-full max-w-[340px] shadow-2xl relative overflow-hidden">
                        <View className="absolute -top-10 -left-10 w-24 h-24 bg-green-50 rounded-full" />
                        
                        <View className="w-20 h-20 bg-emerald-100 rounded-full items-center justify-center mb-6 shadow-inner mt-4">
                            <Ionicons name="checkmark-circle" size={48} color="#107C10" />
                        </View>

                        <Text className="text-xl font-black text-slate-800 mb-2">Transfer Successful!</Text>
                        <Text className="text-slate-400 text-xs font-semibold mb-6 uppercase tracking-wider text-center">Receipt</Text>

                        {/* Receipt details */}
                        <View className="w-full bg-slate-50 p-4 rounded-2xl mb-8 border border-slate-100">
                            <View className="flex-row justify-between mb-3">
                                <Text className="text-slate-400 text-xs font-semibold">Sent Amount</Text>
                                <Text className="text-slate-800 font-black text-sm">₦{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                            </View>
                            <View className="flex-row justify-between mb-3">
                                <Text className="text-slate-400 text-xs font-semibold">Recipient</Text>
                                <Text className="text-slate-800 font-black text-sm">{scannedUser?.name}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-slate-400 text-xs font-semibold">Method</Text>
                                <Text className="text-slate-800 font-black text-sm">QR Code / Manual Email</Text>
                            </View>
                        </View>

                        {/* Action buttons */}
                        <View className="w-full gap-3">
                            <TouchableOpacity 
                                onPress={handleShareReceipt}
                                disabled={isSharingReceipt}
                                className="w-full bg-slate-100 h-14 rounded-2xl items-center justify-center border border-slate-200 flex-row gap-2"
                                activeOpacity={0.8}
                            >
                                {isSharingReceipt ? (
                                    <ActivityIndicator size="small" color="#475569" />
                                ) : (
                                    <>
                                        <Ionicons name="share-social" size={18} color="#475569" />
                                        <Text className="text-slate-700 font-bold text-base">Share Receipt</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleSuccessDone}
                                className="w-full bg-[#107C10] h-14 rounded-2xl items-center justify-center shadow-lg active:bg-green-700"
                            >
                                <Text className="text-white font-bold text-base">Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Global Loader overlay for submissions, loading states, and gallery scanning */}
            {(isSubmitting || isReadingGallery) && (
                <View className="absolute inset-0 bg-black/60 items-center justify-center z-50">
                    <View className="bg-white p-6 rounded-2xl flex-row items-center gap-4 border border-gray-100 shadow-xl">
                        <ActivityIndicator size="small" color="#0056D2" />
                        <Text className="text-slate-800 font-bold">
                            {isReadingGallery ? "Scanning gallery image..." : "Executing transaction..."}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
  // Curved header
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    zIndex: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.2,
  },
  // Tab bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: '900',
  },
  // Permission Card
  permissionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 24,
    margin: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e5ef',
    shadowColor: 'rgba(13,27,62,0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  permissionIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,86,210,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: T.navy,
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 13,
    color: T.textSub,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  grantBtn: {
    width: '100%',
    maxWidth: 240,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0056D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  gradientBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  manualLinkText: {
    color: '#0056D2',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  // My Code Card
  myCodeCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0d1b3e',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  myCodeWatermark: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 150,
    height: 150,
  },
  myCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 16,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myCodeName: {
    fontSize: 16,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.3,
  },
  myCodeEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop: 1,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  qrHintText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    lineHeight: 13,
  },
  shareBtn: {
    width: '100%',
    backgroundColor: T.gold,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: T.navy,
    marginLeft: 6,
  },
  // Modal layout
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 24,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  modalPill: {
    width: 36,
    height: 4,
    backgroundColor: '#e2e5ef',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,86,210,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: T.navy,
  },
  modalSub: {
    fontSize: 10,
    color: T.textSub,
    fontWeight: '600',
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: T.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e5ef',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: '#f8f9fc',
    marginBottom: 24,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: T.navy,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f3f9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textSub,
  },
  actionBtn: {
    flex: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'white',
  },
  // Scanner styles
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    position: 'relative',
  },
  floatingBackBtn: {
    position: 'absolute',
    top: 24,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 240,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  scanWindow: {
    width: 240,
    height: 240,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    paddingTop: 20,
  },
  overlayText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    width: '100%',
  },
  torchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  torchBtnText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },
  // Corners
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#f5a623',
    borderWidth: 0,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  laserLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#f5a623',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  scanDashboardContainer: {
    paddingBottom: 40,
  },
  dashboardCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0d1b3e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  dashboardCardHeader: {
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 20,
  },
  dashboardIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dashboardCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.3,
  },
  dashboardCardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  dashboardOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 12,
  },
  optionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0056D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: 'white',
  },
  optionSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    marginTop: 2,
  },
  cameraTitleText: {
    position: 'absolute',
    top: 32,
    left: 80,
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
  },
  headerBalance: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  decoratedModalCard: {
    width: '90%',
    maxWidth: 340,
    backgroundColor: '#0d1b3e',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'stretch',
  },
  decoratedModalTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
  },
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
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
    backgroundColor: '#0d1b3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarText: {
    color: '#f5a623',
    fontSize: 18,
    fontWeight: '900',
  },
  recipientNameText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
  },
  recipientEmailText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  inputLabelDecorated: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputContainerDecorated: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 8,
  },
  currencySymbol: {
    color: '#f5a623',
    fontSize: 20,
    fontWeight: '900',
    marginRight: 8,
  },
  amountInputDecorated: {
    flex: 1,
    color: 'white',
    fontSize: 20,
    fontWeight: '900',
  },
  balanceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginLeft: 2,
  },
  balanceTextDecorated: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  btnRowDecorated: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtnDecorated: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnTextDecorated: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  sendBtnDecorated: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#0d1b3e',
    fontSize: 13,
    fontWeight: '900',
  }
});
