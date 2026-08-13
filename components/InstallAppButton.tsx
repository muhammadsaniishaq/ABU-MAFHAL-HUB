import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Executive Light Navy & Gold Design Tokens
const L = {
    navyHeader: '#0F172A',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    card: '#FFFFFF',
    inputBorder: '#CBD5E1'
};

export default function InstallAppButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;

        // Check if already running in standalone mode (PWA installed)
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
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isInstalled) {
            Alert.alert("Already Installed! 🎉", "ABU MAFHAL HUB is already installed on your device.");
            return;
        }

        if (deferredPrompt) {
            try {
                deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the PWA install prompt');
                    setIsInstalled(true);
                }
                setDeferredPrompt(null);
            } catch (e) {
                console.error("Install prompt error:", e);
            }
        } else {
            // iOS Safari or manual instructions
            if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
                const userAgent = window.navigator.userAgent.toLowerCase();
                const isIos = /iphone|ipad|ipod/.test(userAgent);
                
                if (isIos) {
                    Alert.alert(
                        "Install on iPhone / iPad 📱",
                        "To install ABU MAFHAL HUB on your home screen:\n\n1. Tap the Share button at the bottom of Safari.\n2. Select 'Add to Home Screen' (➕).\n3. Tap 'Add'!"
                    );
                } else {
                    Alert.alert(
                        "Install App 📱",
                        "To install on your phone:\n\n1. Open your browser menu (3 dots ⋮).\n2. Tap 'Add to Home Screen' or 'Install App'!"
                    );
                }
            }
        }
    };

    if (isInstalled) return null;

    return (
        <TouchableOpacity 
            onPress={handleInstallClick}
            style={{
                backgroundColor: L.navyHeader,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: L.gold,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                elevation: 2
            }}
        >
            <Ionicons name="phone-portrait-outline" size={14} color={L.gold} />
            <Text style={{ color: L.gold, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' }}>
                Install App On Phone 📱
            </Text>
        </TouchableOpacity>
    );
}
