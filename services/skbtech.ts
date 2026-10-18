/**
 * SKBTECH Identity Verification & Services Client
 * Base URL: https://skbtech.com.ng/api/v1
 *
 * Replaces legacy/broken providers (AgentHub & IDPro) with the new official SKBTECH API.
 * All requests are routed securely through the Supabase Edge Function `verify-nin`
 * to protect the API key, enforce atomic wallet balance deductions, and automatically
 * issue refunds if any provider request cannot be completed.
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

export type NINSlipLayout = 'PREMIUM' | 'STANDARD' | 'REGULAR' | 'BASIC';

export interface SKBStatusResponse {
  success: boolean;
  reference: string;
  service?: string;
  type?: string;
  request_status: 'pending' | 'processing' | 'completed' | 'failed';
  refunded: boolean;
  amount?: number;
  response?: string;
  attachments?: string[];
  submitted_at?: string;
  updated_at?: string;
}

export function sanitizeVerificationMessage(rawMsg: string | null | undefined): string {
  if (!rawMsg) return 'Verification service is momentarily unavailable. Please try again shortly.';
  const lower = String(rawMsg).toLowerCase();

  // 1. 🛡️ Confidentiality: Completely mask provider wallet / API key / balance exhaustion from end-users
  if (
    lower.includes('provider api wallet') ||
    lower.includes('agenthub') ||
    lower.includes('skbtech') ||
    lower.includes('provider balance') ||
    lower.includes('provider gateway') ||
    lower.includes('gateway balance') ||
    lower.includes('balance is low') ||
    lower.includes('fund your wallet at') ||
    lower.includes('api key') ||
    lower.includes('api credentials') ||
    lower.includes('config error') ||
    lower.includes('upstream error') ||
    lower.includes('developer page')
  ) {
    return 'Identity verification gateway is currently undergoing scheduled optimization. Please try again in a few moments.';
  }

  // 2. ✨ Professional "No Record Found" message
  if (
    lower.includes('record not found') ||
    lower.includes('not found') ||
    lower.includes('no record') ||
    lower.includes('does not exist') ||
    lower.includes('not exist') ||
    lower.includes('invalid or not found') ||
    lower.includes('no matching') ||
    lower.includes('could not be retrieved') ||
    lower.includes('could not be found')
  ) {
    return 'No citizen record was found matching the details provided. Please verify the information and try again.';
  }

  // 3. User wallet balance
  if (lower.includes('insufficient') && (lower.includes('balance') || lower.includes('wallet'))) {
    return 'Your wallet balance is insufficient for this verification. Please fund your wallet to proceed.';
  }

  // 4. Timeouts
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'The identity verification gateway took too long to respond. If any fee was deducted, it has been automatically refunded. Please try again.';
  }

  return rawMsg;
}

export const SKBTechIdentityVerifier = {
  // ── Core Invoker: delegates to Supabase Edge Function `verify-nin` ────────────
  async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const body = { searchType, searchValue, ...extra };

      // 🛡️ 28-second client-side timeout guard so the mobile app never hangs indefinitely
      const invokePromise = supabase.functions.invoke('verify-nin', { body });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Identity verification request took too long to respond. Please check your connection and try again.'
              )
            ),
          28000
        )
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (error) {
        let msg = error.message || 'Verification failed. Please try again.';
        return { isValid: false, message: sanitizeVerificationMessage(msg) };
      }

      if (data?.error) {
        return { isValid: false, message: sanitizeVerificationMessage(data.error), data: data.details };
      }

      if (data?.data) {
        const providerResponse = data.data;
        const rawStatus = String(providerResponse.status ?? providerResponse.request_status ?? '').toLowerCase();

        if (rawStatus === 'failed') {
          return {
            isValid: false,
            message: sanitizeVerificationMessage(providerResponse.message || providerResponse.response || 'No matching citizen record found.'),
          };
        }

        const isSuccessStatus =
          providerResponse.success === true ||
          rawStatus === 'true' ||
          rawStatus === 'success' ||
          rawStatus === 'completed' ||
          rawStatus === 'pending' ||
          rawStatus === 'processing';

        if (isSuccessStatus) {
          const personData = providerResponse.data ?? providerResponse;
          
          // Ensure we actually have data fields, not an empty object
          const hasIdentityRecord = Boolean(
            personData.nin ||
            personData.bvn ||
            personData.firstname ||
            personData.surname ||
            personData.first_name ||
            personData.last_name ||
            personData.pdf_base64 ||
            personData.slip_url ||
            rawStatus === 'pending' ||
            rawStatus === 'processing'
          );

          if (!hasIdentityRecord) {
            return {
              isValid: false,
              message: 'No citizen record was found matching the details provided. Please verify the information and try again.',
            };
          }

          return {
            isValid: true,
            message: providerResponse.message || providerResponse.response || 'Request Processed Successfully',
            data: personData,
            pdf_base64: providerResponse.pdf_base64 || providerResponse.data?.pdf_base64 || data.pdf_base64,
            slip_url: providerResponse.slip_url || providerResponse.data?.slip_url || data.slip_url || (Array.isArray(providerResponse.attachments) && providerResponse.attachments[0]) || null,
          };
        }
      }

      if (data?.message) {
        return { isValid: false, message: sanitizeVerificationMessage(data.message) };
      }

      return { isValid: false, message: 'Could not verify details. Please check the input and try again.' };
    } catch (e: any) {
      return { isValid: false, message: e.message || 'A network error occurred. Please check your connection.' };
    }
  },

  async invokeDirect(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    return SKBTechIdentityVerifier.invokeEdge(searchType, searchValue, extra);
  },

  // ── 1. NIN VERIFICATIONS & SLIPS ────────────────────────────────────────────

  /**
   * Verify NIN and get full personal data for high-resolution slip generation
   * Supports: PREMIUM, STANDARD, REGULAR, BASIC slips
   */
  validateNIN: async (nin: string, priceId?: string, slipType?: string) => {
    const layout = (slipType || 'PREMIUM').toUpperCase();
    return SKBTechIdentityVerifier.invokeEdge('nin', nin, {
      priceId: priceId || 'nin_premium',
      slip_type: layout,
      layout,
    });
  },

  /** Generate printable NIN Slip PDF */
  generateNINSlip: async (nin: string, slipType: NINSlipLayout = 'PREMIUM', priceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('nin-slip', nin, {
      slip_type: slipType,
      layout: slipType,
      priceId: priceId || 'nin_premium',
    });
  },

  /** Alias for NIN Slip V2 */
  generateNINSlipV2: async (nin: string, slipType: 'PREMIUM' | 'STANDARD' | 'REGULAR' = 'PREMIUM', priceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('nin-slip-v2', nin, {
      slip_type: slipType,
      layout: slipType,
      priceId: priceId || 'nin_premium',
    });
  },

  /** Lookup NIN details by linked phone number */
  verifyNINWithPhone: async (phone: string, priceId?: string, variant: string = 'premium') => {
    return SKBTechIdentityVerifier.invokeEdge('phone', phone, {
      phone,
      phone_number: phone,
      priceId: priceId || 'nin_phone',
      variant: variant.toLowerCase(),
    });
  },

  verifyPhone: async (phone: string, priceId?: string, variant: string = 'premium') => {
    return SKBTechIdentityVerifier.verifyNINWithPhone(phone, priceId, variant);
  },

  /** Search NIN record using demographic details (firstname, lastname, dob: DD-MM-YYYY, gender) */
  verifyDemographic: async (params: DemographicParams, priceId?: string, variant: 'premium' | 'standard' | 'regular' = 'premium') => {
    return SKBTechIdentityVerifier.invokeEdge('demographic', '', {
      firstname: params.firstname,
      lastname: params.lastname,
      dob: params.dob,
      gender: params.gender,
      variant: variant.toLowerCase(),
      priceId: priceId || 'nin_demographic',
    });
  },

  /** VNIN Slip / Premium verification */
  generateVNINSlip: async (vnin: string, priceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('vnin-slip', vnin, {
      vnin,
      priceId: priceId || 'vnin_premium',
    });
  },

  // ── 2. BVN VERIFICATION & SERVICES ──────────────────────────────────────────

  /** Verify BVN record (uses /bvn/standard-slip or /bvn/premium-slip) */
  validateBVN: async (bvn: string, priceId?: string, variant: 'standard' | 'premium' = 'standard') => {
    return SKBTechIdentityVerifier.invokeEdge(variant === 'premium' ? 'bvn-premium-slip' : 'bvn', bvn, {
      bvn,
      variant,
      priceId: priceId || 'bvn_num_advanced',
    });
  },

  /** Get BVN Card / Standard Slip */
  getBVNCard: async (bvn: string, priceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('bvn', bvn, {
      bvn,
      priceId: priceId || 'bvn_card',
    });
  },

  /** Generate BVN Premium Slip (Base64 PDF / Slip details) */
  generateBVNPremiumSlip: async (bvn: string, priceId?: string, reference?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('bvn-premium-slip', bvn, {
      bvn,
      reference: reference || `REF-BVN-${Date.now()}`,
      priceId: priceId || 'bvn_premium_slip',
    });
  },

  /**
   * Retrieve lost or forgotten BVN
   * Method 1: By Phone & Name (/bvn/retrieve-by-phone)
   * Method 2: By CRM Ticket ID & Screenshot (/bvn/central-risk)
   */
  retrieveBVN: async (phoneOrTicket: string, priceId?: string, extra?: any) => {
    const isCRM = extra?.service_code === '631' || extra?.activeTab === 'crm' || Boolean(extra?.ticket_id);
    const searchType = isCRM ? 'bvn-central-risk' : 'bvn-retrieval';

    let firstName = extra?.first_name || '';
    let lastName = extra?.last_name || '';
    let middleName = extra?.middle_name || '';

    // If full_name is provided instead of split names, split intelligently
    if (!firstName && extra?.full_name) {
      const parts = String(extra.full_name).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
    }

    return SKBTechIdentityVerifier.invokeEdge(searchType, phoneOrTicket, {
      priceId: priceId || (isCRM ? 'bvn_central_risk' : 'bvn_retrieval'),
      phone: extra?.phone || extra?.phone_number || phoneOrTicket,
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      ticket_id: extra?.ticket_id || phoneOrTicket,
      batch_id: extra?.batch_id || extra?.bms_ticket || '',
      screenshot: extra?.screenshot || '',
      reference: extra?.reference || `REF-RET-${Date.now()}`,
      ...(extra || {}),
    });
  },

  /** Check progress and result of any async request (BVN Retrieval, CRM, BVN & NIN Modification) */
  checkRequestStatus: async (reference: string) => {
    return SKBTechIdentityVerifier.invokeEdge('request-status', reference, {
      reference,
    });
  },

  checkBVNRetrievalStatus: async (requestIdOrReference: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(requestIdOrReference);
  },

  // ── 3. IPE CLEARANCE ────────────────────────────────────────────────────────

  /** Submit an IPE clearance request using a valid tracking ID */
  runIPEClearance: async (trackingID: string, priceId?: string, addonPriceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('ipe', trackingID, {
      trackingID,
      priceId: priceId || 'ipe_clearance',
      addonPriceId,
    });
  },

  /** Check provider status of a previously submitted IPE request */
  checkIPEStatus: async (trackingID: string) => {
    return SKBTechIdentityVerifier.invokeEdge('ipe-status', trackingID, {
      trackingID,
    });
  },

  // ── 4. NIN VALIDATION & PERSONALIZATION ─────────────────────────────────────

  /** Validate NIN authenticity and registration status */
  submitNINValidation: async (nin: string, _serviceCode?: string, _reference?: string, priceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('nin-validation', nin, {
      nin,
      priceId: priceId || 'nin_validation',
    });
  },

  validateIdentity: async (number: string, _type?: string, priceId?: string, addonPriceId?: string) => {
    return SKBTechIdentityVerifier.invokeEdge('nin-validation', number, {
      nin: number,
      priceId: priceId || 'nin_validation',
      addonPriceId,
    });
  },

  checkNINValidationStatus: async (referenceOrNin: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(referenceOrNin);
  },

  /** Submit a Tracking ID for NIN personalization */
  submitNINPersonalization: async (trackingID: string, _reference?: string, priceId?: string, type: 'info' | 'standard' | 'premium' = 'info') => {
    return SKBTechIdentityVerifier.invokeEdge('nin-personalization', trackingID, {
      trackingID,
      type,
      priceId: priceId || 'nin_personalization',
    });
  },

  getPersonalization: async (number: string, priceId?: string) => {
    return SKBTechIdentityVerifier.submitNINPersonalization(number, undefined, priceId, 'info');
  },

  checkNINPersonalizationStatus: async (trackingID: string) => {
    return SKBTechIdentityVerifier.invokeEdge('nin-personalization-status', trackingID, {
      trackingID,
    });
  },

  // ── 5. MODIFICATIONS ────────────────────────────────────────────────────────

  /**
   * Submit a NIN modification: change_of_name, change_of_dob, address, or phone
   */
  requestModification: async (params: ModificationParams | any, priceId?: string) => {
    const modType =
      params.modification_type ||
      (params.code === '502' || params.service_id === 'nin_mod_phone' ? 'phone' :
       params.code === '503' || params.service_id === 'nin_mod_address' ? 'address' :
       params.current_dob || params.new_dob ? 'change_of_dob' : 'change_of_name');

    return SKBTechIdentityVerifier.invokeEdge('nin-modification', params.nin || params.number, {
      nin: params.nin || params.number,
      modification_type: modType,
      new_first_name: params.new_first_name || params.first_name || params.firstname,
      new_surname: params.new_surname || params.last_name || params.lastname,
      new_middle_name: params.new_middle_name || params.middle_name || params.middlename || '',
      current_dob: params.current_dob,
      new_dob: params.new_dob,
      npc_certificate_number: params.npc_certificate_number,
      npc_certificate: params.npc_certificate,
      address_line_1: params.address_line_1 || params.new_address,
      town_city: params.town_city || params.city || '',
      state: params.state || '',
      address_line_2: params.address_line_2 || '',
      postal_code: params.postal_code || '',
      new_phone: params.new_phone || params.new_phone_number || params.phone,
      priceId: priceId || params.priceId || 'nin_modification',
    });
  },

  /**
   * Submit a BVN modification: change_of_name, change_of_dob, address, or phone
   */
  requestBVNModification: async (params: BVNModificationParams | any, priceId?: string) => {
    const modType =
      params.modification_type ||
      (params.new_dob ? 'change_of_dob' :
       params.new_phone || params.new_phone_number ? 'phone' :
       params.address_line_1 || params.new_address ? 'address' : 'change_of_name');

    return SKBTechIdentityVerifier.invokeEdge('bvn-modification', params.bvn || params.number, {
      bvn: params.bvn || params.number,
      nin: params.nin,
      enrollment_type: params.enrollment_type || 'NIBSS',
      modification_type: modType,
      new_first_name: params.new_first_name,
      new_surname: params.new_surname,
      new_middle_name: params.new_middle_name || '',
      new_dob: params.new_dob,
      address_line_1: params.address_line_1,
      town_city: params.town_city,
      state: params.state,
      address_line_2: params.address_line_2 || '',
      postal_code: params.postal_code || '',
      new_phone: params.new_phone || params.new_phone_number,
      affidavit: params.affidavit,
      priceId: priceId || 'bvn_modification',
      ...params,
    });
  },

  checkBVNModificationStatus: async (requestIdOrReference: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(requestIdOrReference);
  },

  checkNINModificationStatus: async (requestIdOrReference: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(requestIdOrReference);
  },

  checkCRMStatus: async (requestIdOrReference: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(requestIdOrReference);
  },

  // ── 6. BULK SMS ─────────────────────────────────────────────────────────────

  /** Send single or bulk SMS via SKBTECH */
  sendSMS: async (phoneNumbers: string | string[], text: string) => {
    const numbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
    return SKBTechIdentityVerifier.invokeEdge('sms', '', {
      phone_numbers: numbers,
      text,
    });
  },

  // ── 7. COMPATIBILITY ALIASES & STUBS ────────────────────────────────────────
  linkVNINToNIBSS: async (vnin: string, bvn?: string, priceId?: string, _extra?: any): Promise<VerificationResult> => {
    // VNIN verification & slip is available via /vnin/premium-slip
    return SKBTechIdentityVerifier.generateVNINSlip(vnin, priceId);
  },

  checkVNINStatus: async (reference: string): Promise<VerificationResult> => {
    return SKBTechIdentityVerifier.checkRequestStatus(reference);
  },

  delinkAndRetrieve: async (number: string, _phone?: string, priceId?: string): Promise<VerificationResult> => {
    // Delink endpoint fallback to NIN lookup
    return SKBTechIdentityVerifier.validateNIN(number, priceId);
  },

  submitBVNEnrollment: async (_params: any, _priceId?: string): Promise<VerificationResult> => ({
    isValid: false,
    message: 'BVN enrollment is processed directly via licensed NIBSS bank agent stations.',
    data: null,
  }),

  checkBVNEnrollmentStatus: async (reference: string) => {
    return SKBTechIdentityVerifier.checkRequestStatus(reference);
  },

  requestDOBModification: async (number: string, dob: string) => {
    return SKBTechIdentityVerifier.requestModification({
      nin: number,
      modification_type: 'change_of_dob',
      new_dob: dob,
    });
  },

  attestBirth: async (_params: BirthAttestationParams) => ({
    isValid: false,
    message: 'NPC Birth Attestation must be submitted through an NPC state office or with an NPC Certificate.',
  }),

  getTransactionHistory: async (_params?: HistoryParams) => ({
    isValid: false,
    message: 'History is managed locally in your transaction dashboard.',
  }),

  getVerificationHistory: async (_params?: HistoryParams) => ({
    isValid: false,
    message: 'History is managed locally in your verification dashboard.',
  }),
};

// Aliases so all existing files using old names continue to function seamlessly
export const AgentHubIdentityVerifier = SKBTechIdentityVerifier;
export const IdProIdentityVerifier = SKBTechIdentityVerifier;
