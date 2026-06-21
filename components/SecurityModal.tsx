import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Platform, Alert, Dimensions, Image, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  useDerivedValue,
  withSequence,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { supabase } from '../services/supabase';

const PIN_KEY = 'user_transaction_pin';

interface SecurityModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  requiredFor?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SecurityModal({ visible, onClose, onSuccess, title = "Security" }: SecurityModalProps) {
  const [pin, setPin] = useState<string[]>([]);
  const [confirmPin, setConfirmPin] = useState<string[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  
  // Google 2FA States
  const [mfaMode, setMfaMode] = useState(false);
  const [mfaCode, setMfaCode] = useState<string[]>([]);
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  const shake = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setSuccessMode(false);
      checkPinStatus();
      checkBiometric();
    } else {
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setPin([]);
    setConfirmPin(null);
    setSuccessMode(false);
    setMfaMode(false);
    setMfaCode([]);
    setVerifyingMfa(false);
  };

  const checkPinStatus = async () => {
    try {
      let existingPin;
      if (Platform.OS === 'web') {
        existingPin = await AsyncStorage.getItem(PIN_KEY);
      } else {
        existingPin = await SecureStore.getItemAsync(PIN_KEY);
      }
      
      // If PIN is not found locally, query Supabase profiles database
      if (!existingPin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('transaction_pin')
            .eq('id', user.id)
            .single();
          if (profile?.transaction_pin) {
            existingPin = profile.transaction_pin;
            // Cache locally for offline and quick access
            if (Platform.OS === 'web') {
              await AsyncStorage.setItem(PIN_KEY, existingPin);
            } else {
              await SecureStore.setItemAsync(PIN_KEY, existingPin);
            }
          }
        }
      }
      
      setSavedPin(existingPin);
      if (!existingPin) {
        setIsCreating(true);
      } else {
        setIsCreating(false);
        // Only auto-trigger biometric prompt if explicitly set up first
        const isBioSetup = await AsyncStorage.getItem('biometrics_setup_completed');
        if (isBioSetup === 'true') {
          setTimeout(() => promptBiometric(), 400);
        }
      }
    } catch (e) {
      console.error("Storage Error", e);
    }
  };

  const checkBiometric = async () => {
    if (Platform.OS === 'web') return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isBioSetup = await AsyncStorage.getItem('biometrics_setup_completed');
      if (hasHardware && isEnrolled && isBioSetup === 'true') {
        setBiometricAvailable(true);
      } else {
        setBiometricAvailable(false);
      }
    } catch (e) {
      console.log("Biometric check error", e);
    }
  };

  const promptBiometric = async () => {
    if (!biometricAvailable || isCreating || Platform.OS === 'web') return;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify identity',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        handleAuthSuccess();
      }
    } catch (e) {
      console.log("Biometric error", e);
    }
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'error' | 'success') => {
    if (Platform.OS === 'web') return;
    switch (type) {
      case 'light': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
    }
  };

  const handlePress = (digit: string) => {
    if (verifyingMfa) return;
    triggerHaptic('light');
    if (mfaMode) {
      if (mfaCode.length < 6) {
        const newCode = [...mfaCode, digit];
        setMfaCode(newCode);
        if (newCode.length === 6) {
          setTimeout(() => processMfaCode(newCode.join('')), 100);
        }
      }
    } else {
      if (pin.length < 4) {
        const newPin = [...pin, digit];
        setPin(newPin);
        if (newPin.length === 4) {
          // Debounce slightly to allow visual update
          setTimeout(() => processPin(newPin.join('')), 100);
        }
      }
    }
  };

  const handleDelete = () => {
    if (verifyingMfa) return;
    triggerHaptic('light');
    if (mfaMode) {
      setMfaCode(mfaCode.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  const triggerShake = () => {
    triggerHaptic('error');
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    if (mfaMode) {
      setMfaCode([]);
    } else {
      setPin([]);
    }
  };

  const handleAuthSuccess = async () => {
    // Check if account has Google Authenticator 2FA (MFA) enabled and requires level upgrade
    try {
      const { data: levelData, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!levelError && levelData) {
        if (levelData.nextLevel === 'aal2' && levelData.currentLevel === 'aal1') {
          // Admin has 2FA enabled, transition modal to 2FA verification mode
          setMfaMode(true);
          setPin([]); // Clear PIN
          return;
        }
      }
    } catch (e) {
      console.log("MFA check failed during verification:", e);
    }

    triggerHaptic('success');
    setSuccessMode(true);
    setTimeout(() => {
      onSuccess();
    }, 800);
  };

  const processPin = async (inputPin: string) => {
    if (isCreating) {
      if (confirmPin === null) {
        setConfirmPin(inputPin.split(''));
        setPin([]);
        setTimeout(() => Alert.alert("Confirm PIN", "Re-enter your transaction PIN to confirm."), 100);
      } else {
        if (inputPin === confirmPin.join('')) {
          try {
            if (Platform.OS === 'web') {
              await AsyncStorage.setItem(PIN_KEY, inputPin);
            } else {
              await SecureStore.setItemAsync(PIN_KEY, inputPin);
            }

            // Sync with Supabase database profiles table
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { error: dbError } = await supabase
                .from('profiles')
                .update({ transaction_pin: inputPin })
                .eq('id', user.id);
              if (dbError) throw dbError;
            }

            setSavedPin(inputPin);
            setIsCreating(false);
            handleAuthSuccess();
          } catch (e) {
            Alert.alert("Error", "Failed to save PIN");
          }
        } else {
          Alert.alert("Error", "PINs do not match. Try again.");
          setConfirmPin(null);
          setPin([]);
        }
      }
    } else {
      if (inputPin === savedPin) {
        handleAuthSuccess();
      } else {
        triggerShake();
      }
    }
  };

  const processMfaCode = async (code: string) => {
    setVerifyingMfa(true);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      if (!factors || !factors.totp) throw new Error("Could not retrieve authenticator factors.");

      const activeFactor = factors.totp.find(f => f.status === 'verified');
      if (!activeFactor) throw new Error("No active Google Authenticator 2FA enrolled.");

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: activeFactor.id
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: activeFactor.id,
        challengeId: challengeData.id,
        code: code
      });
      if (verifyError) throw verifyError;

      // Successful 2FA code verification!
      triggerHaptic('success');
      setSuccessMode(true);
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: any) {
      triggerShake();
      Alert.alert("2FA Verification Failed", err.message || "Invalid Google Authenticator code.");
    } finally {
      setVerifyingMfa(false);
    }
  };

  const getTitle = () => {
    if (mfaMode) {
      return "Google 2FA";
    }
    if (isCreating) {
      return confirmPin ? "Confirm PIN" : "New PIN";
    }
    return title;
  };

  const animatedShakeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shake.value }],
    };
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        
        <Animated.View 
          entering={FadeInDown.springify().damping(18)}
          style={styles.modalCard}
        >
          <BlurView intensity={95} tint="light" style={styles.blurView}>
            <View style={styles.cardContent}>
              
              {/* Header Content */}
              {successMode ? (
                <Animated.View entering={FadeIn.duration(300)} style={styles.successContainer}>
                   <View style={styles.successIconCircle}>
                      <Ionicons name="checkmark" size={36} color="#10b981" />
                   </View>
                   <Text style={styles.successText}>Verified!</Text>
                </Animated.View>
              ) : (
                <>
                  <View style={styles.headerRow}>
                    <View style={styles.logoCard}>
                      <Image 
                        source={require('../assets/images/logo.png')} 
                        style={{ width: 22, height: 22 }}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.headerTexts}>
                      <Text style={styles.cardTitle}>{getTitle()}</Text>
                      <Text style={styles.cardSubtitle}>
                        {mfaMode 
                          ? "Enter 6-digit Google 2FA code." 
                          : isCreating 
                            ? "Set a secure 4-digit PIN." 
                            : "Enter PIN to continue."}
                      </Text>
                    </View>
                  </View>

                  {/* Enhanced PIN/MFA Dots */}
                  <Animated.View style={[styles.dotsContainer, animatedShakeStyle]}>
                    {mfaMode ? (
                      [0, 1, 2, 3, 4, 5].map((i) => (
                        <PinDot key={i} filled={i < mfaCode.length} error={shake.value !== 0} />
                      ))
                    ) : (
                      [0, 1, 2, 3].map((i) => (
                        <PinDot key={i} filled={i < pin.length} error={shake.value !== 0} />
                      ))
                    )}
                  </Animated.View>

                  {/* Compact Modern Keypad */}
                  <View style={styles.keypadGrid}>
                    <View style={styles.keypadRow}>
                      {[1, 2, 3].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View style={styles.keypadRow}>
                      {[4, 5, 6].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View style={styles.keypadRow}>
                      {[7, 8, 9].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View style={styles.keypadRow}>
                      <View style={styles.actionButtonContainer}>
                          {!mfaMode && !isCreating && biometricAvailable && (
                           <AnimatedPressable 
                             onPress={promptBiometric} 
                             style={styles.biometricButton}
                             entering={FadeIn}
                           >
                             <MaterialCommunityIcons name={Platform.OS === 'ios' ? "face-recognition" : "fingerprint"} size={20} color="#f5a623" />
                           </AnimatedPressable>
                        )}
                      </View>
                      
                      <KeypadButton number={0} onPress={() => handlePress('0')} />
                      
                      <View style={styles.actionButtonContainer}>
                        <TouchableOpacity onPress={handleDelete} hitSlop={{top:15,bottom:15,left:15,right:15}}>
                            <Ionicons name="backspace-outline" size={22} color="#f5a623" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const KeypadButton = ({ number, onPress }: { number: number, onPress: () => void }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  return (
    <AnimatedPressable 
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, styles.keypadButton]}
    >
      <Text style={styles.keypadButtonText}>{number}</Text>
    </AnimatedPressable>
  );
};

const PinDot = ({ filled, error }: { filled: boolean, error: boolean }) => {
  const scale = useDerivedValue(() => withSpring(filled ? 1 : 0.7));
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: filled ? (error ? '#EF4444' : '#f5a623') : 'transparent',
    borderColor: filled ? (error ? '#EF4444' : '#f5a623') : '#cbd5e1'
  }));

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalCard: {
    width: '90%',
    maxWidth: 300,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0d1b3e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  blurView: {
    width: '100%',
  },
  cardContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  successText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d1b3e',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  logoCard: {
    width: 38,
    height: 38,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.2)',
  },
  headerTexts: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0d1b3e',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
  },
  keypadGrid: {
    gap: 8,
    width: '100%',
    maxWidth: 200,
    alignItems: 'center',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  keypadButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0a1633',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  keypadButtonText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0d1b3e',
  },
  actionButtonContainer: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
