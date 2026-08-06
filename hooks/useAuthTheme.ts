import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
    isDark: boolean;
    bgPrimary: string;
    bgCard: string;
    bgInput: string;
    borderPrimary: string;
    borderFocus: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    primaryNavy: string;
    accentTeal: string;
    gold: string;
    cardShadow: string;
}

export const LIGHT_THEME: ThemeColors = {
    isDark: false,
    bgPrimary: '#F5F3EB',
    bgCard: 'rgba(255, 255, 255, 0.94)',
    bgInput: '#FFFFFF',
    borderPrimary: '#E2E8F0',
    borderFocus: '#08E4C7',
    textPrimary: '#0E1A2E',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    primaryNavy: '#0E1A2E',
    accentTeal: '#08E4C7',
    gold: '#D9A73A',
    cardShadow: 'rgba(14, 26, 46, 0.08)',
};

export const DARK_THEME: ThemeColors = {
    isDark: true,
    bgPrimary: '#060D1A',
    bgCard: 'rgba(14, 26, 46, 0.85)',
    bgInput: '#0A1424',
    borderPrimary: '#1E293B',
    borderFocus: '#08E4C7',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primaryNavy: '#0E1A2E',
    accentTeal: '#08E4C7',
    gold: '#D9A73A',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
};

export function useAuthTheme() {
    const [isDark, setIsDark] = useState<boolean>(false);

    useEffect(() => {
        AsyncStorage.getItem('app_theme_preference').then(val => {
            if (val === 'dark') {
                setIsDark(true);
            }
        }).catch(() => {});
    }, []);

    const toggleTheme = async () => {
        const nextState = !isDark;
        setIsDark(nextState);
        try {
            await AsyncStorage.setItem('app_theme_preference', nextState ? 'dark' : 'light');
        } catch (e) {
            console.warn('Failed to save theme preference', e);
        }
    };

    const theme = isDark ? DARK_THEME : LIGHT_THEME;

    return { isDark, toggleTheme, theme };
}
