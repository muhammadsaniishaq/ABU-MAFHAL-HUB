/**
 * AgentHub Identity Verification Service
 * Replaces IDPro with AgentHub (https://agenthub.ng/api)
 *
 * All calls go through the `verify-nin` Supabase Edge Function
 * which handles auth, wallet deduction, and AgentHub API calls.
 *
 * AgentHub Services covered:
 *  - NIN Verification
 *  - NIN Slip PDF (service codes 401 Premium / 402 Standard / 403 Regular)
 *  - Phone → NIN Lookup
 *  - BVN Verification
 *  - BVN by Phone
 *  - BVN Card
 *  - Demographic Verification
 */

import { supabase } from './supabase';
import {
  VerificationResult,
  DemographicParams,
  ModificationParams,
  BirthAttestationParams,
  BVNModificationParams,
  HistoryParams,
} from './partners';

// NIN Slip service codes
export type NINSlipServiceCode = '401' | '402' | '403';
export const NIN_SLIP_CODES: Record<NINSlipServiceCode, string> = {
  '401': 'Premium — Full color, high quality',
  '402': 'Standard — Premium without core',
  '403': 'Regular — Standard NIMC layout',
};

export const AgentHubIdentityVerifier = {
  // ── Core helper: invoke the verify-nin Edge Function ─────────────────────
  async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const body = { searchType, searchValue, ...extra };
      const { data, error } = await supabase.functions.invoke('verify-nin', { body });

      // ── Handle Edge Function HTTP errors ─────────────────────────────────
      if (error) {
        let realMessage = error.message || 'Verification Error';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            if (errBody?.error) realMessage = errBody.error;
            else if (errBody?.message) realMessage = errBody.message;
          }
        } catch (_) { /* keep generic message if body can't be parsed */ }

        if (realMessage.toLowerCase().includes('insufficient') || realMessage.toLowerCase().includes('balance')) {
          return { isValid: false, message: 'Insufficient wallet balance. Please fund your wallet and try again.' };
        }
        if (realMessage.toLowerCase().includes('unauthorized') || realMessage.toLowerCase().includes('jwt')) {
          return { isValid: false, message: 'Session expired. Please log out and log in again.' };
        }
        if (realMessage.toLowerCase().includes('configuration') || realMessage.toLowerCase().includes('api key')) {
          return { isValid: false, message: 'Service is temporarily unavailable. Please try again later.' };
        }
        return { isValid: false, message: realMessage };
      }

      if (!data) {
        return { isValid: false, message: 'No response received from server' };
      }

      // ── Handle explicit error payload ─────────────────────────────────────
      if (data.error) {
        const msg: string = data.error;
        if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
          return { isValid: false, message: 'Insufficient wallet balance. Please fund your wallet and try again.' };
        }
        if (msg.toLowerCase().includes('unauthorized')) {
          return { isValid: false, message: 'Session expired. Please log out and log in again.' };
        }
        return { isValid: false, message: msg, data: data.details };
      }

      // ── Parse AgentHub success response ───────────────────────────────────
      // Edge Function wraps AgentHub response in: { data: { status: "success", message, data/pdf_base64 } }
      const agentHubResponse = data.data;
      if (!agentHubResponse) {
        return { isValid: false, message: 'Invalid response from verification provider' };
      }

      const rawStatus = agentHubResponse.status;
      const agentHubStatus = String(rawStatus || '').toLowerCase();
      const isSuccessStatus = rawStatus === true || ['true', 'success', 'pending', 'completed'].includes(agentHubStatus);

      if (isSuccessStatus) {
        // For NIN slip: return pdf_base64 in data
        if (agentHubResponse.pdf_base64 || agentHubResponse.data?.pdf_base64) {
          return {
            isValid: true,
            message: agentHubResponse.message || 'Slip Generated Successfully',
            data: agentHubResponse.data || { pdf_base64: agentHubResponse.pdf_base64 },
          };
        }

        const personData = agentHubResponse.data ?? agentHubResponse;
        return {
          isValid: true,
          message: agentHubResponse.message || 'Verification Successful',
          data: personData,
        };
      }

      // Fallback: response has person fields at top level
      if (agentHubResponse.firstname || agentHubResponse.surname || agentHubResponse.nin) {
        return { isValid: true, message: 'Verification Successful', data: agentHubResponse };
      }

      return {
        isValid: false,
        message: agentHubResponse.message || 'Verification failed. The record may be invalid or not found.',
      };

    } catch (e: any) {
      return { isValid: false, message: e.message || 'A network error occurred. Check your connection.' };
    }
  },

  /** Verify NIN and get full personal data for high-resolution slip generation */
  validateNIN: async (nin: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin', nin, { priceId: priceId || 'nin_regular' }),

  /** Lookup NIN by phone number */
  verifyNINWithPhone: async (phone: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('phone', phone, { priceId }),

  /** Lookup NIN by phone number (alias) */
  verifyPhone: async (phone: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('phone', phone, { priceId }),

  /**
   * Generate a printable NIN Slip PDF (returned as base64)
   * @param nin - The NIN number
   * @param serviceCode - Slip design: '401' Premium | '402' Standard | '403' Regular (default)
   * @param priceId - Supabase service_pricing ID
   */
  generateNINSlip: async (nin: string, serviceCode: NINSlipServiceCode = '403', priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-slip', nin, {
      service_code: serviceCode,
      priceId,
    }),

  /**
   * Generate a printable VNIN Slip PDF (returned as base64)
   * @param nin - The NIN number
   * @param priceId - Supabase service_pricing ID
   */
  generateVNINSlip: async (nin: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('vnin-slip', nin, { priceId }),

  /** IPE Clearance (uses NIN endpoint on AgentHub) */
  runIPEClearance: async (number: string, priceId?: string, addonPriceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('ipe', number, { priceId, addonPriceId }),

  /** Identity Validation (uses NIN endpoint on AgentHub) */
  validateIdentity: async (number: string, type?: string, priceId?: string, addonPriceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('val', number, { idType: type, priceId, addonPriceId }),

  /** Demographic Verification (firstname, lastname, gender, dob) */
  verifyDemographic: async (params: DemographicParams, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('demographic', '', {
      firstname: params.firstname,
      lastname: params.lastname,
      gender: params.gender,
      dob: params.dob,
      priceId,
    }),

  // ── BVN SERVICES ─────────────────────────────────────────────────────────

  /** Verify BVN and get full personal data */
  validateBVN: async (bvn: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn', bvn, { priceId }),

  /** Get BVN Card */
  getBVNCard: async (bvn: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-card', bvn, { priceId }),

  /** Retrieve BVN by phone number */
  retrieveBVN: async (phone: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-phone', phone, { priceId }),

  /**
   * Generate a printable NIN Slip V2 PDF (PREMIUM, STANDARD, REGULAR)
   * @param nin - 11-digit NIN
   * @param slipType - 'PREMIUM' | 'STANDARD' | 'REGULAR'
   * @param priceId - Supabase service_pricing ID
   */
  generateNINSlipV2: async (nin: string, slipType: 'PREMIUM' | 'STANDARD' | 'REGULAR' = 'PREMIUM', priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-slip-v2', nin, {
      slip_type: slipType,
      priceId,
    }),

  /**
   * Submit NIN Validation request (queue for issue resolution: 329, 330, 331)
   */
  submitNINValidation: async (nin: string, serviceCode: string = '329', reference?: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-validation', nin, {
      service_code: serviceCode,
      reference,
      priceId,
    }),

  /** Check status of a submitted NIN validation request */
  checkNINValidationStatus: async (requestId: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-validation-status', requestId),

  /**
   * Submit NIN Personalization request using Tracking ID
   */
  submitNINPersonalization: async (trackingId: string, reference?: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-personalization', trackingId, {
      trackingId,
      reference,
      priceId,
    }),

  /** Check status of a submitted NIN personalization request */
  checkNINPersonalizationStatus: async (requestId: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-personalization-status', requestId),

  /**
   * Submit NIN Data Modification request
   * service_code: 501 (Name), 502 (Phone), 503 (Address)
   */
  requestModification: async (params: ModificationParams, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-modification', params.number, {
      service_code: (params as any).service_code || '501',
      nin: params.number,
      phone_number: params.phone,
      new_first_name: params.firstname,
      new_surname: params.lastname,
      new_middle_name: params.middlename,
      full_name: (params as any).full_name,
      new_phone_number: (params as any).new_phone_number,
      new_address: (params as any).new_address,
      priceId,
    }),

  /** Get NIN Tracking/Personalization data (alias to submitNINPersonalization) */
  getPersonalization: async (number: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('nin-personalization', number, { trackingId: number, priceId }),

  /** Link VNIN to NIBSS database via AgentHub */
  linkVNINToNIBSS: async (vnin: string, bvn?: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('vnin-to-nibss', vnin, { vnin, bvn, priceId: priceId || 'bvn_vnin_nibss' }),

  /** Request BVN Modification via AgentHub */
  requestBVNModification: async (params: BVNModificationParams, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-modification', params.number, {
      bvn: params.number,
      service_code: (params as any).service_code || '601',
      phone_number: params.phone,
      firstname: params.firstname,
      lastname: params.lastname,
      dob: params.dob,
      priceId: priceId || 'bvn_modification',
    }),

  // ── DELINK & RECOVERY ────────────────────────────────────────────────────

  /** Delink (uses NIN endpoint on AgentHub — no direct counterpart) */
  delinkAndRetrieve: async (number: string, phone?: string, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('delink', number, { phone, priceId }),

  // ── NOT IMPLEMENTED (AgentHub doesn't have direct counterparts yet) ───────

  requestDOBModification: async (_number: string, _dob: string) =>
    ({ isValid: false, message: 'DOB Modification not available via AgentHub yet.' }),

  attestBirth: async (_params: BirthAttestationParams) =>
    ({ isValid: false, message: 'Birth Attestation not available via AgentHub yet.' }),

  getTransactionHistory: async (_params?: HistoryParams) =>
    ({ isValid: false, message: 'History not available via AgentHub.' }),

  getVerificationHistory: async (_params?: HistoryParams) =>
    ({ isValid: false, message: 'History not available via AgentHub.' }),
};

/**
 * Backward-compatible alias
 * Any existing code using `IdProIdentityVerifier` continues to work.
 */
export const IdProIdentityVerifier = AgentHubIdentityVerifier;
