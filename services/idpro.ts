import { supabase } from './supabase';
import { VerificationResult, DemographicParams, ModificationParams, BirthAttestationParams, BVNModificationParams, HistoryParams } from './partners';

export const IdProIdentityVerifier = {
    // Helper to invoke edge function
    async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
        try {
            const body = { searchType, searchValue, ...extra };
            const { data, error } = await supabase.functions.invoke('verify-nin', { body });

            // ── Handle Edge Function HTTP errors ─────────────────────────────
            // Supabase SDK throws a generic "non-2xx" message; the real reason
            // is in the response body (error.context is the raw Response object).
            if (error) {
                // Try to read the actual JSON body for a meaningful message
                let realMessage = error.message || 'Verification Error';
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const errBody = await error.context.json();
                        if (errBody?.error) {
                            realMessage = errBody.error;
                        } else if (errBody?.message) {
                            realMessage = errBody.message;
                        }
                    }
                } catch (_) { /* keep generic message if body can't be parsed */ }

                // Map common Edge Function errors to friendly messages
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

            // ── Handle explicit error payload from Edge Function ──────────────
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

            // ── Parse successful IDPro response ───────────────────────────────
            // Edge Function returns: { data: { status, message, data: { firstname, ... } } }
            const idproResponse = data.data;
            if (!idproResponse) {
                return { isValid: false, message: 'Invalid response from verification provider' };
            }

            const idproStatus = (idproResponse.status || '').toLowerCase();
            if (idproStatus === 'success' || idproStatus === 'pending') {
                const personData = idproResponse.data ?? idproResponse;
                return {
                    isValid: true,
                    message: idproResponse.message || 'Verification Successful',
                    data: personData,
                };
            }

            // Fallback: response has person fields at top level
            if (idproResponse.firstname || idproResponse.surname || idproResponse.nin) {
                return { isValid: true, message: 'Verification Successful', data: idproResponse };
            }

            return {
                isValid: false,
                message: idproResponse.message || 'Verification failed. The NIN may be invalid or not found.',
            };

        } catch (e: any) {
            return { isValid: false, message: e.message || 'A network error occurred. Check your connection.' };
        }
    },

    // ── VERIFICATIONS ────────────────────────────────────────────────────────

    validateNIN: async (nin: string) => IdProIdentityVerifier.invokeEdge('nin', nin),
    verifyNINWithPhone: async (phone: string) => IdProIdentityVerifier.invokeEdge('phone', phone),
    verifyPhone: async (phone: string) => IdProIdentityVerifier.invokeEdge('phone', phone),
    validateBVN: async (bvn: string) => IdProIdentityVerifier.invokeEdge('bvn', bvn),
    getBVNCard: async (bvn: string) => IdProIdentityVerifier.invokeEdge('bvn-card', bvn),
    
    verifyDemographic: async (params: DemographicParams) => 
        IdProIdentityVerifier.invokeEdge('demographic', '', {
            firstname: params.firstname,
            lastname: params.lastname,
            gender: params.gender,
            dob: params.dob
        }),

    // ── IPE CLEARANCE ────────────────────────────────────────────────────────
    runIPEClearance: async (number: string) => IdProIdentityVerifier.invokeEdge('ipe', number),

    // ── VALIDATION ───────────────────────────────────────────────────────────
    validateIdentity: async (number: string, type?: string) => IdProIdentityVerifier.invokeEdge('val', number, { idType: type }),

    // ── DELINK & RECOVERY ────────────────────────────────────────────────────
    delinkAndRetrieve: async (number: string, phone?: string) => IdProIdentityVerifier.invokeEdge('delink', number, { phone }),
    retrieveBVN: async (number: string) => IdProIdentityVerifier.invokeEdge('bvn-phone', number), // using bvn-phone for retrieval

    // ── USER DETAILS / MODIFICATIONS ─────────────────────────────────────────
    getPersonalization: async (number: string) => IdProIdentityVerifier.invokeEdge('tracking-id', number),
    
    // Remaining ones just throw not implemented for now, as idpro doesn't have exact counterparts yet in the docs provided
    requestModification: async (params: ModificationParams) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),
    requestDOBModification: async (number: string, dob: string) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),
    attestBirth: async (params: BirthAttestationParams) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),
    requestBVNModification: async (params: BVNModificationParams) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),

    // ── HISTORY ──────────────────────────────────────────────────────────────
    getTransactionHistory: async (params?: HistoryParams) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),
    getVerificationHistory: async (params?: HistoryParams) => ({ isValid: false, message: 'Not implemented in IdPro yet' }),
};
