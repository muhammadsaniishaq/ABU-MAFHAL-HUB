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
  // ── Core helper: invoke the verify-nin Edge Function with automatic direct fallback ─────────────────────
  async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const body = { searchType, searchValue, ...extra };
      let edgeFailed = false;
      let edgeErrorMessage = '';

      try {
        const { data, error } = await supabase.functions.invoke('verify-nin', { body });

        if (error) {
          edgeFailed = true;
          let realMessage = error.message || 'Verification Error';
          try {
            if (error.context && typeof error.context.json === 'function') {
              const errBody = await error.context.json();
              if (errBody?.error) realMessage = errBody.error;
              else if (errBody?.message) realMessage = errBody.message;
            }
          } catch (_) {}
          edgeErrorMessage = realMessage;
        } else if (data) {
          if (data.error) {
            const msg: string = data.error;
            if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
              return { isValid: false, message: 'Insufficient wallet balance. Please fund your wallet and try again.' };
            }
            if (msg.toLowerCase().includes('unauthorized')) {
              return { isValid: false, message: 'Session expired. Please log out and log in again.' };
            }
            // If it is an internal error or missing config, try direct fallback
            if (msg.toLowerCase().includes('server error') || msg.toLowerCase().includes('unexpected error') || msg.toLowerCase().includes('not configured')) {
              edgeFailed = true;
              edgeErrorMessage = msg;
            } else {
              return { isValid: false, message: msg, data: data.details };
            }
          } else {
            const agentHubResponse = data.data;
            if (agentHubResponse) {
              const rawStatus = agentHubResponse.status;
              const agentHubStatus = String(rawStatus || '').toLowerCase();
              const isSuccessStatus = rawStatus === true || ['true', 'success', 'pending', 'completed'].includes(agentHubStatus);

              if (isSuccessStatus) {
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

              if (agentHubResponse.firstname || agentHubResponse.surname || agentHubResponse.nin) {
                return { isValid: true, message: 'Verification Successful', data: agentHubResponse };
              }

              return {
                isValid: false,
                message: agentHubResponse.message || 'Verification failed. The record may be invalid or not found.',
              };
            }
          }
        }
      } catch (invokeErr: any) {
        edgeFailed = true;
        edgeErrorMessage = invokeErr.message || 'Edge function error';
      }

      // If Edge Function failed, perform seamless direct fallback
      if (edgeFailed) {
        console.warn(`[AgentHub] Edge Function failed (${edgeErrorMessage}), falling back to direct verification...`);
        return await AgentHubIdentityVerifier.invokeDirect(searchType, searchValue, extra);
      }

      return { isValid: false, message: 'No response received from server' };

    } catch (e: any) {
      return await AgentHubIdentityVerifier.invokeDirect(searchType, searchValue, extra);
    }
  },

  // ── Direct Fallback Provider ─────────────────────────────────────────────
  async invokeDirect(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isValid: false, message: 'Please log in to continue.' };

      // 1. Get AgentHub API Key
      let apiKey = '';
      const { data: secret } = await supabase
        .from('system_secrets')
        .select('value')
        .eq('key', 'AGENTHUB_API_KEY')
        .maybeSingle();
      if (secret?.value) apiKey = secret.value;

      if (!apiKey) {
        return { isValid: false, message: 'Verification service key is not configured.' };
      }

      // 2. Determine price and verify balance
      const priceId = extra?.priceId || (searchType === 'bvn' ? 'bvn_num_advanced' : 'nin_regular');
      let fee = 100;
      const { data: pricing } = await supabase
        .from('service_pricing')
        .select('*')
        .eq('id', priceId)
        .maybeSingle();
      if (pricing) {
        const cost = Number(pricing.cost_price || 0);
        const markup = Number(pricing.markup_price || 0);
        fee = pricing.selling_price ? Number(pricing.selling_price) : (cost + markup);
      }

      // 3. Deduct balance
      if (fee > 0) {
        const { error: deductErr } = await supabase.rpc('deduct_balance', {
          user_id: user.id,
          amount: fee
        });
        if (deductErr) {
          if (deductErr.message?.toLowerCase().includes('insufficient')) {
            return { isValid: false, message: `Insufficient wallet balance. You need ₦${fee.toLocaleString()}.` };
          }
          return { isValid: false, message: 'Failed to process payment for verification.' };
        }
      }

      // 4. Build AgentHub endpoint & payload
      let endpoint = 'https://agenthub.ng/api/v1/identity/nin';
      let payload: any = { nin: searchValue };
      const slipType = (extra?.slip_type || extra?.layout || 'REGULAR').toUpperCase();
      let serviceCode = '403';
      if (slipType === 'PREMIUM') serviceCode = '401';
      else if (slipType === 'STANDARD') serviceCode = '402';
      else if (slipType === 'REGULAR') serviceCode = '403';
      else if (slipType === 'INFO') serviceCode = '404';

      const candidateList: { url: string; body: any }[] = [];

      if (searchType === 'nin') {
        if (slipType === 'REGULAR') {
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '403' } });
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'REGULAR' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else if (slipType === 'STANDARD') {
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '402' } });
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'STANDARD' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else if (slipType === 'PREMIUM') {
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '401' } });
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'PREMIUM' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else {
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '403' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        }
      } else if (searchType === 'nin-slip' || searchType === 'nin-slip-v2') {
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: serviceCode } });
        candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: slipType } });
      } else if (searchType === 'phone') {
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/phone-verify', body: { phone: searchValue } });
      } else if (searchType === 'bvn') {
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/bvn', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/identity/bvn', body: { bvn: searchValue } });
      } else if (searchType === 'bvn-phone') {
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/bvn-phone', body: { phone: searchValue } });
      } else if (searchType === 'bvn-card') {
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/bvn-card', body: { bvn: searchValue } });
      } else {
        candidateList.push({ url: endpoint, body: payload });
      }

      // 5. Call AgentHub across candidates
      let resData: any = null;

      for (const item of candidateList) {
        try {
          const res = await fetch(item.url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(item.body)
          });

          if (res.status === 404 && candidateList.length > 1) {
            continue;
          }

          const parsed = await res.json().catch(() => null);
          if (parsed && (parsed.status === true || parsed.status === 'success' || parsed.success === true)) {
            resData = parsed;
            break;
          } else if (parsed) {
            resData = parsed;
          }
        } catch (_) {}
      }

      if (resData && (resData.status === true || resData.status === 'success' || resData.success === true)) {
        const personData = typeof (resData.data) === 'object' && resData.data !== null ? { ...resData.data } : { ...resData };
        const pdfBase64 = resData.pdf_base64 || resData.slip || resData.pdf || resData.file || personData?.pdf_base64 || personData?.slip || personData?.pdf;
        if (pdfBase64) {
          personData.pdf_base64 = pdfBase64;
        }

        // Record successful transaction
        await supabase.from('transactions').insert({
          user_id: user.id,
          amount: fee,
          type: 'payment',
          status: 'success',
          reference: `id_verify_${searchType}_${Date.now()}`,
          description: `Verification: ${pricing?.name || priceId}`
        });

        return {
          isValid: true,
          message: resData.message || 'Verification Successful',
          data: personData
        };
      }

      // If failed, refund user balance
      if (fee > 0) {
        await supabase.rpc('refund_balance', { user_id: user.id, amount: fee }).catch(async () => {
          const { data: p } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
          if (p) {
            await supabase.from('profiles').update({ balance: Number(p.balance) + fee }).eq('id', user.id);
          }
        });
      }

      const errMsg = resData?.error || resData?.message || 'Verification failed. Record not found.';
      return { isValid: false, message: errMsg };
    } catch (err: any) {
      return { isValid: false, message: err.message || 'An error occurred during verification.' };
    }
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
