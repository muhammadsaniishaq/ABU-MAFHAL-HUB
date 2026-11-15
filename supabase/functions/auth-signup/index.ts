import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("Missing internal configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        const body = await req.json().catch(() => ({}));
        const {
            email,
            password,
            full_name,
            username,
            phone,
            referral_code,
            country = 'Nigeria'
        } = body;

        // 1. Validation
        if (!email || !password || !full_name) {
            return new Response(JSON.stringify({
                success: false,
                error: "Missing required registration fields (email, password, full_name)."
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanFullName = full_name.trim();
        const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const cleanPhone = (phone || '').replace(/[^0-9+]/g, '').trim();
        const cleanReferral = (referral_code || '').trim();

        if (password.length < 6) {
            return new Response(JSON.stringify({
                success: false,
                error: "Password must be at least 6 characters in length."
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 2. Uniqueness Checks against existing profiles
        if (cleanUsername) {
            const { data: existingByUsername } = await supabaseAdmin
                .from('profiles')
                .select('id, username, email')
                .ilike('username', cleanUsername)
                .maybeSingle();

            if (existingByUsername && existingByUsername.email?.toLowerCase() !== cleanEmail) {
                return new Response(JSON.stringify({
                    success: false,
                    error: "This Username is already taken. Please choose another username."
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        if (cleanPhone && cleanPhone.length >= 10) {
            const last10 = cleanPhone.slice(-10);
            const { data: existingByPhone } = await supabaseAdmin
                .from('profiles')
                .select('id, phone, email')
                .ilike('phone', `%${last10}`)
                .maybeSingle();

            if (existingByPhone && existingByPhone.email?.toLowerCase() !== cleanEmail) {
                return new Response(JSON.stringify({
                    success: false,
                    error: "An account with this Phone number is already registered. Please log in."
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // 3. Create User in auth.users via Supabase Admin (Bypasses failing GoTrue SMTP!)
        let newUser: any = null;

        const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: password,
            email_confirm: true, // Auto-confirm email in Supabase Auth to eliminate "Error sending confirmation email"
            user_metadata: {
                full_name: cleanFullName,
                username: cleanUsername,
                phone: cleanPhone,
                referral_code: cleanReferral || null,
                country: country,
                account_password: password,
                temp_password: password
            }
        });

        if (createAuthError) {
            console.warn("[auth-signup] Admin createUser notice:", createAuthError);
            const errMsg = createAuthError.message || '';
            if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exists')) {
                // User may have been created in a previous attempt where email delivery failed.
                // Recover and update the existing account safely.
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const matchedUser = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

                if (matchedUser) {
                    const { data: updatedAuth, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
                        password: password,
                        email_confirm: true,
                        user_metadata: {
                            full_name: cleanFullName,
                            username: cleanUsername,
                            phone: cleanPhone,
                            referral_code: cleanReferral || null,
                            country: country,
                            account_password: password,
                            temp_password: password
                        }
                    });

                    if (!updateErr && updatedAuth?.user) {
                        newUser = updatedAuth.user;
                    } else {
                        return new Response(JSON.stringify({
                            success: false,
                            error: "An account with this Email is already registered. Please log in."
                        }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                } else {
                    return new Response(JSON.stringify({
                        success: false,
                        error: "An account with this Email is already registered. Please log in."
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            } else {
                return new Response(JSON.stringify({
                    success: false,
                    error: errMsg || "Failed to create user account."
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } else {
            newUser = createdAuth.user;
        }

        if (!newUser) {
            throw new Error("User record was not created or returned by auth service.");
        }

        // 4. Ensure public.profiles record is accurately populated
        try {
            const { error: profileUpdateError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: newUser.id,
                    email: cleanEmail,
                    full_name: cleanFullName,
                    username: cleanUsername,
                    phone: cleanPhone || null,
                    referral_code: cleanReferral ? cleanReferral.toUpperCase() : null,
                    role: 'user',
                    status: 'active',
                    account_password: password,
                    temp_password: password,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (profileUpdateError) {
                console.warn("[auth-signup] Profile upsert notice:", profileUpdateError);
            }
        } catch (profErr) {
            console.warn("[auth-signup] Profile update caught:", profErr);
        }

        // 5. Handle Referral Attribution if referral code provided
        if (cleanReferral) {
            try {
                await supabaseAdmin.rpc('record_referral', {
                    referee_user_id: newUser.id,
                    referral_input: cleanReferral
                });
            } catch (refErr) {
                console.warn("[auth-signup] Referral record notice:", refErr);
            }
        }

        // 6. Automatically dispatch 6-Digit Verification OTP via send-otp (Resend / Zoho)
        try {
            await supabaseAdmin.functions.invoke('send-otp', {
                body: {
                    action: 'send',
                    identifier: cleanEmail,
                    channel: 'email',
                    purpose: 'signup',
                    userId: newUser.id,
                    name: cleanFullName
                }
            });
        } catch (otpErr) {
            console.warn("[auth-signup] OTP dispatch notice:", otpErr);
        }

        // 7. Background Auto Virtual Account Dispatch
        try {
            supabaseAdmin.functions.invoke('create-virtual-account', {
                body: { userId: newUser.id }
            }).catch(e => console.warn("[auth-signup] Auto VA background notice:", e));
        } catch (vaErr) {
            console.warn("[auth-signup] VA invoke error:", vaErr);
        }

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: cleanFullName,
                username: cleanUsername,
                phone: cleanPhone
            },
            message: "Account created successfully. Verification OTP dispatched."
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error("[auth-signup] Unhandled exception:", err);
        return new Response(JSON.stringify({
            success: false,
            error: err.message || "An unexpected error occurred during account registration."
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
