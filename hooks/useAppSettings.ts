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
    support_facebook: string;
    support_twitter: string;
    support_instagram: string;
    support_telegram: string;
    support_office_address: string;
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
    support_facebook: '',
    support_twitter: '',
    support_instagram: '',
    support_telegram: '',
    support_office_address: 'No 1. Abu Mafhal Hub Plaza, Kano State, Nigeria.',
    funding_fee_type: 'fixed',
    funding_fee_value: '0',
    company_name: 'MAFHAL SUB',
    app_logo: '',
    // Crypto Defaults
    crypto_enabled_btc: true,
    crypto_enabled_usdt: true,
    crypto_enabled_eth: false,
    crypto_maintenance_mode: false,
    crypto_receive_enabled: true,
    crypto_send_enabled: true,
    crypto_buy_enabled: true,
    crypto_sell_enabled: true,
    crypto_swap_enabled: true,
    crypto_earn_enabled: true,
    crypto_cards_enabled: true,
    crypto_stake_enabled: true,
    crypto_loan_enabled: true,
    crypto_gift_enabled: true,
    crypto_gas_enabled: true,
    crypto_qrpay_enabled: true,
    crypto_history_enabled: true,
    crypto_support_enabled: true,
    crypto_more_enabled: true,
    crypto_fee_trc20_usdt: '1.5',
    crypto_fee_btc: '0.0005',
    crypto_rate_btc_buy: '86500000',
    crypto_rate_btc_sell: '85000000',
    crypto_rate_usdt_buy: '1480',
    crypto_rate_usdt_sell: '1460',
    crypto_rate_eth_buy: '4500000',
    crypto_rate_eth_sell: '4300000'
};

let globalSettings: AppSettings = DEFAULT_SETTINGS;
let isFetching = false;
let fetchPromise: Promise<void> | null = null;

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings>(globalSettings);
    const [loading, setLoading] = useState(!fetchPromise && !isFetching);

    useEffect(() => {
        let mounted = true;

        const initFetch = async () => {
            if (!fetchPromise) {
                isFetching = true;
                fetchPromise = (async () => {
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
                            globalSettings = newSettings;
                        }
                    } catch (error: any) {
                        // Suppress excessive logging, just warn once
                        console.warn('Could not fetch app settings from Supabase:', error?.message || error);
                    } finally {
                        isFetching = false;
                    }
                })();
            }

            await fetchPromise;
            
            if (mounted) {
                setSettings(globalSettings);
                setLoading(false);
            }
        };

        initFetch();

        return () => {
            mounted = false;
        };
    }, []);

    const refetch = async () => {
        fetchPromise = null; // force refetch
        setLoading(true);
        // We just let the next render or manual call trigger it
        try {
            const { data, error } = await supabase.from('app_settings').select('key, value');
            if (error) throw error;
            if (data) {
                const newSettings = { ...DEFAULT_SETTINGS };
                data.forEach((item: any) => {
                    newSettings[item.key] = item.value === 'true' || item.value === 'false' 
                        ? item.value === 'true' 
                        : item.value;
                });
                globalSettings = newSettings;
                setSettings(globalSettings);
            }
        } catch (error: any) {
            console.warn('Refetch app settings failed:', error?.message || error);
        } finally {
            setLoading(false);
        }
    };

    return { settings, loading, refetch, setSettings };
}
