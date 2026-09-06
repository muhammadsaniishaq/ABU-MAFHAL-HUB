/**
 * Enterprise Security & Phone Number Validation Utilities
 * Abu Mafhal Sub Platform
 */

export interface PhoneValidationResult {
    isValid: boolean;
    clean11: string; // e.g., '08012345678'
    cleanInternational: string; // e.g., '2348012345678'
    network?: 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE' | 'UNKNOWN';
    error?: string;
}

// Known Nigerian Mobile Network Prefixes
export const NIGERIAN_NETWORK_PREFIXES: Record<string, 'MTN' | 'AIRTEL' | 'GLO' | '9MOBILE'> = {
    // MTN
    '0803': 'MTN', '0806': 'MTN', '0703': 'MTN', '0706': 'MTN',
    '0813': 'MTN', '0816': 'MTN', '0810': 'MTN', '0814': 'MTN',
    '0903': 'MTN', '0906': 'MTN', '0913': 'MTN', '0916': 'MTN', '0704': 'MTN',
    // AIRTEL
    '0802': 'AIRTEL', '0808': 'AIRTEL', '0708': 'AIRTEL', '0812': 'AIRTEL',
    '0701': 'AIRTEL', '0902': 'AIRTEL', '0901': 'AIRTEL', '0904': 'AIRTEL',
    '0907': 'AIRTEL', '0912': 'AIRTEL',
    // GLO
    '0805': 'GLO', '0807': 'GLO', '0705': 'GLO', '0815': 'GLO',
    '0811': 'GLO', '0905': 'GLO', '0915': 'GLO',
    // 9MOBILE
    '0809': '9MOBILE', '0817': '9MOBILE', '0818': '9MOBILE',
    '0909': '9MOBILE', '0908': '9MOBILE'
};

/**
 * Strictly validates a Nigerian mobile phone number.
 * Ensures the number is COMPLETE (exact 11 digits) and belongs to a valid Nigerian network.
 */
export function validateNigerianPhone(rawInput: string | null | undefined): PhoneValidationResult {
    if (!rawInput || typeof rawInput !== 'string') {
        return { isValid: false, clean11: '', cleanInternational: '', error: 'Phone number is required.' };
    }

    let digits = rawInput.replace(/\D/g, '');

    // Format if starting with country code (234)
    if (digits.startsWith('234')) {
        digits = '0' + digits.slice(3);
    } else if (!digits.startsWith('0') && digits.length === 10) {
        digits = '0' + digits;
    }

    // Check completeness
    if (digits.length < 11) {
        return {
            isValid: false,
            clean11: digits,
            cleanInternational: '',
            error: `Incomplete phone number (${digits.length}/11 digits). Please enter all 11 digits.`
        };
    }

    if (digits.length > 11) {
        return {
            isValid: false,
            clean11: digits,
            cleanInternational: '',
            error: `Phone number is too long (${digits.length} digits). A valid Nigerian number is exactly 11 digits.`
        };
    }

    // Check valid network prefix
    const prefix4 = digits.slice(0, 4);
    const network = NIGERIAN_NETWORK_PREFIXES[prefix4];

    if (!network) {
        return {
            isValid: false,
            clean11: digits,
            cleanInternational: '',
            error: `Invalid network prefix (${prefix4}). Please enter a valid MTN, Airtel, Glo, or 9mobile number.`
        };
    }

    // Reject fake repeating sequences like 08000000000, 08011111111, etc.
    const suffix7 = digits.slice(4);
    if (/^(\d)\1{6}$/.test(suffix7)) {
        return {
            isValid: false,
            clean11: digits,
            cleanInternational: '',
            error: 'Invalid phone number format (fake repetitive number).'
        };
    }

    return {
        isValid: true,
        clean11: digits,
        cleanInternational: '234' + digits.slice(1),
        network: network
    };
}

/**
 * Detects if a text contains potential XSS or script injection payloads.
 */
export function isPotentialXssPayload(input: string | null | undefined): boolean {
    if (!input || typeof input !== 'string') return false;

    const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript\s*:/gi,
        /onerror\s*=/gi,
        /onload\s*=/gi,
        /onclick\s*=/gi,
        /<iframe\b/gi,
        /<img\b[^>]*onerror/gi,
        /<svg\b[^>]*onload/gi,
        /eval\s*\(/gi,
        /alert\s*\(/gi,
        /[<>{}[\]\\\/`"']/gi, // Dangerous brackets & quotes
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitizes input string to prevent XSS, HTML tag injection, and SQL injection characters.
 */
export function sanitizeText(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';

    return input
        .replace(/[<>'"`;\\]/g, '') // Strip HTML tags and injection delimiters
        .replace(/javascript:/gi, '')
        .replace(/script/gi, '')
        .trim();
}
