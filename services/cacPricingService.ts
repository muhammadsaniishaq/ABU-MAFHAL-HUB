import { supabase } from './supabase';

export type CacServiceCode = 
  | 'business_name' 
  | 'ltd' 
  | 'plc' 
  | 'incorporated_trustee' 
  | 'upgrade_to_ltd' 
  | 'cac_retrieval';

export interface CacPricingConfig {
  id: string;
  service_code: CacServiceCode;
  service_name: string;
  category: 'registration' | 'company' | 'trustee' | 'upgrade' | 'search';
  description: string;
  regular_price: number;
  promo_price: number | null;
  is_promo_active: boolean;
  promo_start_at: string | null;
  promo_end_at: string | null;
  included_share_capital: number;
  share_capital_increment_step: number;
  share_capital_increment_fee: number;
  included_directors: number;
  additional_director_fee: number;
  included_shareholders: number;
  additional_shareholder_fee: number;
  included_trustees: number;
  additional_trustee_fee: number;
  processing_time: string;
  is_available: boolean;
  quote_validity_hours: number;
  pricing_rules?: Record<string, any>;
  updated_at?: string;
  updated_by?: string;
  updated_by_email?: string;
}

export interface CacCalculationParams {
  shareCapital?: number;
  directorsCount?: number;
  shareholdersCount?: number;
  trusteesCount?: number;
  includeTin?: boolean;
  tinFee?: number;
  asOfDate?: Date | string;
  quoteCreatedAt?: string;
}

export interface CacPriceBreakdownItem {
  label: string;
  amount: number;
  type: 'base' | 'discount' | 'share_capital' | 'directors' | 'shareholders' | 'trustees' | 'tin';
  detail?: string;
}

export interface CacCalculationResult {
  serviceCode: CacServiceCode;
  serviceName: string;
  regularPrice: number;
  effectiveBasePrice: number;
  isPromoActive: boolean;
  promoSavings: number;
  includedShareCapital: number;
  extraShareCapital: number;
  shareCapitalFee: number;
  shareCapitalIncrements: number;
  includedDirectors: number;
  extraDirectors: number;
  directorsFee: number;
  includedShareholders: number;
  extraShareholders: number;
  shareholdersFee: number;
  includedTrustees: number;
  extraTrustees: number;
  trusteesFee: number;
  tinFee: number;
  totalAmount: number;
  processingTime: string;
  quoteExpiresAt: string;
  isQuoteValid: boolean;
  items: CacPriceBreakdownItem[];
}

export interface CacAuditLogEntry {
  id: string;
  service_code: string;
  admin_id?: string;
  admin_email?: string;
  change_type: string;
  previous_config?: any;
  new_config: any;
  summary?: string;
  created_at: string;
}

// -------------------------------------------------------------
// Official Default Configurations (As mandated by specifications)
// -------------------------------------------------------------
export const DEFAULT_CAC_PRICING_CONFIGS: Record<CacServiceCode, CacPricingConfig> = {
  business_name: {
    id: 'business_name',
    service_code: 'business_name',
    service_name: 'Business Name Registration',
    category: 'registration',
    description: 'Official CAC certificate and status document for sole proprietorship and partnerships.',
    regular_price: 40000,
    promo_price: 38000,
    is_promo_active: true,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 0,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 0,
    included_directors: 0,
    additional_director_fee: 0,
    included_shareholders: 0,
    additional_shareholder_fee: 0,
    included_trustees: 0,
    additional_trustee_fee: 0,
    processing_time: '24 hours',
    is_available: true,
    quote_validity_hours: 24,
  },
  ltd: {
    id: 'ltd',
    service_code: 'ltd',
    service_name: 'Private Limited Liability Company (LTD)',
    category: 'company',
    description: 'Private limited company incorporation with certificate, status document, and memorandum of association.',
    regular_price: 100000,
    promo_price: 80000,
    is_promo_active: true,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 1000000,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 30000,
    included_directors: 2,
    additional_director_fee: 5000,
    included_shareholders: 2,
    additional_shareholder_fee: 0,
    included_trustees: 0,
    additional_trustee_fee: 0,
    processing_time: '3 - 5 Business Days',
    is_available: true,
    quote_validity_hours: 24,
  },
  plc: {
    id: 'plc',
    service_code: 'plc',
    service_name: 'Public Limited Liability Company (PLC)',
    category: 'company',
    description: 'Comprehensive incorporation for large enterprises, publicly listed corporations, and commercial institutions.',
    regular_price: 200000,
    promo_price: 200000,
    is_promo_active: false,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 2000000,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 40000,
    included_directors: 2,
    additional_director_fee: 0,
    included_shareholders: 2,
    additional_shareholder_fee: 0,
    included_trustees: 0,
    additional_trustee_fee: 0,
    processing_time: '5 - 7 Business Days',
    is_available: true,
    quote_validity_hours: 24,
  },
  incorporated_trustee: {
    id: 'incorporated_trustee',
    service_code: 'incorporated_trustee',
    service_name: 'Incorporated Trustee',
    category: 'trustee',
    description: 'Incorporation for NGOs, Foundations, Religious Bodies, Alumni, and Community Associations.',
    regular_price: 200000,
    promo_price: 160000,
    is_promo_active: true,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 0,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 0,
    included_directors: 0,
    additional_director_fee: 0,
    included_shareholders: 0,
    additional_shareholder_fee: 0,
    included_trustees: 2,
    additional_trustee_fee: 5000,
    processing_time: '7 - 14 Business Days',
    is_available: true,
    quote_validity_hours: 24,
  },
  upgrade_to_ltd: {
    id: 'upgrade_to_ltd',
    service_code: 'upgrade_to_ltd',
    service_name: 'Business Name to LTD Upgrade',
    category: 'upgrade',
    description: 'Conversion and legal upgrading of existing Business Name registration into an LTD structure.',
    regular_price: 100000,
    promo_price: 90000,
    is_promo_active: true,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 1000000,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 30000,
    included_directors: 2,
    additional_director_fee: 5000,
    included_shareholders: 2,
    additional_shareholder_fee: 0,
    included_trustees: 0,
    additional_trustee_fee: 0,
    processing_time: '5 - 7 Business Days',
    is_available: true,
    quote_validity_hours: 24,
  },
  cac_retrieval: {
    id: 'cac_retrieval',
    service_code: 'cac_retrieval',
    service_name: 'CAC Certificate Retrieval / Document Search',
    category: 'search',
    description: 'Certified True Copy (CTC) retrieval, loss replacement, and status verification search.',
    regular_price: 4000,
    promo_price: 4000,
    is_promo_active: false,
    promo_start_at: null,
    promo_end_at: null,
    included_share_capital: 0,
    share_capital_increment_step: 1000000,
    share_capital_increment_fee: 0,
    included_directors: 0,
    additional_director_fee: 0,
    included_shareholders: 0,
    additional_shareholder_fee: 0,
    included_trustees: 0,
    additional_trustee_fee: 0,
    processing_time: '24 hours',
    is_available: true,
    quote_validity_hours: 24,
  },
};

export const CAC_SERVICES_ORDER: CacServiceCode[] = [
  'business_name',
  'ltd',
  'plc',
  'incorporated_trustee',
  'upgrade_to_ltd',
  'cac_retrieval',
];

export function formatNaira(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₦0';
  return `₦${Math.round(amount).toLocaleString()}`;
}

export function resolveServiceCode(identifier?: string | null): CacServiceCode {
  if (!identifier) return 'business_name';
  const idLower = identifier.toLowerCase();

  if (idLower.includes('upgrade')) return 'upgrade_to_ltd';
  if (idLower.includes('plc') || idLower.includes('public limited')) return 'plc';
  if (idLower.includes('private limited') || idLower.includes('limited liability') || idLower.includes('ltd')) return 'ltd';
  if (idLower.includes('trustee') || idLower.includes('ngo') || idLower.includes('club') || idLower.includes('association')) return 'incorporated_trustee';
  if (idLower.includes('retrieval') || idLower.includes('search') || idLower.includes('certificate')) return 'cac_retrieval';
  return 'business_name';
}

// -------------------------------------------------------------
// Pure Pricing Calculation Engine
// -------------------------------------------------------------
export function calculateCacPrice(
  configInput: CacPricingConfig | CacServiceCode,
  params: CacCalculationParams = {}
): CacCalculationResult {
  const config = typeof configInput === 'string' 
    ? (DEFAULT_CAC_PRICING_CONFIGS[configInput] || DEFAULT_CAC_PRICING_CONFIGS.business_name) 
    : configInput;

  const now = params.asOfDate ? new Date(params.asOfDate) : new Date();
  
  // 1. Promotional Pricing Check (Server / Reference Time)
  let isPromoActive = false;
  let effectiveBasePrice = config.regular_price;

  if (config.is_promo_active && config.promo_price !== null && config.promo_price !== undefined && config.promo_price > 0) {
    const isStartValid = !config.promo_start_at || now >= new Date(config.promo_start_at);
    const isEndValid = !config.promo_end_at || now <= new Date(config.promo_end_at);
    if (isStartValid && isEndValid) {
      isPromoActive = true;
      effectiveBasePrice = config.promo_price;
    }
  }

  const promoSavings = isPromoActive ? Math.max(0, config.regular_price - effectiveBasePrice) : 0;

  const items: CacPriceBreakdownItem[] = [
    {
      label: `${config.service_name} (Base Fee)`,
      amount: effectiveBasePrice,
      type: 'base',
      detail: isPromoActive ? `Promotional rate (Regular: ${formatNaira(config.regular_price)})` : 'Standard registration charge',
    },
  ];

  if (isPromoActive && promoSavings > 0) {
    items.push({
      label: 'Special Promotional Discount',
      amount: -promoSavings,
      type: 'discount',
      detail: `Save ${formatNaira(promoSavings)} with current offer`,
    });
  }

  // 2. Share Capital Increment Calculations
  const shareCapital = Math.max(0, Number(params.shareCapital || 0));
  let shareCapitalFee = 0;
  let extraShareCapital = 0;
  let shareCapitalIncrements = 0;

  if (
    config.share_capital_increment_fee > 0 &&
    config.share_capital_increment_step > 0 &&
    shareCapital > config.included_share_capital
  ) {
    extraShareCapital = shareCapital - config.included_share_capital;
    shareCapitalIncrements = Math.ceil(extraShareCapital / config.share_capital_increment_step);
    shareCapitalFee = shareCapitalIncrements * config.share_capital_increment_fee;

    items.push({
      label: `Additional Share Capital (+${formatNaira(extraShareCapital)})`,
      amount: shareCapitalFee,
      type: 'share_capital',
      detail: `${shareCapitalIncrements} x ${formatNaira(config.share_capital_increment_fee)} per ${formatNaira(config.share_capital_increment_step)}`,
    });
  }

  // 3. Additional Director Fees
  const directorsCount = Math.max(1, Number(params.directorsCount || 1));
  let extraDirectors = 0;
  let directorsFee = 0;

  if (
    config.additional_director_fee > 0 &&
    config.included_directors > 0 &&
    directorsCount > config.included_directors
  ) {
    extraDirectors = directorsCount - config.included_directors;
    directorsFee = extraDirectors * config.additional_director_fee;

    items.push({
      label: `Additional Directors (${extraDirectors} extra)`,
      amount: directorsFee,
      type: 'directors',
      detail: `${extraDirectors} x ${formatNaira(config.additional_director_fee)} (${config.included_directors} included free)`,
    });
  }

  // 4. Additional Shareholders Fees
  const shareholdersCount = Math.max(0, Number(params.shareholdersCount || 0));
  let extraShareholders = 0;
  let shareholdersFee = 0;

  if (
    config.additional_shareholder_fee > 0 &&
    config.included_shareholders > 0 &&
    shareholdersCount > config.included_shareholders
  ) {
    extraShareholders = shareholdersCount - config.included_shareholders;
    shareholdersFee = extraShareholders * config.additional_shareholder_fee;

    items.push({
      label: `Additional Shareholders (${extraShareholders} extra)`,
      amount: shareholdersFee,
      type: 'shareholders',
      detail: `${extraShareholders} x ${formatNaira(config.additional_shareholder_fee)} (${config.included_shareholders} included free)`,
    });
  }

  // 5. Additional Trustee Fees
  const trusteesCount = Math.max(0, Number(params.trusteesCount || 0));
  let extraTrustees = 0;
  let trusteesFee = 0;

  if (
    config.additional_trustee_fee > 0 &&
    config.included_trustees > 0 &&
    trusteesCount > config.included_trustees
  ) {
    extraTrustees = trusteesCount - config.included_trustees;
    trusteesFee = extraTrustees * config.additional_trustee_fee;

    items.push({
      label: `Additional Trustees (${extraTrustees} extra)`,
      amount: trusteesFee,
      type: 'trustees',
      detail: `${extraTrustees} x ${formatNaira(config.additional_trustee_fee)} (${config.included_trustees} included free)`,
    });
  }

  // 6. TIN Add-on Fee
  let tinFee = 0;
  if (params.includeTin) {
    tinFee = params.tinFee !== undefined && params.tinFee >= 0 ? params.tinFee : 3000;
    if (tinFee > 0) {
      items.push({
        label: 'JTB Official Tax ID (TIN) Add-on',
        amount: tinFee,
        type: 'tin',
        detail: 'Official Joint Tax Board digital certificate generation',
      });
    }
  }

  // 7. Total Amount Payable
  const totalAmount = effectiveBasePrice + shareCapitalFee + directorsFee + shareholdersFee + trusteesFee + tinFee;

  // 8. Quotation Validity Expiry (24 hours or configured hours from base timestamp)
  const baseQuoteTime = params.quoteCreatedAt ? new Date(params.quoteCreatedAt) : now;
  const validityHours = config.quote_validity_hours > 0 ? config.quote_validity_hours : 24;
  const quoteExpiresAt = new Date(baseQuoteTime.getTime() + validityHours * 3600 * 1000).toISOString();
  const isQuoteValid = now.getTime() <= new Date(quoteExpiresAt).getTime();

  return {
    serviceCode: config.service_code,
    serviceName: config.service_name,
    regularPrice: config.regular_price,
    effectiveBasePrice,
    isPromoActive,
    promoSavings,
    includedShareCapital: config.included_share_capital,
    extraShareCapital,
    shareCapitalFee,
    shareCapitalIncrements,
    includedDirectors: config.included_directors,
    extraDirectors,
    directorsFee,
    includedShareholders: config.included_shareholders,
    extraShareholders,
    shareholdersFee,
    includedTrustees: config.included_trustees,
    extraTrustees,
    trusteesFee,
    tinFee,
    totalAmount,
    processingTime: config.processing_time || '24 hours',
    quoteExpiresAt,
    isQuoteValid,
    items,
  };
}

// -------------------------------------------------------------
// Database Fetch & Storage Integration
// -------------------------------------------------------------
export async function fetchCacPricingConfigurations(): Promise<{
  configs: Record<CacServiceCode, CacPricingConfig>;
  tinFee: number;
  fromDb: boolean;
}> {
  let configs: Record<CacServiceCode, CacPricingConfig> = { ...DEFAULT_CAC_PRICING_CONFIGS };
  let tinFee = 3000;
  let fromDb = false;

  try {
    // 1. Fetch from dedicated cac_pricing_configurations table
    const { data: dbData, error: dbErr } = await supabase
      .from('cac_pricing_configurations')
      .select('*');

    if (!dbErr && dbData && dbData.length > 0) {
      fromDb = true;
      dbData.forEach((row: any) => {
        const code = row.service_code as CacServiceCode;
        if (code && DEFAULT_CAC_PRICING_CONFIGS[code]) {
          configs[code] = {
            ...DEFAULT_CAC_PRICING_CONFIGS[code],
            ...row,
            regular_price: Number(row.regular_price ?? DEFAULT_CAC_PRICING_CONFIGS[code].regular_price),
            promo_price: row.promo_price !== null && row.promo_price !== undefined ? Number(row.promo_price) : null,
            is_promo_active: Boolean(row.is_promo_active),
            included_share_capital: Number(row.included_share_capital ?? DEFAULT_CAC_PRICING_CONFIGS[code].included_share_capital),
            share_capital_increment_step: Number(row.share_capital_increment_step ?? 1000000),
            share_capital_increment_fee: Number(row.share_capital_increment_fee ?? 0),
            included_directors: Number(row.included_directors ?? 0),
            additional_director_fee: Number(row.additional_director_fee ?? 0),
            included_shareholders: Number(row.included_shareholders ?? 0),
            additional_shareholder_fee: Number(row.additional_shareholder_fee ?? 0),
            included_trustees: Number(row.included_trustees ?? 0),
            additional_trustee_fee: Number(row.additional_trustee_fee ?? 0),
            processing_time: row.processing_time || DEFAULT_CAC_PRICING_CONFIGS[code].processing_time,
            is_available: row.is_available !== false,
            quote_validity_hours: Number(row.quote_validity_hours ?? 24),
          };
        }
      });
    }

    // 2. Fetch app_settings fallback or overlay
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['cac_pricing_controls', 'cac_tin_fee']);

    if (settingsData && settingsData.length > 0) {
      settingsData.forEach(item => {
        if (item.key === 'cac_tin_fee' && item.value) {
          const parsedTin = parseFloat(item.value);
          if (!isNaN(parsedTin) && parsedTin >= 0) tinFee = parsedTin;
        }

        if (item.key === 'cac_pricing_controls' && item.value) {
          try {
            const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            if (parsed && typeof parsed === 'object') {
              Object.keys(parsed).forEach(k => {
                const code = k as CacServiceCode;
                if (configs[code]) {
                  configs[code] = {
                    ...configs[code],
                    ...parsed[code],
                  };
                }
              });
            }
          } catch (_) {}
        }
      });
    }
  } catch (err) {
    console.warn('fetchCacPricingConfigurations error:', err);
  }

  return { configs, tinFee, fromDb };
}

export async function saveCacPricingConfiguration(
  updatedConfigs: Record<CacServiceCode, CacPricingConfig>,
  tinFee?: number,
  changeSummary?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized: You must be logged in as an administrator.');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      throw new Error('Forbidden: Only authorized administrators may update CAC pricing configurations.');
    }

    const now = new Date().toISOString();

    // 1. Snapshot previous configuration for audit log
    const { configs: previousConfigs } = await fetchCacPricingConfigurations();

    // 2. Upsert each row in cac_pricing_configurations
    const rows = Object.values(updatedConfigs).map(cfg => ({
      id: cfg.service_code,
      service_code: cfg.service_code,
      service_name: cfg.service_name,
      category: cfg.category || 'registration',
      description: cfg.description || '',
      regular_price: Number(cfg.regular_price || 0),
      promo_price: cfg.promo_price !== null && cfg.promo_price !== undefined ? Number(cfg.promo_price) : null,
      is_promo_active: Boolean(cfg.is_promo_active),
      promo_start_at: cfg.promo_start_at || null,
      promo_end_at: cfg.promo_end_at || null,
      included_share_capital: Number(cfg.included_share_capital || 0),
      share_capital_increment_step: Number(cfg.share_capital_increment_step || 1000000),
      share_capital_increment_fee: Number(cfg.share_capital_increment_fee || 0),
      included_directors: Number(cfg.included_directors || 0),
      additional_director_fee: Number(cfg.additional_director_fee || 0),
      included_shareholders: Number(cfg.included_shareholders || 0),
      additional_shareholder_fee: Number(cfg.additional_shareholder_fee || 0),
      included_trustees: Number(cfg.included_trustees || 0),
      additional_trustee_fee: Number(cfg.additional_trustee_fee || 0),
      processing_time: cfg.processing_time || '24 hours',
      is_available: Boolean(cfg.is_available),
      quote_validity_hours: Number(cfg.quote_validity_hours || 24),
      pricing_rules: cfg.pricing_rules || {},
      updated_at: now,
      updated_by: user.id,
    }));

    const { error: upsertErr } = await supabase
      .from('cac_pricing_configurations')
      .upsert(rows, { onConflict: 'service_code' });

    if (upsertErr) {
      console.warn('Upsert to cac_pricing_configurations warning (falling back to settings):', upsertErr);
    }

    // 3. Persist into app_settings for multi-layer cache consistency
    await supabase.from('app_settings').upsert([
      {
        key: 'cac_pricing_controls',
        value: updatedConfigs,
        updated_at: now,
      },
      ...(tinFee !== undefined ? [{
        key: 'cac_tin_fee',
        value: String(tinFee),
        updated_at: now,
      }] : []),
    ], { onConflict: 'key' });

    // 4. Mirror into legacy cac_pricing table to avoid breaking any legacy views
    const legacyUpdates = Object.values(updatedConfigs).map(cfg => {
      const activePrice = cfg.is_promo_active && cfg.promo_price && cfg.promo_price > 0 
        ? cfg.promo_price 
        : cfg.regular_price;
      
      const discountLabel = cfg.is_promo_active && cfg.regular_price > activePrice
        ? `${Math.round(((cfg.regular_price - activePrice) / cfg.regular_price) * 100)}% OFF`
        : null;

      return {
        name: cfg.service_name,
        price: activePrice,
        original_price: cfg.regular_price,
        discount_label: discountLabel,
        active: cfg.is_available,
      };
    });

    try {
      await supabase.from('cac_pricing').upsert(legacyUpdates, { onConflict: 'name' });
    } catch (_) {}

    // 5. Audit Logging
    const changedFields: Record<string, { from: any; to: any }> = {};
    Object.keys(updatedConfigs).forEach(key => {
      const k = key as CacServiceCode;
      const prev = previousConfigs[k];
      const next = updatedConfigs[k];
      if (prev && next) {
        if (prev.regular_price !== next.regular_price) {
          changedFields[`${k}.regular_price`] = { from: prev.regular_price, to: next.regular_price };
        }
        if (prev.promo_price !== next.promo_price) {
          changedFields[`${k}.promo_price`] = { from: prev.promo_price, to: next.promo_price };
        }
        if (prev.is_promo_active !== next.is_promo_active) {
          changedFields[`${k}.is_promo_active`] = { from: prev.is_promo_active, to: next.is_promo_active };
        }
        if (prev.share_capital_increment_fee !== next.share_capital_increment_fee) {
          changedFields[`${k}.share_capital_increment_fee`] = { from: prev.share_capital_increment_fee, to: next.share_capital_increment_fee };
        }
        if (prev.additional_director_fee !== next.additional_director_fee) {
          changedFields[`${k}.additional_director_fee`] = { from: prev.additional_director_fee, to: next.additional_director_fee };
        }
        if (prev.additional_trustee_fee !== next.additional_trustee_fee) {
          changedFields[`${k}.additional_trustee_fee`] = { from: prev.additional_trustee_fee, to: next.additional_trustee_fee };
        }
        if (prev.is_available !== next.is_available) {
          changedFields[`${k}.is_available`] = { from: prev.is_available, to: next.is_available };
        }
      }
    });

    try {
      await supabase.from('cac_pricing_audit_logs').insert({
        service_code: 'cac_matrix_all',
        admin_id: user.id,
        admin_email: profile.email || user.email || 'Admin',
        change_type: 'update',
        previous_config: previousConfigs,
        new_config: updatedConfigs,
        summary: changeSummary || `Updated ${Object.keys(changedFields).length} pricing fields across CAC suite`,
        created_at: now,
      });

      // Also log to general audit_logs
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action: 'Updated CAC Dynamic Pricing & Rules Configuration',
        target_resource: 'CAC Registration Pricing Engine',
        details: {
          changedFields,
          tinFee,
          timestamp: now,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('saveCacPricingConfiguration error:', err);
    return { success: false, error: err.message || 'Failed to update CAC pricing settings' };
  }
}

export async function fetchCacPricingAuditLogs(): Promise<CacAuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('cac_pricing_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // Fallback query to audit_logs
      const { data: genLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .ilike('action', '%CAC%')
        .order('created_at', { ascending: false })
        .limit(20);

      if (genLogs) {
        return genLogs.map(l => ({
          id: l.id,
          service_code: 'cac',
          admin_id: l.admin_id,
          admin_email: 'Admin',
          change_type: 'update',
          new_config: l.details || {},
          summary: l.action,
          created_at: l.created_at,
        }));
      }
      return [];
    }

    return (data || []) as CacAuditLogEntry[];
  } catch (e) {
    return [];
  }
}

// -------------------------------------------------------------
// Server-Side Verification Helper (Never trust client totals)
// -------------------------------------------------------------
export function validateOrderTotal(
  config: CacPricingConfig,
  params: CacCalculationParams,
  clientSubmittedTotal: number
): {
  valid: boolean;
  delta: number;
  calculatedTotal: number;
  calculation: CacCalculationResult;
} {
  const calculation = calculateCacPrice(config, params);
  const delta = Math.abs(calculation.totalAmount - clientSubmittedTotal);
  // Allow at most 1 Naira difference for currency rounding tolerance
  const valid = delta <= 1.0;

  return {
    valid,
    delta,
    calculatedTotal: calculation.totalAmount,
    calculation,
  };
}
