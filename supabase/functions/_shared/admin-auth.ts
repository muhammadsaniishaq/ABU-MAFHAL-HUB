import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.44.1";

export interface AdminAuthResult {
    isAdmin: boolean;
    userId?: string;
    email?: string;
    role?: string;
    error?: string;
}

const SUPER_ADMIN_EMAILS = [
    'sale.abumafhal@gmail.com',
    'abumafhal@gmail.com',
    'admin@abumafhal.com',
    'muhammadsaniisyaku3@gmail.com',
];

export function isEmailAdmin(rawEmail: string): boolean {
    const email = (rawEmail || '').toLowerCase().trim();
    if (!email) return false;
    if (SUPER_ADMIN_EMAILS.includes(email)) return true;
    if (email.endsWith('@abumafhal.com') || email.endsWith('@abumafhal.com.ng')) return true;
    return false;
}

/**
 * Strictly verifies whether an incoming HTTP request is authorized as an Administrator
 * or internal system service role.
 */
export async function verifyAdminCaller(
    req: Request,
    supabaseAdmin: SupabaseClient
): Promise<AdminAuthResult> {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const internalHeader = req.headers.get('x-internal-service') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // 1. Allow internal service_role caller
    if (serviceKey) {
        if (internalHeader === serviceKey) {
            return { isAdmin: true, role: 'service_role' };
        }
        if (authHeader && (authHeader === `Bearer ${serviceKey}` || authHeader === serviceKey)) {
            return { isAdmin: true, role: 'service_role' };
        }
    }

    // 2. Extract Bearer token from user Authorization header
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
        return { isAdmin: false, error: 'Missing or empty Authorization token' };
    }

    try {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return { isAdmin: false, error: 'Invalid or expired authorization token' };
        }

        const userEmail = (user.email || '').toLowerCase().trim();

        // 3. Query user profile to verify database role and account status
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, role, email, status')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError || !profile) {
            return { isAdmin: false, error: 'User profile not found' };
        }

        // Account must not be banned or suspended
        const status = String(profile.status || 'active').toLowerCase();
        if (status === 'banned' || status === 'suspended' || status === 'frozen') {
            return { isAdmin: false, error: 'User account is suspended or banned' };
        }

        const role = String(profile.role || '').toLowerCase();
        const hasAdminRole = role === 'admin' || role === 'super_admin' || role === 'owner';
        const hasAdminEmail = isEmailAdmin(userEmail) || isEmailAdmin(profile.email || '');

        if (hasAdminRole || hasAdminEmail) {
            return {
                isAdmin: true,
                userId: user.id,
                email: userEmail,
                role: role || 'admin'
            };
        }

        return {
            isAdmin: false,
            error: 'Access denied: Administrator privileges required'
        };

    } catch (err: any) {
        return {
            isAdmin: false,
            error: err.message || 'Authentication verification failed'
        };
    }
}
