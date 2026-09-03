import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, ActivityIndicator, Alert, Modal, TextInput, Share, Vibration, Image, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { useAppSettings } from '../../hooks/useAppSettings';
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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useIsFocused } from '@react-navigation/native';
import DynamicBanners from '../../components/DynamicBanners';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import ViewShot from 'react-native-view-shot';
import jsQR from 'jsqr';
import { ABU_MAFHAL_LOGO_B64 } from '../../assets/images/logoB64';

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
    const { settings } = useAppSettings();
    const router = useRouter();
    const isFocused = useIsFocused();
    const [activeTab, setActiveTab] = useState<'mycode' | 'scan'>('mycode');
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

    // Balance Privacy
    const [showBalance, setShowBalance] = useState(true);

    // Requested Amount on QR
    const [requestedAmount, setRequestedAmount] = useState('');
    const [amountModalVisible, setAmountModalVisible] = useState(false);
    const [tempAmountInput, setTempAmountInput] = useState('');

    // Copy Toast State
    const [copiedToast, setCopiedToast] = useState<string | null>(null);

    // Recent Transfers State
    const [recentTransfers, setRecentTransfers] = useState<any[]>([]);

    // Notice / Alert Modal State (Cross-Platform)
    const [noticeModal, setNoticeModal] = useState<{ visible: boolean; title: string; message: string }>({
        visible: false,
        title: '',
        message: '',
    });

    const showScanNotice = (title: string, message: string) => {
        setScanned(false);
        setNoticeModal({ visible: true, title, message });
    };

    // Scanner animation & Flyer Ref
    const scanLineAnim = useRef(new Animated.Value(0)).current;
    const flyerRef = useRef<ViewShot>(null);
    const webVideoRef = useRef<any>(null);

    // Real-Time Web Camera Scanner using jsQR with cross-device constraints
    useEffect(() => {
        if (Platform.OS !== 'web' || !cameraActive) return;

        let activeStream: any = null;
        let animationFrameId: number;

        const startWebcam = async () => {
            try {
                if (!navigator?.mediaDevices?.getUserMedia) {
                    showScanNotice("Camera Notice", "Webcam access is not supported on this browser. You can upload a QR image from Gallery instead.");
                    setCameraActive(false);
                    return;
                }

                let stream: any = null;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                } catch (_) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    } catch (e2) {
                        throw e2;
                    }
                }

                activeStream = stream;
                if (webVideoRef.current) {
                    webVideoRef.current.srcObject = stream;
                    webVideoRef.current.play().catch(() => {});
                }

                const scanCanvas = document.createElement('canvas');
                const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

                const scanFrame = () => {
                    if (!cameraActive) return;
                    const video = webVideoRef.current;
                    if (video && video.readyState >= 2 && scanCtx) {
                        scanCanvas.width = video.videoWidth || 640;
                        scanCanvas.height = video.videoHeight || 480;
                        scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
                        const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
                        const code = jsQR(imgData.data, imgData.width, imgData.height, {
                            inversionAttempts: 'attemptBoth'
                        });
                        if (code && code.data) {
                            setScanned(true);
                            setCameraActive(false);
                            onBarcodeScanned({ data: code.data });
                            return;
                        }
                    }
                    animationFrameId = requestAnimationFrame(scanFrame);
                };

                animationFrameId = requestAnimationFrame(scanFrame);
            } catch (err: any) {
                console.warn("Web camera error:", err);
                showScanNotice("Camera Notice", "Could not access webcam. Please allow camera permissions in your browser or upload a QR picture from Gallery instead.");
                setCameraActive(false);
            }
        };

        startWebcam();

        return () => {
            if (activeStream && activeStream.getTracks) {
                activeStream.getTracks().forEach((t: any) => t.stop());
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [cameraActive]);

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if ((activeTab === 'scan' || cameraActive) && !scanned) {
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
    }, [activeTab, cameraActive, scanned]);

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, phone, email, balance, avatar_url, created_at')
                    .eq('id', user.id)
                    .single();
                if (profile) {
                    setCurrentUser(profile);
                    setUserBalance(parseFloat(profile.balance?.toString() || '0'));
                    loadRecentTransfers(profile.id);
                }
            }
        } catch (e) {
            console.error("Error loading user profile:", e);
        }
    };

    const loadRecentTransfers = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('id, amount, type, status, description, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);
            if (!error && data) {
                setRecentTransfers(data);
            }
        } catch (err) {
            console.warn("Recent transfers load notice:", err);
        }
    };

    const handleCopy = async (text: string, label: string) => {
        if (!text) return;
        try {
            await Clipboard.setStringAsync(text);
            if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setCopiedToast(label);
            setTimeout(() => setCopiedToast(null), 2500);
        } catch (e) {
            console.warn("Clipboard copy notice:", e);
        }
    };

    const downloadCardOnWeb = async (): Promise<boolean> => {
        if (!currentUser) return false;
        try {
            if (typeof document === 'undefined') return false;
            
            const canvas = document.createElement('canvas');
            canvas.width = 750;
            canvas.height = 1050;
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            // 1. Dark background gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 750, 1050);
            bgGrad.addColorStop(0, '#060C1B');
            bgGrad.addColorStop(0.5, '#0B1736');
            bgGrad.addColorStop(1, '#060C1B');
            ctx.fillStyle = bgGrad;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(0, 0, 750, 1050, 28);
            } else {
                ctx.rect(0, 0, 750, 1050);
            }
            ctx.fill();

            // 2. Gold border
            ctx.strokeStyle = '#F5A623';
            ctx.lineWidth = 3;
            ctx.stroke();

            // 3. Abu Mafhal Hub Header with Official Logo
            const logoSrc = (settings?.app_logo && typeof settings.app_logo === 'string' && settings.app_logo.startsWith('data:'))
                ? settings.app_logo
                : ABU_MAFHAL_LOGO_B64;
            
            try {
                const logoImg = new window.Image();
                logoImg.src = logoSrc;
                await new Promise((res) => {
                    if (logoImg.complete) {
                        res(null);
                    } else {
                        logoImg.onload = () => res(null);
                        logoImg.onerror = () => res(null);
                    }
                });
                if (logoImg.width > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(80, 80, 30, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(logoImg, 50, 50, 60, 60);
                    ctx.restore();
                }
            } catch (_) {}

            // Header brand text
            ctx.fillStyle = '#F5A623';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('ABU MAFHAL HUB', 125, 74);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText('OFFICIAL VIP PAYMENT PASS', 125, 100);

            // Verified badge pill on top right
            ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(550, 58, 145, 38, 19);
            else ctx.rect(550, 58, 145, 38);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText('✓ VERIFIED', 575, 83);

            // Divider line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(50, 130);
            ctx.lineTo(700, 130);
            ctx.stroke();

            // 4. User Profile Row
            let avatarLoaded = false;
            if (currentUser.avatar_url) {
                try {
                    const avImg = new window.Image();
                    avImg.crossOrigin = 'anonymous';
                    await new Promise((res) => {
                        avImg.onload = res;
                        avImg.onerror = res;
                        avImg.src = currentUser.avatar_url;
                    });
                    if (avImg.width > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(95, 185, 34, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(avImg, 61, 151, 68, 68);
                        ctx.restore();
                        avatarLoaded = true;
                    }
                } catch (_) {}
            }
            if (!avatarLoaded) {
                ctx.beginPath();
                ctx.arc(95, 185, 34, 0, Math.PI * 2);
                ctx.fillStyle = '#F5A623';
                ctx.fill();
                ctx.fillStyle = '#0D1B3E';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText((currentUser.full_name ? currentUser.full_name[0] : 'U').toUpperCase(), 95, 195);
                ctx.textAlign = 'left';
            }

            // User Name & Email
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText(currentUser.full_name || 'Mafhal User', 145, 180);
            ctx.fillStyle = '#94A3B8';
            ctx.font = '17px sans-serif';
            ctx.fillText(currentUser.email || '', 145, 210);

            // 5. QR Code Plate
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(175, 255, 400, 400, 20);
            else ctx.rect(175, 255, 400, 400);
            ctx.fill();

            // Gold corner accents
            ctx.strokeStyle = '#F5A623';
            ctx.lineWidth = 4;
            // Top Left
            ctx.beginPath();
            ctx.moveTo(185, 290);
            ctx.lineTo(185, 270);
            ctx.lineTo(205, 270);
            ctx.stroke();
            // Top Right
            ctx.beginPath();
            ctx.moveTo(545, 270);
            ctx.lineTo(565, 270);
            ctx.lineTo(565, 290);
            ctx.stroke();
            // Bottom Left
            ctx.beginPath();
            ctx.moveTo(185, 620);
            ctx.lineTo(185, 640);
            ctx.lineTo(205, 640);
            ctx.stroke();
            // Bottom Right
            ctx.beginPath();
            ctx.moveTo(545, 640);
            ctx.lineTo(565, 640);
            ctx.lineTo(565, 620);
            ctx.stroke();

            // Load and draw QR code
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(myCodePayload)}&color=0D1B3E&margin=0`;
            const qrImg = new window.Image();
            qrImg.crossOrigin = 'anonymous';
            await new Promise((res) => {
                qrImg.onload = res;
                qrImg.onerror = res;
                qrImg.src = qrUrl;
            });
            ctx.drawImage(qrImg, 195, 275, 360, 360);

            // Amount banner or subtitle
            if (requestedAmount && parseFloat(requestedAmount) > 0) {
                ctx.fillStyle = '#FDE68A';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(200, 675, 350, 42, 12);
                else ctx.rect(200, 675, 350, 42);
                ctx.fill();
                ctx.fillStyle = '#78350F';
                ctx.font = 'bold 19px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`REQUESTED AMOUNT: ₦${parseFloat(requestedAmount).toLocaleString()}`, 375, 703);
                ctx.textAlign = 'left';
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Scan with Abu Mafhal App or Any Banking Camera', 375, 695);
                ctx.textAlign = 'left';
            }

            // 6. Bottom Details Card ("a kasa da bayanan sa")
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(60, 735, 630, 200, 18);
            else ctx.rect(60, 735, 630, 200);
            ctx.fill();
            ctx.stroke();

            // Row 1: Wallet ID
            ctx.fillStyle = '#F5A623';
            ctx.font = 'bold 20px monospace';
            ctx.fillText(`WALLET ID:  MAF-${(currentUser.id || '').substring(0, 8).toUpperCase()}`, 90, 780);

            // Row 2: Account Name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`ACCOUNT NAME:  ${currentUser.full_name}`, 90, 820);

            // Row 3: Email
            ctx.fillStyle = '#94A3B8';
            ctx.font = '17px sans-serif';
            ctx.fillText(`EMAIL ADDRESS:  ${currentUser.email}`, 90, 858);

            // Row 4: Phone & Settlement
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`PHONE: ${currentUser.phone || 'Verified'}   •   FEE: 0% Free Instant Transfer`, 90, 898);

            // 7. Footer Watermark Seal
            ctx.fillStyle = 'rgba(245, 166, 35, 0.85)';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('POWERED BY ABU MAFHAL HUB • SECURE 256-BIT ENCRYPTION', 375, 975);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.font = '13px sans-serif';
            ctx.fillText('www.abumafhal.com.ng', 375, 1000);

            // Trigger download
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Abu_Mafhal_QR_${(currentUser.full_name || 'Card').replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Alert.alert("Downloaded 🎉", "Your official Abu Mafhal QR Card has been saved successfully!");
            return true;
        } catch (canvasErr) {
            console.error("downloadCardOnWeb error:", canvasErr);
            return false;
        }
    };

    const handleSaveToGallery = async () => {
        if (!currentUser) return;
        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            if (Platform.OS === 'web') {
                await downloadCardOnWeb();
                return;
            }
            if (flyerRef.current && flyerRef.current.capture) {
                const uri = await flyerRef.current.capture();
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    await MediaLibrary.saveToLibraryAsync(uri);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("Saved to Photos 📸", "Your Abu Mafhal QR Card has been saved to your photo gallery!");
                } else {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: `Abu Mafhal Pay QR - ${currentUser.full_name}`,
                    });
                }
            } else {
                handleShareMyCode();
            }
        } catch (error: any) {
            console.error("Save to gallery error:", error);
            if (Platform.OS === 'web') {
                await downloadCardOnWeb();
            } else {
                handleShareMyCode();
            }
        }
    };

    const handleShareMyCode = async () => {
        if (!currentUser) return;
        
        setIsSubmitting(true);
        try {
            if (Platform.OS === 'web') {
                await downloadCardOnWeb();
                return;
            }
            if (flyerRef.current && flyerRef.current.capture) {
                const uri = await flyerRef.current.capture();
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: `Pay ${currentUser.full_name} - Abu Mafhal Hub`,
                });
            } else {
                throw new Error("Unable to capture QR Flyer");
            }
        } catch (error: any) {
            console.error("Flyer share error:", error);
            try {
                await Share.share({
                    title: `Pay ${currentUser.full_name}`,
                    message: `Assalamu alaikum, scan this QR code or use my details to send me money instantly on Abu Mafhal Hub:\n\n👤 Name: ${currentUser.full_name}\n📧 Email: ${currentUser.email}\n💳 Wallet ID: MAF-${currentUser.id.substring(0, 8).toUpperCase()}`,
                });
            } catch (fallbackError: any) {
                Alert.alert("Share Error", fallbackError.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const decodeQrFromDataUrl = async (dataUrl: string): Promise<string | null> => {
        return new Promise((resolve) => {
            try {
                const img = new window.Image();
                img.onload = () => {
                    try {
                        const maxDim = 1200;
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        if (w > maxDim || h > maxDim) {
                            const scale = maxDim / Math.max(w, h);
                            w = Math.round(w * scale);
                            h = Math.round(h * scale);
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        if (!ctx) {
                            resolve(null);
                            return;
                        }

                        ctx.drawImage(img, 0, 0, w, h);
                        
                        // 1. Full Image Scan
                        const fullData = ctx.getImageData(0, 0, w, h);
                        let code = jsQR(fullData.data, w, h, { inversionAttempts: 'attemptBoth' });
                        if (code && code.data) {
                            resolve(code.data);
                            return;
                        }

                        // 2. Center 70% Box (Flyer / Card format)
                        const c70w = Math.floor(w * 0.7);
                        const c70h = Math.floor(h * 0.7);
                        const c70x = Math.floor(w * 0.15);
                        const c70y = Math.floor(h * 0.15);
                        const c70Data = ctx.getImageData(c70x, c70y, c70w, c70h);
                        code = jsQR(c70Data.data, c70w, c70h, { inversionAttempts: 'attemptBoth' });
                        if (code && code.data) {
                            resolve(code.data);
                            return;
                        }

                        // 3. Center 50% Box (Focused QR)
                        const c50w = Math.floor(w * 0.5);
                        const c50h = Math.floor(h * 0.5);
                        const c50x = Math.floor(w * 0.25);
                        const c50y = Math.floor(h * 0.25);
                        const c50Data = ctx.getImageData(c50x, c50y, c50w, c50h);
                        code = jsQR(c50Data.data, c50w, c50h, { inversionAttempts: 'attemptBoth' });
                        if (code && code.data) {
                            resolve(code.data);
                            return;
                        }

                        // 4. Downscale 50% for high-resolution images
                        const downCanvas = document.createElement('canvas');
                        downCanvas.width = Math.floor(w / 2);
                        downCanvas.height = Math.floor(h / 2);
                        const downCtx = downCanvas.getContext('2d', { willReadFrequently: true });
                        if (downCtx) {
                            downCtx.drawImage(img, 0, 0, downCanvas.width, downCanvas.height);
                            const downData = downCtx.getImageData(0, 0, downCanvas.width, downCanvas.height);
                            code = jsQR(downData.data, downCanvas.width, downCanvas.height, { inversionAttempts: 'attemptBoth' });
                            if (code && code.data) {
                                resolve(code.data);
                                return;
                            }
                        }

                        resolve(null);
                    } catch (e) {
                        console.warn("Canvas decode error:", e);
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = dataUrl;
            } catch (err) {
                console.warn("Image load error:", err);
                resolve(null);
            }
        });
    };

    const handleUploadFromGallery = async () => {
        try {
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.style.display = 'none';

                input.onchange = async (e: any) => {
                    const file = e.target?.files?.[0];
                    if (!file) return;
                    setIsReadingGallery(true);
                    setScanned(false);

                    const reader = new FileReader();
                    reader.onload = async (re) => {
                        const dataUrl = re.target?.result as string;
                        if (!dataUrl) {
                            setIsReadingGallery(false);
                            showScanNotice("File Error", "Could not read this picture file. Please try another image.");
                            return;
                        }

                        const decodedText = await decodeQrFromDataUrl(dataUrl);
                        setIsReadingGallery(false);

                        if (decodedText) {
                            onBarcodeScanned({ data: decodedText });
                        } else {
                            showScanNotice(
                                "No QR Code Detected",
                                "Could not find a recognizable QR code in this image. Please crop tightly to the square QR code and try again, or enter the recipient's email manually."
                            );
                        }
                    };
                    reader.onerror = () => {
                        setIsReadingGallery(false);
                        showScanNotice("File Error", "Failed to read image file. Please try again.");
                    };
                    reader.readAsDataURL(file);
                };

                document.body.appendChild(input);
                input.click();
                setTimeout(() => {
                    try { document.body.removeChild(input); } catch (_) {}
                }, 1000);
                return;
            }

            // Native Mobile (iOS & Android)
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                showScanNotice("Permission Denied", "We need access to your photo gallery to upload QR images.");
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
            setScanned(false);

            const formData = new FormData();
            formData.append('file', {
                uri: selectedImage.uri,
                name: 'qr.jpg',
                type: 'image/jpeg',
            } as any);

            const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            setIsReadingGallery(false);

            const qrText = result?.[0]?.symbol?.[0]?.data;
            if (qrText) {
                onBarcodeScanned({ data: qrText });
            } else {
                showScanNotice(
                    "No QR Code Detected",
                    "Could not find a clear QR code in this picture. Please crop closer to the square QR code."
                );
            }
        } catch (e: any) {
            setIsReadingGallery(false);
            console.error("Gallery scan error:", e);
            showScanNotice("Scan Error", "Failed to scan QR code from gallery. Please try another image or enter email manually.");
        }
    };

    const onBarcodeScanned = async ({ data }: { data: string }) => {
        if (confirmModalVisible || successModalVisible) return;
        setScanned(true);
        setCameraActive(false);
        if (Platform.OS !== 'web') {
            Vibration.vibrate(100);
        }
        
        try {
            let userId = '';
            let email = '';
            
            try {
                const parsed = JSON.parse(data);
                if (parsed.userId) {
                    userId = parsed.userId;
                    email = parsed.email || '';
                    if (parsed.amount && parseFloat(parsed.amount) > 0) {
                        setAmount(String(parsed.amount));
                    }
                }
            } catch (jsonErr) {
                const trimmedData = data.trim();
                // 1. Check if it's Wallet ID format: MAF-XXXXXXXX
                if (trimmedData.toUpperCase().startsWith('MAF-')) {
                    const cleanPrefix = trimmedData.replace(/^MAF-/i, '').trim();
                    userId = cleanPrefix;
                } 
                // 2. Check for URL with query params
                else if (trimmedData.includes('http://') || trimmedData.includes('https://')) {
                    try {
                        const urlObj = new URL(trimmedData);
                        userId = urlObj.searchParams.get('userId') || '';
                        email = urlObj.searchParams.get('email') || '';
                    } catch (_) {}
                }
                // 3. Check for email anywhere in text
                const emailMatch = trimmedData.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch && !userId) {
                    email = emailMatch[0].toLowerCase();
                } else if (!userId && !email) {
                    if (trimmedData.length === 36) {
                        userId = trimmedData;
                    } else {
                        email = trimmedData.toLowerCase();
                    }
                }
            }

            let query = supabase.from('profiles').select('id, full_name, email, avatar_url');
            if (userId) {
                if (userId.length === 36) {
                    query = query.eq('id', userId);
                } else {
                    query = query.ilike('id', `${userId}%`);
                }
            } else if (email) {
                query = query.eq('email', email);
            } else {
                showScanNotice("Invalid QR", "This QR code does not contain a valid Abu Mafhal user ID, Wallet ID, or email.");
                return;
            }

            const { data: recipient, error } = await query.maybeSingle();
            
            if (error || !recipient) {
                showScanNotice("User Not Found", "No registered Abu Mafhal user was found matching this QR code.");
                return;
            }

            if (currentUser && recipient.id === currentUser.id) {
                showScanNotice("Self Scan Notice", `You scanned your own QR code (${currentUser.full_name || 'My Account'}). To make a transfer, please scan another user's QR code.`);
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
            showScanNotice("Scan Error", "Failed to process QR code details. Please try again.");
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
            const logoAsset = Asset.fromModule((settings?.app_logo ? { uri: typeof settings.app_logo === 'string' ? settings.app_logo : settings.app_logo.url } : require('../../assets/images/logo.png')));
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

    // Build user QR code payload with optional requested amount
    const myCodePayload = currentUser ? JSON.stringify({
        type: 'transfer',
        userId: currentUser.id,
        name: currentUser.full_name,
        email: currentUser.email,
        ...(requestedAmount && parseFloat(requestedAmount) > 0 ? { amount: parseFloat(requestedAmount) } : {})
    }) : '';

    return (
        <View className="flex-1 bg-[#f4f6fb]">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Ultra-Sleek Executive Curved Header */}
            <LinearGradient 
              colors={['#060B18', '#0D1B3E']} 
              style={s.headerContainer}
            >
              <View style={s.headerTop}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={18} color="white" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.headerTitle}>QR Pay & Transfer</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setShowBalance(!showBalance);
                    }}
                    style={s.headerBalancePill}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="wallet-outline" size={11} color="#F5A623" style={{ marginRight: 4 }} />
                    <Text style={s.headerBalance}>
                      {showBalance ? `₦${userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '₦ • • • • • •'}
                    </Text>
                    <Ionicons name={showBalance ? "eye-outline" : "eye-off-outline"} size={11} color="#F5A623" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setActiveTab(activeTab === 'mycode' ? 'scan' : 'mycode');
                  }} 
                  style={s.headerToggleBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name={activeTab === 'mycode' ? 'scan-outline' : 'qr-code-outline'} size={16} color="#F5A623" />
                </TouchableOpacity>
              </View>

              {/* Ultra-Compact Segmented Tab Switcher */}
              <View style={s.tabContainer}>
                <TouchableOpacity
                    onPress={() => { 
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setActiveTab('mycode'); 
                      setCameraActive(false); 
                    }}
                    style={[s.tabItem, activeTab === 'mycode' && s.tabItemActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="qr-code" size={13} color={activeTab === 'mycode' ? '#F5A623' : 'rgba(255,255,255,0.45)'} style={{ marginRight: 5 }} />
                    <Text style={[s.tabText, activeTab === 'mycode' && s.tabTextActive]}>My QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => { 
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                      setActiveTab('scan'); 
                      setCameraActive(false); 
                    }}
                    style={[s.tabItem, activeTab === 'scan' && s.tabItemActive]}
                    activeOpacity={0.8}
                >
                    <Ionicons name="scan" size={13} color={activeTab === 'scan' ? '#10B981' : 'rgba(255,255,255,0.45)'} style={{ marginRight: 5 }} />
                    <Text style={[s.tabText, activeTab === 'scan' && s.tabTextActiveScan]}>Scan to Pay</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {activeTab === 'scan' ? (
                <View style={{ flex: 1 }}>
                    <ScrollView 
                        contentContainerStyle={s.scanDashboardContainer} 
                        showsVerticalScrollIndicator={false}
                    >
                            {/* Modern Interactive Scanner Hub Card */}
                            <LinearGradient
                                colors={['#070D1E', '#0D1B3E', '#081128']}
                                style={s.modernScanHubCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                {/* Ambient Glow */}
                                <View style={s.ambientOrb} />

                                {/* Header badge */}
                                <View style={[s.cardBrandBadge, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                    <Ionicons name="scan" size={10} color="#10B981" />
                                    <Text style={[s.cardBrandTitle, { color: '#10B981' }]}>FAST SCAN & PAY</Text>
                                </View>

                                {/* Compact Interactive Scanner Launch Box */}
                                <TouchableOpacity 
                                    onPress={async () => {
                                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setScanned(false);
                                        if (Platform.OS === 'web') {
                                            setCameraActive(true);
                                        } else if (!permission?.granted) {
                                            const res = await requestPermission();
                                            if (res.granted) setCameraActive(true);
                                            else showScanNotice("Camera Access Required", "Please allow camera access to scan QR codes.");
                                        } else {
                                            setCameraActive(true);
                                        }
                                    }}
                                    activeOpacity={0.88}
                                    style={s.scannerInteractiveBox}
                                >
                                    {/* 4 Gold Targeting Brackets */}
                                    <View style={[s.qrCorner, s.qrCornerTL]} />
                                    <View style={[s.qrCorner, s.qrCornerTR]} />
                                    <View style={[s.qrCorner, s.qrCornerBL]} />
                                    <View style={[s.qrCorner, s.qrCornerBR]} />

                                    {/* Laser Line Animation */}
                                    <Animated.View style={[s.previewLaserLine, { transform: [{ translateY: scanLineAnim }] }]} />

                                    {/* Center Content */}
                                    <View style={s.previewCenterContent}>
                                        <View style={s.previewCameraIconRing}>
                                            <Ionicons name="camera" size={22} color="#F5A623" />
                                        </View>
                                        <Text style={s.previewTapTitle}>Launch Live Camera</Text>
                                        <Text style={s.previewTapSub}>Tap to scan any recipient QR code</Text>
                                    </View>
                                </TouchableOpacity>
                            </LinearGradient>

                            {/* Two Compact Glass Action Cards */}
                            <View style={s.scanQuickActionsGrid}>
                                <TouchableOpacity 
                                    onPress={handleUploadFromGallery}
                                    style={s.scanQuickActionCard}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#1E293B', '#0F172A']} style={s.scanQuickActionGrad}>
                                        <View style={[s.scanQuickActionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                            <Ionicons name="image" size={18} color="#10B981" />
                                        </View>
                                        <Text style={s.scanQuickActionTitle}>Upload Photo</Text>
                                        <Text style={s.scanQuickActionSub}>Scan from gallery</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setManualInputVisible(true)}
                                    style={s.scanQuickActionCard}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#1E293B', '#0F172A']} style={s.scanQuickActionGrad}>
                                        <View style={[s.scanQuickActionIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                                            <Ionicons name="mail" size={18} color="#3B82F6" />
                                        </View>
                                        <Text style={s.scanQuickActionTitle}>Pay via Email</Text>
                                        <Text style={s.scanQuickActionSub}>Direct transfer</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Frequent Recipients for Fast Re-transfer - ALWAYS VISIBLE */}
                            <View style={s.recentTransfersContainer}>
                                <View style={s.recentTransfersHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="repeat" size={13} color="#F5A623" />
                                        <Text style={s.recentTransfersTitle}>Frequent Recipients</Text>
                                    </View>
                                    <Text style={s.recentTransfersBadge}>
                                        {recentTransfers.length > 0 ? `${recentTransfers.length} Saved` : 'Instant'}
                                    </Text>
                                </View>
                                {recentTransfers.length > 0 ? (
                                    recentTransfers.slice(0, 3).map((tx, idx) => (
                                        <TouchableOpacity 
                                            key={tx.id || idx} 
                                            style={s.recentTxRow}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (tx.recipient_email) {
                                                    setManualInput(tx.recipient_email);
                                                    setManualInputVisible(true);
                                                }
                                            }}
                                        >
                                            <View style={s.recentTxIcon}>
                                                <Ionicons name="arrow-up" size={12} color="#F5A623" />
                                            </View>
                                            <View style={{ flex: 1, marginHorizontal: 8 }}>
                                                <Text style={s.recentTxDesc} numberOfLines={1}>
                                                    {tx.description || 'Wallet Transfer'}
                                                </Text>
                                                <Text style={s.recentTxDate}>
                                                    {new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </Text>
                                            </View>
                                            <Text style={s.recentTxAmount}>
                                                ₦{parseFloat(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={s.recentEmptyBox}>
                                        <View style={s.recentEmptyIconCircle}>
                                            <Ionicons name="people-outline" size={18} color="#94A3B8" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={s.recentEmptyTitle}>No Frequent Recipients</Text>
                                            <Text style={s.recentEmptySub}>People you pay via QR or email will be remembered here for 1-tap transfers.</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Bank-Grade Security Pill */}
                            <View style={s.securityShieldPill}>
                                <Ionicons name="shield-checkmark" size={15} color="#10B981" />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.securityShieldTitle}>End-to-End Encrypted Transfer</Text>
                                    <Text style={s.securityShieldSub}>Instant wallet settlement with zero transaction fees.</Text>
                                </View>
                            </View>

                            {/* Banner in scan footer */}
                            <View style={{ width: '100%', maxWidth: 350, marginTop: 12 }}>
                                <DynamicBanners placement="qr_pay" />
                            </View>
                        </ScrollView>
                    </View>
                ) : (
                <ScrollView 
                    contentContainerStyle={s.myCodeDashboardContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {currentUser ? (
                        <>
                            {/* LUXURY COMPACT VIP QR CARD */}
                            <ViewShot ref={flyerRef} options={{ format: 'png', quality: 1 }}>
                                <LinearGradient 
                                    colors={['#060B18', '#0D1B3E', '#081126']} 
                                    style={s.myCodeCard}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    {/* Ambient Glow */}
                                    <View style={s.ambientOrb} />

                                    {/* 1. Official Branding: Logo + VIP Header */}
                                    <View style={s.cardBrandRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                            <Image 
                                                source={{ uri: (settings?.app_logo && typeof settings.app_logo === 'string' && settings.app_logo.startsWith('http')) ? settings.app_logo : ABU_MAFHAL_LOGO_B64 }}
                                                style={s.cardBrandLogo}
                                                resizeMode="contain"
                                            />
                                            <View>
                                                <Text style={s.cardBrandTitle}>ABU MAFHAL HUB</Text>
                                                <Text style={s.cardBrandSubText}>OFFICIAL VIP QR PASS</Text>
                                            </View>
                                        </View>
                                        <View style={s.cardVerifiedPill}>
                                            <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                            <Text style={s.cardVerifiedText}>VERIFIED</Text>
                                        </View>
                                    </View>

                                    {/* 2. User Profile: Avatar + Full Name + Email */}
                                    <View style={s.cardTopRow}>
                                        <View style={s.cardTopUser}>
                                            <LinearGradient
                                                colors={['#F5A623', '#D97706']}
                                                style={s.avatarGradientRing}
                                            >
                                                <View style={s.avatarInnerWrapper}>
                                                    {currentUser.avatar_url ? (
                                                        <Image 
                                                            source={{ uri: currentUser.avatar_url }} 
                                                            style={{ width: '100%', height: '100%', borderRadius: 17.5 }}
                                                        />
                                                    ) : (
                                                        <Text style={{ fontSize: 15, fontWeight: '900', color: '#F5A623' }}>
                                                            {currentUser.full_name ? currentUser.full_name[0].toUpperCase() : 'U'}
                                                        </Text>
                                                    )}
                                                </View>
                                            </LinearGradient>
                                            <View style={{ marginLeft: 9, flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Text style={s.myCodeName} numberOfLines={1}>{currentUser.full_name}</Text>
                                                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                                </View>
                                                <TouchableOpacity 
                                                    onPress={() => handleCopy(currentUser.email, 'Email')}
                                                    style={s.emailCopyBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={s.myCodeEmail} numberOfLines={1}>{currentUser.email}</Text>
                                                    <Ionicons name="copy-outline" size={9} color="#94A3B8" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Status badge */}
                                        <View style={s.instantBadge}>
                                            <Ionicons name="flash" size={9} color="#F5A623" />
                                            <Text style={s.instantBadgeText}>0% FEE</Text>
                                        </View>
                                    </View>

                                    {/* 3. Center: High-Definition QR Code with Precision Gold Reticle */}
                                    <View style={s.qrWrapperContainer}>
                                        <View style={s.qrWrapper}>
                                            <View style={[s.qrCorner, s.qrCornerTL]} />
                                            <View style={[s.qrCorner, s.qrCornerTR]} />
                                            <View style={[s.qrCorner, s.qrCornerBL]} />
                                            <View style={[s.qrCorner, s.qrCornerBR]} />

                                            <Image
                                                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(myCodePayload)}&color=0D1B3E&margin=0` }}
                                                style={{ width: 126, height: 126 }}
                                                resizeMode="contain"
                                            />
                                        </View>

                                        {/* Dynamic Requested Amount Ribbon */}
                                        {requestedAmount && parseFloat(requestedAmount) > 0 ? (
                                            <View style={s.requestedAmountBanner}>
                                                <View style={s.requestedAmountIcon}>
                                                    <Ionicons name="pricetag" size={9} color="#0D1B3E" />
                                                </View>
                                                <Text style={s.requestedAmountTxt}>
                                                    Amount: <Text style={{ fontWeight: '900', color: '#0D1B3E' }}>₦{parseFloat(requestedAmount).toLocaleString()}</Text>
                                                </Text>
                                                <TouchableOpacity 
                                                    onPress={() => {
                                                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                                                        setRequestedAmount('');
                                                    }}
                                                    style={s.requestedAmountClearBtn}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="close" size={11} color="#0D1B3E" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={s.qrSecurityNote}>
                                                <Ionicons name="shield-checkmark" size={9} color="#F5A623" />
                                                <Text style={s.qrSecurityNoteText}>Scan with Mafhal App or any Camera to Pay</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* 4. Bottom: Wallet ID Bar with 1-Tap Copy & User Details */}
                                    <View style={s.cardFooter}>
                                        <TouchableOpacity 
                                            onPress={() => handleCopy(`MAF-${currentUser.id.substring(0, 8).toUpperCase()}`, 'Wallet ID')}
                                            style={s.walletIdPill}
                                            activeOpacity={0.8}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons name="wallet-outline" size={13} color="#F5A623" />
                                                <Text style={s.cardInfoLabel}>WALLET ID:</Text>
                                                <Text style={s.cardInfoValue}>MAF-{currentUser.id.substring(0, 8).toUpperCase()}</Text>
                                            </View>
                                            <View style={s.copyIconBadge}>
                                                <Ionicons name="copy-outline" size={11} color="#F5A623" />
                                            </View>
                                        </TouchableOpacity>

                                        {/* User Details Footer */}
                                        <View style={s.cardDetailsSubBar}>
                                            <Text style={s.cardDetailsSubText} numberOfLines={1}>
                                                👤 {currentUser.full_name}   •   📱 {currentUser.phone || 'Abu Mafhal Pay'}
                                            </Text>
                                        </View>
                                    </View>
                                </LinearGradient>
                            </ViewShot>

                            {/* 3 LUXURY DECORATED ACTION BUTTONS */}
                            <View style={s.featureActionGrid}>
                                {/* 1. Set Amount (Warm Amber) */}
                                <TouchableOpacity 
                                    onPress={() => {
                                        setTempAmountInput(requestedAmount);
                                        setAmountModalVisible(true);
                                    }}
                                    style={s.featureActionBtn}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#2B1B04', '#150D02']} style={[s.featureActionGrad, { borderColor: 'rgba(245, 166, 35, 0.35)' }]}>
                                        <View style={[s.featureActionIcon, { backgroundColor: 'rgba(245, 166, 35, 0.18)' }]}>
                                            <Ionicons name="pricetag" size={14} color="#F5A623" />
                                        </View>
                                        <Text style={s.featureActionTitle}>
                                            {requestedAmount ? 'Edit Amount' : 'Set Amount'}
                                        </Text>
                                        <Text style={[s.featureActionSub, { color: '#FBBF24' }]}>
                                            {requestedAmount ? `₦${parseFloat(requestedAmount).toLocaleString()}` : 'Custom'}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* 2. Save Image (Emerald Green) */}
                                <TouchableOpacity 
                                    onPress={handleSaveToGallery}
                                    style={s.featureActionBtn}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#04261A', '#02130D']} style={[s.featureActionGrad, { borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                                        <View style={[s.featureActionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
                                            <Ionicons name="arrow-down-circle" size={14} color="#10B981" />
                                        </View>
                                        <Text style={s.featureActionTitle}>Save Photo</Text>
                                        <Text style={[s.featureActionSub, { color: '#34D399' }]}>To Photos</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* 3. Share Flyer (Sapphire Royal Blue) */}
                                <TouchableOpacity 
                                    onPress={handleShareMyCode}
                                    style={s.featureActionBtn}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient colors={['#0C1938', '#060D1E']} style={[s.featureActionGrad, { borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                                        <View style={[s.featureActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.18)' }]}>
                                            <Ionicons name="share-social" size={14} color="#3B82F6" />
                                        </View>
                                        <Text style={s.featureActionTitle}>Share Flyer</Text>
                                        <Text style={[s.featureActionSub, { color: '#60A5FA' }]}>To Chat</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* RECENT TRANSFERS ACTIVITY - ALWAYS VISIBLE */}
                            <View style={s.recentTransfersContainer}>
                                <View style={s.recentTransfersHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="time" size={13} color="#F5A623" />
                                        <Text style={s.recentTransfersTitle}>Recent Activity</Text>
                                    </View>
                                    <Text style={s.recentTransfersBadge}>
                                        {recentTransfers.length > 0 ? `${recentTransfers.length} Transfers` : 'Live History'}
                                    </Text>
                                </View>

                                {recentTransfers.length > 0 ? (
                                    recentTransfers.map((tx, idx) => (
                                        <View key={tx.id || idx} style={s.recentTxRow}>
                                            <View style={s.recentTxIcon}>
                                                <Ionicons 
                                                    name={tx.type === 'transfer' ? "swap-horizontal" : "arrow-up"} 
                                                    size={12} 
                                                    color="#F5A623" 
                                                />
                                            </View>
                                            <View style={{ flex: 1, marginHorizontal: 8 }}>
                                                <Text style={s.recentTxDesc} numberOfLines={1}>
                                                    {tx.description || 'Wallet Transfer'}
                                                </Text>
                                                <Text style={s.recentTxDate}>
                                                    {new Date(tx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>
                                            <Text style={s.recentTxAmount}>
                                                ₦{parseFloat(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={s.recentEmptyBox}>
                                        <View style={s.recentEmptyIconCircle}>
                                            <Ionicons name="receipt-outline" size={18} color="#94A3B8" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={s.recentEmptyTitle}>No Recent Transfers Yet</Text>
                                            <Text style={s.recentEmptySub}>
                                                Your peer-to-peer QR payments and wallet transfers will appear here automatically.
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Dynamic Banner in Footer */}
                            <View style={{ width: '100%', maxWidth: 350, marginTop: 10 }}>
                                <DynamicBanners placement="qr_pay" />
                            </View>
                        </>
                    ) : (
                        <ActivityIndicator size="large" color="#0056D2" />
                    )}
                </ScrollView>
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

                            {/* Quick Amount Chips */}
                            <View style={s.quickChipRow}>
                                {['500', '1000', '2000', '5000'].map(val => (
                                    <TouchableOpacity 
                                        key={val} 
                                        style={[s.quickChip, amount === val && s.quickChipActive]}
                                        onPress={() => {
                                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                                            setAmount(val);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.quickChipText, amount === val && s.quickChipTextActive]}>
                                            ₦{parseInt(val).toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity 
                                    style={[s.quickChip, s.quickChipMax]}
                                    onPress={() => {
                                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                                        setAmount(userBalance > 0 ? String(userBalance) : '0');
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.quickChipText, { color: '#F5A623', fontWeight: '900' }]}>Max</Text>
                                </TouchableOpacity>
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

            {/* SET REQUESTED AMOUNT MODAL */}
            <Modal visible={amountModalVisible} transparent animationType="fade" onRequestClose={() => setAmountModalVisible(false)}>
                <View style={s.modalOverlay}>
                    <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
                    
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                    >
                        <LinearGradient
                            colors={['#0F1D40', '#070D1E']}
                            style={s.decoratedModalCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={s.modalPill} />
                            
                            <View style={{ alignItems: 'center', marginBottom: 14 }}>
                                <View style={[s.modalIconWrapper, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
                                    <Ionicons name="pricetag" size={20} color="#F5A623" />
                                </View>
                                <Text style={s.decoratedModalTitle}>Set Request Amount</Text>
                                <Text style={s.modalSubTitle}>
                                    Anyone who scans this QR code will pay this exact amount automatically.
                                </Text>
                            </View>

                            {/* Quick Amount Chips */}
                            <View style={s.quickChipRow}>
                                {['500', '1000', '2000', '5000', '10000'].map(val => (
                                    <TouchableOpacity 
                                        key={val} 
                                        style={[s.quickChip, tempAmountInput === val && s.quickChipActive]}
                                        onPress={() => {
                                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                                            setTempAmountInput(val);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.quickChipText, tempAmountInput === val && s.quickChipTextActive]}>
                                            ₦{parseInt(val).toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Amount Input */}
                            <Text style={s.inputLabelDecorated}>Custom Amount (₦)</Text>
                            <View style={s.inputContainerDecorated}>
                                <Text style={s.currencySymbol}>₦</Text>
                                <TextInput
                                    style={s.amountInputDecorated}
                                    keyboardType="number-pad"
                                    value={tempAmountInput}
                                    onChangeText={setTempAmountInput}
                                    placeholder="0.00"
                                    placeholderTextColor="rgba(255,255,255,0.25)"
                                    autoFocus
                                />
                            </View>

                            {/* Buttons */}
                            <View style={s.btnRowDecorated}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setAmountModalVisible(false);
                                        setTempAmountInput('');
                                    }}
                                    style={s.cancelBtnDecorated}
                                    activeOpacity={0.7}
                                >
                                    <Text style={s.cancelBtnTextDecorated}>Cancel</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    onPress={() => {
                                        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        setRequestedAmount(tempAmountInput);
                                        setAmountModalVisible(false);
                                    }}
                                    style={s.sendBtnDecorated}
                                    activeOpacity={0.9}
                                >
                                    <LinearGradient 
                                        colors={['#F5A623', '#D4890E']}
                                        style={s.sendBtnGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={s.sendBtnText}>Apply to QR</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* FLOATING COPIED TOAST */}
            {copiedToast && (
                <View style={s.toastContainer} pointerEvents="none">
                    <BlurView intensity={80} tint="dark" style={s.toastBlur}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={s.toastText}>{copiedToast} copied to clipboard!</Text>
                    </BlurView>
                </View>
            )}

            {/* FULL-SCREEN LIVE CAMERA SCANNER MODAL */}
            <Modal
                visible={cameraActive}
                animationType="fade"
                transparent={false}
                onRequestClose={() => setCameraActive(false)}
                statusBarTranslucent
            >
                <View style={{ flex: 1, backgroundColor: '#050B17', position: 'relative' }}>
                    {Platform.OS === 'web' ? (
                        <video
                            ref={webVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                backgroundColor: '#050B17',
                            }}
                        />
                    ) : !scanned ? (
                        <CameraView
                            style={StyleSheet.absoluteFillObject}
                            facing="back"
                            enableTorch={torchEnabled}
                            onBarcodeScanned={onBarcodeScanned}
                            barcodeScannerSettings={{
                                barcodeTypes: ["qr"],
                            }}
                        />
                    ) : null}

                    {scanned && (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,11,23,0.95)', alignItems: 'center', justifyContent: 'center', zIndex: 50 }]}>
                            <ActivityIndicator size="large" color="#F5A623" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', marginTop: 14, fontSize: 15 }}>Processing recipient details...</Text>
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
                                <Text style={s.cameraTitleText}>Live QR Scanner</Text>
                                <TouchableOpacity 
                                    onPress={() => setTorchEnabled(!torchEnabled)}
                                    style={s.floatingBackBtn}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name={torchEnabled ? "flash" : "flash-off"} size={18} color={torchEnabled ? "#F5A623" : "white"} />
                                </TouchableOpacity>
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
                                <Text style={s.overlayText}>Align recipient QR code inside the frame</Text>
                                
                                <View style={s.buttonRow}>
                                    <TouchableOpacity 
                                        onPress={handleUploadFromGallery}
                                        style={s.torchBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="image-outline" size={15} color="white" />
                                        <Text style={s.torchBtnText}>Upload Photo</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        onPress={() => { setCameraActive(false); setManualInputVisible(true); }}
                                        style={s.torchBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="mail-outline" size={15} color="white" />
                                        <Text style={s.torchBtnText}>Pay via Email</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>

            {/* CROSS-PLATFORM THEMED NOTICE / ALERT MODAL */}
            <Modal visible={noticeModal.visible} transparent animationType="fade" onRequestClose={() => setNoticeModal({ visible: false, title: '', message: '' })}>
                <View style={s.modalOverlay}>
                    <View style={s.noticeCard}>
                        <View style={s.noticeIconRing}>
                            <Ionicons name="information-circle" size={32} color="#F5A623" />
                        </View>
                        <Text style={s.noticeTitle}>{noticeModal.title}</Text>
                        <Text style={s.noticeMessage}>{noticeModal.message}</Text>
                        <TouchableOpacity
                            onPress={() => setNoticeModal({ visible: false, title: '', message: '' })}
                            style={s.noticeDismissBtn}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={['#F5A623', '#D4890E']} style={s.noticeDismissGrad}>
                                <Text style={s.noticeDismissText}>Understood</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Global Loader overlay for submissions, loading states, and gallery scanning */}
            {(isSubmitting || isReadingGallery) && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,11,23,0.75)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }]}>
                    <View style={s.readingGalleryBox}>
                        <ActivityIndicator size="large" color="#F5A623" />
                        <Text style={s.readingGalleryText}>
                            {isReadingGallery ? "Scanning gallery image..." : "Processing transaction..."}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
  // Ultra-Compact Curved Header
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 10,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    zIndex: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -0.2,
  },
  headerBalancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    marginTop: 2,
  },
  headerBalance: {
    color: '#F5A623',
    fontSize: 11,
    fontWeight: '800',
  },
  headerToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tab bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 36,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tabTextActive: {
    color: '#F5A623',
    fontWeight: '900',
  },
  tabTextActiveScan: {
    color: '#10B981',
    fontWeight: '900',
  },
  // Dashboard Scroll Container
  myCodeDashboardContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 90,
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
  // Executive Luxury VIP QR Card (Compact, Horizontal Balanced & Perfectly Arranged)
  myCodeCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    overflow: 'hidden',
    backgroundColor: '#070D1E',
  },
  ambientOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F5A623',
    opacity: 0.1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTopUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarGradientRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 17.5,
    backgroundColor: '#070D1E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  myCodeName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  emailCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  myCodeEmail: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardBrandLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  cardBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    gap: 4,
  },
  cardBrandTitle: {
    color: '#F5A623',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardBrandSubText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cardVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 3,
  },
  cardVerifiedText: {
    color: '#10B981',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 3,
  },
  instantBadgeText: {
    color: '#F5A623',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cardDetailsSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
  },
  cardDetailsSubText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
  },
  qrWrapperContainer: {
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#F5A623',
  },
  qrCornerTL: {
    top: 3,
    left: 3,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 5,
  },
  qrCornerTR: {
    top: 3,
    right: 3,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 5,
  },
  qrCornerBL: {
    bottom: 3,
    left: 3,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 5,
  },
  qrCornerBR: {
    bottom: 3,
    right: 3,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 5,
  },
  requestedAmountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 5,
  },
  requestedAmountIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestedAmountTxt: {
    color: '#78350F',
    fontSize: 10.5,
    fontWeight: '700',
  },
  requestedAmountClearBtn: {
    marginLeft: 3,
    padding: 2,
  },
  qrSecurityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  qrSecurityNoteText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardFooter: {
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
  },
  walletIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
  },
  cardInfoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(245, 166, 35, 0.9)',
    letterSpacing: 0.5,
  },
  cardInfoValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.2,
  },
  copyIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 3 Decorated Action Buttons
  featureActionGrid: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 350,
    marginTop: 10,
    gap: 8,
  },
  featureActionBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  featureActionGrad: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  featureActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureActionTitle: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  featureActionSub: {
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  recentTransfersContainer: {
    width: '100%',
    maxWidth: 350,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: 'rgba(13, 27, 62, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  recentTransfersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recentTransfersTitle: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  recentTxIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTxDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  recentTxDate: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  recentTxAmount: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#10B981',
  },
  recentTransfersBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F5A623',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    letterSpacing: 0.3,
  },
  recentEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 2,
  },
  recentEmptyIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmptyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  recentEmptySub: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 13,
  },
  modalSubTitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  quickChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
    justifyContent: 'center',
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipActive: {
    backgroundColor: 'rgba(245, 166, 35, 0.25)',
    borderColor: '#F5A623',
  },
  quickChipMax: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  quickChipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipTextActive: {
    color: '#F5A623',
    fontWeight: '900',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },
  toastBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
  // Full-Screen Live Camera Scanner Overlay Styles
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  overlayTop: {
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingBottom: 15,
  },
  floatingBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  overlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 270,
  },
  overlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  scanWindow: {
    width: 260,
    height: 260,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#F5A623',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  laserLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#F5A623',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  overlayText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  torchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  torchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scanDashboardContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    alignItems: 'center',
  },
  modernScanHubCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    overflow: 'hidden',
    backgroundColor: '#070D1E',
  },
  scannerInteractiveBox: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 10,
  },
  scannerPreviewBox: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.25)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewLaserLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#F5A623',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  previewCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewCameraIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  previewTapTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  previewTapSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  launchCameraBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  launchCameraGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  launchCameraText: {
    color: '#0D1B3E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  readingGalleryBox: {
    backgroundColor: '#0D1B3E',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 260,
  },
  readingGalleryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  noticeCard: {
    backgroundColor: '#0D1B3E',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    width: '88%',
    maxWidth: 340,
  },
  noticeIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    marginBottom: 12,
  },
  noticeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  noticeMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  noticeDismissBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  noticeDismissGrad: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeDismissText: {
    color: '#0D1B3E',
    fontSize: 13.5,
    fontWeight: '900',
  },
  scanQuickActionsGrid: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 340,
    marginTop: 14,
    gap: 10,
  },
  scanQuickActionCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  scanQuickActionGrad: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
  },
  scanQuickActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scanQuickActionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  scanQuickActionSub: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  securityShieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 340,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: 'rgba(13, 27, 62, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 2,
  },
  securityShieldTitle: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  securityShieldSub: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1,
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
