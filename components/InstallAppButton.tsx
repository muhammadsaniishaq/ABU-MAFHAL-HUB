import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Executive Light Navy & Gold Design Tokens
const L = {
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textMuted: '#64748B',
    inputBorder: '#CBD5E1',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5'
};

export default function InstallAppButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isIosDevice, setIsIosDevice] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Detect iOS
        if (typeof navigator !== 'undefined') {
            const ua = window.navigator.userAgent.toLowerCase();
            if (/iphone|ipad|ipod/.test(ua)) {
                setIsIosDevice(true);
            }
        }

        // Check if already running as installed PWA
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setModalVisible(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleButtonClick = () => {
        if (deferredPrompt) {
            triggerNativePrompt();
        } else {
            setModalVisible(true);
        }
    };

    const triggerNativePrompt = async () => {
        if (!deferredPrompt) {
            setModalVisible(true);
            return;
        }
        try {
            deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                setIsInstalled(true);
                setModalVisible(false);
            }
            setDeferredPrompt(null);
        } catch (e) {
            console.error("Install prompt error:", e);
            setModalVisible(true);
        }
    };

    if (isInstalled) return null;

    return (
        <View>
            {/* Install Button Trigger */}
            <TouchableOpacity 
                onPress={handleButtonClick}
                activeOpacity={0.8}
                style={{
                    backgroundColor: L.navyHeader,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: L.gold,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    elevation: 2
                }}
            >
                <Ionicons name="phone-portrait" size={12} color={L.gold} />
                <Text style={{ color: L.gold, fontSize: 8.5, fontWeight: '900', textTransform: 'uppercase' }}>
                    Install App On Phone 📱
                </Text>
            </TouchableOpacity>

            {/* PWA Installation Guidance Modal */}
            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: L.goldDk, maxWidth: 450, width: '100%', elevation: 10 }}>
                        
                        {/* Modal Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderColor: L.inputBorder, paddingBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: L.goldBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.goldDk }}>
                                    <Ionicons name="phone-portrait-outline" size={16} color={L.goldAmber} />
                                </View>
                                <Text style={{ color: L.navyHeader, fontWeight: '900', fontSize: 12 }}>Install App On Your Phone</Text>
                            </View>

                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={20} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Modal Body */}
                        <Text style={{ color: L.textPrimary, fontSize: 10, fontWeight: 'bold', marginBottom: 10 }}>
                            Add <Text style={{ color: L.goldAmber, fontWeight: '900' }}>ABU MAFHAL HUB</Text> directly to your phone's Home Screen as a smartphone app!
                        </Text>

                        {/* Native Trigger Button if available */}
                        {deferredPrompt ? (
                            <TouchableOpacity 
                                onPress={triggerNativePrompt}
                                style={{ backgroundColor: L.navyHeader, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: L.gold, marginBottom: 12 }}
                            >
                                <Ionicons name="download-outline" size={16} color={L.gold} />
                                <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Tap Here To Install Now 📱</Text>
                            </TouchableOpacity>
                        ) : isIosDevice ? (
                            /* iOS Safari Instructions Card */
                            <View style={{ backgroundColor: L.goldBg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: L.goldDk, marginBottom: 12 }}>
                                <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 10, marginBottom: 6 }}>iPhone / iPad (Safari Browser) Instructions:</Text>
                                <View style={{ gap: 4 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>1️⃣ Tap the <Text style={{ fontWeight: '900' }}>Share Button (⬆️)</Text> at the bottom of Safari.</Text>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>2️⃣ Scroll down & tap <Text style={{ fontWeight: '900' }}>"Add to Home Screen" (➕)</Text>.</Text>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>3️⃣ Tap <Text style={{ fontWeight: '900' }}>"Add"</Text> at top right corner!</Text>
                                </View>
                            </View>
                        ) : (
                            /* Android / Chrome Instructions Card */
                            <View style={{ backgroundColor: L.goldBg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: L.goldDk, marginBottom: 12 }}>
                                <Text style={{ color: L.goldAmber, fontWeight: '900', fontSize: 10, marginBottom: 6 }}>Android / Chrome Browser Instructions:</Text>
                                <View style={{ gap: 4 }}>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>1️⃣ Tap your browser menu <Text style={{ fontWeight: '900' }}>(3 dots ⋮ at top right)</Text>.</Text>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>2️⃣ Tap <Text style={{ fontWeight: '900' }}>"Add to Home Screen"</Text> or <Text style={{ fontWeight: '900' }}>"Install App"</Text> (📱).</Text>
                                    <Text style={{ color: L.textPrimary, fontSize: 9, fontWeight: '700' }}>3️⃣ Tap <Text style={{ fontWeight: '900' }}>"Install"</Text> to place app icon on your phone!</Text>
                                </View>
                            </View>
                        )}

                        {/* Close Modal Action Button */}
                        <TouchableOpacity 
                            onPress={() => setModalVisible(false)}
                            style={{ backgroundColor: L.navyHeader, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 9, textTransform: 'uppercase' }}>Got It, Close</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}
