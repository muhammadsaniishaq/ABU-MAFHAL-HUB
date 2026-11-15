import { createClient } from "@supabase/supabase-js";
import { verifyAdminCaller } from "../_shared/admin-auth.ts";
import { sendEmail } from "../_shared/email.ts";
import { renderAbuMafhalEmailTemplate } from "../_shared/email-template.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 24 Hours in Milliseconds
const TIMELOCK_DURATION_MS = 24 * 60 * 60 * 1000;

let schemaInitialized = false;

async function ensureSchema(supabaseAdmin: any) {
    if (schemaInitialized) return;
    try {
        const { error } = await supabaseAdmin
            .from('admin_promotion_requests')
            .select('id')
            .limit(1);

        if (!error) {
            schemaInitialized = true;
            return;
        }

        console.log("[admin-promotion] Table not found or inaccessible. Attempting DDL init...");
        const dbUrl = Deno.env.get('SUPABASE_DB_URL');
        if (dbUrl) {
            const { default: postgres } = await import("npm:postgres@3.4.4");
            const sql = postgres(dbUrl, { ssl: 'require' });
            await sql.unsafe(`
                CREATE TABLE IF NOT EXISTS public.admin_promotion_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                    target_role TEXT NOT NULL CHECK (target_role IN ('admin', 'super_admin')),
                    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                    requested_by_email TEXT,
                    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
                    effective_after TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '24 hours'),
                    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
                    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                    approved_by_email TEXT,
                    approved_at TIMESTAMPTZ,
                    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                    cancelled_by_email TEXT,
                    cancelled_at TIMESTAMPTZ,
                    notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
                );

                CREATE INDEX IF NOT EXISTS idx_admin_promotion_target ON public.admin_promotion_requests(target_user_id);
                CREATE INDEX IF NOT EXISTS idx_admin_promotion_status ON public.admin_promotion_requests(status);
                CREATE INDEX IF NOT EXISTS idx_admin_promotion_effective_after ON public.admin_promotion_requests(effective_after);
            `);
            await sql.end();
            schemaInitialized = true;
            console.log("[admin-promotion] Schema created successfully via DDL.");
        }
    } catch (e) {
        console.warn("[admin-promotion] Schema ensure error:", e);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        await ensureSchema(supabaseAdmin);

        // 🛡️ CRITICAL SECURITY SHIELD: Verify Admin Caller
        const adminCheck = await verifyAdminCaller(req, supabaseAdmin);
        if (!adminCheck.isAdmin) {
            console.warn(`[admin-promotion] Unauthorized access attempt blocked: ${adminCheck.error}`);
            return new Response(JSON.stringify({ 
                success: false, 
                error: adminCheck.error || "Access denied: Administrator privileges required." 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403,
            });
        }

        const callerUser = adminCheck.user;
        const callerEmail = callerUser?.email || 'admin@abumafhal.com';

        const body = await req.json().catch(() => ({}));
        const { action = 'list', targetUserId, targetRole = 'admin', requestId, reason, notes } = body;

        // Ensure database table exists via DDL if requested or needed
        if (action === 'init_schema') {
            const dbUrl = Deno.env.get('SUPABASE_DB_URL');
            if (dbUrl) {
                try {
                    const { default: postgres } = await import("npm:postgres@3.4.4");
                    const sql = postgres(dbUrl, { ssl: 'require' });

                    await sql.unsafe(`
                        CREATE TABLE IF NOT EXISTS public.admin_promotion_requests (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
                            target_role TEXT NOT NULL CHECK (target_role IN ('admin', 'super_admin')),
                            requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                            requested_by_email TEXT,
                            requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
                            effective_after TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '24 hours'),
                            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
                            approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                            approved_by_email TEXT,
                            approved_at TIMESTAMPTZ,
                            cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                            cancelled_by_email TEXT,
                            cancelled_at TIMESTAMPTZ,
                            notes TEXT,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
                        );

                        CREATE INDEX IF NOT EXISTS idx_admin_promotion_target ON public.admin_promotion_requests(target_user_id);
                        CREATE INDEX IF NOT EXISTS idx_admin_promotion_status ON public.admin_promotion_requests(status);
                        CREATE INDEX IF NOT EXISTS idx_admin_promotion_effective_after ON public.admin_promotion_requests(effective_after);
                    `);

                    await sql.end();
                    return new Response(JSON.stringify({ success: true, message: "Schema initialized successfully" }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                } catch (sqlErr: any) {
                    console.error("[init_schema] SQL Error:", sqlErr);
                    return new Response(JSON.stringify({ success: false, error: sqlErr.message }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
            } else {
                return new Response(JSON.stringify({ success: true, message: "DB URL not configured, relying on pre-existing table" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // 1. ACTION: REQUEST PROMOTION (Starts 24-Hour Timelock Countdown)
        if (action === 'request_promotion') {
            if (!targetUserId) {
                return new Response(JSON.stringify({ success: false, error: "Target User ID is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (targetRole !== 'admin' && targetRole !== 'super_admin') {
                return new Response(JSON.stringify({ success: false, error: "Invalid role. Allowed: admin, super_admin" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Fetch target user profile
            const { data: targetProfile, error: userFetchErr } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, role, phone, status')
                .eq('id', targetUserId)
                .single();

            if (userFetchErr || !targetProfile) {
                return new Response(JSON.stringify({ success: false, error: "Target user not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (targetProfile.role === targetRole) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `User is already an ${targetRole.toUpperCase()}. No promotion required.` 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Check if there is already an active pending promotion request for this user
            const { data: existingPending } = await supabaseAdmin
                .from('admin_promotion_requests')
                .select('*')
                .eq('target_user_id', targetUserId)
                .eq('status', 'pending')
                .maybeSingle();

            if (existingPending) {
                const now = Date.now();
                const targetTime = new Date(existingPending.effective_after).getTime();
                const remainingMs = Math.max(0, targetTime - now);
                const hoursLeft = Math.floor(remainingMs / (1000 * 60 * 60));
                const minsLeft = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `A promotion request to ${existingPending.target_role.toUpperCase()} is already pending for this user. ⏳ ${hoursLeft}h ${minsLeft}m remaining in 24-hour timelock countdown.`,
                    existingRequest: existingPending
                }), {
                    status: 409,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Calculate Server Timestamps
            const requestedAt = new Date();
            const effectiveAfter = new Date(requestedAt.getTime() + TIMELOCK_DURATION_MS);

            // Insert Promotion Request
            const { data: createdReq, error: insertErr } = await supabaseAdmin
                .from('admin_promotion_requests')
                .insert({
                    target_user_id: targetUserId,
                    target_role: targetRole,
                    requested_by: callerUser?.id,
                    requested_by_email: callerEmail,
                    requested_at: requestedAt.toISOString(),
                    effective_after: effectiveAfter.toISOString(),
                    status: 'pending',
                    notes: notes || `Requested promotion by ${callerEmail}`
                })
                .select()
                .single();

            if (insertErr) {
                console.error("[admin-promotion] Insert Error:", insertErr);
                throw insertErr;
            }

            // Log in Audit Logs
            await supabaseAdmin.from('audit_logs').insert({
                admin_id: callerUser?.id,
                action: 'ADMIN_PROMOTION_TIMELOCK_INITIATED',
                target_resource: 'profiles',
                details: {
                    target_user_id: targetUserId,
                    target_email: targetProfile.email,
                    target_name: targetProfile.full_name,
                    target_role: targetRole,
                    requested_by: callerEmail,
                    requested_at: requestedAt.toISOString(),
                    effective_after: effectiveAfter.toISOString(),
                    timelock_hours: 24,
                    info: 'Privilege escalation locked for 24-hour countdown before approval'
                }
            }).catch(e => console.warn("[audit_logs] log insert error:", e));

            // Notify Super Admins via Email
            const emailHtml = renderAbuMafhalEmailTemplate({
                title: "🔒 24-Hour Admin Promotion Timelock Started",
                preheader: `Promotion request initiated for ${targetProfile.email}`,
                content: `
                    <p style="font-size: 15px; color: #334155;">A request has been initiated to promote a user to <strong>${targetRole.toUpperCase()}</strong>:</p>
                    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                        <p style="margin: 4px 0;"><strong>Candidate:</strong> ${targetProfile.full_name || 'N/A'} (${targetProfile.email})</p>
                        <p style="margin: 4px 0;"><strong>Requested Role:</strong> <span style="color: #D97706; font-weight: bold;">${targetRole.toUpperCase()}</span></p>
                        <p style="margin: 4px 0;"><strong>Initiated By:</strong> ${callerEmail}</p>
                        <p style="margin: 4px 0;"><strong>Timelock Duration:</strong> 24 Hours</p>
                        <p style="margin: 4px 0;"><strong>Earliest Approval Date:</strong> ${effectiveAfter.toUTCString()}</p>
                    </div>
                    <p style="font-size: 14px; color: #64748B;">
                        ⚠️ <strong>Security Notice:</strong> The user will NOT have admin privileges during this 24-hour period. If this request was not authorized, you can cancel or reject it immediately in the Admin Dashboard.
                    </p>
                `
            });

            await sendEmail({
                to: 'sale.abumafhal@gmail.com',
                subject: `🔒 Security Timelock: Admin Promotion Requested for ${targetProfile.email}`,
                html: emailHtml
            }).catch(e => console.warn("Email alert error:", e));

            return new Response(JSON.stringify({ 
                success: true, 
                message: `24-Hour Security Timelock countdown initiated for ${targetProfile.full_name || targetProfile.email}. Can be approved after 24 hours.`,
                request: createdReq
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2. ACTION: LIST PENDING / RECENT PROMOTIONS
        if (action === 'list') {
            const { data: requests, error: listErr } = await supabaseAdmin
                .from('admin_promotion_requests')
                .select(`
                    *,
                    target:target_user_id (id, full_name, email, phone, role, avatar_url, status),
                    requester:requested_by (id, full_name, email)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (listErr) {
                console.error("[admin-promotion] List error:", listErr);
                throw listErr;
            }

            const now = Date.now();
            const enrichedRequests = (requests || []).map((r: any) => {
                const targetTime = new Date(r.effective_after).getTime();
                const remainingMs = Math.max(0, targetTime - now);
                const isReady = r.status === 'pending' && remainingMs === 0;

                return {
                    ...r,
                    remaining_ms: remainingMs,
                    remaining_seconds: Math.floor(remainingMs / 1000),
                    is_ready_for_approval: isReady
                };
            });

            return new Response(JSON.stringify({ 
                success: true, 
                requests: enrichedRequests 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 3. ACTION: APPROVE PROMOTION (Allowed ONLY after 24 hours elapse)
        if (action === 'approve_promotion') {
            if (!requestId) {
                return new Response(JSON.stringify({ success: false, error: "Request ID is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Fetch request
            const { data: promoReq, error: reqFetchErr } = await supabaseAdmin
                .from('admin_promotion_requests')
                .select('*, target:target_user_id(id, full_name, email, role)')
                .eq('id', requestId)
                .single();

            if (reqFetchErr || !promoReq) {
                return new Response(JSON.stringify({ success: false, error: "Promotion request not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (promoReq.status !== 'pending') {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `Request cannot be approved because its current status is '${promoReq.status.toUpperCase()}'.` 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 🛡️ CRITICAL 24-HOUR TIMELOCK ENFORCEMENT
            const now = Date.now();
            const effectiveAfter = new Date(promoReq.effective_after).getTime();

            if (now < effectiveAfter) {
                const remainingMs = effectiveAfter - now;
                const hours = Math.floor(remainingMs / (1000 * 60 * 60));
                const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);

                return new Response(JSON.stringify({ 
                    success: false, 
                    error: `⏳ 24-Hour Timelock is still active! Cannot approve yet. Time remaining: ${hours}h ${mins}m ${secs}s.`,
                    remaining_ms: remainingMs
                }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 24 Hours have completed! Perform the promotion
            const approvedAt = new Date().toISOString();

            // 1. Update Profile Role
            const { error: profileUpdateErr } = await supabaseAdmin
                .from('profiles')
                .update({ 
                    role: promoReq.target_role,
                    updated_at: approvedAt
                })
                .eq('id', promoReq.target_user_id);

            if (profileUpdateErr) {
                console.error("[admin-promotion] Profile update error:", profileUpdateErr);
                throw profileUpdateErr;
            }

            // 2. Update Promotion Request status
            await supabaseAdmin
                .from('admin_promotion_requests')
                .update({
                    status: 'approved',
                    approved_by: callerUser?.id,
                    approved_by_email: callerEmail,
                    approved_at: approvedAt,
                    updated_at: approvedAt
                })
                .eq('id', requestId);

            // 3. Log into Audit Logs
            await supabaseAdmin.from('audit_logs').insert({
                admin_id: callerUser?.id,
                action: 'ADMIN_PROMOTION_APPROVED_AFTER_24H',
                target_resource: 'profiles',
                details: {
                    request_id: requestId,
                    target_user_id: promoReq.target_user_id,
                    target_email: promoReq.target?.email,
                    new_role: promoReq.target_role,
                    approved_by: callerEmail,
                    requested_by: promoReq.requested_by_email,
                    requested_at: promoReq.requested_at,
                    effective_after: promoReq.effective_after,
                    approved_at: approvedAt
                }
            }).catch(e => console.warn("[audit_logs] log insert error:", e));

            return new Response(JSON.stringify({ 
                success: true, 
                message: `🎉 Success! ${promoReq.target?.full_name || promoReq.target?.email} has been officially approved and promoted to ${promoReq.target_role.toUpperCase()} after fulfilling the 24-hour timelock.`
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 4. ACTION: CANCEL / REJECT PROMOTION (Can be done anytime)
        if (action === 'cancel_promotion') {
            if (!requestId) {
                return new Response(JSON.stringify({ success: false, error: "Request ID is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const cancelledAt = new Date().toISOString();

            const { data: updatedReq, error: cancelErr } = await supabaseAdmin
                .from('admin_promotion_requests')
                .update({
                    status: 'cancelled',
                    cancelled_by: callerUser?.id,
                    cancelled_by_email: callerEmail,
                    cancelled_at: cancelledAt,
                    notes: reason ? `Cancelled: ${reason}` : 'Cancelled by administrator',
                    updated_at: cancelledAt
                })
                .eq('id', requestId)
                .eq('status', 'pending')
                .select()
                .maybeSingle();

            if (cancelErr || !updatedReq) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    error: cancelErr?.message || "Could not cancel request. It may already be completed or cancelled." 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Log in Audit Logs
            await supabaseAdmin.from('audit_logs').insert({
                admin_id: callerUser?.id,
                action: 'ADMIN_PROMOTION_CANCELLED',
                target_resource: 'profiles',
                details: {
                    request_id: requestId,
                    target_user_id: updatedReq.target_user_id,
                    cancelled_by: callerEmail,
                    reason: reason || 'N/A'
                }
            }).catch(e => console.warn("[audit_logs] log insert error:", e));

            return new Response(JSON.stringify({ 
                success: true, 
                message: "Promotion request has been cancelled successfully." 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 5. ACTION: IMMEDIATE DEMOTE (Instant demotion for security emergencies)
        if (action === 'demote_user') {
            if (!targetUserId) {
                return new Response(JSON.stringify({ success: false, error: "Target User ID is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const updatedAt = new Date().toISOString();

            const { error: demoteErr } = await supabaseAdmin
                .from('profiles')
                .update({ role: 'user', updated_at: updatedAt })
                .eq('id', targetUserId);

            if (demoteErr) throw demoteErr;

            // Cancel any pending promotions for this user
            await supabaseAdmin
                .from('admin_promotion_requests')
                .update({ 
                    status: 'cancelled', 
                    notes: 'Auto-cancelled due to emergency demotion',
                    cancelled_by: callerUser?.id,
                    cancelled_by_email: callerEmail,
                    cancelled_at: updatedAt
                })
                .eq('target_user_id', targetUserId)
                .eq('status', 'pending');

            // Log in Audit Logs
            await supabaseAdmin.from('audit_logs').insert({
                admin_id: callerUser?.id,
                action: 'ADMIN_DEMOTED_TO_USER',
                target_resource: 'profiles',
                details: {
                    target_user_id: targetUserId,
                    demoted_by: callerEmail,
                    reason: reason || 'Demoted by administrator'
                }
            }).catch(e => console.warn("[audit_logs] log insert error:", e));

            return new Response(JSON.stringify({ 
                success: true, 
                message: "User privileges have been revoked immediately." 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[admin-promotion] Fatal Error:", err);
        return new Response(JSON.stringify({ 
            success: false, 
            error: err.message || "Internal Server Error" 
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
