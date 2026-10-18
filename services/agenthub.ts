/**
 * DEPRECATED / CONDEMNED: AgentHub & IDPro Identity Services
 *
 * This file has been condemned and superseded by the official SKBTECH API service (`services/skbtech.ts`).
 * All calls are now automatically routed through SKBTECH (https://skbtech.com.ng/api/v1)
 * via the `verify-nin` Supabase Edge Function.
 *
 * All exports are retained as aliases to `SKBTechIdentityVerifier` to ensure backwards compatibility.
 */

import { SKBTechIdentityVerifier, NINSlipLayout, SKBStatusResponse } from './skbtech';

export type NINSlipServiceCode = '401' | '402' | '403';
export const NIN_SLIP_CODES: Record<NINSlipServiceCode, string> = {
  '401': 'Premium — Full color, high quality',
  '402': 'Standard — Standard information',
  '403': 'Regular — Basic NIMC layout',
};

export const AgentHubIdentityVerifier = SKBTechIdentityVerifier;
export const IdProIdentityVerifier = SKBTechIdentityVerifier;
export default SKBTechIdentityVerifier;
