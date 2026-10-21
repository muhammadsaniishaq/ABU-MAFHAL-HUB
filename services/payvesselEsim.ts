import { supabase } from './supabase';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface EsimRegion {
    code: string;
    name: string;
    flag: string;
    currency: string;
    popular?: boolean;
    is_regional?: boolean;
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
    is_daily?: boolean;
    networks?: any[];
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
    updated_at?: string;
}

// ─── Helper: invoke edge function ─────────────────────────────────────────────
async function invokeEsim(body: Record<string, unknown>) {
    let token = '';
    let userId = '';
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            token = session.access_token || '';
            userId = session.user?.id || '';
        }
    } catch (_) {}

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = {
        ...body,
        user_id: userId || body.user_id,
    };

    const { data, error } = await supabase.functions.invoke('payvessel-esim', {
        body: payload,
        headers,
    });

    if (error) {
        console.error('[payvesselEsim] invoke error:', error);
        throw new Error(error.message ?? 'Edge function error');
    }
    return data;
}

// ─── Fallback regions (shown if API is unreachable) ──────────────────────────
const FALLBACK_REGIONS: EsimRegion[] = [
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
];

const FALLBACK_RATE = 1650;

// ─── Service ──────────────────────────────────────────────────────────────────
export const payvesselEsimService = {

    /**
     * Test PayVessel eSIM connection & show diagnostics.
     * Call this from your admin panel to verify API credentials are configured.
     */
    testConnection: async () => {
        try {
            const data = await invokeEsim({ action: 'test_connection' });
            return data;
        } catch (e: any) {
            return { status: false, message: e.message ?? 'Connection test error' };
        }
    },

    /**
     * Fetch list of supported regions & countries from PayVessel.
     * Falls back to a curated list if the API is unavailable.
     */
    getRegions: async (): Promise<{ regions: EsimRegion[]; usd_rate: number }> => {
        try {
            const data = await invokeEsim({ action: 'get_regions' });
            if (data?.status && Array.isArray(data.regions) && data.regions.length > 0) {
                return { regions: data.regions, usd_rate: data.usd_rate ?? FALLBACK_RATE };
            }
        } catch (e) {
            console.warn('[payvesselEsim] getRegions error, using fallback:', e);
        }
        return { regions: FALLBACK_REGIONS, usd_rate: FALLBACK_RATE };
    },

    /**
     * Fetch available data packages for a specific country code (e.g. 'SA', 'AE', 'GB').
     * Falls back to a computed catalog if the API is unavailable.
     */
    getPackages: async (countryCode: string): Promise<EsimPackage[]> => {
        try {
            const data = await invokeEsim({ action: 'get_packages', country_code: countryCode });
            if (data?.status && Array.isArray(data.packages) && data.packages.length > 0) {
                return data.packages;
            }
        } catch (e) {
            console.warn(`[payvesselEsim] getPackages(${countryCode}) error, using fallback:`, e);
        }

        // Fallback: local computed bundles
        const rate = FALLBACK_RATE;
        const margin = 1.15; // 15% fallback margin
        return [
            { package_code: `${countryCode}_1GB_7D`, name: '1 GB Roaming Data', data_amount: '1 GB', validity_days: 7, price_usd: 2.88, price_ngn: Math.round(2.88 * rate), location_code: countryCode },
            { package_code: `${countryCode}_3GB_15D`, name: '3 GB Roaming Data', data_amount: '3 GB', validity_days: 15, price_usd: 6.33, price_ngn: Math.round(6.33 * rate), location_code: countryCode },
            { package_code: `${countryCode}_5GB_30D`, name: '5 GB Roaming Data', data_amount: '5 GB', validity_days: 30, price_usd: 9.78, price_ngn: Math.round(9.78 * rate), location_code: countryCode },
            { package_code: `${countryCode}_10GB_30D`, name: '10 GB Roaming Data', data_amount: '10 GB', validity_days: 30, price_usd: 16.68, price_ngn: Math.round(16.68 * rate), location_code: countryCode },
            { package_code: `${countryCode}_20GB_30D`, name: '20 GB Roaming Data', data_amount: '20 GB', validity_days: 30, price_usd: 27.60, price_ngn: Math.round(27.60 * rate), location_code: countryCode },
        ];
    },

    /**
     * Purchase and activate an eSIM. Debits the user's wallet atomically.
     * On PayVessel failure, the wallet is automatically refunded.
     */
    orderEsim: async (params: {
        package_code: string;
        country_code: string;
        country_name: string;
        data_amount: string;
        validity_days: number;
        price_ngn: number;
        price_usd: number;
    }): Promise<UserEsim> => {
        const data = await invokeEsim({ action: 'order_esim', ...params });

        if (data?.status === false) {
            throw new Error(data.error ?? 'Failed to order eSIM. Please try again.');
        }
        if (!data?.esim) {
            throw new Error('eSIM provisioning returned an unexpected response. Please contact support.');
        }

        return data.esim as UserEsim;
    },

    /**
     * Fetch all eSIMs purchased by the current user.
     */
    getMyEsims: async (): Promise<UserEsim[]> => {
        try {
            const data = await invokeEsim({ action: 'get_my_esims' });
            if (data?.status && Array.isArray(data.esims)) {
                return data.esims;
            }
        } catch (e) {
            console.warn('[payvesselEsim] getMyEsims edge function failed, falling back to direct DB query:', e);
        }

        // Fallback: direct Supabase query
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('user_esims')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[payvesselEsim] getMyEsims DB fallback error:', error);
                return [];
            }
            return (data ?? []) as UserEsim[];
        } catch (e) {
            console.error('[payvesselEsim] getMyEsims complete failure:', e);
            return [];
        }
    },

    /**
     * Check the live status of an eSIM from PayVessel.
     * Updates the local DB record on success.
     */
    checkEsimStatus: async (orderReference: string): Promise<{ status: string; source?: string }> => {
        try {
            const data = await invokeEsim({ action: 'check_esim_status', order_reference: orderReference });
            if (data?.status) {
                return { status: data.esim_status ?? 'UNKNOWN', source: data.source ?? 'payvessel' };
            }
        } catch (e) {
            console.warn('[payvesselEsim] checkEsimStatus error:', e);
        }
        return { status: 'UNKNOWN', source: 'error' };
    },

    /**
     * Fetch available top-up data packages for an active eSIM ICCID.
     */
    getTopupPackages: async (iccid: string): Promise<EsimPackage[]> => {
        try {
            const data = await invokeEsim({ action: 'get_topup_packages', iccid });
            if (data?.status && Array.isArray(data.packages) && data.packages.length > 0) {
                return data.packages;
            }
        } catch (e) {
            console.warn(`[payvesselEsim] getTopupPackages(${iccid}) error:`, e);
        }
        return [];
    },

    /**
     * Top-up an existing eSIM with additional roaming data.
     * Atomically debits the user's wallet with auto-refund on failure.
     */
    topupEsim: async (params: {
        iccid: string;
        package_code: string;
        price_ngn: number;
        price_usd?: number;
    }): Promise<{ status: boolean; message: string; reference?: string }> => {
        const data = await invokeEsim({ action: 'topup_esim', ...params });
        if (data?.status === false) {
            throw new Error(data.error ?? 'Failed to complete eSIM top-up.');
        }
        return data;
    },
};
