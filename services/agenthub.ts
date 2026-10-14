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

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const extractStringValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') return parsed;
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed.key || parsed.token || parsed.api_key || parsed.apiKey || parsed.value || JSON.stringify(parsed);
        }
      } catch (e) {}
    }
    return trimmed;
  }
  if (typeof val === 'object' && val !== null) {
    return val.key || val.token || val.api_key || val.apiKey || val.value || JSON.stringify(val);
  }
  return String(val);
};

export const AgentHubIdentityVerifier = {
  // ── Core helper: invoke verification securely via Supabase Edge Function ─────────────────────
  async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const body = { searchType, searchValue, ...extra };
      const { data, error } = await supabase.functions.invoke('verify-nin', { body });

      if (error) {
        let msg = error.message || 'Verification failed. Please try again.';
        if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
          msg = 'Insufficient wallet balance. Please fund your wallet and try again.';
        }
        return { isValid: false, message: msg };
      }

      if (data?.error) {
        return { isValid: false, message: data.error, data: data.details };
      }

      if (data?.data) {
        const providerResponse = data.data;
        const rawStatus = providerResponse.status;
        const isSuccessStatus = rawStatus === true || ['true', 'success', 'pending', 'completed'].includes(String(rawStatus || '').toLowerCase());

        if (isSuccessStatus) {
          const personData = providerResponse.data ?? providerResponse;
          return {
            isValid: true,
            message: providerResponse.message || 'Verification Successful',
            data: personData,
            pdf_base64: providerResponse.pdf_base64 || providerResponse.data?.pdf_base64 || data.pdf_base64
          };
        }
      }

      if (data?.message) {
        return { isValid: false, message: data.message };
      }

      return { isValid: false, message: 'Could not verify details. Please check the input and try again.' };
    } catch (e: any) {
      return { isValid: false, message: e.message || 'A network error occurred. Please check your connection.' };
    }
  },

  // ── Direct Execution Alias: Always delegates to invokeEdge to guarantee single atomic deduction ──
  async invokeDirect(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    return AgentHubIdentityVerifier.invokeEdge(searchType, searchValue, extra);
  },

  /** Verify NIN and get full personal data for high-resolution slip generation */
  validateNIN: async (nin: string, priceId?: string, slipType?: string) => {
    const defaultSlip = priceId === 'nin_standard' ? 'STANDARD' :
                        priceId === 'nin_regular' ? 'REGULAR' :
                        priceId === 'nin_info' ? 'INFO' : 'PREMIUM';
    return AgentHubIdentityVerifier.invokeEdge('nin', nin, { 
      priceId: priceId || 'nin_regular',
      slip_type: (slipType || defaultSlip).toUpperCase()
    });
  },

  /** Lookup NIN by phone number */
  verifyNINWithPhone: async (phone: string, priceId?: string, slipType?: string) => {
    const defaultSlip = priceId === 'nin_standard' ? 'STANDARD' :
                        priceId === 'nin_regular' ? 'REGULAR' :
                        priceId === 'nin_info' ? 'INFO' : 'PREMIUM';
    return AgentHubIdentityVerifier.invokeEdge('phone', phone, { 
      priceId,
      slip_type: (slipType || defaultSlip).toUpperCase()
    });
  },

  /** Lookup NIN by phone number (alias) */
  verifyPhone: async (phone: string, priceId?: string, slipType?: string) => {
    const defaultSlip = priceId === 'nin_standard' ? 'STANDARD' :
                        priceId === 'nin_regular' ? 'REGULAR' :
                        priceId === 'nin_info' ? 'INFO' : 'PREMIUM';
    return AgentHubIdentityVerifier.invokeEdge('phone', phone, { 
      priceId,
      slip_type: (slipType || defaultSlip).toUpperCase()
    });
  },

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

  /** Retrieve BVN by phone number (Code 630) or CRM Ticket (Code 631) */
  retrieveBVN: async (phoneOrIdentifier: string, priceId?: string, extra?: any) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-retrieval', phoneOrIdentifier, {
      priceId: priceId || 'bvn_retrieval',
      ...(extra || {})
    }),

  /** Check BVN Retrieval Status via AgentHub */
  checkBVNRetrievalStatus: async (requestIdOrReference: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-retrieval-status', requestIdOrReference, {
      request_id: requestIdOrReference,
      reference: requestIdOrReference,
    }),

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
  linkVNINToNIBSS: async (vnin: string, bvn?: string, priceId?: string, extra?: any) =>
    AgentHubIdentityVerifier.invokeEdge('vnin-to-nibss', vnin, {
      vnin,
      bvn,
      priceId: priceId || 'bvn_vnin_nibss',
      ...extra
    }),

  /** Check status of a VNIN to NIBSS linking request */
  checkVNINStatus: async (referenceOrRequestId: string) =>
    AgentHubIdentityVerifier.invokeEdge('vnin-to-nibss-status', referenceOrRequestId, { reference: referenceOrRequestId }),

  /** Request BVN Modification via AgentHub */
  requestBVNModification: async (params: any, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-modification', params.bvn || params.number || 'bvn-modification', {
      service_code: params.service_code || '620',
      bank_code: params.bank_code || '706',
      reference: params.reference || `REF-MOD-${Date.now()}`,
      nin: params.nin,
      bvn: params.bvn || params.number,
      old_first_name: params.old_first_name || params.firstname,
      old_surname: params.old_surname || params.lastname,
      old_middle_name: params.old_middle_name || '',
      priceId: priceId || 'bvn_modification',
      ...params,
    }),

  /** Check BVN Modification Status via AgentHub */
  checkBVNModificationStatus: async (requestIdOrReference: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-modification-status', requestIdOrReference, {
      request_id: requestIdOrReference,
      reference: requestIdOrReference,
    }),

  /** Submit BVN User Enrollment via AgentHub */
  submitBVNEnrollment: async (params: any, priceId?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-enrollment', params.phone_number || params.bvn || 'enrollment', {
      priceId: priceId || 'bvn_enrollment',
      ...params,
    }),

  /** Check BVN User Enrollment Status via AgentHub */
  checkBVNEnrollmentStatus: async (requestIdOrReference: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-enrollment-status', requestIdOrReference, {
      request_id: requestIdOrReference,
      reference: requestIdOrReference,
    }),

  /** Generate BVN Premium Slip via AgentHub */
  generateBVNPremiumSlip: async (bvn: string, priceId?: string, reference?: string) =>
    AgentHubIdentityVerifier.invokeEdge('bvn-premium-slip', bvn, {
      bvn,
      reference: reference || `REF-BVN-SLIP-${Date.now()}`,
      priceId: priceId || 'bvn_premium_slip',
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
