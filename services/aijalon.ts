/**
 * Aijalon Identity & Verification API Service
 * Full implementation covering all endpoints available on the Aijalon dashboard
 * Base URL: https://aijalon.ng/api
 * Auth: Bearer Token in Authorization header
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const AIJALON_BASE_URL = 'https://aijalon.ng/api';
const AIJALON_TOKEN = 'lv_Aijalon_r63b1dtk84qu1mz31pws59j0oax86c59';

const aijalonHeaders = {
    'Authorization': `Bearer ${AIJALON_TOKEN}`,
    'Content-Type': 'application/json',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AijalonResponse {
    success: boolean;
    data?: any;
    message: string;
    rawData?: any;
}

/** NIN Verification — verify a National Identification Number */
export interface NINParams {
    number: string; // 11-digit NIN
}

/** NIN With Phone — verify NIN using phone number linked to it */
export interface NINWithPhoneParams {
    number: string; // phone number linked to NIN
}

/** NIN Demo Search — verify using demographic details */
export interface NINDemoSearchParams {
    firstname: string;
    lastname: string;
    gender: 'm' | 'f';
    dob: string; // DD-MM-YYYY
}

/** BVN Verification — verify a Bank Verification Number */
export interface BVNParams {
    number: string; // 11-digit BVN
}

/** BVN Card — retrieve full BVN card/record details */
export interface BVNCardParams {
    number: string; // 11-digit BVN
}

/** IPE Clearance — instant pre-employment clearance check */
export interface IPEClearanceParams {
    number: string; // NIN or BVN for clearance
}

/** Validation — instant document/identity validation */
export interface ValidationParams {
    number: string;    // ID number
    type?: string;     // e.g. 'nin', 'bvn', 'passport'
}

/** Delink & Retrieval — delink a phone number from NIN or retrieve linked info */
export interface DelinkRetrievalParams {
    number: string;    // NIN or BVN
    phone?: string;    // phone number to delink (optional for retrieval only)
}

/** BVN Retrieval — retrieve BVN information by phone or NIN */
export interface BVNRetrievalParams {
    number: string;    // phone number or NIN
}

/** Personalization — NIN personalization/enrollment details */
export interface PersonalizationParams {
    number: string;    // NIN
}

/** Modification — request name or data modification */
export interface ModificationParams {
    number: string;           // NIN
    firstname?: string;
    lastname?: string;
    middlename?: string;
    phone?: string;
}

/** DOB Modification — request date of birth correction */
export interface DOBModificationParams {
    number: string;   // NIN
    dob: string;      // new DOB in DD-MM-YYYY format
}

/** Birth Attestation — birth certificate attestation/verification */
export interface BirthAttestationParams {
    firstname: string;
    lastname: string;
    dob: string;       // DD-MM-YYYY
    state?: string;    // state of birth
    lga?: string;      // LGA of birth
}

/** BVN Modification — request BVN record update */
export interface BVNModificationParams {
    number: string;    // BVN
    firstname?: string;
    lastname?: string;
    middlename?: string;
    dob?: string;      // DD-MM-YYYY
    phone?: string;
}

/** Transaction History — retrieve verification transaction history */
export interface TransactionHistoryParams {
    page?: number;
    limit?: number;
    from?: string;    // date filter DD-MM-YYYY
    to?: string;      // date filter DD-MM-YYYY
}

/** Verification History — retrieve past verifications */
export interface VerificationHistoryParams {
    page?: number;
    limit?: number;
    type?: string;    // filter by type: 'nin', 'bvn', 'phone', etc.
}

// ─── CORE HTTP HELPER ─────────────────────────────────────────────────────────

async function aijalonPost(endpoint: string, body: object): Promise<AijalonResponse> {
    try {
        const response = await fetch(`${AIJALON_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: aijalonHeaders,
            body: JSON.stringify(body),
        });

        let data: any;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text };
        }

        if (!response.ok) {
            return {
                success: false,
                message: data?.message || data?.detail || data?.error || `Request failed (${response.status})`,
                rawData: data,
            };
        }

        return {
            success: true,
            message: data?.message || 'Request successful',
            data: data?.data || data,
            rawData: data,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Network Error — Could not reach Aijalon API',
        };
    }
}

async function aijalonGet(endpoint: string, params?: Record<string, any>): Promise<AijalonResponse> {
    try {
        let url = `${AIJALON_BASE_URL}${endpoint}`;
        if (params && Object.keys(params).length > 0) {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
            ).toString();
            url = `${url}?${qs}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: aijalonHeaders,
        });

        let data: any;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text };
        }

        if (!response.ok) {
            return {
                success: false,
                message: data?.message || data?.detail || data?.error || `Request failed (${response.status})`,
                rawData: data,
            };
        }

        return {
            success: true,
            message: data?.message || 'Request successful',
            data: data?.data || data,
            rawData: data,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Network Error — Could not reach Aijalon API',
        };
    }
}

// ─── VERIFICATIONS ────────────────────────────────────────────────────────────

/**
 * NIN Verification
 * Verify a National Identification Number (NIN)
 * POST /api/nin/
 */
export const verifyNIN = (params: NINParams) =>
    aijalonPost('/nin/', { number: params.number });

/**
 * NIN With Phone
 * Verify/lookup NIN using a phone number linked to it
 * POST /api/nin-phone/
 */
export const verifyNINWithPhone = (params: NINWithPhoneParams) =>
    aijalonPost('/nin-phone/', { number: params.number });

/**
 * NIN Demo Search
 * Search for NIN record using demographic data
 * POST /api/demo/
 */
export const verifyNINDemo = (params: NINDemoSearchParams) =>
    aijalonPost('/demo/', {
        firstname: params.firstname,
        lastname: params.lastname,
        gender: params.gender,
        dob: params.dob,
    });

/**
 * BVN Verification
 * Verify a Bank Verification Number (BVN)
 * POST /api/bvn/
 */
export const verifyBVN = (params: BVNParams) =>
    aijalonPost('/bvn/', { number: params.number });

/**
 * BVN Card
 * Retrieve full BVN card details and linked records
 * POST /api/bvn-card/
 */
export const getBVNCard = (params: BVNCardParams) =>
    aijalonPost('/bvn-card/', { number: params.number });

// ─── IPE CLEARANCE ────────────────────────────────────────────────────────────

/**
 * IPE Clearance (Instant)
 * Instant Pre-Employment clearance check via NIN/BVN
 * POST /api/ipe/
 */
export const runIPEClearance = (params: IPEClearanceParams) =>
    aijalonPost('/ipe/', { number: params.number });

// ─── VALIDATION ───────────────────────────────────────────────────────────────

/**
 * Validation (Instant)
 * Instant document/identity validation
 * POST /api/validate/
 */
export const validateIdentity = (params: ValidationParams) =>
    aijalonPost('/validate/', {
        number: params.number,
        ...(params.type ? { type: params.type } : {}),
    });

// ─── DELINK & RECOVERY ────────────────────────────────────────────────────────

/**
 * Delink & Retrieval
 * Delink a phone number from NIN or retrieve linked information
 * POST /api/delink/
 */
export const delinkAndRetrieve = (params: DelinkRetrievalParams) =>
    aijalonPost('/delink/', {
        number: params.number,
        ...(params.phone ? { phone: params.phone } : {}),
    });

/**
 * BVN Retrieval
 * Retrieve BVN information by phone number or NIN
 * POST /api/bvn-retrieval/
 */
export const retrieveBVN = (params: BVNRetrievalParams) =>
    aijalonPost('/bvn-retrieval/', { number: params.number });

// ─── USER DETAILS / MODIFICATIONS ─────────────────────────────────────────────

/**
 * Personalization
 * Retrieve NIN personalization and enrollment details
 * POST /api/personalize/
 */
export const getPersonalization = (params: PersonalizationParams) =>
    aijalonPost('/personalize/', { number: params.number });

/**
 * Modification
 * Request name or contact data modification on NIN record
 * POST /api/modify/
 */
export const requestModification = (params: ModificationParams) =>
    aijalonPost('/modify/', {
        number: params.number,
        ...(params.firstname ? { firstname: params.firstname } : {}),
        ...(params.lastname ? { lastname: params.lastname } : {}),
        ...(params.middlename ? { middlename: params.middlename } : {}),
        ...(params.phone ? { phone: params.phone } : {}),
    });

/**
 * DOB Modification
 * Request date of birth correction on NIN record
 * POST /api/dob-modify/
 */
export const requestDOBModification = (params: DOBModificationParams) =>
    aijalonPost('/dob-modify/', {
        number: params.number,
        dob: params.dob,
    });

/**
 * Birth Attestation
 * Verify or attest a birth certificate record
 * POST /api/birth-attestation/
 */
export const attestBirth = (params: BirthAttestationParams) =>
    aijalonPost('/birth-attestation/', {
        firstname: params.firstname,
        lastname: params.lastname,
        dob: params.dob,
        ...(params.state ? { state: params.state } : {}),
        ...(params.lga ? { lga: params.lga } : {}),
    });

/**
 * BVN Modification
 * Request BVN record update/correction
 * POST /api/bvn-modify/
 */
export const requestBVNModification = (params: BVNModificationParams) =>
    aijalonPost('/bvn-modify/', {
        number: params.number,
        ...(params.firstname ? { firstname: params.firstname } : {}),
        ...(params.lastname ? { lastname: params.lastname } : {}),
        ...(params.middlename ? { middlename: params.middlename } : {}),
        ...(params.dob ? { dob: params.dob } : {}),
        ...(params.phone ? { phone: params.phone } : {}),
    });

// ─── HISTORY / RECORDS ────────────────────────────────────────────────────────

/**
 * Transactions
 * Retrieve verification transaction/billing history
 * GET /api/transactions/
 */
export const getTransactionHistory = (params?: TransactionHistoryParams) =>
    aijalonGet('/transactions/', params);

/**
 * Verifications
 * Retrieve past verification history
 * GET /api/verifications/
 */
export const getVerificationHistory = (params?: VerificationHistoryParams) =>
    aijalonGet('/verifications/', params);

// ─── NAMED EXPORT (grouped) ──────────────────────────────────────────────────

export const AijalonAPI = {
    // Verifications
    verifyNIN,
    verifyNINWithPhone,
    verifyNINDemo,
    verifyBVN,
    getBVNCard,

    // IPE Clearance
    runIPEClearance,

    // Validation
    validateIdentity,

    // Delink & Recovery
    delinkAndRetrieve,
    retrieveBVN,

    // User Details / Modifications
    getPersonalization,
    requestModification,
    requestDOBModification,
    attestBirth,
    requestBVNModification,

    // History
    getTransactionHistory,
    getVerificationHistory,
};
