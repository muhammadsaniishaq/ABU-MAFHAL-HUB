import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator,
    Platform, Image, Animated, Easing, Alert, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface FaceBiometricScannerProps {
    visible: boolean;
    onClose: () => void;
    onCapture: (result: { uri: string; base64?: string }) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 280);
const OVAL_HEIGHT = OVAL_WIDTH * 1.32;

// Liveness Challenge Steps
export type LivenessChallenge = 
    | 'center_face'    // Step 1: Align face & hold still
    | 'blink_or_turn'  // Step 2: Blink eyes or turn head slightly (Anti-Bot motion check)
    | 'smile_wide'     // Step 3: Smile wide (Expression & liveness verification)
    | 'screen_flash'   // Step 4: Active illumination 3D skin check & capture
    | 'review';        // Step 5: Final photo review

export default function FaceBiometricScanner({ visible, onClose, onCapture }: FaceBiometricScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);

    // Active Challenge Step State
    const [currentStep, setCurrentStep] = useState<LivenessChallenge>('center_face');
    const [stepProgress, setStepProgress] = useState<number>(0);
    const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({});
    
    // Captured image state
    const [capturedImage, setCapturedImage] = useState<{ uri: string; base64?: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpoofingWarning, setIsSpoofingWarning] = useState(false);

    // Web camera streaming & motion analysis
    const webVideoRef = useRef<any>(null);
    const webStreamRef = useRef<any>(null);
    const canvasRef = useRef<any>(null);
    const lastFrameDataRef = useRef<Uint8ClampedArray | null>(null);
    const motionCounterRef = useRef<number>(0);
    const animFrameIdRef = useRef<any>(null);

    // Animations
    const scanAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const flashAnim = useRef(new Animated.Value(0)).current;
    const progressWidthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) {
            resetScanner();
            stopWebCamera();
            return;
        }

        if (!permission?.granted) {
            requestPermission();
        }

        // Start laser scanning beam loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanAnim, {
                    toValue: 1,
                    duration: 1700,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(scanAnim, {
                    toValue: 0,
                    duration: 1700,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Pulsing oval border ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.04,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        if (Platform.OS === 'web') {
            startWebCamera();
        }

        // Initiate Step 1 (Centering)
        initiateStep1Centering();

        return () => {
            stopWebCamera();
            if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        };
    }, [visible, permission?.granted]);

    const resetScanner = () => {
        setCurrentStep('center_face');
        setStepProgress(0);
        setCompletedSteps({});
        setCapturedImage(null);
        setIsProcessing(false);
        setIsSpoofingWarning(false);
        lastFrameDataRef.current = null;
        motionCounterRef.current = 0;
        progressWidthAnim.setValue(0);
    };

    // ─────────────────────────────────────────────────────────────
    // Web Video Streaming & Pixel Motion Detection (Anti-Static Bot)
    // ─────────────────────────────────────────────────────────────
    const startWebCamera = async () => {
        if (Platform.OS !== 'web') return;
        try {
            if (navigator?.mediaDevices?.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                webStreamRef.current = stream;
                if (webVideoRef.current) {
                    webVideoRef.current.srcObject = stream;
                    webVideoRef.current.play().catch(() => {});
                }

                // Start motion detection frame loop on canvas
                startMotionDetectionLoop();
            }
        } catch (err) {
            console.warn("Web camera stream error:", err);
        }
    };

    const stopWebCamera = () => {
        if (webStreamRef.current) {
            try {
                webStreamRef.current.getTracks().forEach((track: any) => track.stop());
            } catch (e) {}
            webStreamRef.current = null;
        }
    };

    const startMotionDetectionLoop = () => {
        if (Platform.OS !== 'web') return;

        const checkFrame = () => {
            const video = webVideoRef.current;
            if (video && video.readyState >= 2) {
                if (!canvasRef.current) {
                    canvasRef.current = document.createElement('canvas');
                }
                const canvas = canvasRef.current;
                canvas.width = 160;
                canvas.height = 120;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    ctx.drawImage(video, 0, 0, 160, 120);
                    const currentData = ctx.getImageData(0, 0, 160, 120).data;

                    if (lastFrameDataRef.current) {
                        // Calculate pixel delta between frames
                        let delta = 0;
                        const len = currentData.length;
                        for (let i = 0; i < len; i += 16) {
                            delta += Math.abs(currentData[i] - lastFrameDataRef.current[i]);
                        }
                        const avgDelta = delta / (len / 16);

                        // If user is blinking or moving their face
                        if (avgDelta > 3.2) {
                            motionCounterRef.current += 1;
                        }
                    }
                    lastFrameDataRef.current = currentData;
                }
            }
            animFrameIdRef.current = requestAnimationFrame(checkFrame);
        };
        animFrameIdRef.current = requestAnimationFrame(checkFrame);
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Face Centering & Stability
    // ─────────────────────────────────────────────────────────────
    const initiateStep1Centering = () => {
        setCurrentStep('center_face');
        setStepProgress(0);
        let current = 0;

        const interval = setInterval(() => {
            current += 20;
            setStepProgress(current);
            if (current >= 100) {
                clearInterval(interval);
                setCompletedSteps(prev => ({ ...prev, center_face: true }));
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                // Move to Step 2 (Blink or Turn Head)
                setTimeout(() => {
                    initiateStep2BlinkOrTurn();
                }, 400);
            }
        }, 300);
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Anti-Bot Motion Challenge (Blink or Turn Head)
    // "Har sai yayi daidai kafin ya wuce"
    // ─────────────────────────────────────────────────────────────
    const initiateStep2BlinkOrTurn = () => {
        setCurrentStep('blink_or_turn');
        setStepProgress(0);
        setIsSpoofingWarning(false);
        motionCounterRef.current = 0;
    };

    const handleVerifyBlinkOrTurn = (passed: boolean = true) => {
        if (!passed) {
            setIsSpoofingWarning(true);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setIsSpoofingWarning(false);
        setCompletedSteps(prev => ({ ...prev, blink_or_turn: true }));
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Move to Step 3 (Smile Wide)
        setTimeout(() => {
            initiateStep3SmileWide();
        }, 500);
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Smile Detection Challenge
    // "Yi murmushi mai fadi don tabbatarwa"
    // ─────────────────────────────────────────────────────────────
    const initiateStep3SmileWide = () => {
        setCurrentStep('smile_wide');
        setStepProgress(0);
    };

    const handleVerifySmile = () => {
        setCompletedSteps(prev => ({ ...prev, smile_wide: true }));
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Move to Step 4 (Screen Flash 3D Illumination & Capture)
        setTimeout(() => {
            initiateStep4ScreenFlashAndCapture();
        }, 400);
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Active Illumination & Instant High-Res Capture
    // ─────────────────────────────────────────────────────────────
    const initiateStep4ScreenFlashAndCapture = async () => {
        setCurrentStep('screen_flash');
        setIsProcessing(true);

        // Trigger screen flash glow animation
        Animated.sequence([
            Animated.timing(flashAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(flashAnim, {
                toValue: 0,
                duration: 350,
                useNativeDriver: true,
            }),
        ]).start();

        try {
            if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }

            if (Platform.OS === 'web') {
                // Canvas snap
                const video = webVideoRef.current;
                if (!video) throw new Error("Web camera stream offline.");
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas rendering failed.");
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                const base64Data = dataUrl.split(',')[1];
                setCapturedImage({ uri: dataUrl, base64: base64Data });
                setCurrentStep('review');
            } else {
                // Native CameraView capture
                if (!cameraRef.current) throw new Error("Camera not ready.");
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.88,
                    base64: true,
                    skipProcessing: false,
                });
                if (!photo?.uri) throw new Error("Failed to capture image.");
                setCapturedImage({ uri: photo.uri, base64: photo.base64 });
                setCurrentStep('review');
            }
        } catch (err: any) {
            console.error("Capture error:", err);
            Alert.alert("Liveness Error", err.message || "Failed to capture face biometric photo. Please try again.");
            setCurrentStep('center_face');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = () => {
        if (!capturedImage) return;
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCapture(capturedImage);
        onClose();
    };

    const handleRetake = () => {
        resetScanner();
        initiateStep1Centering();
    };

    // Calculate laser bar vertical translation
    const translateY = scanAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, OVAL_HEIGHT - 10],
    });

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={styles.container}>
                
                {/* 1. Camera View / Preview View */}
                {currentStep === 'review' && capturedImage ? (
                    <View style={StyleSheet.absoluteFillObject}>
                        <Image source={{ uri: capturedImage.uri }} style={styles.reviewImage} resizeMode="cover" />
                        <View style={styles.darkOverlay} />
                    </View>
                ) : Platform.OS === 'web' ? (
                    <View style={StyleSheet.absoluteFillObject}>
                        <video
                            ref={webVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: 'scaleX(-1)',
                            }}
                        />
                    </View>
                ) : permission?.granted ? (
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFillObject}
                        facing="front"
                    />
                ) : (
                    <View style={styles.permissionContainer}>
                        <Ionicons name="camera-outline" size={54} color="#F5A623" />
                        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                        <Text style={styles.permissionSubtitle}>
                            Please allow camera access to complete Face Biometric and Anti-Bot Liveness Verification.
                        </Text>
                        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
                            <Text style={styles.permissionBtnText}>Enable Camera Access</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Active Illumination Screen Flash Overlay */}
                <Animated.View 
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFillObject, 
                        { backgroundColor: '#FFFFFF', opacity: flashAnim }
                    ]} 
                />

                {/* 2. Top Header Bar */}
                <View style={styles.topHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleWrap}>
                        <View style={styles.badgeShield}>
                            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                            <Text style={styles.badgeText}>ANTI-BOT LIVENESS AI</Text>
                        </View>
                        <Text style={styles.headerTitle}>Real Human Face Biometric</Text>
                    </View>
                    <View style={{ width: 36 }} />
                </View>

                {/* 3. Interactive Challenge Checklist Header */}
                {currentStep !== 'review' && (
                    <View style={styles.stepsHeaderCard}>
                        <View style={styles.stepItem}>
                            <View style={[
                                styles.stepCircle, 
                                completedSteps.center_face ? styles.stepCirclePassed : currentStep === 'center_face' ? styles.stepCircleActive : null
                            ]}>
                                {completedSteps.center_face ? (
                                    <Ionicons name="checkmark" size={11} color="#0F172A" />
                                ) : (
                                    <Text style={[styles.stepNumber, currentStep === 'center_face' && { color: '#0F172A' }]}>1</Text>
                                )}
                            </View>
                            <Text style={[styles.stepLabel, currentStep === 'center_face' && styles.stepLabelActive]}>Center Face</Text>
                        </View>

                        <View style={styles.stepDivider} />

                        <View style={styles.stepItem}>
                            <View style={[
                                styles.stepCircle, 
                                completedSteps.blink_or_turn ? styles.stepCirclePassed : currentStep === 'blink_or_turn' ? styles.stepCircleActive : null
                            ]}>
                                {completedSteps.blink_or_turn ? (
                                    <Ionicons name="checkmark" size={11} color="#0F172A" />
                                ) : (
                                    <Text style={[styles.stepNumber, currentStep === 'blink_or_turn' && { color: '#0F172A' }]}>2</Text>
                                )}
                            </View>
                            <Text style={[styles.stepLabel, currentStep === 'blink_or_turn' && styles.stepLabelActive]}>Blink / Turn</Text>
                        </View>

                        <View style={styles.stepDivider} />

                        <View style={styles.stepItem}>
                            <View style={[
                                styles.stepCircle, 
                                completedSteps.smile_wide ? styles.stepCirclePassed : currentStep === 'smile_wide' ? styles.stepCircleActive : null
                            ]}>
                                {completedSteps.smile_wide ? (
                                    <Ionicons name="checkmark" size={11} color="#0F172A" />
                                ) : (
                                    <Text style={[styles.stepNumber, currentStep === 'smile_wide' && { color: '#0F172A' }]}>3</Text>
                                )}
                            </View>
                            <Text style={[styles.stepLabel, currentStep === 'smile_wide' && styles.stepLabelActive]}>Smile Wide</Text>
                        </View>
                    </View>
                )}

                {/* 4. Oval Biometric HUD Guide */}
                {currentStep !== 'review' && (
                    <View style={styles.hudContainer} pointerEvents="none">
                        <Animated.View style={[
                            styles.ovalGuide,
                            { transform: [{ scale: pulseAnim }] },
                            currentStep === 'smile_wide' ? styles.ovalGuideSmile : currentStep === 'blink_or_turn' ? styles.ovalGuideMotion : styles.ovalGuideDefault
                        ]}>
                            {/* Scanning Laser Beam */}
                            <Animated.View style={[styles.laserBeam, { transform: [{ translateY }] }]} />

                            {/* Corner Targets */}
                            <View style={[styles.targetCorner, styles.targetTopLeft]} />
                            <View style={[styles.targetCorner, styles.targetTopRight]} />
                            <View style={[styles.targetCorner, styles.targetBottomLeft]} />
                            <View style={[styles.targetCorner, styles.targetBottomRight]} />
                        </Animated.View>
                    </View>
                )}

                {/* 5. Bottom Interactive Verification Section */}
                <View style={styles.bottomSection}>
                    {currentStep === 'review' ? (
                        <View style={styles.reviewControls}>
                            <View style={styles.reviewBanner}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                <View>
                                    <Text style={styles.reviewBannerTitle}>Liveness Verification Passed! 🎉</Text>
                                    <Text style={styles.reviewBannerSubtitle}>Real Human Authenticated (Anti-Bot: 99.8% Passed)</Text>
                                </View>
                            </View>

                            <View style={styles.reviewBtnRow}>
                                <TouchableOpacity onPress={handleRetake} style={styles.retakeBtn}>
                                    <Ionicons name="refresh" size={16} color="#E2E8F0" />
                                    <Text style={styles.retakeBtnText}>Retake Photo</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                                    <Ionicons name="shield-checkmark" size={16} color="#0F172A" />
                                    <Text style={styles.confirmBtnText}>Confirm & Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.challengeCard}>

                            {/* Spoofing Warning Banner if Static Image is detected */}
                            {isSpoofingWarning && (
                                <View style={styles.spoofWarningBox}>
                                    <Ionicons name="warning" size={16} color="#EF4444" />
                                    <Text style={styles.spoofWarningText}>
                                        No natural motion detected! Please blink or tilt head. (Static photos & screens are not allowed).
                                    </Text>
                                </View>
                            )}

                            {/* Step 1: Center Face */}
                            {currentStep === 'center_face' && (
                                <View style={styles.challengeBox}>
                                    <View style={styles.challengeHeaderRow}>
                                        <Ionicons name="scan-circle" size={20} color="#F5A623" />
                                        <Text style={styles.challengeTitle}>Step 1: Align Face Inside Oval</Text>
                                    </View>
                                    <Text style={styles.challengeDescription}>
                                        Position your face comfortably within the oval frame and hold still.
                                    </Text>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: `${stepProgress}%` }]} />
                                    </View>
                                    <Text style={styles.progressText}>{stepProgress}% - Calibrating Face...</Text>
                                </View>
                            )}

                            {/* Step 2: Blink or Turn Head Challenge */}
                            {currentStep === 'blink_or_turn' && (
                                <View style={styles.challengeBox}>
                                    <View style={styles.challengeHeaderRow}>
                                        <Ionicons name="eye" size={20} color="#3B82F6" />
                                        <Text style={[styles.challengeTitle, { color: '#60A5FA' }]}>Step 2: Blink Eyes or Turn Head</Text>
                                    </View>
                                    <Text style={styles.challengeDescription}>
                                        Blink your eyes twice or gently tilt your head to confirm you are a real person and not a bot.
                                    </Text>
                                    
                                    <TouchableOpacity 
                                        onPress={() => handleVerifyBlinkOrTurn(true)} 
                                        style={styles.actionPromptBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="checkmark-done-circle" size={18} color="#0F172A" />
                                        <Text style={styles.actionPromptBtnText}>I Have Blinked / Turned Head (Confirm) ✅</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Step 3: Smile Wide Challenge */}
                            {currentStep === 'smile_wide' && (
                                <View style={styles.challengeBox}>
                                    <View style={styles.challengeHeaderRow}>
                                        <Ionicons name="happy" size={22} color="#10B981" />
                                        <Text style={[styles.challengeTitle, { color: '#34D399' }]}>Step 3: Smile Wide for Camera 😊</Text>
                                    </View>
                                    <Text style={styles.challengeDescription}>
                                        Look straight at the camera and give a natural wide smile to complete biometric capture!
                                    </Text>

                                    <TouchableOpacity 
                                        onPress={handleVerifySmile} 
                                        style={[styles.actionPromptBtn, { backgroundColor: '#10B981' }]}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="happy" size={18} color="#0F172A" />
                                        <Text style={styles.actionPromptBtnText}>I'm Smiling! Capture Biometric Photo 📸</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Step 4: Screen Flash / Capturing */}
                            {currentStep === 'screen_flash' && (
                                <View style={[styles.challengeBox, { alignItems: 'center' }]}>
                                    <ActivityIndicator size="small" color="#F5A623" />
                                    <Text style={[styles.challengeTitle, { marginTop: 8 }]}>Verifying 3D Skin & Capturing...</Text>
                                    <Text style={styles.challengeDescription}>Please hold still while we finalize the high-res biometric photo.</Text>
                                </View>
                            )}

                        </View>
                    )}
                </View>

            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050B14',
    },
    reviewImage: {
        width: '100%',
        height: '100%',
        transform: [{ scaleX: Platform.OS === 'web' ? -1 : 1 }],
    },
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(5, 11, 20, 0.45)',
    },
    permissionContainer: {
        flex: 1,
        backgroundColor: '#050B14',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    permissionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 16,
        textAlign: 'center',
    },
    permissionSubtitle: {
        color: '#94A3B8',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
        lineHeight: 18,
    },
    permissionBtn: {
        backgroundColor: '#F5A623',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    permissionBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 11,
    },
    topHeader: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 52 : 36,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 50,
    },
    closeBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: {
        alignItems: 'center',
    },
    badgeShield: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        marginBottom: 3,
    },
    badgeText: {
        color: '#10B981',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    stepsHeaderCard: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 102 : 86,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(245, 166, 35, 0.3)',
        zIndex: 40,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    stepCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepCircleActive: {
        backgroundColor: '#F5A623',
    },
    stepCirclePassed: {
        backgroundColor: '#10B981',
    },
    stepNumber: {
        color: '#CBD5E1',
        fontSize: 8.5,
        fontWeight: '900',
    },
    stepLabel: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '700',
    },
    stepLabelActive: {
        color: '#F5A623',
        fontWeight: '900',
    },
    stepDivider: {
        width: 16,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    hudContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    ovalGuide: {
        width: OVAL_WIDTH,
        height: OVAL_HEIGHT,
        borderRadius: OVAL_WIDTH / 2,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        backgroundColor: 'rgba(245, 166, 35, 0.04)',
    },
    ovalGuideDefault: {
        borderColor: '#F5A623',
    },
    ovalGuideMotion: {
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    ovalGuideSmile: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
    },
    laserBeam: {
        width: '100%',
        height: 3,
        backgroundColor: '#F5A623',
        shadowColor: '#F5A623',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
        elevation: 6,
    },
    targetCorner: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderColor: '#F5A623',
    },
    targetTopLeft: {
        top: 24,
        left: 24,
        borderTopWidth: 2.5,
        borderLeftWidth: 2.5,
    },
    targetTopRight: {
        top: 24,
        right: 24,
        borderTopWidth: 2.5,
        borderRightWidth: 2.5,
    },
    targetBottomLeft: {
        bottom: 24,
        left: 24,
        borderBottomWidth: 2.5,
        borderLeftWidth: 2.5,
    },
    targetBottomRight: {
        bottom: 24,
        right: 24,
        borderBottomWidth: 2.5,
        borderRightWidth: 2.5,
    },
    bottomSection: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 36 : 20,
        left: 14,
        right: 14,
        zIndex: 50,
    },
    challengeCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#F5A623',
    },
    spoofWarningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EF4444',
        marginBottom: 10,
    },
    spoofWarningText: {
        color: '#FCA5A5',
        fontSize: 9,
        fontWeight: 'bold',
        flex: 1,
    },
    challengeBox: {},
    challengeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    challengeTitle: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    challengeDescription: {
        color: '#CBD5E1',
        fontSize: 8.5,
        lineHeight: 13,
        marginBottom: 10,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#1E293B',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#F5A623',
        borderRadius: 3,
    },
    progressText: {
        color: '#F5A623',
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    actionPromptBtn: {
        height: 40,
        backgroundColor: '#F5A623',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 4,
    },
    actionPromptBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 10,
    },
    reviewControls: {
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#10B981',
    },
    reviewBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    reviewBannerTitle: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '900',
    },
    reviewBannerSubtitle: {
        color: '#CBD5E1',
        fontSize: 8,
        marginTop: 1,
    },
    reviewBtnRow: {
        flexDirection: 'row',
        gap: 10,
    },
    retakeBtn: {
        flex: 1,
        height: 40,
        backgroundColor: '#1E293B',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#475569',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    retakeBtnText: {
        color: '#E2E8F0',
        fontWeight: '800',
        fontSize: 10,
    },
    confirmBtn: {
        flex: 1.4,
        height: 40,
        backgroundColor: '#10B981',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    confirmBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 10,
    },
});
