import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.1';

// We must use the Service Role key to read from system_secrets (bypassing RLS)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Fetch a single secret from the system_secrets table securely.
 */
export async function getSystemSecret(key: string, fallbackEnvName?: string): Promise<string> {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_secrets')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            console.error(`[Secrets] Failed to fetch secret '${key}' from DB:`, error.message);
        } else if (data && data.value) {
            return data.value;
        }
    } catch (err) {
        console.error(`[Secrets] Exception fetching secret '${key}':`, err);
    }
    
    // Fallback to Deno environment variables if provided
    if (fallbackEnvName) {
        return Deno.env.get(fallbackEnvName) || '';
    }
    return '';
}

/**
 * Fetch multiple secrets at once.
 */
export async function getSystemSecrets(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    try {
        const { data, error } = await supabaseAdmin
            .from('system_secrets')
            .select('key, value')
            .in('key', keys);

        if (error) {
            console.error(`[Secrets] Failed to fetch multiple secrets from DB:`, error.message);
        } else if (data) {
            for (const row of data) {
                result[row.key] = row.value;
            }
        }
    } catch (err) {
        console.error(`[Secrets] Exception fetching multiple secrets:`, err);
    }
    return result;
}
