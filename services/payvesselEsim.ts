import { supabase } from './supabase';

export interface EsimRegion {
    code: string;
    name: string;
    flag: string;
    currency: string;
    popular?: boolean;
}

export interface EsimPackage {
    package_code: string;
    name: string;
    data_amount: string;
    validity_days: number;
    price_usd: number;
    price_ngn: number;
    wholesale_usd?: number;
    location_code: string;
}

export interface UserEsim {
    id: string;
    user_id: string;
    order_reference: string;
    package_code: string;
    country_code: string;
    country_name: string;
    data_amount: string;
    validity_days: number;
    iccid?: string;
    qr_code_url?: string;
    lpa_activation_code?: string;
    smdp_address?: string;
    activation_code?: string;
    status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'DEPLETED' | 'FAILED';
    cost_ngn: number;
    cost_usd: number;
    created_at: string;
}

export const payvesselEsimService = {
    /**
     * Test PayVessel eSIM connection & diagnostics
     */
    testConnection: async () => {
        try {
            const { data, error } = await supabase.functions.invoke('payvessel-esim', {
                body: { action: 'test_connection' }
            });
            if (error) throw error;
            return data;
        } catch (e: any) {
            return { status: false, message: e.message || 'Connection test error' };
        }
    },

    /**
     * Fetch list of supported regions & countries
     */
    getRegions: async (): Promise<{ regions: EsimRegion[]; usd_rate: number }> => {
        try {
            const { data, error } = await supabase.functions.invoke('payvessel-esim', {
                body: { action: 'get_regions' }
            });
            if (!error && data?.status && Array.isArray(data.regions)) {
                return { regions: data.regions, usd_rate: data.usd_rate || 1650 };
            }
        } catch (_) {}

        // Fallback default destinations
        return {
            regions: [
                { code: 'SA', name: 'Saudi Arabia (Hajj & Umrah)', flag: '🇸🇦', currency: 'SAR', popular: true },
                { code: 'AE', name: 'United Arab Emirates (Dubai)', flag: '🇦🇪', currency: 'AED', popular: true },
                { code: 'GB', name: 'United Kingdom (UK)', flag: '🇬🇧', currency: 'GBP', popular: true },
                { code: 'US', name: 'United States of America', flag: '🇺🇸', currency: 'USD', popular: true },
                { code: 'TR', name: 'Turkey (Türkiye)', flag: '🇹🇷', currency: 'TRY', popular: true },
                { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'EGP', popular: true },
                { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', popular: true },
                { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', popular: true },
                { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', popular: true },
                { code: 'DE', name: 'Germany (Europe Roam)', flag: '🇩🇪', currency: 'EUR', popular: true },
                { code: 'FR', name: 'France (Europe Roam)', flag: '🇫🇷', currency: 'EUR', popular: true },
            ],
            usd_rate: 1650
        };
    },

    /**
     * Fetch available data packages for a country
     */
    getPackages: async (countryCode: string): Promise<EsimPackage[]> => {
        try {
            const { data, error } = await supabase.functions.invoke('payvessel-esim', {
                body: { action: 'get_packages', country_code: countryCode }
            });
            if (!error && data?.status && Array.isArray(data.packages)) {
                return data.packages;
            }
        } catch (_) {}

        // Fallback package bundles
        const rate = 1650;
        return [
            { package_code: `${countryCode}_1GB_7D`, name: '1 GB Roaming Data', data_amount: '1 GB', validity_days: 7, price_usd: 3.50, price_ngn: Math.round(3.50 * rate), location_code: countryCode },
            { package_code: `${countryCode}_3GB_15D`, name: '3 GB Roaming Data', data_amount: '3 GB', validity_days: 15, price_usd: 7.50, price_ngn: Math.round(7.50 * rate), location_code: countryCode },
            { package_code: `${countryCode}_5GB_30D`, name: '5 GB Roaming Data', data_amount: '5 GB', validity_days: 30, price_usd: 11.50, price_ngn: Math.round(11.50 * rate), location_code: countryCode },
            { package_code: `${countryCode}_10GB_30D`, name: '10 GB Roaming Data', data_amount: '10 GB', validity_days: 30, price_usd: 19.50, price_ngn: Math.round(19.50 * rate), location_code: countryCode },
            { package_code: `${countryCode}_20GB_30D`, name: '20 GB Roaming Data', data_amount: '20 GB', validity_days: 30, price_usd: 32.00, price_ngn: Math.round(32.00 * rate), location_code: countryCode },
        ];
    },

    /**
     * Purchase and activate an eSIM
     */
    orderEsim: async (params: {
        package_code: string;
        country_code: string;
        country_name: string;
        data_amount: string;
        validity_days: number;
        price_ngn: number;
        price_usd: number;
    }) => {
        const { data, error } = await supabase.functions.invoke('payvessel-esim', {
            body: {
                action: 'order_esim',
                ...params
            }
        });

        if (error) throw error;
        if (data?.status === false) {
            throw new Error(data.error || 'Failed to order eSIM');
        }

        return data.esim;
    },

    /**
     * Fetch all eSIMs owned by the user
     */
    getMyEsims: async (): Promise<UserEsim[]> => {
        try {
            const { data, error } = await supabase.functions.invoke('payvessel-esim', {
                body: { action: 'get_my_esims' }
            });
            if (!error && data?.status && Array.isArray(data.esims)) {
                return data.esims;
            }
        } catch (_) {}

        // Fallback to direct supabase query
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data } = await supabase
            .from('user_esims')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        return data || [];
    }
};
