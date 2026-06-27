import { supabase } from './supabase';
import { VerificationResult, DemographicParams, ModificationParams, BirthAttestationParams, BVNModificationParams, HistoryParams } from './partners';

export const IdProIdentityVerifier = {
    // Helper to invoke edge function
    async invokeEdge(searchType: string, searchValue: any, extra?: any): Promise<VerificationResult> {
        try {
            const body = { searchType, searchValue, ...extra };
            const { data, error } = await supabase.functions.invoke('verify-nin', { body });
            
            if (error) {
                return { isValid: false, message: error.message || 'Verification Error' };
            }
            if (data?.error) {
                return { isValid: false, message: data.error, data: data.details };
            }
            if (data?.data) {
                return { 
                    isValid: true, 
                    message: data.data.message || 'Verification Successful', 
                    data: data.data.data || data.data
                };
            }
            
            return { isValid: false, message: 'Unknown Response from Provider' };
        } catch (e: any) {
            return { isValid: false, message: e.message || 'Network Error' };
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
