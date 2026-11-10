import { createClient } from "@supabase/supabase-js";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.muhammmadsaniishaq.abumafhalsub";
const DEFAULT_WEB_URL = "https://abumafhal.com.ng";

// Helper: Format Nigerian phone number into canonical display format (080...)
function formatToLocalPhone(rawPhone: string): string {
    let p = (rawPhone || '').replace(/\D/g, '');
    if (p.startsWith('234') && p.length === 13) {
        return '0' + p.slice(3);
    }
    if (p.length === 10 && !p.startsWith('0')) {
        return '0' + p;
    }
    return p;
}

// Helper: Sanitize plan name to remove any vendor tags ([BILAL], [BIGI], [CK], etc.)
function cleanPlanName(rawName: string): string {
    if (!rawName) return '';
    return rawName
        .replace(/\[\s*(bilal|bilalsadasub|bigi|bigisub|ck|clubkonnect|shago|vtpass|baxi|ketawancy|simhost)[^\]]*\]/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\b(bilal\s*sada|bilalsadasub|bigisub|clubkonnect|shago|vtpass|ketawancy)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper: Send message back to user via WhatsApp Meta Cloud API
async function sendWhatsAppMessage(
    toPhone: string,
    messageText: string,
    phoneNumberId: string,
    accessToken: string
): Promise<boolean> {
    try {
        if (!phoneNumberId || !accessToken) {
            console.error("[WhatsApp Bot] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN");
            return false;
        }

        const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: toPhone,
                type: 'text',
                text: {
                    body: messageText
                }
            })
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            console.error("[WhatsApp Bot] Send error:", res.status, JSON.stringify(data));
            return false;
        }

        console.log(`[WhatsApp Bot] Message sent successfully to ${toPhone}`);
        return true;
    } catch (err) {
        console.error("[WhatsApp Bot] Exception in sendWhatsAppMessage:", err);
        return false;
    }
}

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch secrets and app_settings
    const secrets = await getSystemSecrets([
        'WHATSAPP_PHONE_NUMBER_ID',
        'WHATSAPP_ACCESS_TOKEN',
        'WHATSAPP_VERIFY_TOKEN',
        'WHATSAPP_ADMIN_CALL_PHONE',
        'WHATSAPP_BOT_NUMBER'
    ]);

    const { data: appSettingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', [
            'support_whatsapp', 
            'whatsapp_admin_call_phone', 
            'support_phone', 
            'whatsapp_bot_enabled', 
            'maintenance_mode',
            'play_store_url', 
            'company_name',
            'site_url',
            'app_url',
            'website_url',
            'referral_url'
        ]);

    const settingsMap: Record<string, string> = {};
    if (appSettingsData) {
        appSettingsData.forEach(s => { settingsMap[s.key] = s.value; });
    }

    // Dynamic resolution of official URLs
    const playStoreLink = (settingsMap['play_store_url'] || DEFAULT_PLAY_STORE_URL).trim();
    let webBaseUrl = (settingsMap['site_url'] || settingsMap['app_url'] || settingsMap['website_url'] || DEFAULT_WEB_URL).trim();
    if (webBaseUrl.endsWith('/')) {
        webBaseUrl = webBaseUrl.slice(0, -1);
    }
    if (webBaseUrl.includes('abumafhalsub.com')) {
        webBaseUrl = DEFAULT_WEB_URL;
    }
    if (!webBaseUrl.startsWith('http')) {
        webBaseUrl = 'https://' + webBaseUrl;
    }

    const verifyToken = secrets['WHATSAPP_VERIFY_TOKEN'] || Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'abumafhal_wa_verify_2026';
    const phoneNumberId = secrets['WHATSAPP_PHONE_NUMBER_ID'] || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
    const accessToken = secrets['WHATSAPP_ACCESS_TOKEN'] || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
    let adminCallPhone = (secrets['WHATSAPP_ADMIN_CALL_PHONE'] || settingsMap['whatsapp_admin_call_phone'] || settingsMap['support_whatsapp'] || '2348145853539').replace(/\D/g, '');
    if (adminCallPhone.startsWith('0') && adminCallPhone.length === 11) {
        adminCallPhone = '234' + adminCallPhone.slice(1);
    } else if (adminCallPhone.length === 10) {
        adminCallPhone = '234' + adminCallPhone;
    }

    const isSystemMaintenance = settingsMap['maintenance_mode'] === 'true';
    const isBotEnabled = settingsMap['whatsapp_bot_enabled'] !== 'false';

    // ==========================================
    // 1. GET: Webhook Verification & Diagnostics
    // ==========================================
    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        console.log(`[WhatsApp Bot] Webhook Verification: mode=${mode}, token=${token}`);

        if (mode === 'subscribe' && token === verifyToken) {
            console.log("[WhatsApp Bot] Webhook Verified Successfully!");
            return new Response(challenge || 'ok', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Diagnostic mode
        if (!mode && !token) {
            let metaCheck: any = null;
            let testSendResult: any = null;
            let recentLogs: any = null;

            if (url.searchParams.get('diag') === '1') {
                if (phoneNumberId && accessToken) {
                    try {
                        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` }
                        });
                        metaCheck = {
                            status: metaRes.status,
                            ok: metaRes.ok,
                            body: await metaRes.json().catch(() => null)
                        };
                    } catch (e: any) {
                        metaCheck = { error: e.message };
                    }
                }

                const { data: logs } = await supabaseAdmin
                    .from('whatsapp_bot_logs')
                    .select('id, phone_number, direction, message_type, content, created_at')
                    .order('created_at', { ascending: false })
                    .limit(10);
                recentLogs = logs;

                if (url.searchParams.get('sync_bot_number') === '1') {
                    const updates = [
                        { key: 'whatsapp_bot_number', value: '09065645747' },
                        { key: 'WHATSAPP_BOT_NUMBER', value: '09065645747' },
                        { key: 'support_whatsapp', value: '09065645747' },
                        { key: 'whatsapp_number', value: '09065645747' },
                        { key: 'whatsapp_admin_call_phone', value: '08145853539' },
                        { key: 'WHATSAPP_ADMIN_CALL_PHONE', value: '08145853539' }
                    ];
                    await supabaseAdmin.from('app_settings').upsert(updates, { onConflict: 'key' });
                    await supabaseAdmin.from('system_secrets').upsert([
                        { key: 'WHATSAPP_BOT_NUMBER', value: '09065645747' },
                        { key: 'WHATSAPP_ADMIN_CALL_PHONE', value: '08145853539' }
                    ], { onConflict: 'key' });
                }

                const { data: allWaSettings } = await supabaseAdmin
                    .from('app_settings')
                    .select('key, value')
                    .or('key.ilike.%whatsapp%,key.ilike.%support%');
                metaCheck = { ...metaCheck, current_db_settings: allWaSettings, system_secrets: secrets };

                const testTo = url.searchParams.get('test_to');
                if (testTo && phoneNumberId && accessToken) {
                    try {
                        const sendRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: testTo,
                                type: 'text',
                                text: { body: "Test message from Abu Mafhal Sub diagnostic check." }
                            })
                        });
                        testSendResult = {
                            status: sendRes.status,
                            ok: sendRes.ok,
                            body: await sendRes.json().catch(() => null)
                        };
                    } catch (err: any) {
                        testSendResult = { error: err.message };
                    }
                }
            }

            return new Response(JSON.stringify({
                status: "active",
                service: "Abu Mafhal Sub WhatsApp Bot",
                default_language: "en",
                domain: webBaseUrl,
                play_store_url: playStoreLink,
                maintenance_mode: isSystemMaintenance,
                bot_enabled: isBotEnabled,
                has_phone_id: Boolean(phoneNumberId),
                has_access_token: Boolean(accessToken),
                phone_id_preview: phoneNumberId ? `${phoneNumberId.slice(0, 4)}...${phoneNumberId.slice(-4)}` : null,
                token_preview: accessToken ? `${accessToken.slice(0, 7)}...${accessToken.slice(-6)}` : null,
                admin_call_phone: adminCallPhone,
                meta_check: metaCheck,
                recent_logs: recentLogs,
                test_send_result: testSendResult,
                timestamp: new Date().toISOString()
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        return new Response('Verification token mismatch', { status: 403 });
    }

    // ==========================================
    // 2. POST: Handle Incoming WhatsApp Messages
    // ==========================================
    if (req.method === 'POST') {
        try {
            const body = await req.json();

            // Ignore delivery status updates or read receipts
            const entry = body?.entry?.[0];
            const change = entry?.changes?.[0]?.value;
            const message = change?.messages?.[0];

            if (!message) {
                return new Response(JSON.stringify({ status: "ignored_non_message" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            const senderPhone = (message.from || '').toString().trim(); // E.164, e.g. 2348012345678
            const contactName = change?.contacts?.[0]?.profile?.name || 'Customer';
            const rawText = (message.text?.body || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '').toString().trim();
            const text = rawText.trim();
            const lowerText = text.toLowerCase();

            console.log(`[WhatsApp Bot] Incoming from ${senderPhone} (${contactName}): "${text}"`);

            // Background log
            supabaseAdmin.from('whatsapp_bot_logs').insert({
                phone_number: senderPhone,
                direction: 'incoming',
                message_type: message.type || 'text',
                content: text,
                raw_payload: body
            }).then(() => {}).catch(() => {});

            // Fetch or create session
            let { data: session } = await supabaseAdmin
                .from('whatsapp_bot_sessions')
                .select('*')
                .eq('phone_number', senderPhone)
                .maybeSingle();

            if (!session) {
                const { data: newSession } = await supabaseAdmin
                    .from('whatsapp_bot_sessions')
                    .insert({
                        phone_number: senderPhone,
                        step: 'IDLE',
                        session_data: { lang: 'en' }
                    })
                    .select()
                    .single();
                session = newSession;
            }

            let userId = session?.user_id;
            let currentStep = session?.step || 'IDLE';
            let sessionData = session?.session_data || {};

            // 1. Language Resolution (Default is strictly English)
            let userLang: 'en' | 'ha' = (sessionData.lang === 'ha' ? 'ha' : 'en');

            // Direct language commands anytime
            if (lowerText === 'english' || lowerText === 'turanci') {
                userLang = 'en';
                sessionData = { ...sessionData, lang: 'en' };
                await supabaseAdmin
                    .from('whatsapp_bot_sessions')
                    .update({ session_data: sessionData })
                    .eq('phone_number', senderPhone);
            } else if (lowerText === 'hausa') {
                userLang = 'ha';
                sessionData = { ...sessionData, lang: 'ha' };
                await supabaseAdmin
                    .from('whatsapp_bot_sessions')
                    .update({ session_data: sessionData })
                    .eq('phone_number', senderPhone);
            }

            // Helper to reply and update state
            const reply = async (msg: string, nextStep: string = 'IDLE', nextData: any = sessionData): Promise<Response> => {
                await sendWhatsAppMessage(senderPhone, msg, phoneNumberId, accessToken);
                try {
                    await supabaseAdmin
                        .from('whatsapp_bot_sessions')
                        .update({
                            step: nextStep,
                            session_data: nextData,
                            last_interaction: new Date().toISOString()
                        })
                        .eq('phone_number', senderPhone);

                    await supabaseAdmin.from('whatsapp_bot_logs').insert({
                        phone_number: senderPhone,
                        direction: 'outgoing',
                        message_type: 'text',
                        content: msg
                    });
                } catch (logErr) {
                    console.error("[WhatsApp Bot] Session/log update error:", logErr);
                }

                return new Response(JSON.stringify({ status: "success", step: nextStep }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            };

            // -------------------------------------------------------------
            // 2. GLOBAL MAINTENANCE / BOT DISABLED CHECK
            // -------------------------------------------------------------
            if (isSystemMaintenance) {
                const maintMsg = userLang === 'ha'
                    ? `🚧 *Sanarwar Kulawa da Tsari (Maintenance)* 🚧\n\nBarka! A halin yanzu ana kan aikin inganta tsarin *Abu Mafhal Sub* don yi muku hidima mafi inganci.\n\nDukkan sabis an dakatar da su na ɗan lokaci kaɗan. Za mu dawo nan ba da jimawa ba. Mun gode da haƙuri da fahimta!\n\n📞 *Tuntuɓi Admin Don Gaggawa:*\n📱 Kira: +${adminCallPhone}\n💬 WhatsApp: https://wa.me/${adminCallPhone}\n🌐 Shafin Gizo: ${webBaseUrl}`
                    : `🚧 *Scheduled System Maintenance* 🚧\n\nDear customer, *Abu Mafhal Sub* is currently undergoing scheduled maintenance & system upgrade to serve you better.\n\nTransactions are temporarily paused and will resume shortly. We apologize for any inconvenience!\n\n📞 *Urgent Inquiries:*\n📱 Direct Call: +${adminCallPhone}\n💬 WhatsApp: https://wa.me/${adminCallPhone}\n🌐 Web Portal: ${webBaseUrl}`;
                return reply(maintMsg, 'IDLE', sessionData);
            }

            if (!isBotEnabled) {
                const offMsg = userLang === 'ha'
                    ? `⚠️ A halin yanzu an dakatar da WhatsApp Bot na ɗan lokaci don yin gyare-gyare.\n\nDa fatan a sauke manhajar mu a Play Store ko kiran Admin:\n📱 Play Store: ${playStoreLink}\n📞 Kira: +${adminCallPhone}`
                    : `⚠️ The WhatsApp bot is currently offline for scheduled updates.\n\nPlease use our official mobile app or contact Admin directly:\n📱 Play Store: ${playStoreLink}\n📞 Call: +${adminCallPhone}`;
                return reply(offMsg, 'IDLE', sessionData);
            }

            // 3. Try resolving user profile if not already linked
            if (!userId) {
                const cleanDigits = senderPhone.replace(/\D/g, '');
                const last10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

                try {
                    const { data: matchedProfiles } = await supabaseAdmin
                        .from('profiles')
                        .select('id, full_name, email, balance, transaction_pin, phone')
                        .or(`phone.eq.${senderPhone},phone.eq.0${last10},phone.eq.+234${last10},phone.eq.234${last10},phone.eq.${last10}`)
                        .limit(1);

                    if (matchedProfiles && matchedProfiles.length > 0) {
                        userId = matchedProfiles[0].id;
                        await supabaseAdmin
                            .from('whatsapp_bot_sessions')
                            .update({ user_id: userId })
                            .eq('phone_number', senderPhone);
                    }
                } catch (e) {
                    console.error("[WhatsApp Bot] Profile resolution error:", e);
                }
            }

            // 4. Load Hidden Features & Feature Flags from DB
            const { data: hiddenRow } = await supabaseAdmin
                .from('app_settings')
                .select('value')
                .eq('key', 'hidden_features')
                .maybeSingle();

            let hiddenList: string[] = [];
            if (hiddenRow?.value) {
                try {
                    const parsed = typeof hiddenRow.value === 'string' ? JSON.parse(hiddenRow.value) : hiddenRow.value;
                    if (Array.isArray(parsed)) hiddenList = parsed.map(x => String(x).toLowerCase().trim());
                } catch (_) {}
            }

            const { data: flags } = await supabaseAdmin
                .from('feature_flags')
                .select('feature_key, is_enabled');

            if (flags) {
                flags.forEach(f => {
                    const rawKey = String(f.feature_key || '').toLowerCase().trim();
                    const cleanKey = rawKey.replace(/^feature_/, '');
                    if (f.is_enabled === false) {
                        if (!hiddenList.includes(rawKey)) hiddenList.push(rawKey);
                        if (!hiddenList.includes(cleanKey)) hiddenList.push(cleanKey);
                    }
                });
            }

            // Strict Function to check if a feature is enabled
            const isEnabled = (key: string): boolean => {
                const k = key.toLowerCase().trim();
                const fk = 'feature_' + k;
                if (hiddenList.includes(k) || hiddenList.includes(fk)) return false;
                // If parent bills category is hidden, hide electricity and cable
                if ((k === 'cable' || k === 'electricity') && (hiddenList.includes('bills') || hiddenList.includes('feature_bills'))) return false;
                // If sim or telecom_hub is hidden
                if (k === 'sim' && (hiddenList.includes('sim') || hiddenList.includes('telecom_hub') || hiddenList.includes('feature_sim') || hiddenList.includes('feature_telecom_sim'))) return false;
                return true;
            };

            // Quick reset / Main Menu command
            if (lowerText === '0' || lowerText === 'menu' || lowerText === 'start' || lowerText === 'reset' || lowerText === 'hi' || lowerText === 'hello' || lowerText === 'sannu' || lowerText === 'barka') {
                currentStep = 'IDLE';
                sessionData = { lang: userLang };
            }

            // Language switcher selection
            if (lowerText === 'lang' || lowerText === 'language' || lowerText === 'yare') {
                const langPrompt = `🌐 *Select Language / Zaɓi Yare:*\n\n1️⃣ English (Default)\n2️⃣ Hausa\n\n_(Reply with 1 or 2, or type '0' for menu)_`;
                return reply(langPrompt, 'SELECT_LANGUAGE', { ...sessionData });
            }

            if (currentStep === 'SELECT_LANGUAGE') {
                if (text === '1' || lowerText === 'english') {
                    userLang = 'en';
                    sessionData = { lang: 'en' };
                    return reply(`✅ Language set to *English*.\n\nType *0* or *menu* to explore services.`, 'IDLE', sessionData);
                } else if (text === '2' || lowerText === 'hausa') {
                    userLang = 'ha';
                    sessionData = { lang: 'ha' };
                    return reply(`✅ An sauya yare zuwa *Hausa*.\n\nTura *0* ko *menu* don ganin dukkan hidimomi.`, 'IDLE', sessionData);
                } else {
                    return reply(`❌ Invalid choice. Reply with 1 for English or 2 for Hausa (or '0' for menu):`, 'SELECT_LANGUAGE', sessionData);
                }
            }

            // Direct Call / Support Escalation keyword trigger
            if (lowerText === 'call' || lowerText === 'kira' || lowerText === 'admin' || lowerText === 'agent' || lowerText === 'help' || lowerText === 'magana') {
                if (userId) {
                    try {
                        const { data: ticket } = await supabaseAdmin
                            .from('tickets')
                            .insert({
                                user_id: userId,
                                subject: `WhatsApp Bot Escalation: ${senderPhone}`,
                                status: 'open',
                                priority: 'high'
                            })
                            .select()
                            .single();

                        if (ticket) {
                            await supabaseAdmin.from('ticket_messages').insert({
                                ticket_id: ticket.id,
                                sender_id: userId,
                                message: `Customer requested Admin support via WhatsApp Bot from phone ${senderPhone}.`
                            });
                        }
                    } catch (_) {}
                }

                const escalationMsg = userLang === 'ha'
                    ? `📞 *Abu Mafhal Sub Taimako & Kira:*\n\nMun sanar da Admin a take! Zaka iya kiran Admin kai tsaye ko yin magana da shi:\n\n📱 *Kira Kai Tsaye (Direct Phone Call):*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Assalamu%20Alaikum%20Admin,%20ina%20neman%20taimako%20(Lambar%20Waya:%20${senderPhone})\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}\n\n(Tura '0' don babban menu)`
                    : `📞 *Abu Mafhal Sub Support & Direct Call:*\n\nAdmin has been notified! You can reach Admin directly:\n\n📱 *Direct Phone Call:*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Hello%20Admin,%20I%20need%20support%20(Phone:%20${senderPhone})\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}\n\n(Type '0' for main menu)`;
                return reply(escalationMsg, 'IDLE');
            }

            // Master Feature Catalog
            interface CatalogItem {
                key: string;
                icon: string;
                titleEn: string;
                titleHa: string;
            }

            const masterCatalog: CatalogItem[] = [
                { key: 'data',          icon: '📶', titleEn: 'Buy Data (MTN, Airtel, Glo, 9mobile, Smile)', titleHa: 'Siyan Data (MTN, Airtel, Glo, 9mobile, Smile)' },
                { key: 'airtime',       icon: '📲', titleEn: 'Buy Airtime (VTU Recharge)',                  titleHa: 'Siyan Airtime (Katin Kira)' },
                { key: 'wallet',        icon: '🏦', titleEn: 'Fund Wallet / Virtual Account (DVA)',         titleHa: 'Zuba Kuɗi a Asusu (DVA)' },
                { key: 'cable',         icon: '📺', titleEn: 'Cable TV (DSTV, GOtv, Startimes)',            titleHa: 'Katin Cable TV (DSTV, GOTV, Startimes)' },
                { key: 'electricity',   icon: '⚡', titleEn: 'Electricity Bill (PHCN Token)',               titleHa: 'Wutar Lantarki (PHCN Electricity)' },
                { key: 'education',     icon: '🎓', titleEn: 'Exam Result PINs (WAEC, NECO, NABTEB)',       titleHa: 'Exam Scratch Cards (WAEC, NECO, NABTEB)' },
                { key: 'airtime_cash',  icon: '💵', titleEn: 'Airtime to Cash (Convert Airtime)',           titleHa: 'Canza Airtime zuwa Kuɗi' },
                { key: 'recharge_pin',  icon: '🖨️', titleEn: 'Recharge Card PIN / Printing',                titleHa: 'Buga Katin Recharge (Recharge PIN)' },
                { key: 'bulk_sms',      icon: '💬', titleEn: 'Bulk SMS (Custom Sender ID)',                 titleHa: 'Bulk SMS (Tura Saƙonni)' },
                { key: 'nin',           icon: '🪪', titleEn: 'NIN Verification & Slip Printing',            titleHa: 'Binciken NIN & Buga Slip' },
                { key: 'bvn',           icon: '🔍', titleEn: 'BVN Verification Services',                   titleHa: 'Binciken BVN' },
                { key: 'cac',           icon: '🏢', titleEn: 'CAC Business Registration',                   titleHa: 'Rijistar Kamfani (CAC)' },
                { key: 'sim',           icon: '💳', titleEn: 'Buy SIM Cards (Kirani 4G SIM)',               titleHa: 'Siyan SIM Card' },
                { key: 'cards',         icon: '💳', titleEn: 'Virtual Dollar & Naira Cards',                titleHa: 'Katin Virtual Card (Dollar & Naira)' },
                { key: 'crypto',        icon: '🪙', titleEn: 'Crypto Exchange (USDT, BTC, Web3)',           titleHa: 'Harkokin Crypto (USDT, BTC)' },
                { key: 'history',       icon: '📜', titleEn: 'Recent Transactions (History)',               titleHa: 'Tarihin Kwanan Nan (History)' },
                { key: 'support',       icon: '📞', titleEn: 'Customer Support / Call Admin',               titleHa: 'Tuntubi Admin / Kira da Magana' },
                { key: 'language',      icon: '🌐', titleEn: 'Change Language (English / Hausa)',           titleHa: 'Sauya Yare (English / Hausa)' },
            ];

            // Strict Dynamic Feature Visibility: Filter out any feature hidden in Admin!
            const availableItems = masterCatalog.filter(item => {
                if (item.key === 'wallet' || item.key === 'history' || item.key === 'support' || item.key === 'language') return true;
                return isEnabled(item.key);
            });

            // -------------------------------------------------------------
            // A. UNLINKED USER: Prompt for Account Linking + Play Store Link
            // -------------------------------------------------------------
            if (!userId) {
                if (currentStep === 'AWAITING_LINK_EMAIL') {
                    const cleanEmail = lowerText.trim();
                    const { data: userProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, full_name, email, phone, transaction_pin')
                        .ilike('email', cleanEmail)
                        .maybeSingle();

                    if (!userProfile) {
                        const notFoundMsg = userLang === 'ha'
                            ? `❌ *Ba a sami asusun Abu Mafhal Sub mai Email din "${text}" ba.*\n\nDa fatan ka duba ka sake turawa, ko ka sauke manhajar mu a Play Store don yin sabuwar rajista:\n\n📱 *Google Play Store:*\n${playStoreLink}\n\n🌐 *Shafin Yanar Gizo:* ${webBaseUrl}\n\n(Tura '0' don sokewa)`
                            : `❌ *No Abu Mafhal Sub account found with Email "${text}".*\n\nPlease check the email and try again, or download our mobile app from Google Play Store to create a free account:\n\n📱 *Download on Google Play Store:*\n${playStoreLink}\n\n🌐 *Web Portal:* ${webBaseUrl}\n\n(Reply '0' to cancel)`;
                        return reply(notFoundMsg, 'AWAITING_LINK_EMAIL', sessionData);
                    }

                    const pinPrompt = userLang === 'ha'
                        ? `🔐 An gano asusunka (*${userProfile.full_name || 'User'}*)!\n\nDon tabbatar da cewa asusun naka ne, sanya lambobin *Transaction PIN* ɗinka guda 4:\n\n(Ko tura '0' don sokewa)`
                        : `🔐 Account found (*${userProfile.full_name || 'User'}*)!\n\nPlease enter your 4-digit *Transaction PIN* to verify account ownership:\n\n(Or reply '0' to cancel)`;
                    return reply(pinPrompt, 'AWAITING_LINK_PIN', { ...sessionData, pending_user_id: userProfile.id, pending_email: cleanEmail });
                }

                if (currentStep === 'AWAITING_LINK_PIN') {
                    const { pending_user_id } = sessionData;
                    const { data: userProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, full_name, transaction_pin, balance, phone')
                        .eq('id', pending_user_id)
                        .single();

                    if (!userProfile || userProfile.transaction_pin !== text) {
                        const wrongPinMsg = userLang === 'ha'
                            ? `❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`
                            : `❌ Incorrect Transaction PIN! Please try again (or reply '0' to cancel):`;
                        return reply(wrongPinMsg, 'AWAITING_LINK_PIN', sessionData);
                    }

                    // Successfully Linked!
                    await supabaseAdmin
                        .from('whatsapp_bot_sessions')
                        .update({ user_id: userProfile.id })
                        .eq('phone_number', senderPhone);

                    // Update profile phone if not set
                    if (!userProfile.phone) {
                        const localPhone = formatToLocalPhone(senderPhone);
                        await supabaseAdmin.from('profiles').update({ phone: localPhone }).eq('id', userProfile.id);
                    }

                    const welcomeMsg = userLang === 'ha'
                        ? `✅ Asusu ya haɗu cikin nasara! 🎉\n\n👤 *${userProfile.full_name || 'Customer'}*\n💰 Balance: ₦${Number(userProfile.balance || 0).toLocaleString()}\n\nBarka da zuwa *Abu Mafhal Sub*!\n\nTura *0* ko *menu* don ganin dukkan hidimomi.`
                        : `✅ Account linked successfully! 🎉\n\n👤 *${userProfile.full_name || 'Customer'}*\n💰 Balance: ₦${Number(userProfile.balance || 0).toLocaleString()}\n\nWelcome to *Abu Mafhal Sub*!\n\nType *0* or *menu* to explore all services.`;
                    return reply(welcomeMsg, 'IDLE', { lang: userLang });
                }

                // Default Guest / Unlinked Prompt with Google Play Store Link + Official Domain
                const guestMsg = userLang === 'ha'
                    ? `🌟 *Barka da zuwa Abu Mafhal Sub WhatsApp Bot!* 🌟\n\nLambar wayarka (*${senderPhone}*) ba ta haɗu da asusun Abu Mafhal Sub ba tukuna.\n\n👉 *Kana da asusu?*\nTura mana *Email* ɗinka da kayi rajista da shi don haɗa asusunka cikin daƙiƙa kaɗan.\n\n📲 *Baka da asusu tukuna?*\nSauke manhajar *Abu Mafhal Sub* a Google Play Store don yin rajista a take:\n🔗 ${playStoreLink}\n\n🌐 *Shafin Yanar Gizo:* ${webBaseUrl}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 _Tura 'lang' ko 'english' don komawa Turanci._`
                    : `🌟 *Welcome to Abu Mafhal Sub WhatsApp Bot!* 🌟\n\nYour phone number (*${senderPhone}*) is not yet linked to an Abu Mafhal Sub account.\n\n👉 *Already registered?*\nReply with your registered *Email address* to link your account in seconds!\n\n📲 *Don't have an account yet?*\nDownload our official mobile app on Google Play Store to create a free account:\n🔗 ${playStoreLink}\n\n🌐 *Web Portal:* ${webBaseUrl}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 _Type 'hausa' or 'yare' to switch to Hausa language._`;
                return reply(guestMsg, 'AWAITING_LINK_EMAIL', { lang: userLang });
            }

            // Fetch Linked User Profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, balance, transaction_pin, phone')
                .eq('id', userId)
                .maybeSingle();

            if (!profile) {
                await supabaseAdmin.from('whatsapp_bot_sessions').update({ user_id: null }).eq('phone_number', senderPhone);
                const relinkPrompt = userLang === 'ha'
                    ? `⚠️ Ba a sami bayanan asusunka ba. Da fatan ka sake tura Email ɗinka don haɗawa, ko ka sauke manhajarmu:\n📱 *Google Play Store:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}`
                    : `⚠️ Unable to locate your account profile. Please reply with your registered Email address, or download our app:\n📱 *Google Play Store:* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}`;
                return reply(relinkPrompt, 'AWAITING_LINK_EMAIL', { lang: userLang });
            }

            const currentBalance = Number(profile.balance || 0);
            const userFirstName = (profile.full_name || 'Customer').split(' ')[0];

            // -------------------------------------------------------------
            // B. MAIN MENU (Step IDLE)
            // -------------------------------------------------------------
            if (currentStep === 'IDLE') {
                const choiceNum = parseInt(text, 10);
                if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= availableItems.length) {
                    const chosen = availableItems[choiceNum - 1];

                    // Check if feature is closed/disabled
                    if (!isEnabled(chosen.key)) {
                        const closedMsg = userLang === 'ha'
                            ? `⚠️ Wannan sabis ɗin yana fuskantar kulawa ta musamman (Maintenance) a halin yanzu. Da fatan a gwada wani sabis ɗin ko tura '0' don komawa babban menu.`
                            : `⚠️ This service is currently under maintenance. Please try another option or type '0' for main menu.`;
                        return reply(closedMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'data') {
                        const netMenu = userLang === 'ha'
                            ? `📶 *Siyan Data (Buy Data Bundle)*\n\nZaɓi Network:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n5️⃣ SMILE 4G\n\n(Tura lamba 1-5 ko sunan network, ko '0' don sokewa)`
                            : `📶 *Buy Data Bundle*\n\nSelect Network:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n5️⃣ SMILE 4G\n\n(Reply with 1-5 or network name, or '0' to cancel)`;
                        return reply(netMenu, 'DATA_SELECT_NETWORK', { lang: userLang });
                    }

                    if (chosen.key === 'airtime') {
                        const netMenu = userLang === 'ha'
                            ? `📲 *Siyan Airtime (Buy Airtime)*\n\nZaɓi Network:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n\n(Tura lamba 1-4, ko '0' don sokewa)`
                            : `📲 *Buy Airtime (VTU Recharge)*\n\nSelect Network:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n\n(Reply with number 1-4, or '0' to cancel)`;
                        return reply(netMenu, 'AIRTIME_SELECT_NETWORK', { lang: userLang });
                    }

                    if (chosen.key === 'wallet') {
                        const { data: dvaAccounts } = await supabaseAdmin
                            .from('virtual_accounts')
                            .select('bank_name, account_number, account_name')
                            .eq('user_id', userId);

                        let bankText = '';
                        if (dvaAccounts && dvaAccounts.length > 0) {
                            bankText = userLang === 'ha' ? `\n\n🏦 *Lambobin Asusu don Zuba Kuɗi (DVA):*` : `\n\n🏦 *Your Dedicated Bank Accounts (DVA):*`;
                            dvaAccounts.forEach((acc) => {
                                bankText += `\n• *${acc.bank_name}*: \`${acc.account_number}\`\n  ${acc.account_name}`;
                            });
                            bankText += userLang === 'ha' ? `\n\n💡 _Duk kuɗin da ka tura zuwa wannan asusun za su shiga wallet ɗinka a take._` : `\n\n💡 _Any bank transfer to these accounts automatically funds your wallet within seconds!_`;
                        } else {
                            bankText = userLang === 'ha'
                                ? `\n\n💡 Shiga manhajar Abu Mafhal Sub ko shafinmu ka duba shafin Wallet don samun lambobin DVA:`
                                : `\n\n💡 Open the Abu Mafhal Sub app or web portal to generate and view your personalized virtual bank accounts:`;
                            bankText += `\n📱 *Play Store:* ${playStoreLink}\n🌐 *Web:* ${webBaseUrl}`;
                        }

                        const balMsg = userLang === 'ha'
                            ? `💰 *Bayanin Asusu (Wallet Info)*\n\n👤 Suna: *${profile.full_name}*\n💳 Balance: *₦${currentBalance.toLocaleString()}*${bankText}\n\n(Tura '0' don babban menu)`
                            : `💰 *Wallet & Bank Accounts Info*\n\n👤 Account: *${profile.full_name}*\n💳 Wallet Balance: *₦${currentBalance.toLocaleString()}*${bankText}\n\n(Type '0' for main menu)`;
                        return reply(balMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'cable') {
                        const cablePrompt = userLang === 'ha'
                            ? `📺 *Katin Cable TV: Zaɓi Mai Ba Da Sabis:*\n\n1️⃣ DSTV\n2️⃣ GOTV\n3️⃣ STARTIMES\n\n(Tura lamba, ko '0' don sokewa)`
                            : `📺 *Cable TV Subscription: Select Provider:*\n\n1️⃣ DSTV\n2️⃣ GOtv\n3️⃣ STARTIMES\n\n(Reply with number 1-3, or '0' to cancel)`;
                        return reply(cablePrompt, 'CABLE_SELECT_PROVIDER', { lang: userLang });
                    }

                    if (chosen.key === 'electricity') {
                        const elecPrompt = userLang === 'ha'
                            ? `⚡ *Katin Wutar Lantarki (PHCN Electricity):*\n\n1️⃣ AEDC (Abuja)\n2️⃣ IBEDC (Ibadan)\n3️⃣ EKEDC (Eko)\n4️⃣ IKEDC (Ikeja)\n5️⃣ KEDCO (Kano/Yobe/Katsina)\n6️⃣ EEDC (Enugu)\n7️⃣ PHED (Port Harcourt)\n\n(Tura lamba, ko '0' don sokewa)`
                            : `⚡ *Electricity Bill (PHCN Token): Select Disco:*\n\n1️⃣ AEDC (Abuja)\n2️⃣ IBEDC (Ibadan)\n3️⃣ EKEDC (Eko)\n4️⃣ IKEDC (Ikeja)\n5️⃣ KEDCO (Kano/Yobe/Katsina)\n6️⃣ EEDC (Enugu)\n7️⃣ PHED (Port Harcourt)\n\n(Reply with number 1-7, or '0' to cancel)`;
                        return reply(elecPrompt, 'ELECTRICITY_SELECT_DISCO', { lang: userLang });
                    }

                    if (chosen.key === 'education') {
                        const examPrompt = userLang === 'ha'
                            ? `🎓 *Exam Scratch Cards: Zaɓi Jarabawa:*\n\n1️⃣ WAEC Scratch Card\n2️⃣ NECO Result Token\n3️⃣ NABTEB Result PIN\n\n(Tura lamba, ko '0' don sokewa)`
                            : `🎓 *Exam Result PINs: Select Exam:*\n\n1️⃣ WAEC Scratch Card\n2️⃣ NECO Result Token\n3️⃣ NABTEB Result PIN\n\n(Reply with number 1-3, or '0' to cancel)`;
                        return reply(examPrompt, 'EXAM_SELECT_TYPE', { lang: userLang });
                    }

                    if (chosen.key === 'airtime_cash') {
                        const a2cMsg = userLang === 'ha'
                            ? `💵 *Canza Airtime zuwa Kuɗi (Airtime to Cash)*\n\nMuna canza katin kiran MTN, Airtel, Glo, da 9mobile zuwa kuɗi a wallet ɗinka ko banki a mafi sauƙin charges:\n\n• MTN: 80% - 85%\n• Airtel: 75% - 80%\n• Glo: 70% - 75%\n• 9mobile: 70% - 75%\n\n💬 *Don canza airtime a take:* Tuntuɓi Admin a WhatsApp:\nhttps://wa.me/${adminCallPhone}?text=Ina%20son%20canza%20airtime%20zuwa%20kudi\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/airtime-to-cash\n\n(Tura '0' don komawa babban menu)`
                            : `💵 *Airtime to Cash (Instant Conversion)*\n\nConvert excess MTN, Airtel, Glo, and 9mobile airtime directly to cash in your bank account or wallet:\n\n• MTN: 80% - 85%\n• Airtel: 75% - 80%\n• Glo: 70% - 75%\n• 9mobile: 70% - 75%\n\n💬 *To convert airtime now:* Chat directly with Admin on WhatsApp:\nhttps://wa.me/${adminCallPhone}?text=Hello%20Admin,%20I%20want%20to%20convert%20airtime%20to%20cash\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/airtime-to-cash\n\n(Type '0' for main menu)`;
                        return reply(a2cMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'recharge_pin') {
                        const rPinMsg = userLang === 'ha'
                            ? `🖨️ *Buga Katin Recharge (Recharge PIN)*\n\nZaka iya buga katin recharge na MTN, Airtel, Glo, da 9mobile kai tsaye tare da sunan kamfaninka a sauƙaƙe:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/recharge-pin\n\n(Tura '0' don komawa babban menu)`
                            : `🖨️ *Recharge Card Printing & E-PINs*\n\nGenerate and print customized recharge card PINs for MTN, Airtel, Glo, and 9mobile with your brand name on *Abu Mafhal Sub*:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/recharge-pin\n\n(Type '0' for main menu)`;
                        return reply(rPinMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'bulk_sms') {
                        const bulkMsg = userLang === 'ha'
                            ? `💬 *Bulk SMS (Saƙonni Masu Yawa)*\n\nTura saƙonni da sunan kamfaninka (Custom Sender ID) zuwa lambobi dubbai a take ba tare da matsalar DND ba a farashin ₦3.50 kacal:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/bulk-sms\n\n(Tura '0' don babban menu)`
                            : `💬 *Bulk SMS Services*\n\nSend branded SMS with custom Sender ID to all Nigerian networks (delivered to DND & Non-DND numbers) at just ₦3.50/unit:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/bulk-sms\n\n(Type '0' for main menu)`;
                        return reply(bulkMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'nin') {
                        const ninMsg = userLang === 'ha'
                            ? `🪪 *Binciken NIN & Buga Slip*\n\nYin binciken NIN da buga Standard Slip ko Premium Plastic Slip a take:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/nin-services\n\n(Tura '0' don babban menu)`
                            : `🪪 *NIN Verification & Premium Slip Printing*\n\nVerify National Identity Number (NIN) and generate verifiable color slips directly on Abu Mafhal Sub:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/nin-services\n\n(Type '0' for main menu)`;
                        return reply(ninMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'bvn') {
                        const bvnMsg = userLang === 'ha'
                            ? `🔍 *Binciken BVN*\n\nTabbatar da lambar BVN da buga slip mai inganci:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/bvn-services\n\n(Tura '0' don babban menu)`
                            : `🔍 *BVN Verification Services*\n\nValidate Bank Verification Number (BVN) details securely on Abu Mafhal Sub:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/bvn-services\n\n(Type '0' for main menu)`;
                        return reply(bvnMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'cac') {
                        const cacMsg = userLang === 'ha'
                            ? `🏢 *Rijistar Kamfani (CAC)*\n\nYin rijistar Business Name, Company (LLC), ko NGO a hukumar CAC cikin gaggawa tare da samun takardar Certificate:\n\n💬 *Yi Magana da Masani a WhatsApp:*\nhttps://wa.me/${adminCallPhone}?text=Ina%20son%20yin%20rijistar%20CAC\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/cac-services\n\n(Tura '0' don babban menu)`
                            : `🏢 *CAC Business & Company Registration*\n\nRegister Business Name, Company (LLC), or NGO with the Corporate Affairs Commission (CAC) with fast certificate delivery:\n\n💬 *Chat with CAC Specialist:*\nhttps://wa.me/${adminCallPhone}?text=Hello%20Admin,%20I%20want%20to%20register%20my%20business%20on%20CAC\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/cac-services\n\n(Type '0' for main menu)`;
                        return reply(cacMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'sim') {
                        const simMsg = userLang === 'ha'
                            ? `💳 *Siyan SIM Card*\n\nSayi Kirani 4G SIM cards da data bundles a sauƙaƙe tare da isarwa har gida:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/sim\n\n(Tura '0' don babban menu)`
                            : `💳 *Buy SIM Cards & Telecom Hub*\n\nOrder Kirani 4G SIM cards and data plans with instant doorstep delivery:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/sim\n\n(Type '0' for main menu)`;
                        return reply(simMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'cards') {
                        const cardMsg = userLang === 'ha'
                            ? `💳 *Katin Virtual Dollar & Naira*\n\nƘirƙiri katin biyan kuɗi na ƙasashen waje (USD Mastercard/Visa) don biyan kuɗin Facebook Ads, Netflix, Apple, da Amazon:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/virtual-cards\n\n(Tura '0' don babban menu)`
                            : `💳 *Virtual Dollar & Naira Cards*\n\nInstant virtual USD Mastercard/Visa cards for international payments (Netflix, Apple, Google, Amazon, Facebook Ads):\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/virtual-cards\n\n(Type '0' for main menu)`;
                        return reply(cardMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'crypto') {
                        const cryptoMsg = userLang === 'ha'
                            ? `🪙 *Harkokin Crypto (USDT, BTC)*\n\nSayi, sayar, ko canza USDT, BTC, ETH a mafi kyawun farashi tare da zuba kuɗi a wallet take:\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}/crypto\n\n(Tura '0' don babban menu)`
                            : `🪙 *Crypto Exchange & Web3*\n\nBuy, Sell, and Swap USDT, BTC, ETH, and TON at the best live exchange rates with instant wallet funding:\n\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}/crypto\n\n(Type '0' for main menu)`;
                        return reply(cryptoMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'history') {
                        const { data: txs } = await supabaseAdmin
                            .from('transactions')
                            .select('type, amount, status, description, created_at')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false })
                            .limit(5);

                        if (!txs || txs.length === 0) {
                            const emptyTx = userLang === 'ha'
                                ? `📜 Ba ka da wani transaction kwanan nan a asusunka.\n\n(Tura '0' don babban menu)`
                                : `📜 No recent transactions found in your account.\n\n(Type '0' for main menu)`;
                            return reply(emptyTx, 'IDLE', { lang: userLang });
                        }

                        let txMsg = userLang === 'ha' ? `📜 *Transactions 5 na Kwanan Nan:*\n` : `📜 *Recent 5 Transactions:*\n`;
                        txs.forEach((t, idx) => {
                            const icon = t.status === 'success' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
                            const dateStr = new Date(t.created_at).toLocaleDateString('en-GB');
                            txMsg += `\n${idx + 1}. ${icon} *₦${Number(t.amount).toLocaleString()}* - ${t.description || t.type}\n   _${dateStr}_ [${t.status.toUpperCase()}]`;
                        });
                        txMsg += userLang === 'ha' ? `\n\n(Tura '0' don babban menu)` : `\n\n(Type '0' for main menu)`;
                        return reply(txMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'support') {
                        try {
                            const { data: ticket } = await supabaseAdmin
                                .from('tickets')
                                .insert({
                                    user_id: userId,
                                    subject: `WhatsApp Support Request from ${senderPhone}`,
                                    status: 'open',
                                    priority: 'high'
                                })
                                .select()
                                .single();

                            if (ticket) {
                                await supabaseAdmin.from('ticket_messages').insert({
                                    ticket_id: ticket.id,
                                    sender_id: userId,
                                    message: `Customer (${profile.full_name}, ${senderPhone}) requested Admin support via WhatsApp Bot.`
                                });
                            }
                        } catch (_) {}

                        const supportMsg = userLang === 'ha'
                            ? `📞 *Abu Mafhal Sub Taimako & Kira:*\n\n✅ An buɗe maka Support Ticket kuma an sanar da Admin a take.\n\n📱 *Kira Kai Tsaye (Direct Phone Call):*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Assalamu%20Alaikum%20Admin,%20ina%20neman%20taimako%20(Lambar%20Waya:%20${senderPhone})\n\n📧 *Email:* support@abumafhal.com.ng\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}\n\n(Tura '0' don komawa babban menu)`
                            : `📞 *Abu Mafhal Sub Customer Support & Direct Call:*\n\n✅ Support ticket created and Admin notified instantly.\n\n📱 *Direct Phone Call:*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Hello%20Admin,%20I%20need%20support%20(Phone:%20${senderPhone})\n\n📧 *Email:* support@abumafhal.com.ng\n📱 *Mobile App (Play Store):* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}\n\n(Type '0' for main menu)`;
                        return reply(supportMsg, 'IDLE', { lang: userLang });
                    }

                    if (chosen.key === 'language') {
                        const langPrompt = `🌐 *Select Language / Zaɓi Yare:*\n\n1️⃣ English\n2️⃣ Hausa\n\n_(Reply with 1 or 2)_`;
                        return reply(langPrompt, 'SELECT_LANGUAGE', { ...sessionData });
                    }
                }

                // Render Main Menu strictly in userLang (English by default) + Links Footer
                let menuText = '';
                if (userLang === 'ha') {
                    menuText = `🌟 *Barka da zuwa Abu Mafhal Sub!* 🌟\n👤 Sannu *${userFirstName}*,\n💰 Balance: *₦${currentBalance.toLocaleString()}*\n\nZaɓi lambar hidimar da kake so:`;
                    availableItems.forEach((item, idx) => {
                        menuText += `\n${idx + 1}️⃣ ${item.icon} ${item.titleHa}`;
                    });
                    menuText += `\n\n_(Tura lambar zaɓinka, ko '0' don sake ganin menu)\n\n━━━━━━━━━━━━━━━━━━━━\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}_`;
                } else {
                    menuText = `🌟 *Welcome to Abu Mafhal Sub!* 🌟\n👤 Hello *${userFirstName}*,\n💰 Wallet Balance: *₦${currentBalance.toLocaleString()}*\n\nSelect a service:`;
                    availableItems.forEach((item, idx) => {
                        menuText += `\n${idx + 1}️⃣ ${item.icon} ${item.titleEn}`;
                    });
                    menuText += `\n\n_(Reply with a number, e.g. 1, or type 0 for menu)\n\n━━━━━━━━━━━━━━━━━━━━\n📱 *Download Android App:* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}_`;
                }
                return reply(menuText, 'IDLE', { lang: userLang });
            }

            // -------------------------------------------------------------
            // C. BUY DATA FLOW (All Networks + Smart Curation + Vendor Stripping)
            // -------------------------------------------------------------
            if (currentStep === 'DATA_SELECT_NETWORK') {
                const netInput = lowerText.replace(/\s+/g, '');
                let chosenNetwork = '';

                if (netInput === '1' || netInput.includes('mtn')) chosenNetwork = 'mtn';
                else if (netInput === '2' || netInput.includes('airtel')) chosenNetwork = 'airtel';
                else if (netInput === '3' || netInput.includes('glo')) chosenNetwork = 'glo';
                else if (netInput === '4' || netInput.includes('9mobile') || netInput.includes('etisalat') || netInput.includes('9mob')) chosenNetwork = '9mobile';
                else if (netInput === '5' || netInput.includes('smile')) chosenNetwork = 'smile';

                if (!chosenNetwork) {
                    const invNet = userLang === 'ha'
                        ? `❌ Zaɓin da ka yi ba ya ciki.\n\nZaɓi:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n5️⃣ SMILE 4G\n\n(Tura lamba 1-5 ko sunan network, ko '0' don sokewa):`
                        : `❌ Invalid choice.\n\nSelect:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n5️⃣ SMILE 4G\n\n(Reply with 1-5 or network name, or '0' to cancel):`;
                    return reply(invNet, 'DATA_SELECT_NETWORK', sessionData);
                }

                // Fallback built-in catalog for Smile if not in data_plans
                const smileFallback = [
                    { id: 'smile_1.5gb', plan_id: 'smile_1gb', name: 'Smile 1.5GB Monthly', selling_price: 1200, validity: '30 Days' },
                    { id: 'smile_2gb', plan_id: 'smile_2gb', name: 'Smile 2GB Monthly', selling_price: 1500, validity: '30 Days' },
                    { id: 'smile_3gb', plan_id: 'smile_3gb', name: 'Smile 3GB Monthly', selling_price: 2000, validity: '30 Days' },
                    { id: 'smile_5gb', plan_id: 'smile_5gb', name: 'Smile 5GB Monthly', selling_price: 3000, validity: '30 Days' },
                    { id: 'smile_10gb', plan_id: 'smile_10gb', name: 'Smile 10GB Monthly', selling_price: 4500, validity: '30 Days' },
                ];

                let activePlans: any[] = [];

                if (chosenNetwork === 'smile') {
                    const { data: dbSmile } = await supabaseAdmin
                        .from('data_plans')
                        .select('*')
                        .ilike('network', 'smile')
                        .eq('is_active', true);

                    if (dbSmile && dbSmile.length > 0) activePlans = dbSmile;
                    else activePlans = smileFallback;
                } else {
                    // Fetch all active plans for the network
                    const { data: dbPlans } = await supabaseAdmin
                        .from('data_plans')
                        .select('*')
                        .ilike('network', chosenNetwork)
                        .eq('is_active', true)
                        .order('selling_price', { ascending: true })
                        .limit(100);

                    if (dbPlans && dbPlans.length > 0) {
                        // Smart curation: pick top bundles (500MB, 1GB, 1.5GB, 2GB, 3GB, 5GB, 10GB, 20GB)
                        const targetVols = ['500mb', '1gb', '1.5gb', '2gb', '3gb', '5gb', '10gb', '15gb', '20gb'];
                        const selectedPicks: any[] = [];
                        const usedTargets = new Set<string>();

                        for (const target of targetVols) {
                            const matches = dbPlans.filter(p => {
                                const n = (p.name || '').toLowerCase();
                                const v = (p.volume || '').toLowerCase();
                                return (n.includes(target) || v.includes(target)) && !n.includes('night') && !n.includes('social');
                            });

                            if (matches.length > 0) {
                                // Prefer monthly / 30 days / SME / CG
                                matches.sort((a, b) => {
                                    const a30 = (a.name.includes('30') || a.name.toLowerCase().includes('monthly')) ? 1 : 0;
                                    const b30 = (b.name.includes('30') || b.name.toLowerCase().includes('monthly')) ? 1 : 0;
                                    if (a30 !== b30) return b30 - a30;
                                    return Number(a.selling_price) - Number(b.selling_price);
                                });
                                selectedPicks.push(matches[0]);
                                usedTargets.add(target);
                            }
                        }

                        // If less than 6 plans picked, fill up with other unique clean plans
                        if (selectedPicks.length < 6) {
                            for (const p of dbPlans) {
                                if (!selectedPicks.some(sp => sp.id === p.id)) {
                                    selectedPicks.push(p);
                                    if (selectedPicks.length >= 8) break;
                                }
                            }
                        }

                        activePlans = selectedPicks.length > 0 ? selectedPicks : dbPlans.slice(0, 10);
                    }
                }

                if (activePlans.length === 0) {
                    const noPlans = userLang === 'ha'
                        ? `⚠️ A halin yanzu ba a sami data plans na ${chosenNetwork.toUpperCase()} ba. Da fatan a gwada wani network ɗin ko tura '0'.`
                        : `⚠️ No active data bundles found for ${chosenNetwork.toUpperCase()} at the moment. Please try another network or reply '0'.`;
                    return reply(noPlans, 'IDLE', sessionData);
                }

                // Clean up plan display names (stripping vendor tags!)
                let plansText = userLang === 'ha'
                    ? `📦 *Zaɓi Plan na ${chosenNetwork.toUpperCase()}:*\n`
                    : `📦 *Select ${chosenNetwork.toUpperCase()} Data Plan:*\n`;

                activePlans.forEach((p, idx) => {
                    const cleanName = cleanPlanName(p.name);
                    plansText += `\n${idx + 1}️⃣ ${cleanName} - *₦${Number(p.selling_price).toLocaleString()}*`;
                });
                plansText += userLang === 'ha'
                    ? `\n\n(Tura lambar plan ɗin da kake so 1-${activePlans.length}, ko '0' don sokewa)`
                    : `\n\n(Reply with plan number 1-${activePlans.length}, or '0' to cancel)`;

                return reply(plansText, 'DATA_SELECT_PLAN', {
                    ...sessionData,
                    network: chosenNetwork,
                    available_plans: activePlans
                });
            }

            if (currentStep === 'DATA_SELECT_PLAN') {
                const plans = sessionData.available_plans || [];
                const planIndex = parseInt(text, 10) - 1;

                if (isNaN(planIndex) || planIndex < 0 || planIndex >= plans.length) {
                    const invalidPlan = userLang === 'ha'
                        ? `❌ Zaɓin da ka yi ba ya cikin jerin plans.\n\nDa fatan ka sanya lamba daga 1 zuwa ${plans.length} (ko tura '0' don sokewa):`
                        : `❌ Invalid selection.\n\nPlease reply with a number from 1 to ${plans.length} (or type '0' to cancel):`;
                    return reply(invalidPlan, 'DATA_SELECT_PLAN', sessionData);
                }

                const selectedPlan = plans[planIndex];
                const cleanName = cleanPlanName(selectedPlan.name);

                const promptPhone = userLang === 'ha'
                    ? `📱 Ka zaɓi: *${cleanName}* (₦${Number(selectedPlan.selling_price).toLocaleString()})\n\nSanya lambar wayar da za a tura wa data:\n_(Misali: 08012345678)_`
                    : `📱 You selected: *${cleanName}* (₦${Number(selectedPlan.selling_price).toLocaleString()})\n\nPlease enter the recipient 11-digit phone number:\n_(e.g. 08012345678)_`;

                return reply(promptPhone, 'DATA_ENTER_PHONE', {
                    ...sessionData,
                    selected_plan: selectedPlan,
                    clean_plan_name: cleanName
                });
            }

            if (currentStep === 'DATA_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    const badPhone = userLang === 'ha'
                        ? `❌ Lambar wayar da ka sanya ba daidai ba ce.\n\nDa fatan sanya ingantacciyar lambar waya mai lamba 11 (Misali: 08012345678), ko tura '0' don sokewa:`
                        : `❌ Invalid phone number format.\n\nPlease enter a valid 11-digit Nigerian phone number (e.g. 08012345678), or reply '0' to cancel:`;
                    return reply(badPhone, 'DATA_ENTER_PHONE', sessionData);
                }

                const selectedPlan = sessionData.selected_plan;
                const cleanName = sessionData.clean_plan_name || cleanPlanName(selectedPlan.name);
                const planPrice = Number(selectedPlan.selling_price);

                if (currentBalance < planPrice) {
                    const insBal = userLang === 'ha'
                        ? `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Farashin Plan: *₦${planPrice.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\nDon zuba kuɗi a take, tura kuɗi zuwa lambar asusunka ta DVA ko ka tura '3' don duba asusunka.\n\n(Tura '0' don komawa babban menu)`
                        : `⚠️ *Insufficient Wallet Balance!*\n\n• Plan Cost: *₦${planPrice.toLocaleString()}*\n• Your Balance: *₦${currentBalance.toLocaleString()}*\n\nPlease fund your wallet via bank transfer to your DVA account (option 3 in menu).\n\n(Type '0' for main menu)`;
                    return reply(insBal, 'IDLE', { lang: userLang });
                }

                const confirmMsg = userLang === 'ha'
                    ? `📋 *Tabbatar da Siyan Data:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Package: *${cleanName}*\n• Lambar Waya: *${cleanPhone}*\n• Kuɗin da za a cire: *₦${planPrice.toLocaleString()}*\n\n🔐 Don tabbatarwa da tura data a take, sanya *Transaction PIN* ɗinka mai lamba 4:\n_(Ko tura '0' don sokewa)_`
                    : `📋 *Confirm Data Purchase:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Bundle: *${cleanName}*\n• Recipient Phone: *${cleanPhone}*\n• Amount to Debit: *₦${planPrice.toLocaleString()}*\n\n🔐 To confirm and deliver instantly, enter your 4-digit *Transaction PIN*:\n_(Or type '0' to cancel)_`;

                return reply(confirmMsg, 'DATA_CONFIRM_PIN', {
                    ...sessionData,
                    recipient_phone: cleanPhone
                });
            }

            if (currentStep === 'DATA_CONFIRM_PIN') {
                const userPin = text.trim();

                if (!profile.transaction_pin || profile.transaction_pin !== userPin) {
                    const badPin = userLang === 'ha'
                        ? `❌ *Transaction PIN ba daidai ba ne!*\n\nDa fatan ka sake gwadawa daidai, ko ka tura '0' don soke cinikin:`
                        : `❌ *Incorrect Transaction PIN!*\n\nPlease enter the correct 4-digit PIN, or reply '0' to cancel:`;
                    return reply(badPin, 'DATA_CONFIRM_PIN', sessionData);
                }

                const selectedPlan = sessionData.selected_plan;
                const cleanName = sessionData.clean_plan_name || cleanPlanName(selectedPlan.name);
                const recipientPhone = sessionData.recipient_phone;
                const network = sessionData.network;

                const waitMsg = userLang === 'ha'
                    ? `⏳ Ana tura data zuwa *${recipientPhone}*, da fatan a ɗan jira kaɗan...`
                    : `⏳ Delivering data bundle to *${recipientPhone}*, please hold on a moment...`;
                await sendWhatsAppMessage(senderPhone, waitMsg, phoneNumberId, accessToken);

                try {
                    const billsRes = await fetch(`${supabaseUrl}/functions/v1/bills-payment`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'x-internal-service': supabaseServiceKey
                        },
                        body: JSON.stringify({
                            type: 'data',
                            user_id: userId,
                            network: network,
                            planId: selectedPlan.plan_id,
                            phone: recipientPhone,
                            vendor: selectedPlan.api_vendor || '',
                            requestId: `WA_DATA_${Date.now()}`
                        })
                    });

                    const billsData = await billsRes.json().catch(() => ({ success: false, error: "Network error" }));

                    if (billsData.success) {
                        const { data: updatedProfile } = await supabaseAdmin
                            .from('profiles')
                            .select('balance')
                            .eq('id', userId)
                            .single();

                        const newBal = Number(updatedProfile?.balance || (currentBalance - Number(selectedPlan.selling_price)));

                        const successMsg = userLang === 'ha'
                            ? `✅ *Transaction Ya Yi Nasara!* 🎉\n\n📦 Sabis: *${cleanName}*\n📶 Network: *${network.toUpperCase()}*\n📱 Lamba: *${recipientPhone}*\n💰 Kuɗi: *₦${Number(selectedPlan.selling_price).toLocaleString()}*\n💳 Sabon Balance: *₦${newBal.toLocaleString()}*\n\n_Mun gode da kasuwanci da Abu Mafhal Sub!_\n\n(Tura '0' ko 'menu' don sabon transaction)`
                            : `✅ *Data Purchase Successful!* 🎉\n\n📦 Package: *${cleanName}*\n📶 Network: *${network.toUpperCase()}*\n📱 Recipient: *${recipientPhone}*\n💰 Amount: *₦${Number(selectedPlan.selling_price).toLocaleString()}*\n💳 New Balance: *₦${newBal.toLocaleString()}*\n\n_Thank you for choosing Abu Mafhal Sub!_\n\n(Type '0' or 'menu' for main menu)`;
                        return reply(successMsg, 'IDLE', { lang: userLang });
                    } else {
                        const errMsg = billsData.error || billsData.message || "Could not process request.";
                        const failMsg = userLang === 'ha'
                            ? `❌ *Transaction bai tafi ba:*\n${errMsg}\n\n_(Ba a cire kuɗi a wallet ɗinka ba)._\n\nTura '0' don komawa babban menu.`
                            : `❌ *Transaction Failed:*\n${errMsg}\n\n_(Your wallet was not debited)._\n\nType '0' for main menu.`;
                        return reply(failMsg, 'IDLE', { lang: userLang });
                    }
                } catch (e: any) {
                    console.error("[WhatsApp Bot] Execution error:", e);
                    const netErr = userLang === 'ha'
                        ? `❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.\n\n(Tura '0' don komawa babban menu)`
                        : `❌ Connection error. Please try again shortly.\n\n(Type '0' for main menu)`;
                    return reply(netErr, 'IDLE', { lang: userLang });
                }
            }

            // -------------------------------------------------------------
            // D. BUY AIRTIME FLOW (Bilingual based on userLang)
            // -------------------------------------------------------------
            if (currentStep === 'AIRTIME_SELECT_NETWORK') {
                const netInput = lowerText.replace(/\s+/g, '');
                let chosenNetwork = '';

                if (netInput === '1' || netInput.includes('mtn')) chosenNetwork = 'mtn';
                else if (netInput === '2' || netInput.includes('airtel')) chosenNetwork = 'airtel';
                else if (netInput === '3' || netInput.includes('glo')) chosenNetwork = 'glo';
                else if (netInput === '4' || netInput.includes('9mobile') || netInput.includes('etisalat') || netInput.includes('9mob')) chosenNetwork = '9mobile';

                if (!chosenNetwork) {
                    const invNet = userLang === 'ha'
                        ? `❌ Zaɓin da ka yi ba ya ciki.\n\nZaɓi:\n1 na MTN\n2 na AIRTEL\n3 na GLO\n4 na 9MOBILE\n(Ko tura '0' don sokewa):`
                        : `❌ Invalid choice.\n\nSelect:\n1 for MTN\n2 for AIRTEL\n3 for GLO\n4 for 9MOBILE\n(Or reply '0' to cancel):`;
                    return reply(invNet, 'AIRTIME_SELECT_NETWORK', sessionData);
                }

                const amtPrompt = userLang === 'ha'
                    ? `💰 Sanya adadin katin kiran da kake so (₦50 zuwa ₦50,000):\n_(Misali: 500)_`
                    : `💰 Enter the amount of airtime you wish to purchase (₦50 to ₦50,000):\n_(e.g. 500)_`;

                return reply(amtPrompt, 'AIRTIME_ENTER_AMOUNT', {
                    ...sessionData,
                    network: chosenNetwork
                });
            }

            if (currentStep === 'AIRTIME_ENTER_AMOUNT') {
                const amount = parseInt(text.replace(/\D/g, ''), 10);
                if (isNaN(amount) || amount < 50 || amount > 50000) {
                    const badAmt = userLang === 'ha'
                        ? `❌ Adadin da ka sanya ba ya tsakanin ₦50 zuwa ₦50,000.\n\nDa fatan sanya adadi daidai (ko tura '0' don sokewa):`
                        : `❌ Amount must be between ₦50 and ₦50,000.\n\nPlease enter a valid amount (or reply '0' to cancel):`;
                    return reply(badAmt, 'AIRTIME_ENTER_AMOUNT', sessionData);
                }

                if (currentBalance < amount) {
                    const insBal = userLang === 'ha'
                        ? `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Kuɗin da kake so: *₦${amount.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\n(Tura '0' don komawa babban menu)`
                        : `⚠️ *Insufficient Wallet Balance!*\n\n• Airtime Amount: *₦${amount.toLocaleString()}*\n• Your Balance: *₦${currentBalance.toLocaleString()}*\n\n(Type '0' for main menu)`;
                    return reply(insBal, 'IDLE', { lang: userLang });
                }

                const promptPhone = userLang === 'ha'
                    ? `📱 Sanya lambar wayar da za a tura wa katin kiran:\n_(Misali: 08012345678)_`
                    : `📱 Enter the recipient 11-digit phone number:\n_(e.g. 08012345678)_`;

                return reply(promptPhone, 'AIRTIME_ENTER_PHONE', {
                    ...sessionData,
                    airtime_amount: amount
                });
            }

            if (currentStep === 'AIRTIME_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    const badPhone = userLang === 'ha'
                        ? `❌ Lambar wayar da ka sanya ba daidai ba ce.\n\nDa fatan sanya ingantacciyar lambar waya mai lamba 11 (Misali: 08012345678), ko tura '0' don sokewa:`
                        : `❌ Invalid phone number format.\n\nPlease enter an 11-digit phone number (e.g. 08012345678), or type '0' to cancel:`;
                    return reply(badPhone, 'AIRTIME_ENTER_PHONE', sessionData);
                }

                const amount = sessionData.airtime_amount;
                const confirmMsg = userLang === 'ha'
                    ? `📋 *Tabbatar da Siyan Airtime:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Adadi: *₦${amount.toLocaleString()}*\n• Lambar Waya: *${cleanPhone}*\n\n🔐 Don tabbatarwa, sanya *Transaction PIN* ɗinka mai lamba 4:\n_(Ko tura '0' don sokewa)_`
                    : `📋 *Confirm Airtime Purchase:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Amount: *₦${amount.toLocaleString()}*\n• Recipient Phone: *${cleanPhone}*\n\n🔐 Enter your 4-digit *Transaction PIN* to complete transaction:\n_(Or reply '0' to cancel)_`;

                return reply(confirmMsg, 'AIRTIME_CONFIRM_PIN', {
                    ...sessionData,
                    recipient_phone: cleanPhone
                });
            }

            if (currentStep === 'AIRTIME_CONFIRM_PIN') {
                const userPin = text.trim();

                if (!profile.transaction_pin || profile.transaction_pin !== userPin) {
                    const badPin = userLang === 'ha'
                        ? `❌ *Transaction PIN ba daidai ba ne!*\n\nDa fatan ka sake gwadawa daidai, ko ka tura '0' don sokewa:`
                        : `❌ *Incorrect Transaction PIN!*\n\nPlease try again with your correct 4-digit PIN, or reply '0' to cancel:`;
                    return reply(badPin, 'AIRTIME_CONFIRM_PIN', sessionData);
                }

                const amount = sessionData.airtime_amount;
                const recipientPhone = sessionData.recipient_phone;
                const network = sessionData.network;

                const waitMsg = userLang === 'ha'
                    ? `⏳ Ana tura katin kira zuwa *${recipientPhone}*, da fatan a ɗan jira kaɗan...`
                    : `⏳ Sending airtime to *${recipientPhone}*, please hold on a moment...`;
                await sendWhatsAppMessage(senderPhone, waitMsg, phoneNumberId, accessToken);

                try {
                    const billsRes = await fetch(`${supabaseUrl}/functions/v1/bills-payment`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'x-internal-service': supabaseServiceKey
                        },
                        body: JSON.stringify({
                            type: 'airtime',
                            user_id: userId,
                            network: network,
                            amount: amount,
                            phone: recipientPhone,
                            requestId: `WA_AIRTIME_${Date.now()}`
                        })
                    });

                    const billsData = await billsRes.json().catch(() => ({ success: false, error: "Network error" }));

                    if (billsData.success) {
                        const { data: updatedProfile } = await supabaseAdmin
                            .from('profiles')
                            .select('balance')
                            .eq('id', userId)
                            .single();

                        const newBal = Number(updatedProfile?.balance || (currentBalance - amount));

                        const successMsg = userLang === 'ha'
                            ? `✅ *Airtime Ya Yi Nasara!* 🎉\n\n📶 Network: *${network.toUpperCase()}*\n📱 Lamba: *${recipientPhone}*\n💰 Adadi: *₦${amount.toLocaleString()}*\n💳 Sabon Balance: *₦${newBal.toLocaleString()}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' ko 'menu' don sabon transaction)`
                            : `✅ *Airtime Purchase Successful!* 🎉\n\n📶 Network: *${network.toUpperCase()}*\n📱 Recipient: *${recipientPhone}*\n💰 Amount: *₦${amount.toLocaleString()}*\n💳 New Balance: *₦${newBal.toLocaleString()}*\n\n_Thank you for choosing Abu Mafhal Sub!_\n\n(Type '0' or 'menu' for main menu)`;
                        return reply(successMsg, 'IDLE', { lang: userLang });
                    } else {
                        const errMsg = billsData.error || billsData.message || "Failed to process airtime.";
                        const failMsg = userLang === 'ha'
                            ? `❌ *Transaction bai tafi ba:*\n${errMsg}\n\n(Tura '0' don komawa babban menu)`
                            : `❌ *Transaction Failed:*\n${errMsg}\n\n(Type '0' for main menu)`;
                        return reply(failMsg, 'IDLE', { lang: userLang });
                    }
                } catch (e: any) {
                    console.error("[WhatsApp Bot] Airtime error:", e);
                    const netErr = userLang === 'ha'
                        ? `❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.\n\n(Tura '0' don komawa babban menu)`
                        : `❌ Connection error. Please try again shortly.\n\n(Type '0' for main menu)`;
                    return reply(netErr, 'IDLE', { lang: userLang });
                }
            }

            // -------------------------------------------------------------
            // E. OTHER SERVICES (Exam PIN, PHCN Electricity, Cable TV)
            // -------------------------------------------------------------

            // 1. Exam PIN Flow
            if (currentStep === 'EXAM_SELECT_TYPE') {
                const examMap: Record<string, { type: string, name: string, price: number }> = {
                    '1': { type: 'waec', name: 'WAEC Scratch Card', price: 3800 },
                    '2': { type: 'neco', name: 'NECO Result Token', price: 1300 },
                    '3': { type: 'nabteb', name: 'NABTEB Result PIN', price: 1400 },
                };

                const chosenExam = examMap[text];
                if (!chosenExam) {
                    const invExam = userLang === 'ha'
                        ? `❌ Zaɓin da ka yi ba ya ciki. Zaɓi 1 na WAEC, 2 na NECO, ko 3 na NABTEB (ko '0' don sokewa):`
                        : `❌ Invalid choice. Reply 1 for WAEC, 2 for NECO, or 3 for NABTEB (or '0' to cancel):`;
                    return reply(invExam, 'EXAM_SELECT_TYPE', sessionData);
                }

                if (currentBalance < chosenExam.price) {
                    const insBal = userLang === 'ha'
                        ? `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Farashi: *₦${chosenExam.price.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\n(Tura '0' don komawa babban menu)`
                        : `⚠️ *Insufficient Wallet Balance!*\n\n• PIN Price: *₦${chosenExam.price.toLocaleString()}*\n• Your Balance: *₦${currentBalance.toLocaleString()}*\n\n(Type '0' for main menu)`;
                    return reply(insBal, 'IDLE', { lang: userLang });
                }

                const promptPhone = userLang === 'ha'
                    ? `📱 Sanya lambar wayar da za a tura wa Exam PIN ɗin:\n_(Misali: 08012345678)_`
                    : `📱 Enter the recipient phone number to receive the Exam PIN via SMS:\n_(e.g. 08012345678)_`;

                return reply(promptPhone, 'EXAM_ENTER_PHONE', {
                    ...sessionData,
                    exam: chosenExam
                });
            }

            if (currentStep === 'EXAM_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    const badPhone = userLang === 'ha'
                        ? `❌ Lambar wayar ba daidai ba ce. Sanya lambar waya mai lamba 11 (ko tura '0' don sokewa):`
                        : `❌ Invalid phone number. Please enter a valid 11-digit number (or reply '0' to cancel):`;
                    return reply(badPhone, 'EXAM_ENTER_PHONE', sessionData);
                }

                const exam = sessionData.exam;
                const confirmMsg = userLang === 'ha'
                    ? `📋 *Tabbatar da Siyan Exam PIN:*\n\n• Jarabawa: *${exam.name}*\n• Lambar Waya: *${cleanPhone}*\n• Kuɗi: *₦${exam.price.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don tabbatarwa:\n_(Ko tura '0' don sokewa)_`
                    : `📋 *Confirm Exam PIN Purchase:*\n\n• Exam: *${exam.name}*\n• Phone Number: *${cleanPhone}*\n• Amount: *₦${exam.price.toLocaleString()}*\n\n🔐 Enter your 4-digit *Transaction PIN* to complete:\n_(Or reply '0' to cancel)_`;

                return reply(confirmMsg, 'EXAM_CONFIRM_PIN', {
                    ...sessionData,
                    recipient_phone: cleanPhone
                });
            }

            if (currentStep === 'EXAM_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    const badPin = userLang === 'ha'
                        ? `❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`
                        : `❌ Incorrect Transaction PIN! Please try again (or reply '0' to cancel):`;
                    return reply(badPin, 'EXAM_CONFIRM_PIN', sessionData);
                }

                const exam = sessionData.exam;
                const phone = sessionData.recipient_phone;

                const waitMsg = userLang === 'ha'
                    ? `⏳ Ana sarrafa Exam PIN ɗinka, da fatan a ɗan jira...`
                    : `⏳ Processing your Exam PIN, please hold on...`;
                await sendWhatsAppMessage(senderPhone, waitMsg, phoneNumberId, accessToken);

                try {
                    const res = await fetch(`${supabaseUrl}/functions/v1/bills-payment`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'x-internal-service': supabaseServiceKey
                        },
                        body: JSON.stringify({
                            type: 'education',
                            user_id: userId,
                            examType: exam.type,
                            phone: phone,
                            amount: exam.price,
                            requestId: `WA_EXAM_${Date.now()}`
                        })
                    });

                    const data = await res.json().catch(() => ({ success: false, error: "Network error" }));
                    if (data.success) {
                        const pinDetails = data.pin || data.token || data.serial || data.details || "PIN will be delivered via SMS";
                        const succ = userLang === 'ha'
                            ? `✅ *Exam PIN Ya Yi Nasara!* 🎉\n\n🎓 Jarabawa: *${exam.name}*\n🔑 PIN/Token: *${pinDetails}*\n📱 Lamba: *${phone}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' don komawa babban menu)`
                            : `✅ *Exam PIN Purchase Successful!* 🎉\n\n🎓 Exam: *${exam.name}*\n🔑 PIN/Token: *${pinDetails}*\n📱 Recipient: *${phone}*\n\n_Thank you for choosing Abu Mafhal Sub!_\n\n(Type '0' for main menu)`;
                        return reply(succ, 'IDLE', { lang: userLang });
                    } else {
                        const err = userLang === 'ha'
                            ? `❌ *Transaction bai tafi ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`
                            : `❌ *Transaction Failed:*\n${data.error || "An error occurred"}\n\n(Type '0' for main menu)`;
                        return reply(err, 'IDLE', { lang: userLang });
                    }
                } catch (_) {
                    const netErr = userLang === 'ha'
                        ? `❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`
                        : `❌ Connection error. Please try again later.`;
                    return reply(netErr, 'IDLE', { lang: userLang });
                }
            }

            // 2. Electricity Flow
            if (currentStep === 'ELECTRICITY_SELECT_DISCO') {
                const discoMap: Record<string, string> = {
                    '1': '01', // Abuja
                    '2': '03', // Ibadan
                    '3': '02', // Eko
                    '4': '04', // Ikeja
                    '5': '06', // Kano
                    '6': '08', // Enugu
                    '7': '05'  // Port Harcourt
                };
                const discoCode = discoMap[text];
                if (!discoCode) {
                    const invDisco = userLang === 'ha'
                        ? `❌ Zaɓin da ka yi ba ya ciki. Zaɓi lamba 1 zuwa 7 (ko tura '0' don sokewa):`
                        : `❌ Invalid choice. Select a number from 1 to 7 (or reply '0' to cancel):`;
                    return reply(invDisco, 'ELECTRICITY_SELECT_DISCO', sessionData);
                }

                const promptMeter = userLang === 'ha'
                    ? `🔢 Sanya lambar Meter ɗinka:\n_(Misali: 45012345678)_`
                    : `🔢 Enter your Meter Number:\n_(e.g. 45012345678)_`;

                return reply(promptMeter, 'ELECTRICITY_ENTER_METER', {
                    ...sessionData,
                    disco: discoCode
                });
            }

            if (currentStep === 'ELECTRICITY_ENTER_METER') {
                const meterNo = text.replace(/\D/g, '');
                if (meterNo.length < 8) {
                    const badMeter = userLang === 'ha'
                        ? `❌ Lambar Meter ba ta da inganci. Sake dubawa ka sanya (ko tura '0' don sokewa):`
                        : `❌ Invalid Meter number. Please verify and re-enter (or reply '0' to cancel):`;
                    return reply(badMeter, 'ELECTRICITY_ENTER_METER', sessionData);
                }

                const promptAmt = userLang === 'ha'
                    ? `💰 Sanya adadin kuɗin da kake son siya (₦500 zuwa ₦50,000):\n_(Misali: 2000)_`
                    : `💰 Enter token amount (₦500 to ₦50,000):\n_(e.g. 2000)_`;

                return reply(promptAmt, 'ELECTRICITY_ENTER_AMOUNT', {
                    ...sessionData,
                    meter_no: meterNo
                });
            }

            if (currentStep === 'ELECTRICITY_ENTER_AMOUNT') {
                const amount = parseInt(text.replace(/\D/g, ''), 10);
                if (isNaN(amount) || amount < 500 || amount > 50000) {
                    const badAmt = userLang === 'ha'
                        ? `❌ Mafi ƙanƙanta shine ₦500. Sanya adadi mai kyau (ko tura '0' don sokewa):`
                        : `❌ Minimum amount is ₦500 (max ₦50,000). Please enter a valid amount (or '0' to cancel):`;
                    return reply(badAmt, 'ELECTRICITY_ENTER_AMOUNT', sessionData);
                }

                if (currentBalance < amount) {
                    const insBal = userLang === 'ha'
                        ? `⚠️ Kuɗin Wallet ɗinka bai isa ba! Balance: ₦${currentBalance.toLocaleString()}.\n\n(Tura '0' don babban menu)`
                        : `⚠️ Insufficient wallet balance! Balance: ₦${currentBalance.toLocaleString()}.\n\n(Type '0' for main menu)`;
                    return reply(insBal, 'IDLE', { lang: userLang });
                }

                const confirmMsg = userLang === 'ha'
                    ? `📋 *Tabbatar da Siyan Katin Wuta:*\n\n• Meter: *${sessionData.meter_no}*\n• Kuɗi: *₦${amount.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don biya:\n_(Ko tura '0' don sokewa)_`
                    : `📋 *Confirm Electricity Bill:*\n\n• Meter No: *${sessionData.meter_no}*\n• Amount: *₦${amount.toLocaleString()}*\n\n🔐 Enter your 4-digit *Transaction PIN* to complete payment:\n_(Or reply '0' to cancel)_`;

                return reply(confirmMsg, 'ELECTRICITY_CONFIRM_PIN', {
                    ...sessionData,
                    amount: amount
                });
            }

            if (currentStep === 'ELECTRICITY_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    const badPin = userLang === 'ha'
                        ? `❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`
                        : `❌ Incorrect Transaction PIN! Please try again (or reply '0' to cancel):`;
                    return reply(badPin, 'ELECTRICITY_CONFIRM_PIN', sessionData);
                }

                const waitMsg = userLang === 'ha'
                    ? `⏳ Ana sarrafa Token ɗin wutar lantarki, da fatan a ɗan jira...`
                    : `⏳ Generating electricity token, please hold on...`;
                await sendWhatsAppMessage(senderPhone, waitMsg, phoneNumberId, accessToken);

                try {
                    const res = await fetch(`${supabaseUrl}/functions/v1/bills-payment`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'x-internal-service': supabaseServiceKey
                        },
                        body: JSON.stringify({
                            type: 'electricity',
                            user_id: userId,
                            provider: sessionData.disco,
                            meterNumber: sessionData.meter_no,
                            amount: sessionData.amount,
                            phone: profile.phone || senderPhone,
                            requestId: `WA_ELEC_${Date.now()}`
                        })
                    });

                    const data = await res.json().catch(() => ({ success: false, error: "Network error" }));
                    if (data.success) {
                        const token = data.token || data.meter_token || data.mainToken || "Token generated successfully";
                        const succ = userLang === 'ha'
                            ? `✅ *Katin Wuta Ya Yi Nasara!* 🎉\n\n⚡ Token: *${token}*\n🔢 Meter: *${sessionData.meter_no}*\n💰 Kuɗi: *₦${Number(sessionData.amount).toLocaleString()}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' don komawa babban menu)`
                            : `✅ *Electricity Bill Successful!* 🎉\n\n⚡ Token: *${token}*\n🔢 Meter No: *${sessionData.meter_no}*\n💰 Amount: *₦${Number(sessionData.amount).toLocaleString()}*\n\n_Thank you for choosing Abu Mafhal Sub!_\n\n(Type '0' for main menu)`;
                        return reply(succ, 'IDLE', { lang: userLang });
                    } else {
                        const fail = userLang === 'ha'
                            ? `❌ *Ba a samu nasara ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`
                            : `❌ *Payment Failed:*\n${data.error || "An error occurred"}\n\n(Type '0' for main menu)`;
                        return reply(fail, 'IDLE', { lang: userLang });
                    }
                } catch (_) {
                    const netErr = userLang === 'ha'
                        ? `❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`
                        : `❌ Connection error. Please try again later.`;
                    return reply(netErr, 'IDLE', { lang: userLang });
                }
            }

            // 3. Cable TV Flow
            if (currentStep === 'CABLE_SELECT_PROVIDER') {
                const provMap: Record<string, { code: string, name: string }> = {
                    '1': { code: '01', name: 'DSTV' },
                    '2': { code: '02', name: 'GOTV' },
                    '3': { code: '03', name: 'STARTIMES' }
                };
                const prov = provMap[text];
                if (!prov) {
                    const invProv = userLang === 'ha'
                        ? `❌ Zaɓi 1 na DSTV, 2 na GOTV, ko 3 na STARTIMES (ko '0' don sokewa):`
                        : `❌ Invalid choice. Reply 1 for DSTV, 2 for GOtv, or 3 for STARTIMES (or '0' to cancel):`;
                    return reply(invProv, 'CABLE_SELECT_PROVIDER', sessionData);
                }

                const promptIuc = userLang === 'ha'
                    ? `📺 Sanya lambar IUC / SmartCard na *${prov.name}*:\n_(Misali: 2012345678)_`
                    : `📺 Enter your *${prov.name}* IUC / SmartCard Number:\n_(e.g. 2012345678)_`;

                return reply(promptIuc, 'CABLE_ENTER_SMARTCARD', {
                    ...sessionData,
                    provider: prov
                });
            }

            if (currentStep === 'CABLE_ENTER_SMARTCARD') {
                const smartCard = text.replace(/\D/g, '');
                if (smartCard.length < 8) {
                    const badCard = userLang === 'ha'
                        ? `❌ Lambar SmartCard ba ta da inganci. Sake gwadawa (ko tura '0' don sokewa):`
                        : `❌ Invalid SmartCard number. Please re-enter (or reply '0' to cancel):`;
                    return reply(badCard, 'CABLE_ENTER_SMARTCARD', sessionData);
                }

                const provCode = sessionData.provider.code;
                let packages: Array<{ id: string, name: string, price: number }> = [];

                if (provCode === '02') { // GOTV
                    packages = [
                        { id: 'gotv-smallie', name: 'GOtv Smallie', price: 1575 },
                        { id: 'gotv-jinja', name: 'GOtv Jinja', price: 3300 },
                        { id: 'gotv-jolli', name: 'GOtv Jolli', price: 4850 },
                        { id: 'gotv-max', name: 'GOtv Max', price: 7200 },
                        { id: 'gotv-supa', name: 'GOtv Supa', price: 9600 }
                    ];
                } else if (provCode === '01') { // DSTV
                    packages = [
                        { id: 'dstv-padi', name: 'DStv Padi', price: 3600 },
                        { id: 'dstv-yanga', name: 'DStv Yanga', price: 5100 },
                        { id: 'dstv-confam', name: 'DStv Confam', price: 9300 },
                        { id: 'dstv-compact', name: 'DStv Compact', price: 15700 }
                    ];
                } else { // STARTIMES
                    packages = [
                        { id: 'nova', name: 'Nova Bouquet', price: 1700 },
                        { id: 'basic', name: 'Basic Bouquet', price: 3300 },
                        { id: 'classic', name: 'Classic Bouquet', price: 5000 }
                    ];
                }

                let pkgList = userLang === 'ha'
                    ? `📦 *Zaɓi Package na ${sessionData.provider.name}:*\n`
                    : `📦 *Select ${sessionData.provider.name} Package:*\n`;

                packages.forEach((pkg, idx) => {
                    pkgList += `\n${idx + 1}️⃣ ${pkg.name} - *₦${pkg.price.toLocaleString()}*`;
                });
                pkgList += userLang === 'ha'
                    ? `\n\n(Tura lambar package ɗin da kake so, ko '0' don sokewa)`
                    : `\n\n(Reply with package number 1-${packages.length}, or '0' to cancel)`;

                return reply(pkgList, 'CABLE_SELECT_PACKAGE', {
                    ...sessionData,
                    smart_card: smartCard,
                    packages: packages
                });
            }

            if (currentStep === 'CABLE_SELECT_PACKAGE') {
                const packages = sessionData.packages || [];
                const pkgIndex = parseInt(text, 10) - 1;

                if (isNaN(pkgIndex) || pkgIndex < 0 || pkgIndex >= packages.length) {
                    const invPkg = userLang === 'ha'
                        ? `❌ Zaɓi lamba daga 1 zuwa ${packages.length} (ko tura '0' don sokewa):`
                        : `❌ Invalid choice. Select a number from 1 to ${packages.length} (or '0' to cancel):`;
                    return reply(invPkg, 'CABLE_SELECT_PACKAGE', sessionData);
                }

                const selectedPkg = packages[pkgIndex];
                if (currentBalance < selectedPkg.price) {
                    const insBal = userLang === 'ha'
                        ? `⚠️ Kuɗin Wallet ɗinka bai isa ba! Farashi: ₦${selectedPkg.price.toLocaleString()}, Balance ɗinka: ₦${currentBalance.toLocaleString()}.\n\n(Tura '0' don babban menu)`
                        : `⚠️ Insufficient wallet balance! Cost: ₦${selectedPkg.price.toLocaleString()}, Balance: ₦${currentBalance.toLocaleString()}.\n\n(Type '0' for main menu)`;
                    return reply(insBal, 'IDLE', { lang: userLang });
                }

                const confirmMsg = userLang === 'ha'
                    ? `📋 *Tabbatar da Biyan Cable TV:*\n\n• Mai Ba Da Sabis: *${sessionData.provider.name}*\n• SmartCard/IUC: *${sessionData.smart_card}*\n• Package: *${selectedPkg.name}*\n• Kuɗi: *₦${selectedPkg.price.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don tabbatarwa:\n_(Ko tura '0' don sokewa)_`
                    : `📋 *Confirm Cable TV Subscription:*\n\n• Provider: *${sessionData.provider.name}*\n• SmartCard/IUC: *${sessionData.smart_card}*\n• Package: *${selectedPkg.name}*\n• Amount: *₦${selectedPkg.price.toLocaleString()}*\n\n🔐 Enter your 4-digit *Transaction PIN* to complete:\n_(Or reply '0' to cancel)_`;

                return reply(confirmMsg, 'CABLE_CONFIRM_PIN', {
                    ...sessionData,
                    selected_pkg: selectedPkg
                });
            }

            if (currentStep === 'CABLE_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    const badPin = userLang === 'ha'
                        ? `❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`
                        : `❌ Incorrect Transaction PIN! Please try again (or reply '0' to cancel):`;
                    return reply(badPin, 'CABLE_CONFIRM_PIN', sessionData);
                }

                const pkg = sessionData.selected_pkg;
                const waitMsg = userLang === 'ha'
                    ? `⏳ Ana kunna sub ɗinka na ${sessionData.provider.name}, da fatan a ɗan jira...`
                    : `⏳ Activating your ${sessionData.provider.name} subscription, please hold on...`;
                await sendWhatsAppMessage(senderPhone, waitMsg, phoneNumberId, accessToken);

                try {
                    const res = await fetch(`${supabaseUrl}/functions/v1/bills-payment`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json',
                            'x-internal-service': supabaseServiceKey
                        },
                        body: JSON.stringify({
                            type: 'tv',
                            user_id: userId,
                            provider: sessionData.provider.code,
                            smartCard: sessionData.smart_card,
                            packageId: pkg.id,
                            amount: pkg.price,
                            phone: profile.phone || senderPhone,
                            requestId: `WA_TV_${Date.now()}`
                        })
                    });

                    const data = await res.json().catch(() => ({ success: false, error: "Network error" }));
                    if (data.success) {
                        const succ = userLang === 'ha'
                            ? `✅ *Biyan Cable TV Ya Yi Nasara!* 🎉\n\n📺 TV: *${sessionData.provider.name}*\n📦 Package: *${pkg.name}*\n🔢 SmartCard: *${sessionData.smart_card}*\n💰 Kuɗi: *₦${Number(pkg.price).toLocaleString()}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' don komawa babban menu)`
                            : `✅ *Cable TV Subscription Successful!* 🎉\n\n📺 TV: *${sessionData.provider.name}*\n📦 Package: *${pkg.name}*\n🔢 SmartCard: *${sessionData.smart_card}*\n💰 Amount: *₦${Number(pkg.price).toLocaleString()}*\n\n_Thank you for choosing Abu Mafhal Sub!_\n\n(Type '0' for main menu)`;
                        return reply(succ, 'IDLE', { lang: userLang });
                    } else {
                        const fail = userLang === 'ha'
                            ? `❌ *Ba a samu nasara ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`
                            : `❌ *Subscription Failed:*\n${data.error || "An error occurred"}\n\n(Type '0' for main menu)`;
                        return reply(fail, 'IDLE', { lang: userLang });
                    }
                } catch (_) {
                    const netErr = userLang === 'ha'
                        ? `❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`
                        : `❌ Connection error. Please try again later.`;
                    return reply(netErr, 'IDLE', { lang: userLang });
                }
            }

            // Fallback for unhandled input: return to main menu
            const fallbackMsg = userLang === 'ha'
                ? `🌟 *Abu Mafhal Sub WhatsApp Bot*\n\nBa a gane wannan zaɓin ba. Da fatan ka tura '0' ko 'menu' don ganin dukkan hidimominmu.\n\n📱 *Manhajar Android:* ${playStoreLink}\n🌐 *Shafin Gizo:* ${webBaseUrl}`
                : `🌟 *Abu Mafhal Sub WhatsApp Bot*\n\nUnrecognized command. Type *0* or *menu* to view our available services.\n\n📱 *Download Android App:* ${playStoreLink}\n🌐 *Web Portal:* ${webBaseUrl}`;
            return reply(fallbackMsg, 'IDLE', { lang: userLang });

        } catch (err: any) {
            console.error("[WhatsApp Bot] Unexpected error:", err);
            return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }
    }

    return new Response("Method not allowed", { status: 405 });
});
