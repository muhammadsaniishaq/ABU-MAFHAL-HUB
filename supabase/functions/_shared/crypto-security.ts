import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPPORTED_CRYPTO_ASSETS = [
    'usdt', 'btc', 'eth', 'sol', 'trx', 'bnb', 'ton', 'doge'
] as const;

export type SupportedCryptoAsset = typeof SUPPORTED_CRYPTO_ASSETS[number];

// Baseline fallback USD prices if external ticker APIs are completely unreachable
export const FALLBACK_USD_PRICES: Record<string, number> = {
    'usdt': 1.00,
    'btc': 92000.00,
    'eth': 3200.00,
    'sol': 215.00,
    'trx': 0.20,
    'bnb': 640.00,
    'ton': 5.50,
    'doge': 0.38
};

// Reasonable boundary limits to prevent overflow, dust attacks, or absurd numbers
export const TRANSACTION_LIMITS = {
    MIN_NGN_BUY: 500,
    MAX_NGN_BUY: 10_000_000,
    MIN_USDT_VALUE_SELL: 1.0, // Minimum $1 worth of crypto
    MAX_USDT_VALUE_SELL: 20_000.0,
    MIN_USDT_WITHDRAWAL: 2.0,
    MAX_USDT_WITHDRAWAL: 20_000.0,
    MIN_TRANSFER_AMOUNT: 0.0001,
};

/**
 * 🛡️ Validates user existence, active status, and ban flags.
 * Drops exploiters and banned actors immediately.
 */
export async function validateUserSecurity(supabaseAdmin: SupabaseClient, userId: string) {
    if (!userId) {
        throw new Error("Tantancewar mai amfani ta gaza (Invalid User ID)");
    }

    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, phone, email, balance, is_banned, status')
        .eq('id', userId)
        .maybeSingle();

    if (error || !profile) {
        throw new Error("Ba a sami bayanan asusun mai amfani ba (User profile not found)");
    }

    if (profile.is_banned === true || profile.status === 'banned' || profile.status === 'suspended') {
        throw new Error("An dakatar da wannan asusun saboda tsaro. Tuntubi Admin (Account is suspended or banned)");
    }

    return profile;
}

/**
 * 🛡️ Enforces Global Crypto Maintenance Mode.
 * If maintenance is toggled on, halts all trading, withdrawal, and transfer ops immediately.
 */
export async function checkCryptoMaintenance(supabaseAdmin: SupabaseClient) {
    try {
        const { data: setting } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', 'crypto_maintenance_mode')
            .maybeSingle();

        if (setting?.value === 'true' || setting?.value === '1' || setting?.value === true) {
            throw new Error("Sabis na Crypto yana kan bita na wucin-gadi (Maintenance Mode). Da fatan za a sake gwadawa nan gaba.");
        }
    } catch (err: any) {
        if (err.message && err.message.includes("Maintenance Mode")) {
            throw err;
        }
        // If query fails, proceed cautiously
    }
}

/**
 * 🛡️ Validates whether an asset is supported on the platform.
 */
export function validateAsset(rawAsset: string): SupportedCryptoAsset {
    const norm = (rawAsset || '').toLowerCase().trim();
    if (!SUPPORTED_CRYPTO_ASSETS.includes(norm as any)) {
        throw new Error(`Kudin crypto da aka zaba '${rawAsset}' ba ya cikin jerin kudaden da ake amfani da su.`);
    }
    return norm as SupportedCryptoAsset;
}

/**
 * 🛡️ Validates numeric amounts for safety (rejects NaN, negative, zero, Infinity).
 */
export function validateAmount(amount: any, min = 0.00000001, max = 1_000_000_000): number {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
        throw new Error("Adadin kudin da aka shigar ba daidai ba ne (Invalid amount).");
    }
    if (parsed < min) {
        throw new Error(`Adadin ya yi kadan. Mafi karancin adadi shine ${min}.`);
    }
    if (parsed > max) {
        throw new Error(`Adadin ya wuce kima. Mafi yawan adadi shine ${max}.`);
    }
    return parsed;
}

/**
 * 🛡️ Fetches live USD prices for crypto assets with fast timeouts and fallbacks.
 */
export async function fetchLiveCryptoPrices(): Promise<Record<string, number>> {
    const prices: Record<string, number> = { ...FALLBACK_USD_PRICES };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max timeout

        const res = await fetch(
            'https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","TRXUSDT","BNBUSDT","TONUSDT","DOGEUSDT"]',
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                for (const item of data) {
                    const sym = item.symbol.replace('USDT', '').toLowerCase();
                    const p = parseFloat(item.price);
                    if (!isNaN(p) && p > 0) {
                        prices[sym] = p;
                    }
                }
            }
        }
    } catch (_) {
        // Fallback to FALLBACK_USD_PRICES cleanly
    }
    return prices;
}

/**
 * 🛡️ Authoritative rate resolver.
 * Merges system settings (admin fixed rates, profit margins) with live market prices.
 * Completely immune to client-side price manipulation.
 */
export async function getAuthoritativeCryptoRates(supabaseAdmin: SupabaseClient) {
    // 1. Fetch live coin USD prices
    const usdPrices = await fetchLiveCryptoPrices();

    // 2. Fetch admin settings
    let usdtBuyRate = 1480;
    let usdtSellRate = 1460;
    let swapFeePercent = 1.5;
    const customRates: Record<string, number> = {};

    try {
        const { data: settings } = await supabaseAdmin
            .from('app_settings')
            .select('key, value');

        if (settings && Array.isArray(settings)) {
            for (const s of settings) {
                if (s.key === 'crypto_rate_usdt_buy') {
                    const v = parseFloat(s.value);
                    if (!isNaN(v) && v >= 1000 && v <= 3500) usdtBuyRate = v;
                } else if (s.key === 'crypto_rate_usdt_sell') {
                    const v = parseFloat(s.value);
                    if (!isNaN(v) && v >= 1000 && v <= 3500) usdtSellRate = v;
                } else if (s.key === 'crypto_swap_fee_percent') {
                    const v = parseFloat(s.value);
                    if (!isNaN(v) && v >= 0.1 && v <= 10) swapFeePercent = v;
                } else if (s.key.startsWith('crypto_rate_')) {
                    const v = parseFloat(s.value);
                    if (!isNaN(v) && v > 0) customRates[s.key] = v;
                }
            }
        }
    } catch (_) {}

    // Ensure sell rate never exceeds buy rate (arbitrage prevention)
    if (usdtSellRate > usdtBuyRate) {
        usdtSellRate = usdtBuyRate - 20;
    }

    return {
        usdPrices,
        usdtBuyRate,
        usdtSellRate,
        swapFeePercent,
        customRates,

        /**
         * Authoritative Buy Rate in NGN per 1 unit of asset
         */
        getBuyRateNgn(asset: SupportedCryptoAsset): number {
            const customKey = `crypto_rate_${asset}_buy`;
            if (customRates[customKey]) return customRates[customKey];

            if (asset === 'usdt') return usdtBuyRate;

            const priceUsd = usdPrices[asset] || FALLBACK_USD_PRICES[asset] || 1;
            // Admin margin factor for buy: 1.015 (platform markup)
            return Math.round(priceUsd * usdtBuyRate * 1.015);
        },

        /**
         * Authoritative Sell Rate in NGN per 1 unit of asset
         */
        getSellRateNgn(asset: SupportedCryptoAsset): number {
            const customKey = `crypto_rate_${asset}_sell`;
            if (customRates[customKey]) return customRates[customKey];

            if (asset === 'usdt') return usdtSellRate;

            const priceUsd = usdPrices[asset] || FALLBACK_USD_PRICES[asset] || 1;
            // Admin margin factor for sell: 0.985 (platform spread)
            return Math.round(priceUsd * usdtSellRate * 0.985);
        },

        /**
         * Authoritative Asset USD price
         */
        getAssetUsdPrice(asset: SupportedCryptoAsset): number {
            return usdPrices[asset] || FALLBACK_USD_PRICES[asset] || 1.0;
        }
    };
}

/**
 * 🛡️ Calculates swap output strictly on the server with profit fee deducted.
 * Zero trust in client's expectedAmountOut!
 */
export function computeSafeSwapOutput(
    fromAsset: SupportedCryptoAsset,
    toAsset: SupportedCryptoAsset,
    amountIn: number,
    authoritativeRates: Awaited<ReturnType<typeof getAuthoritativeCryptoRates>>
) {
    const fromUsdPrice = authoritativeRates.getAssetUsdPrice(fromAsset);
    const toUsdPrice = authoritativeRates.getAssetUsdPrice(toAsset);

    if (fromUsdPrice <= 0 || toUsdPrice <= 0) {
        throw new Error("Farashin kudin crypto bai kammala lissafi ba. Sake gwadawa.");
    }

    // Gross USD value of input
    const grossUsdValue = amountIn * fromUsdPrice;

    // Platform swap fee
    const feePercent = authoritativeRates.swapFeePercent;
    const feeUsd = grossUsdValue * (feePercent / 100);
    const netUsdValue = Math.max(0, grossUsdValue - feeUsd);

    // Compute raw output
    const rawAmountOut = netUsdValue / toUsdPrice;

    // Format according to asset decimal precision
    const precision = toAsset === 'btc' ? 8 : toAsset === 'eth' ? 6 : toAsset === 'sol' || toAsset === 'bnb' ? 5 : 4;
    const safeAmountOut = Number(rawAmountOut.toFixed(precision));

    if (safeAmountOut <= 0) {
        throw new Error("Adadin da kake son canzawa ya yi kadan sosai.");
    }

    return {
        safeAmountOut,
        feePercent,
        grossUsdValue: Number(grossUsdValue.toFixed(4)),
        feeUsd: Number(feeUsd.toFixed(4)),
        netUsdValue: Number(netUsdValue.toFixed(4))
    };
}
