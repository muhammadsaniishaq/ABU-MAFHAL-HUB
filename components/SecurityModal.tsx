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

const PIN_KEY = 'user_transaction_pin';

interface SecurityModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function SecurityModal({ visible, onClose, onSuccess, title = "Security" }: SecurityModalProps) {
  const [pin, setPin] = useState<string[]>([]);
  const [confirmPin, setConfirmPin] = useState<string[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  
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
  };

  const checkPinStatus = async () => {
    try {
      let existingPin;
      if (Platform.OS === 'web') {
        existingPin = await AsyncStorage.getItem(PIN_KEY);
      } else {
        existingPin = await SecureStore.getItemAsync(PIN_KEY);
      }
      
      setSavedPin(existingPin);
      if (!existingPin) {
        setIsCreating(true);
      } else {
        setIsCreating(false);
        setTimeout(() => promptBiometric(), 400);
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
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
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
    triggerHaptic('light');
    if (pin.length < 4) {
      const newPin = [...pin, digit];
      setPin(newPin);
      if (newPin.length === 4) {
        // Debounce slightly to allow visual update
        setTimeout(() => processPin(newPin.join('')), 50);
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic('light');
    setPin(pin.slice(0, -1));
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
    setPin([]);
  };

  const handleAuthSuccess = () => {
    triggerHaptic('success');
    setSuccessMode(true);
    setTimeout(() => {
      onSuccess();
    }, 1000);
  };

  const processPin = async (inputPin: string) => {
    if (isCreating) {
      if (confirmPin === null) {
        setConfirmPin(inputPin.split(''));
        setPin([]);
        // Short delay for visual clarity
        setTimeout(() => Alert.alert("Confirm PIN", "Re-enter to confirm."), 100);
      } else {
        if (inputPin === confirmPin.join('')) {
          try {
            if (Platform.OS === 'web') {
              await AsyncStorage.setItem(PIN_KEY, inputPin);
            } else {
              await SecureStore.setItemAsync(PIN_KEY, inputPin);
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

  const getTitle = () => {
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
      <View className="flex-1 justify-end bg-black/60">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <Animated.View 
          entering={FadeInDown.springify().damping(18)}
          className="w-full overflow-hidden rounded-t-[36px] bg-white/90"
        >
          <BlurView intensity={90} tint="light" className="w-full pb-8">
            <View className="items-center pt-6 px-6">
              
              {/* Drag Handle (Pill) */}
              <View className="w-10 h-1.5 bg-gray-300 rounded-full mb-6 opacity-60" />

              {/* Header Content */}
              {successMode ? (
                <Animated.View entering={FadeIn.duration(400)} className="items-center py-10">
                   <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                      <Ionicons name="checkmark" size={48} color="#16A34A" />
                   </View>
                   <Text className="text-xl font-bold text-gray-800">Verified!</Text>
                </Animated.View>
              ) : (
                <>
                  <View className="flex-row items-center mb-6">
                    <View className="w-10 h-10 bg-white shadow-sm rounded-xl items-center justify-center mr-3 border border-gray-100">
                      <Image 
                        source={require('../assets/images/logo.png')} 
                        style={{ width: 24, height: 24 }}
                        resizeMode="contain"
                      />
                    </View>
                    <View>
                      <Text className="text-lg font-bold text-gray-800 tracking-tight">{getTitle()}</Text>
                      <Text className="text-gray-500 text-xs font-medium">
                        {isCreating ? "Set a secure 4-digit PIN." : "Enter PIN to continue."}
                      </Text>
                    </View>
                  </View>

                  {/* Enhanced PIN Dots */}
                  <Animated.View style={[styles.dotsContainer, animatedShakeStyle]}>
                    {[0, 1, 2, 3].map((i) => (
                      <PinDot key={i} filled={i < pin.length} error={shake.value !== 0} />
                    ))}
                  </Animated.View>

                  {/* Compact Modern Keypad */}
                  <View className="w-full max-w-[280px] gap-y-3">
                    <View className="flex-row justify-between">
                      {[1, 2, 3].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View className="flex-row justify-between">
                      {[4, 5, 6].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View className="flex-row justify-between">
                      {[7, 8, 9].map(n => <KeypadButton key={n} number={n} onPress={() => handlePress(n.toString())} />)}
                    </View>
                    <View className="flex-row justify-between items-center h-[60px]">
                      <View className="w-[60px] h-[60px] justify-center items-center">
                        {!isCreating && biometricAvailable && (
                          <AnimatedPressable 
                            onPress={promptBiometric} 
                            className="w-12 h-12 bg-blue-50/80 rounded-full justify-center items-center active:bg-blue-100"
                            entering={FadeIn}
                          >
                            <MaterialCommunityIcons name={Platform.OS === 'ios' ? "face-recognition" : "fingerprint"} size={24} color="#2563EB" />
                          </AnimatedPressable>
                        )}
                      </View>
                      
                      <KeypadButton number={0} onPress={() => handlePress('0')} />
                      
                      <View className="w-[60px] h-[60px] justify-center items-center">
                        <TouchableOpacity onPress={handleDelete} hitSlop={{top:15,bottom:15,left:15,right:15}}>
                            <Ionicons name="backspace-outline" size={26} color="#475569" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity onPress={onClose} className="mt-6 py-1">
                    <Text className="text-gray-400 font-semibold text-[13px] uppercase tracking-wider">Cancel</Text>
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
      className="bg-white/70 border border-gray-100 shadow-sm"
    >
      <Text className="text-2xl font-semibold text-gray-700">{number}</Text>
    </AnimatedPressable>
  );
};

const PinDot = ({ filled, error }: { filled: boolean, error: boolean }) => {
  const scale = useDerivedValue(() => withSpring(filled ? 1 : 0.7));
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: filled ? (error ? '#EF4444' : '#2563EB') : 'transparent',
    borderColor: filled ? (error ? '#EF4444' : '#2563EB') : '#94A3B8'
  }));

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
};

const styles = StyleSheet.create({
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  keypadButton: {
    width: 70,
    height: 60, // Shorter height for compactness
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
