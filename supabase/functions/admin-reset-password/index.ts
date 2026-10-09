import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../_shared/email.ts";

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
        const { userId, email, newPassword, sendEmailNotification = true, adminEmail } = body;

        if (!userId && !email) {
            return new Response(JSON.stringify({ success: false, error: "Missing userId or email" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        if (!newPassword || newPassword.length < 6) {
            return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), {
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
                .select('id, email, full_name')
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

        // 1. Update password in Supabase Auth via Admin API
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
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
        if (sendEmailNotification && recipientEmail) {
            try {
                const emailSubject = "🔐 Security Alert: Your Abu Mafhal Password Has Been Updated";
                const emailText = `Hello ${recipientName},\n\nYour Abu Mafhal account password has been successfully updated by administration.\n\nYour New Password: ${newPassword}\n\nPlease log in to your account and change your password immediately if you did not request this change.\n\nBest regards,\nAbu Mafhal Security Team`;
                
                const emailHtml = `
                <div style="font-family: Arial, sans-serif; background-color: #070D1F; color: #FFFFFF; padding: 28px; border-radius: 16px; border: 1.5px solid #D4AF37; max-width: 580px; margin: 0 auto;">
                    <div style="text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.3); padding-bottom: 16px; margin-bottom: 20px;">
                        <h2 style="color: #D4AF37; margin: 0; font-size: 20px; letter-spacing: 0.5px;">👑 ABU MAFHAL EXECUTIVE SECURITY</h2>
                        <p style="color: #94A3B8; font-size: 11px; margin-top: 4px; text-transform: uppercase;">Credential Authority Notification</p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.6; color: #E2E8F0;">
                        Hello <strong style="color: #FFFFFF;">${recipientName}</strong>,
                    </p>

                    <p style="font-size: 13.5px; line-height: 1.6; color: #CBD5E1;">
                        Your Abu Mafhal account login credentials have been updated by the system administrator.
                    </p>

                    <div style="background: rgba(212, 175, 55, 0.1); border: 1px solid #D4AF37; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
                        <div style="font-size: 11px; color: #D4AF37; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Temporary / New Password</div>
                        <div style="font-size: 22px; font-weight: 900; color: #FFFFFF; font-family: monospace; letter-spacing: 2px; margin-top: 8px;">
                            ${newPassword}
                        </div>
                    </div>

                    <p style="font-size: 12.5px; color: #94A3B8; line-height: 1.6;">
                        🛡️ <strong>Security Recommendation:</strong> We advise logging in and changing this password to your personal secret phrase immediately inside your Profile Settings.
                    </p>

                    <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 24px; padding-top: 14px; text-align: center;">
                        <p style="font-size: 11px; color: #64748B; margin: 0;">Abu Mafhal Hub • Executive User Governance Console</p>
                    </div>
                </div>
                `;

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
