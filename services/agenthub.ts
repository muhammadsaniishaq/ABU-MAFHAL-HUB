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
  // ── Core helper: invoke verification directly with fallback to Edge Function ─────────────────────
  async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      // 1. Prioritize Direct Client Execution with official AgentHub endpoints
      const directRes = await AgentHubIdentityVerifier.invokeDirect(searchType, searchValue, extra);
      if (directRes && (directRes.isValid || (directRes.data && (directRes.data.bvn || directRes.data.firstName || directRes.data.pdf_base64)))) {
        return directRes;
      }
      
      // If direct response indicated an intentional user error (like insufficient funds), return it immediately
      if (directRes && !directRes.isValid && directRes.message) {
        const m = directRes.message.toLowerCase();
        if (m.includes('insufficient') || m.includes('balance') || m.includes('please log in')) {
          return directRes;
        }
      }

      // If direct verification did not return success, try the Edge Function as fallback
      const body = { searchType, searchValue, ...extra };
      const { data, error } = await supabase.functions.invoke('verify-nin', { body });

      if (error) {
        return directRes || { isValid: false, message: error.message || 'Verification failed' };
      }

      if (data?.error) {
        return directRes || { isValid: false, message: data.error };
      }

      if (data?.data) {
        const agentHubResponse = data.data;
        const rawStatus = agentHubResponse.status;
        const isSuccessStatus = rawStatus === true || ['true', 'success', 'pending', 'completed'].includes(String(rawStatus || '').toLowerCase());

        if (isSuccessStatus) {
          const personData = agentHubResponse.data ?? agentHubResponse;
          return {
            isValid: true,
            message: agentHubResponse.message || 'Verification Successful',
            data: personData,
            pdf_base64: agentHubResponse.pdf_base64 || agentHubResponse.data?.pdf_base64
          };
        }
      }

      return directRes || { isValid: false, message: 'Could not verify details. Please check the input and try again.' };

    } catch (e: any) {
      return await AgentHubIdentityVerifier.invokeDirect(searchType, searchValue, extra);
    }
  },

  // ── Direct Execution Provider ─────────────────────────────────────────────
  async invokeDirect(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isValid: false, message: 'Please log in to continue.' };

      // 1. Get AgentHub API Key from all secret stores
      let apiKey = '';

      // A. Try system_secrets
      const { data: secretList } = await supabase
        .from('system_secrets')
        .select('*');
      if (secretList) {
        for (const s of secretList) {
          const k = String(s.key || '').toUpperCase();
          if (['AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'AGENTS_HUB_KEY', 'AH_API_KEY'].includes(k)) {
            const v = extractStringValue(s.value);
            if (v) { apiKey = v; break; }
          }
        }
      }

      // B. Try app_settings
      if (!apiKey) {
        const { data: settingsList } = await supabase
          .from('app_settings')
          .select('*');
        if (settingsList) {
          for (const s of settingsList) {
            const k = String(s.key || '').toUpperCase();
            if (['AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'AGENTS_HUB_KEY', 'AH_API_KEY'].includes(k)) {
              const v = extractStringValue(s.value);
              if (v) { apiKey = v; break; }
            }
          }
        }
      }

      // C. Try AsyncStorage (Local Vault Cache)
      if (!apiKey) {
        for (const k of ['AGENTHUB_API_KEY', 'AGENTHUB_KEY', 'AGENTS_HUB_KEY', 'AH_API_KEY']) {
          const cached = await AsyncStorage.getItem(`@vault_${k}`).catch(() => null);
          if (cached && cached.trim()) {
            apiKey = cached.trim();
            break;
          }
        }
      }

      // D. Try process.env
      if (!apiKey) {
        apiKey = (process.env.AGENTHUB_API_KEY || (process.env as any).EXPO_PUBLIC_AGENTHUB_API_KEY || '').trim();
      }

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

      const candidateList: { url: string; body?: any; method?: 'GET' | 'POST' }[] = [];

      if (searchType === 'nin') {
        if (slipType === 'REGULAR') {
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'REGULAR', reference: `REF-${Date.now()}` } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '403' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else if (slipType === 'STANDARD') {
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'STANDARD', reference: `REF-${Date.now()}` } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '402' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else if (slipType === 'PREMIUM') {
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'PREMIUM', reference: `REF-${Date.now()}` } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '401' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        } else {
          candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: 'REGULAR', reference: `REF-${Date.now()}` } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: '403' } });
          candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/nin', body: { nin: searchValue } });
        }
      } else if (searchType === 'nin-slip' || searchType === 'nin-slip-v2') {
        candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2', body: { nin: searchValue, slip_type: slipType, reference: `REF-${Date.now()}` } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/slip', body: { nin: searchValue, service_code: serviceCode } });
      } else if (searchType === 'phone') {
        candidateList.push({ url: 'https://agenthub.ng/api/identity/nin/slip-v2-phone', body: { nin: searchValue, slip_type: 'STANDARD', reference: `REF-${Date.now()}` } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/phone-verify', body: { phone: searchValue } });
      } else if (searchType === 'bvn') {
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/premium-slip', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/verification', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/verification', body: { bvn: searchValue, reference: extra?.reference || `REF-BVN-${Date.now()}` } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/verification', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/bvn', body: { bvn: searchValue } });
      } else if (searchType === 'bvn-premium-slip') {
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/premium-slip', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/premium-slip', body: { bvn: searchValue } });
      } else if (searchType === 'bvn-phone' || searchType === 'bvn-retrieval') {
        const ref = extra?.reference || `REF-RET-${Date.now()}`;
        const sCode = String(extra?.service_code || (extra?.ticket_id || extra?.agent_code ? '631' : '630'));
        const pNum = extra?.phone_number || extra?.phone || searchValue;
        const fName = extra?.full_name || extra?.name || 'Account Holder';

        if (sCode === '631') {
          candidateList.push({ 
            url: 'https://agenthub.ng/api/bvn/retrieval', 
            body: { 
              service_code: '631', 
              reference: ref, 
              agent_code: extra?.agent_code || extra?.agentCode, 
              ticket_id: extra?.ticket_id || extra?.ticketId, 
              bms_ticket: extra?.bms_ticket || extra?.bmsTicket || '', 
              screenshot: extra?.screenshot || extra?.screenshot_proof || extra?.image || '' 
            } 
          });
          candidateList.push({ 
            url: 'https://agenthub.ng/api/v1/bvn/retrieval', 
            body: { 
              service_code: '631', 
              reference: ref, 
              agent_code: extra?.agent_code || extra?.agentCode, 
              ticket_id: extra?.ticket_id || extra?.ticketId, 
              bms_ticket: extra?.bms_ticket || extra?.bmsTicket || '', 
              screenshot: extra?.screenshot || extra?.screenshot_proof || extra?.image || '' 
            } 
          });
        } else {
          candidateList.push({ 
            url: 'https://agenthub.ng/api/bvn/retrieval', 
            body: { service_code: '630', reference: ref, phone_number: pNum, full_name: fName } 
          });
          candidateList.push({ 
            url: 'https://agenthub.ng/api/v1/bvn/retrieval', 
            body: { service_code: '630', reference: ref, phone_number: pNum, full_name: fName } 
          });
        }
      } else if (searchType === 'bvn-retrieval-status') {
        const qId = encodeURIComponent(searchValue || extra?.request_id || extra?.reference || '');
        candidateList.push({ url: `https://agenthub.ng/api/bvn/retrieval/status?request_id=${qId}&reference=${qId}`, method: 'GET' });
        candidateList.push({ url: `https://agenthub.ng/api/v1/bvn/retrieval/status?request_id=${qId}`, method: 'GET' });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/retrieval/status', body: { request_id: searchValue, reference: searchValue } });
      } else if (searchType === 'bvn-card' || searchType === 'card' || searchType === 'bvn-slip') {
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/premium-slip', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/verification', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/premium-slip', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/slip', body: { bvn: searchValue } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/identity/bvn/slip', body: { bvn: searchValue } });
      } else if (searchType === 'vnin-to-nibss') {
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/vnin-to-nibss', body: { reference: extra?.reference || `REF-VNIN-${Date.now()}`, ticket_id: extra?.ticket_id || `TICKET-${Date.now()}`, full_name: extra?.full_name || 'BVN Holder', nin: extra?.nin || searchValue, bvn: extra?.bvn || searchValue, vnin: searchValue || extra?.vnin } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/vnin-to-nibss', body: { vnin: searchValue || extra?.vnin, bvn: extra?.bvn } });
      } else if (searchType === 'vnin-to-nibss-status') {
        const qRef = encodeURIComponent(searchValue || extra?.reference || '');
        candidateList.push({ url: `https://agenthub.ng/api/bvn/vnin-to-nibss/status?reference=${qRef}&request_id=${qRef}`, method: 'GET' });
        candidateList.push({ url: `https://agenthub.ng/api/v1/bvn/vnin-to-nibss/status?reference=${qRef}`, method: 'GET' });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/vnin-to-nibss/status', body: { reference: searchValue } });
      } else if (searchType === 'bvn-modification') {
        candidateList.push({ 
          url: 'https://agenthub.ng/api/bvn/modification', 
          body: { 
            service_code: extra?.service_code || '620', 
            bank_code: extra?.bank_code || '706', 
            reference: extra?.reference || `REF-MOD-${Date.now()}`, 
            nin: extra?.nin, 
            bvn: searchValue || extra?.bvn, 
            old_first_name: extra?.old_first_name || extra?.old_firstname,
            old_surname: extra?.old_surname || extra?.old_lastname,
            new_first_name: extra?.new_first_name || extra?.firstname, 
            new_surname: extra?.new_surname || extra?.lastname, 
            new_middle_name: extra?.new_middle_name || extra?.middlename,
            phone_number: extra?.phone_number || extra?.phone, 
            dob: extra?.dob || extra?.date_of_birth 
          } 
        });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/modification', body: { bvn: searchValue || extra?.bvn } });
      } else if (searchType === 'bvn-modification-status') {
        const qMod = encodeURIComponent(searchValue || extra?.request_id || extra?.reference || '');
        candidateList.push({ url: `https://agenthub.ng/api/bvn/modification/status?request_id=${qMod}&reference=${qMod}`, method: 'GET' });
        candidateList.push({ url: `https://agenthub.ng/api/v1/bvn/modification/status?request_id=${qMod}`, method: 'GET' });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/modification/status', body: { request_id: searchValue, reference: searchValue } });
      } else if (searchType === 'bvn-enrollment') {
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/enrollment', body: { ...extra, reference: extra?.reference || `REF-ENROLL-${Date.now()}` } });
        candidateList.push({ url: 'https://agenthub.ng/api/v1/bvn/enrollment', body: { ...extra } });
      } else if (searchType === 'bvn-enrollment-status') {
        const qEnr = encodeURIComponent(searchValue || extra?.request_id || extra?.reference || '');
        candidateList.push({ url: `https://agenthub.ng/api/bvn/enrollment/status?request_id=${qEnr}&reference=${qEnr}`, method: 'GET' });
        candidateList.push({ url: `https://agenthub.ng/api/v1/bvn/enrollment/status?request_id=${qEnr}`, method: 'GET' });
        candidateList.push({ url: 'https://agenthub.ng/api/bvn/enrollment/status', body: { request_id: searchValue, reference: searchValue } });
      } else {
        candidateList.push({ url: endpoint, body: payload });
      }

      // 5. Call AgentHub across candidates
      let resData: any = null;
      let successfulData: any = null;

      for (const item of candidateList as any[]) {
        try {
          const isGet = (item.method || '').toUpperCase() === 'GET';
          const fetchOptions: any = {
            method: item.method || 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
            },
          };
          if (!isGet && item.body) {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(item.body);
          }

          const res = await fetch(item.url, fetchOptions);

          const parsed = await res.json().catch(() => null);
          if (parsed) {
            resData = parsed;
            const isSuccess = parsed.status === true || 
                              parsed.status === 'success' || 
                              parsed.success === true ||
                              parsed.current_status === 'COMPLETED' ||
                              Boolean(parsed.data && (
                                parsed.data.bvn || 
                                parsed.data.firstName || 
                                parsed.data.firstname || 
                                parsed.data.nin || 
                                parsed.data.pdf_base64 || 
                                parsed.data.user_details || 
                                parsed.data.data
                              ));
            if (isSuccess) {
              successfulData = parsed;
              break;
            }
          }
        } catch (_) {}
      }

      if (successfulData) {
        resData = successfulData;
      }

      if (resData) {
        // Deeply unwrap personData across all AgentHub formats
        let personData: any = {};
        
        if (resData.data && typeof resData.data === 'object') {
          personData = { ...resData.data };
          if (resData.data.data && typeof resData.data.data === 'object') {
            personData = { ...personData, ...resData.data.data };
          }
          if (resData.data.user_details) {
            if (typeof resData.data.user_details === 'object') {
              personData = { ...personData, ...resData.data.user_details };
              if (resData.data.user_details.data && typeof resData.data.user_details.data === 'object') {
                personData = { ...personData, ...resData.data.user_details.data };
              }
            }
          }
        } else {
          personData = { ...resData };
        }

        const firstName = personData.firstName || personData.firstname || personData.first_name || '';
        const lastName = personData.lastName || personData.surname || personData.lastname || personData.last_name || '';
        const middleName = personData.middleName || personData.middlename || personData.middle_name || '';
        const bvn = personData.bvn || personData.number || searchValue || '';
        const phone = personData.phoneNumber || personData.phoneNumber1 || personData.phone || personData.phone_number || '';
        const dob = personData.dateOfBirth || personData.dob || personData.birthdate || '';
        const gender = personData.gender || '';
        const photo = personData.image || personData.base64Image || personData.photo || personData.face || '';
        const pdfBase64 = resData.pdf_base64 || resData.data?.pdf_base64 || personData.pdf_base64 || resData.slip || personData.slip;

        personData.firstName = firstName;
        personData.first_name = firstName;
        personData.lastName = lastName;
        personData.last_name = lastName;
        personData.surname = lastName;
        personData.middleName = middleName;
        personData.middle_name = middleName;
        personData.bvn = bvn;
        personData.phone = phone;
        personData.phoneNumber = phone;
        personData.phoneNumber1 = phone;
        personData.dateOfBirth = dob;
        personData.dob = dob;
        personData.gender = gender;
        if (photo) {
          personData.image = photo;
          personData.base64Image = photo;
          personData.photo = photo;
        }
        if (pdfBase64) {
          personData.pdf_base64 = pdfBase64;
        }

        const isSuccess = resData.status === true || 
                          resData.status === 'success' || 
                          resData.success === true || 
                          resData.current_status === 'COMPLETED' ||
                          Boolean(firstName || lastName || (bvn && bvn.length >= 10) || pdfBase64);

        if (isSuccess) {
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
      }

      // If failed, refund user balance
      if (fee > 0) {
        try {
          const { error: refundErr } = await supabase.rpc('refund_balance', { user_id: user.id, amount: fee });
          if (refundErr) {
            const { data: p } = await supabase.from('profiles').select('balance').eq('id', user.id).maybeSingle();
            if (p) {
              await supabase.from('profiles').update({ balance: Number(p.balance) + fee }).eq('id', user.id);
            }
          }
        } catch (_) {
          try {
            const { data: p } = await supabase.from('profiles').select('balance').eq('id', user.id).maybeSingle();
            if (p) {
              await supabase.from('profiles').update({ balance: Number(p.balance) + fee }).eq('id', user.id);
            }
          } catch (_) {}
        }
      }

      const errMsg = resData?.error || resData?.message || resData?.msg || 'Verification failed. Record not found.';
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
