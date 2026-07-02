import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface AppSettings {
    maintenance_mode: boolean;
    allow_registrations: boolean;
    require_email_verif: boolean;
    force_app_update: boolean;
    allow_biometrics: boolean;
    auto_approve_kyc: boolean;
    hide_user_balances: boolean;
    support_whatsapp: string;
    support_email: string;
    funding_fee_type: string;
    funding_fee_value: string;
    [key: string]: any;
}

const DEFAULT_SETTINGS: AppSettings = {
    maintenance_mode: false,
    allow_registrations: true,
    require_email_verif: false,
    force_app_update: false,
    allow_biometrics: true,
    auto_approve_kyc: false,
    hide_user_balances: false,
    support_whatsapp: '',
    support_email: '',
    funding_fee_type: 'fixed',
    funding_fee_value: '0'
};

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase.from('app_settings').select('key, value');
            if (error) throw error;

            if (data) {
                const newSettings = { ...DEFAULT_SETTINGS };
                data.forEach((item: any) => {
                    if (item.value === 'true' || item.value === 'false') {
                        newSettings[item.key] = item.value === 'true';
                    } else {
                        newSettings[item.key] = item.value;
                    }
                });
                setSettings(newSettings);
            }
        } catch (error) {
            console.error('Error fetching app settings:', error);
        } finally {
            setLoading(false);
        }
    };

    return { settings, loading, refetch: fetchSettings };
}
