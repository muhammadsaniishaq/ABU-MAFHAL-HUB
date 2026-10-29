import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action = 'update', userId, email, newPassword, sendEmailNotification = true, adminEmail } = body;

        if (!userId && !email) {
            return new Response(JSON.stringify({ success: false, error: "Missing userId or email" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Resolve User ID if only email provided
        let targetUserId = userId;
        let targetEmail = email;

        if (!targetUserId && targetEmail) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, email, full_name, account_password, temp_password')
                .eq('email', targetEmail)
                .maybeSingle();

            if (profile) {
                targetUserId = profile.id;
            }
        }

        if (!targetUserId) {
            return new Response(JSON.stringify({ success: false, error: "User account not found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 404,
            });
        }

        // --- ACTION 1: GET REAL ACTIVE PASSWORD ---
        if (action === 'get_password') {
            // Check profiles table
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('account_password, temp_password, plain_password')
                .eq('id', targetUserId)
                .maybeSingle();

            let foundPassword = profile?.account_password || profile?.temp_password || profile?.plain_password;

            // Check auth.users user_metadata
            if (!foundPassword) {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
                if (authUser?.user?.user_metadata) {
                    foundPassword = authUser.user.user_metadata.account_password || 
                                    authUser.user.user_metadata.temp_password || 
                                    authUser.user.user_metadata.plain_password;
                }
            }

            if (foundPassword) {
                return new Response(JSON.stringify({ 
                    success: true, 
                    password: foundPassword, 
                    synced: true 
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }

            return new Response(JSON.stringify({ 
                success: true, 
                password: null, 
                needsSync: true,
                message: "Password is encrypted in bcrypt hash. Use sync_live_password to generate and bind live password." 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // --- ACTION 2: SYNC LIVE PASSWORD FOR LEGACY ACCOUNT ---
        let passwordToSet = newPassword;
        if (action === 'sync_live_password' && (!passwordToSet || passwordToSet.length < 6)) {
            const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const lower = "abcdefghjkmnpqrstuvwxyz";
            const numbers = "23456789";
            let gen = "Abu#";
            for (let i = 0; i < 3; i++) gen += upper.charAt(Math.floor(Math.random() * upper.length));
            for (let i = 0; i < 3; i++) gen += numbers.charAt(Math.floor(Math.random() * numbers.length));
            for (let i = 0; i < 2; i++) gen += lower.charAt(Math.floor(Math.random() * lower.length));
            gen += "@!";
            passwordToSet = gen;
        }

        if (!passwordToSet || passwordToSet.length < 6) {
            return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 1. Update password in Supabase Auth via Admin API (and persist in user_metadata)
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { 
                password: passwordToSet,
                user_metadata: {
                    account_password: passwordToSet,
                    temp_password: passwordToSet
                }
            }
        );

        if (updateError) {
            throw updateError;
        }

        // Persist password record into profiles table for Super Admin reference
        try {
            await supabaseAdmin
                .from('profiles')
                .update({ 
                    account_password: passwordToSet, 
                    temp_password: passwordToSet 
                })
                .eq('id', targetUserId);
        } catch (dbErr) {
            console.warn("[admin-reset-password] Profile password persist notice:", dbErr);
        }

        // Get user profile for personalized email
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, email')
            .eq('id', targetUserId)
            .maybeSingle();

        const recipientEmail = targetEmail || userProfile?.email || updatedUser?.user?.email;
        const recipientName = userProfile?.full_name || 'Valued User';

        // 2. Dispatch Email if requested and recipient email exists
        let emailSent = false;
        if (sendEmailNotification && recipientEmail && action !== 'sync_live_password') {
            try {
                const emailSubject = "🔐 Security Alert: Your Abu Mafhal Password Has Been Updated";
                const emailText = `Hello ${recipientName},\n\nYour Abu Mafhal account password has been successfully updated by administration.\n\nYour New Password: ${passwordToSet}\n\nPlease log in to your account and change your password immediately inside your Profile Settings.\n\nBest regards,\nAbu Mafhal Team`;
                
                const customMessage = `
                    Your Abu Mafhal account login password has been updated by the system administrator.
                    <div style="background: rgba(234, 179, 8, 0.12); border: 1.5px dashed #EAB308; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
                        <div style="font-size: 11px; color: #CA8A04; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Temporary / New Password</div>
                        <div style="font-size: 24px; font-weight: 900; color: #0A192F; font-family: monospace; letter-spacing: 3px; margin-top: 8px;">
                            ${newPassword}
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #64748B; margin-top: 14px;">
                        🛡️ <strong>Security Tip:</strong> We recommend logging in and changing this password to your personal secret phrase immediately inside your Profile Settings.
                    </p>
                `;

                const emailHtml = renderAbuMafhalEmailTemplate({
                    recipientName: recipientName,
                    headlineBadge: 'Security Update',
                    headlineTitle: 'Account Password Changed',
                    headlineSubtitle: 'Your login credentials have been securely refreshed.',
                    greeting: `Hello ${recipientName} 👋`,
                    messageBody: customMessage,
                    buttonText: 'Login to ABU MAFHAL SUB &rarr;',
                    buttonUrl: 'https://abumafhal.com.ng'
                });

                await sendEmail(recipientEmail, emailSubject, emailText, emailHtml, supabaseAdmin);
                emailSent = true;
            } catch (mailErr) {
                console.warn("[admin-reset-password] Email sending failed:", mailErr);
            }
        }

        // 3. Log into admin_audit_logs if available
        try {
            await supabaseAdmin.from('admin_audit_logs').insert({
                admin_email: adminEmail || 'admin',
                action: 'PASSWORD_RESET',
                target_user_id: targetUserId,
                details: { targetEmail: recipientEmail, emailSent },
                created_at: new Date().toISOString()
            });
        } catch (_) {}

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Password updated successfully",
            emailSent,
            userId: targetUserId
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("[admin-reset-password] Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message || "Failed to update password" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
