import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "./email.ts";

export interface CryptoNotifyParams {
    supabaseAdmin: SupabaseClient;
    userId: string;
    type: 'crypto_deposit' | 'crypto_withdrawal' | 'crypto_buy' | 'crypto_sell' | 'crypto_swap' | 'crypto_transfer';
    title: string;
    body: string;
    amount: number | string;
    asset: string;
    reference?: string;
    fee?: number | string;
    recipientOrAddress?: string;
    extraData?: Record<string, any>;
}

export async function notifyCryptoUser(params: CryptoNotifyParams): Promise<void> {
    const { supabaseAdmin, userId, type, title, body, amount, asset, reference, fee, recipientOrAddress, extraData } = params;
    if (!userId) return;

    try {
        // 1. Fetch user profile + push tokens
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name, phone, email, expo_push_token, push_token')
            .eq('id', userId)
            .maybeSingle();

        // Also fetch email from auth.users if not found in profile
        let userEmail = profile?.email;
        if (!userEmail) {
            try {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (authUser?.user?.email) {
                    userEmail = authUser.user.email;
                }
            } catch (_) {}
        }

        const userName = profile?.full_name || 'Valued Trader';
        const pushToken = profile?.expo_push_token || profile?.push_token;

        // 2. In-App Notification (Always inserted for realtime and notifications tab)
        const notificationPayload = {
            user_id: userId,
            title,
            body,
            message: body,
            massage: body,
            type,
            priority: 'high',
            is_read: false,
            data: {
                amount,
                asset: asset.toUpperCase(),
                reference: reference || null,
                fee: fee || null,
                recipient: recipientOrAddress || null,
                timestamp: new Date().toISOString(),
                ...(extraData || {})
            }
        };

        const promises: Promise<any>[] = [
            supabaseAdmin.from('notifications').insert(notificationPayload)
        ];

        // 3. Expo Push Notification
        if (pushToken && (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken['))) {
            const pushPromise = fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: pushToken,
                    sound: 'default',
                    title: `✨ ${title}`,
                    body,
                    data: notificationPayload.data,
                    priority: 'high',
                    channelId: 'crypto-alerts'
                })
            }).then(r => r.json()).catch(err => {
                console.warn('[Crypto Notifier] Push notification send error:', err?.message || err);
            });
            promises.push(pushPromise);
        }

        // 4. Branded HTML Email
        if (userEmail && userEmail.includes('@')) {
            const formattedAsset = asset.toUpperCase();
            const dateStr = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });
            
            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
                    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                    .header { background: linear-gradient(135deg, #0B132B 0%, #1C2541 100%); padding: 28px 24px; text-align: center; }
                    .brand { color: #FFD700; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
                    .tagline { color: #94A3B8; font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
                    .content { padding: 28px 24px; }
                    .status-badge { display: inline-block; background: #ECFDF5; color: #059669; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; margin-bottom: 16px; border: 1px solid #A7F3D0; }
                    .amount-box { background: #F1F5F9; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; border: 1px dashed #CBD5E1; }
                    .amount-val { font-size: 28px; font-weight: 800; color: #0F172A; margin: 0; }
                    .table-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
                    .table-label { color: #64748B; }
                    .table-val { font-weight: 600; color: #0F172A; text-align: right; max-width: 250px; word-break: break-all; }
                    .footer { background: #F8FAFC; padding: 20px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1 class="brand">ABU MAFHAL HUB</h1>
                        <div class="tagline">Next-Gen Crypto Exchange</div>
                    </div>
                    <div class="content">
                        <div class="status-badge">✓ TRANSACTION CONFIRMED</div>
                        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0F172A;">Hello ${userName},</h2>
                        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">${body}</p>

                        <div class="amount-box">
                            <div class="amount-val">${amount} ${formattedAsset}</div>
                            <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Verified on Blockchain / Ledger</div>
                        </div>

                        <div style="margin-top: 16px;">
                            <div class="table-row">
                                <span class="table-label">Transaction Type</span>
                                <span class="table-val" style="text-transform: capitalize;">${type.replace('crypto_', '')}</span>
                            </div>
                            ${fee !== undefined && fee !== null ? `
                            <div class="table-row">
                                <span class="table-label">Network / Service Fee</span>
                                <span class="table-val">${fee}</span>
                            </div>` : ''}
                            ${recipientOrAddress ? `
                            <div class="table-row">
                                <span class="table-label">Destination</span>
                                <span class="table-val">${recipientOrAddress}</span>
                            </div>` : ''}
                            ${reference ? `
                            <div class="table-row">
                                <span class="table-label">Reference ID</span>
                                <span class="table-val">${reference}</span>
                            </div>` : ''}
                            <div class="table-row" style="border-bottom: none;">
                                <span class="table-label">Date & Time</span>
                                <span class="table-val">${dateStr}</span>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        Need assistance? Contact our 24/7 support at support@abumafhal.com<br>
                        Abu Mafhal Sub &bull; Secure Digital Assets &bull; All Rights Reserved
                    </div>
                </div>
            </body>
            </html>
            `;

            const emailPromise = sendEmail(
                userEmail,
                `[Abu Mafhal Hub] ${title}`,
                body,
                emailHtml,
                supabaseAdmin
            ).catch(err => {
                console.warn('[Crypto Notifier] Email send error:', err?.message || err);
            });
            promises.push(emailPromise);
        }

        await Promise.allSettled(promises);
        console.log(`[Crypto Notifier] Dispatched in-app, push, and email for user ${userId} (${type})`);

    } catch (e: any) {
        console.error('[Crypto Notifier Exception]:', e?.message || e);
    }
}
