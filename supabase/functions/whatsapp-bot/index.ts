import { createClient } from "@supabase/supabase-js";
import { getSystemSecrets } from "../_shared/secrets.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        .in('key', ['support_whatsapp', 'whatsapp_admin_call_phone', 'support_phone', 'whatsapp_bot_enabled']);

    const settingsMap: Record<string, string> = {};
    if (appSettingsData) {
        appSettingsData.forEach(s => { settingsMap[s.key] = s.value; });
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

    // ==========================================
    // 1. GET: Webhook Verification (Meta Setup)
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

        // Health check & Diagnostic mode
        if (!mode && !token) {
            let metaCheck: any = null;
            let testSendResult: any = null;
            let recentLogs: any = null;

            if (url.searchParams.get('diag') === '1') {
                // 1. Verify Meta Graph API connection with stored credentials
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

                // 2. Fetch last 5 logs from whatsapp_bot_logs
                const { data: logs } = await supabaseAdmin
                    .from('whatsapp_bot_logs')
                    .select('id, phone_number, direction, message_type, content, created_at')
                    .order('created_at', { ascending: false })
                    .limit(5);
                recentLogs = logs;

                // 2b. Fetch current app_settings & secrets for whatsapp
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

                // 3. Optional test send
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

            // Log incoming message in background
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
                        session_data: {}
                    })
                    .select()
                    .single();
                session = newSession;
            }

            let userId = session?.user_id;
            let currentStep = session?.step || 'IDLE';
            let sessionData = session?.session_data || {};

            // 1. Try resolving user if not already linked
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

            // Quick reset / Main Menu command
            if (lowerText === '0' || lowerText === 'menu' || lowerText === 'start' || lowerText === 'reset' || lowerText === 'barka' || lowerText === 'sannu' || lowerText === 'hi' || lowerText === 'hello') {
                currentStep = 'IDLE';
                sessionData = {};
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

            // Direct Call / Support Escalation keyword trigger
            if (lowerText === 'call' || lowerText === 'kira' || lowerText === 'admin' || lowerText === 'agent' || lowerText === 'help' || lowerText === 'magana') {
                // Log Support Ticket
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
                                message: `Kwastoma ya nemi kiran Admin ta WhatsApp Bot daga lambar ${senderPhone}.`
                            });
                        }
                    } catch (_) {}
                }

                const escalationMsg = `📞 *Abu Mafhal Sub Admin Support:*\n\nMun sanar da Admin a take! Zaka iya kiran Admin kai tsaye ko yin magana da shi:\n\n📱 *Kira Kai Tsaye (Direct Call):*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Assalamu%20Alaikum%20Admin,%20ina%20neman%20taimako%20(Lambar%20Waya:%20${senderPhone})\n\n(Tura '0' don komawa babban menu)`;
                return reply(escalationMsg, 'IDLE');
            }

            // -------------------------------------------------------------
            // A. UNLINKED USER: Prompt for Account Linking
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
                        return reply(
                            `❌ Ba a sami asusu mai Email din "${text}" ba.\n\nDa fatan ka duba ka sake turawa, ko ka shiga manhajar Abu Mafhal Sub don yin rajista.\n\n(Tura '0' don sokewa)`,
                            'AWAITING_LINK_EMAIL'
                        );
                    }

                    return reply(
                        `🔐 An gano asusunka (*${userProfile.full_name || 'User'}*)!\n\nDon tabbatar da cewa asusun naka ne, sanya lambobin *Transaction PIN* ɗinka guda 4:\n(Ko tura '0' don sokewa)`,
                        'AWAITING_LINK_PIN',
                        { pending_user_id: userProfile.id, pending_email: cleanEmail }
                    );
                }

                if (currentStep === 'AWAITING_LINK_PIN') {
                    const { pending_user_id } = sessionData;
                    const { data: userProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('id, full_name, transaction_pin, balance, phone')
                        .eq('id', pending_user_id)
                        .single();

                    if (!userProfile || userProfile.transaction_pin !== text) {
                        return reply(
                            `❌ Transaction PIN ɗin da ka sanya ba daidai ba ne!\n\nSake gwadawa ka sanya PIN ɗin mai lamba 4, ko tura '0' don sokewa:`,
                            'AWAITING_LINK_PIN',
                            sessionData
                        );
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

                    const welcomeMsg = `✅ Asusu ya haɗu cikin nasara! 🎉\n\n👤 *${userProfile.full_name || 'Customer'}*\n💰 Balance: ₦${Number(userProfile.balance || 0).toLocaleString()}\n\nBarka da zuwa *Abu Mafhal Sub*!\n\nZaɓi lambar hidimar da kake so:\n1️⃣ Siyan Data (MTN, Airtel, Glo, 9mobile)\n2️⃣ Siyan Airtime (Katin Kira)\n3️⃣ Zuba Kuɗi / Bank Accounts (DVA)\n4️⃣ Katin Cable TV (DSTV, GOTV, Startimes)\n5️⃣ Wutar Lantarki (PHCN Electricity)\n6️⃣ Exam PINs (WAEC, NECO, NABTEB)\n7️⃣ Canza Airtime zuwa Kuɗi (Airtime to Cash)\n8️⃣ Buga Katin Recharge (Recharge PIN)\n9️⃣ Tarihin Kwanan Nan (Recent History)\n🔟 Tuntubi Admin / Support (Call & Chat)\n\n(Tura lambar zaɓinka)`;
                    return reply(welcomeMsg, 'IDLE', {});
                }

                // Default Guest Message
                return reply(
                    `🌟 *Barka da zuwa Abu Mafhal Sub WhatsApp Bot!* 🌟\n\nLambar wayarka (${senderPhone}) ba ta haɗu da asusunka ba tukuna.\n\n👉 *Don haɗa asusunka:* Tura mana *Email* ɗinka da kayi rajista da shi a Abu Mafhal Sub.\n\n🌐 Idan baka da asusu, sauke manhajar Abu Mafhal Sub ko buɗe shafinmu don yin rajista cikin daƙiƙa 60!`,
                    'AWAITING_LINK_EMAIL'
                );
            }

            // Fetch Linked User Profile
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, balance, transaction_pin, phone')
                .eq('id', userId)
                .maybeSingle();

            if (!profile) {
                await supabaseAdmin.from('whatsapp_bot_sessions').update({ user_id: null }).eq('phone_number', senderPhone);
                return reply(`⚠️ An samu matsala wajen duba asusunka. Da fatan sake tura Email ɗinka don haɗawa.`);
            }

            const currentBalance = Number(profile.balance || 0);
            const userFirstName = (profile.full_name || 'Aboki').split(' ')[0];

            // -------------------------------------------------------------
            // B. MAIN MENU (Step IDLE)
            // -------------------------------------------------------------
            if (currentStep === 'IDLE') {
                if (text === '1') {
                    // Option 1: Buy Data -> Choose Network
                    const networkMenu = `📶 *Siyan Data (Buy Data)*\n\nZaɓi Network ɗin da kake so:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n\n(Tura lamba, ko '0' don babban menu)`;
                    return reply(networkMenu, 'DATA_SELECT_NETWORK', {});
                }

                if (text === '2') {
                    // Option 2: Buy Airtime -> Choose Network
                    const airtimeNetMenu = `📲 *Siyan Airtime (Buy Airtime)*\n\nZaɓi Network ɗin da kake so:\n1️⃣ MTN\n2️⃣ AIRTEL\n3️⃣ GLO\n4️⃣ 9MOBILE\n\n(Tura lamba, ko '0' don babban menu)`;
                    return reply(airtimeNetMenu, 'AIRTIME_SELECT_NETWORK', {});
                }

                if (text === '3') {
                    // Option 3: Check Balance & DVA
                    const { data: dvaAccounts } = await supabaseAdmin
                        .from('virtual_accounts')
                        .select('bank_name, account_number, account_name')
                        .eq('user_id', userId);

                    let bankText = '';
                    if (dvaAccounts && dvaAccounts.length > 0) {
                        bankText = `\n\n🏦 *Lambobin Asusu don Zuba Kuɗi (Bank Accounts - DVA):*`;
                        dvaAccounts.forEach((acc) => {
                            bankText += `\n• *${acc.bank_name}*: \`${acc.account_number}\`\n  Suna: ${acc.account_name}`;
                        });
                        bankText += `\n\n💡 _Duk kuɗin da ka tura zuwa wannan asusun za su shiga wallet ɗinka a take._`;
                    } else {
                        bankText = `\n\n💡 Don samun lambar asusu ta musamman (DVA), shiga manhajar Abu Mafhal Sub ka duba shafin Wallet.`;
                    }

                    const balMsg = `💰 *Bayanin Asusu (Wallet Info)*\n\n👤 Suna: *${profile.full_name}*\n💳 Balance: *₦${currentBalance.toLocaleString()}*${bankText}\n\n(Tura '0' don komawa babban menu)`;
                    return reply(balMsg, 'IDLE');
                }

                if (text === '4') {
                    // Option 4: Cable TV
                    return reply(
                        `📺 *Katin Cable TV: Zaɓi Mai Ba Da Sabis:*\n\n1️⃣ DSTV\n2️⃣ GOTV\n3️⃣ STARTIMES\n\n(Tura lamba, ko '0' don komawa babban menu)`,
                        'CABLE_SELECT_PROVIDER',
                        {}
                    );
                }

                if (text === '5') {
                    // Option 5: Electricity
                    return reply(
                        `⚡ *Katin Wutar Lantarki (PHCN Electricity):*\n\n1️⃣ AEDC (Abuja)\n2️⃣ IBEDC (Ibadan)\n3️⃣ EKEDC (Eko)\n4️⃣ IKEDC (Ikeja)\n5️⃣ KEDCO (Kano/Yobe/Katsina)\n6️⃣ EEDC (Enugu)\n7️⃣ PHED (Port Harcourt)\n\n(Tura lamba, ko '0' don komawa babban menu)`,
                        'ELECTRICITY_SELECT_DISCO',
                        {}
                    );
                }

                if (text === '6') {
                    // Option 6: Exam PINs
                    return reply(
                        `🎓 *Exam Scratch Cards: Zaɓi Jarabawa:*\n\n1️⃣ WAEC Scratch Card\n2️⃣ NECO Result Token\n3️⃣ NABTEB Result PIN\n\n(Tura lamba, ko '0' don komawa babban menu)`,
                        'EXAM_SELECT_TYPE',
                        {}
                    );
                }

                if (text === '7') {
                    // Option 7: Airtime to Cash
                    const a2cMsg = `💵 *Canza Airtime zuwa Kuɗi (Airtime to Cash)*\n\nMuna canza katin kiran MTN, Airtel, Glo, da 9mobile zuwa kuɗi a wallet ɗinka ko asusun banki:\n\n• MTN: 80% - 85%\n• Airtel: 75% - 80%\n• Glo: 70% - 75%\n• 9mobile: 70% - 75%\n\n💬 *Don canza airtime a take:* Tuntuɓi Admin a WhatsApp:\nhttps://wa.me/${adminCallPhone}?text=Ina%20son%20canza%20airtime%20zuwa%20kudi\n\n(Tura '0' don komawa babban menu)`;
                    return reply(a2cMsg, 'IDLE');
                }

                if (text === '8') {
                    // Option 8: Recharge Card PIN
                    const rPinMsg = `🖨️ *Buga Katin Recharge (Recharge PIN)*\n\nZaka iya samarwa ko buga katin recharge na MTN, Airtel, Glo, da 9mobile kai tsaye a cikin manhajar *Abu Mafhal Sub* tare da samun rangwame na musamman.\n\n🌐 Don shiga shafin buga kati, buɗe manhajar Abu Mafhal Sub ka duba shafin *Recharge PIN*.\n\n(Tura '0' don komawa babban menu)`;
                    return reply(rPinMsg, 'IDLE');
                }

                if (text === '9') {
                    // Option 9: Recent Transactions
                    const { data: txs } = await supabaseAdmin
                        .from('transactions')
                        .select('type, amount, status, description, created_at')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(5);

                    if (!txs || txs.length === 0) {
                        return reply(`📜 Ba ka da wani transaction kwanan nan a asusunka.\n\n(Tura '0' don komawa babban menu)`, 'IDLE');
                    }

                    let txMsg = `📜 *Transactions 5 na Kwanan Nan:*\n`;
                    txs.forEach((t, idx) => {
                        const icon = t.status === 'success' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
                        const dateStr = new Date(t.created_at).toLocaleDateString('en-GB');
                        txMsg += `\n${idx + 1}. ${icon} *₦${Number(t.amount).toLocaleString()}* - ${t.description || t.type}\n   _${dateStr}_ [${t.status.toUpperCase()}]`;
                    });
                    txMsg += `\n\n(Tura '0' don komawa babban menu)`;
                    return reply(txMsg, 'IDLE');
                }

                if (text === '10' || text === 'admin' || text === 'call' || text === 'support') {
                    // Option 10: Call & Support Escalation
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
                                message: `Kwastoma (${profile.full_name}, ${senderPhone}) ya nemi kiran Admin ta WhatsApp Bot.`
                            });
                        }
                    } catch (_) {}

                    const supportMsg = `📞 *Abu Mafhal Sub Support & Call:*\n\n✅ An buɗe maka Support Ticket kuma an sanar da Admin a take.\n\n📱 *Kira Kai Tsaye (Direct Phone Call):*\n+${adminCallPhone}\n\n💬 *WhatsApp Chat:* https://wa.me/${adminCallPhone}?text=Assalamu%20Alaikum%20Admin,%20ina%20neman%20taimako%20(Lambar%20Waya:%20${senderPhone})\n\n📧 *Email:* support@abumafhal.com.ng\n\n(Tura '0' don komawa babban menu)`;
                    return reply(supportMsg, 'IDLE');
                }

                // Default Main Menu
                const mainMenu = `🌟 *Barka da zuwa Abu Mafhal Sub!* 🌟\n👤 Sannu *${userFirstName}*,\n💰 Balance: *₦${currentBalance.toLocaleString()}*\n\nZaɓi lambar hidimar da kake so:\n1️⃣ Siyan Data (MTN, Airtel, Glo, 9mobile)\n2️⃣ Siyan Airtime (Katin Kira)\n3️⃣ Zuba Kuɗi / Bank Accounts (DVA)\n4️⃣ Katin Cable TV (DSTV, GOTV, Startimes)\n5️⃣ Wutar Lantarki (PHCN Electricity)\n6️⃣ Exam PINs (WAEC, NECO, NABTEB)\n7️⃣ Canza Airtime zuwa Kuɗi (Airtime to Cash)\n8️⃣ Buga Katin Recharge (Recharge PIN)\n9️⃣ Tarihin Kwanan Nan (Recent History)\n🔟 Tuntubi Admin / Support (Call & Chat)\n\n_(Tura lambar zaɓinka, ko '0' kowane lokaci don sake ganin menu)_`;
                return reply(mainMenu, 'IDLE');
            }

            // -------------------------------------------------------------
            // C. BUY DATA FLOW
            // -------------------------------------------------------------
            if (currentStep === 'DATA_SELECT_NETWORK') {
                const netMap: Record<string, string> = {
                    '1': 'mtn',
                    '2': 'airtel',
                    '3': 'glo',
                    '4': '9mobile'
                };

                const chosenNetwork = netMap[text];
                if (!chosenNetwork) {
                    return reply(`❌ Zaɓin da ka yi ba ya ciki.\n\nZaɓi:\n1 na MTN\n2 na AIRTEL\n3 na GLO\n4 na 9MOBILE\n(Ko tura '0' don sokewa):`, 'DATA_SELECT_NETWORK');
                }

                // Fetch active plans for this network from data_plans
                let activePlans: any[] = [];
                const { data: plans } = await supabaseAdmin
                    .from('data_plans')
                    .select('*')
                    .ilike('network', chosenNetwork)
                    .eq('is_active', true)
                    .order('selling_price', { ascending: true })
                    .limit(10);

                if (plans && plans.length > 0) {
                    activePlans = plans;
                } else {
                    const { data: fallbackPlans } = await supabaseAdmin
                        .from('data_plans')
                        .select('*')
                        .ilike('network', chosenNetwork)
                        .order('selling_price', { ascending: true })
                        .limit(10);
                    activePlans = fallbackPlans || [];
                }

                if (activePlans.length === 0) {
                    return reply(`⚠️ A halin yanzu ba a sami data plans na ${chosenNetwork.toUpperCase()} ba. Da fatan a gwada wani network ɗin ko tura '0'.`, 'IDLE');
                }

                let plansText = `📦 *Zaɓi Plan na ${chosenNetwork.toUpperCase()}:*\n`;
                activePlans.forEach((p, idx) => {
                    plansText += `\n${idx + 1}️⃣ ${p.name} - *₦${Number(p.selling_price).toLocaleString()}*`;
                });
                plansText += `\n\n(Tura lambar plan ɗin da kake so, ko '0' don sokewa)`;

                return reply(plansText, 'DATA_SELECT_PLAN', {
                    network: chosenNetwork,
                    available_plans: activePlans
                });
            }

            if (currentStep === 'DATA_SELECT_PLAN') {
                const plans = sessionData.available_plans || [];
                const planIndex = parseInt(text, 10) - 1;

                if (isNaN(planIndex) || planIndex < 0 || planIndex >= plans.length) {
                    return reply(`❌ Zaɓin da ka yi ba ya cikin jerin plans.\n\nDa fatan ka sanya lamba daga 1 zuwa ${plans.length} (ko tura '0' don sokewa):`, 'DATA_SELECT_PLAN', sessionData);
                }

                const selectedPlan = plans[planIndex];

                return reply(
                    `📱 Ka zaɓi: *${selectedPlan.name}* (₦${Number(selectedPlan.selling_price).toLocaleString()})\n\nSanya lambar wayar da za a tura wa data:\n_(Misali: 08012345678)_`,
                    'DATA_ENTER_PHONE',
                    { ...sessionData, selected_plan: selectedPlan }
                );
            }

            if (currentStep === 'DATA_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    return reply(
                        `❌ Lambar wayar da ka sanya ba daidai ba ce.\n\nDa fatan sanya ingantacciyar lambar waya mai lamba 11 (Misali: 08012345678), ko tura '0' don sokewa:`,
                        'DATA_ENTER_PHONE',
                        sessionData
                    );
                }

                const selectedPlan = sessionData.selected_plan;
                const planPrice = Number(selectedPlan.selling_price);

                // Check wallet balance
                if (currentBalance < planPrice) {
                    return reply(
                        `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Farashin Plan: *₦${planPrice.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\nDon zuba kuɗi a take, tura kuɗi zuwa lambar asusunka ta DVA ko ka tura '3' don duba asusunka.\n\n(Tura '0' don komawa babban menu)`,
                        'IDLE',
                        {}
                    );
                }

                return reply(
                    `📋 *Tabbatar da Siyan Data:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Package: *${selectedPlan.name}*\n• Lambar Waya: *${cleanPhone}*\n• Kuɗin da za a cire: *₦${planPrice.toLocaleString()}*\n\n🔐 Don tabbatarwa da tura data a take, sanya *Transaction PIN* ɗinka mai lamba 4:\n_(Ko tura '0' don sokewa)_`,
                    'DATA_CONFIRM_PIN',
                    { ...sessionData, recipient_phone: cleanPhone }
                );
            }

            if (currentStep === 'DATA_CONFIRM_PIN') {
                const userPin = text.trim();

                // Check PIN against profile
                if (!profile.transaction_pin || profile.transaction_pin !== userPin) {
                    return reply(
                        `❌ *Transaction PIN ba daidai ba ne!*\n\nDa fatan ka sake gwadawa daidai, ko ka tura '0' don soke cinikin:`,
                        'DATA_CONFIRM_PIN',
                        sessionData
                    );
                }

                const selectedPlan = sessionData.selected_plan;
                const recipientPhone = sessionData.recipient_phone;
                const network = sessionData.network;

                await sendWhatsAppMessage(senderPhone, `⏳ Ana tura data zuwa *${recipientPhone}*, da fatan a ɗan jira kaɗan...`, phoneNumberId, accessToken);

                // Call internal Bills-Payment edge function
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

                        const successMsg = `✅ *Transaction Ya Yi Nasara!* 🎉\n\n📦 Sabis: *${selectedPlan.name}*\n📶 Network: *${network.toUpperCase()}*\n📱 Lamba: *${recipientPhone}*\n💰 Kuɗi: *₦${Number(selectedPlan.selling_price).toLocaleString()}*\n💳 Sabon Balance: *₦${newBal.toLocaleString()}*\n\n_Mun gode da kasuwanci da Abu Mafhal Sub!_\n\n(Tura '0' ko 'menu' don sabon transaction)`;
                        return reply(successMsg, 'IDLE', {});
                    } else {
                        const errMsg = billsData.error || billsData.message || "An samu matsala wajen sarrafa wannan oda.";
                        return reply(`❌ *Transaction bai tafi ba:*\n${errMsg}\n\n_(Ba a cire kudi a wallet dinka ba)._\n\nTura '0' don komawa babban menu.`, 'IDLE', {});
                    }
                } catch (e: any) {
                    console.error("[WhatsApp Bot] Execution error:", e);
                    return reply(`❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                }
            }

            // -------------------------------------------------------------
            // D. BUY AIRTIME FLOW
            // -------------------------------------------------------------
            if (currentStep === 'AIRTIME_SELECT_NETWORK') {
                const netMap: Record<string, string> = {
                    '1': 'mtn',
                    '2': 'airtel',
                    '3': 'glo',
                    '4': '9mobile'
                };

                const chosenNetwork = netMap[text];
                if (!chosenNetwork) {
                    return reply(`❌ Zaɓin da ka yi ba ya ciki.\n\nZaɓi:\n1 na MTN\n2 na AIRTEL\n3 na GLO\n4 na 9MOBILE\n(Ko tura '0' don sokewa):`, 'AIRTIME_SELECT_NETWORK');
                }

                return reply(
                    `💰 Sanya adadin katin kiran da kake so (₦50 zuwa ₦50,000):\n_(Misali: 500)_`,
                    'AIRTIME_ENTER_AMOUNT',
                    { network: chosenNetwork }
                );
            }

            if (currentStep === 'AIRTIME_ENTER_AMOUNT') {
                const amount = parseInt(text.replace(/\D/g, ''), 10);
                if (isNaN(amount) || amount < 50 || amount > 50000) {
                    return reply(`❌ Adadin da ka sanya ba ya tsakanin ₦50 zuwa ₦50,000.\n\nDa fatan sanya adadi daidai (ko tura '0' don sokewa):`, 'AIRTIME_ENTER_AMOUNT', sessionData);
                }

                if (currentBalance < amount) {
                    return reply(
                        `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Kuɗin da kake so: *₦${amount.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\n(Tura '0' don komawa babban menu)`,
                        'IDLE',
                        {}
                    );
                }

                return reply(
                    `📱 Sanya lambar wayar da za a tura wa katin kiran:\n_(Misali: 08012345678)_`,
                    'AIRTIME_ENTER_PHONE',
                    { ...sessionData, airtime_amount: amount }
                );
            }

            if (currentStep === 'AIRTIME_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    return reply(
                        `❌ Lambar wayar da ka sanya ba daidai ba ce.\n\nDa fatan sanya ingantacciyar lambar waya mai lamba 11 (Misali: 08012345678), ko tura '0' don sokewa:`,
                        'AIRTIME_ENTER_PHONE',
                        sessionData
                    );
                }

                const amount = sessionData.airtime_amount;
                return reply(
                    `📋 *Tabbatar da Siyan Airtime:*\n\n• Network: *${sessionData.network.toUpperCase()}*\n• Adadi: *₦${amount.toLocaleString()}*\n• Lambar Waya: *${cleanPhone}*\n\n🔐 Don tabbatarwa, sanya *Transaction PIN* ɗinka mai lamba 4:\n_(Ko tura '0' don sokewa)_`,
                    'AIRTIME_CONFIRM_PIN',
                    { ...sessionData, recipient_phone: cleanPhone }
                );
            }

            if (currentStep === 'AIRTIME_CONFIRM_PIN') {
                const userPin = text.trim();

                if (!profile.transaction_pin || profile.transaction_pin !== userPin) {
                    return reply(
                        `❌ *Transaction PIN ba daidai ba ne!*\n\nDa fatan ka sake gwadawa daidai, ko ka tura '0' don sokewa:`,
                        'AIRTIME_CONFIRM_PIN',
                        sessionData
                    );
                }

                const amount = sessionData.airtime_amount;
                const recipientPhone = sessionData.recipient_phone;
                const network = sessionData.network;

                await sendWhatsAppMessage(senderPhone, `⏳ Ana tura katin kira zuwa *${recipientPhone}*, da fatan a ɗan jira kaɗan...`, phoneNumberId, accessToken);

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

                        const successMsg = `✅ *Airtime Ya Yi Nasara!* 🎉\n\n📶 Network: *${network.toUpperCase()}*\n📱 Lamba: *${recipientPhone}*\n💰 Adadi: *₦${amount.toLocaleString()}*\n💳 Sabon Balance: *₦${newBal.toLocaleString()}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' ko 'menu' don sabon transaction)`;
                        return reply(successMsg, 'IDLE', {});
                    } else {
                        const errMsg = billsData.error || billsData.message || "An samu matsala wajen tura katin kira.";
                        return reply(`❌ *Transaction bai tafi ba:*\n${errMsg}\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    }
                } catch (e: any) {
                    console.error("[WhatsApp Bot] Airtime error:", e);
                    return reply(`❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                }
            }

            // -------------------------------------------------------------
            // E. OTHER SERVICES (Exam PIN, PHCN Electricity, Cable TV)
            // -------------------------------------------------------------
            if (currentStep === 'OTHER_SELECT_SERVICE') {
                if (text === '1') {
                    // Exam PINs
                    return reply(
                        `🎓 *Siyan Exam PIN: Zaɓi Jarabawa:*\n\n1️⃣ WAEC Scratch Card\n2️⃣ NECO Result Token\n3️⃣ NABTEB Result PIN\n\n(Tura lambar da kake so, ko '0' don sokewa)`,
                        'EXAM_SELECT_TYPE',
                        {}
                    );
                }

                if (text === '2') {
                    // Electricity
                    return reply(
                        `⚡ *Katin Wutar Lantarki (PHCN):*\n\n1️⃣ AEDC (Abuja)\n2️⃣ IBEDC (Ibadan)\n3️⃣ EKEDC (Eko)\n4️⃣ IKEDC (Ikeja)\n5️⃣ KEDCO (Kano/Yobe/Katsina)\n6️⃣ EEDC (Enugu)\n7️⃣ PHED (Port Harcourt)\n\n(Tura lamba, ko '0' don sokewa)`,
                        'ELECTRICITY_SELECT_DISCO',
                        {}
                    );
                }

                if (text === '3') {
                    // Cable TV
                    return reply(
                        `📺 *Katin Cable TV: Zaɓi Mai Ba Da Sabis:*\n\n1️⃣ DSTV\n2️⃣ GOTV\n3️⃣ STARTIMES\n\n(Tura lamba, ko '0' don sokewa)`,
                        'CABLE_SELECT_PROVIDER',
                        {}
                    );
                }

                return reply(`❌ Zaɓin da ka yi ba ya ciki. Da fatan tura 1, 2, ko 3 (ko '0' don babban menu).`, 'OTHER_SELECT_SERVICE');
            }

            // 1. Exam PIN Flow
            if (currentStep === 'EXAM_SELECT_TYPE') {
                const examMap: Record<string, { type: string, name: string, price: number }> = {
                    '1': { type: 'waec', name: 'WAEC Scratch Card', price: 3800 },
                    '2': { type: 'neco', name: 'NECO Result Token', price: 1300 },
                    '3': { type: 'nabteb', name: 'NABTEB Result PIN', price: 1400 },
                };

                const chosenExam = examMap[text];
                if (!chosenExam) {
                    return reply(`❌ Zaɓin da ka yi ba ya ciki. Zaɓi 1 na WAEC, 2 na NECO, ko 3 na NABTEB (ko '0' don sokewa):`, 'EXAM_SELECT_TYPE');
                }

                if (currentBalance < chosenExam.price) {
                    return reply(
                        `⚠️ *Kuɗin da ke cikin Wallet ɗinka bai isa ba!*\n\n• Farashi: *₦${chosenExam.price.toLocaleString()}*\n• Balance ɗinka: *₦${currentBalance.toLocaleString()}*\n\n(Tura '0' don komawa babban menu)`,
                        'IDLE',
                        {}
                    );
                }

                return reply(
                    `📱 Sanya lambar wayar da za a tura wa Exam PIN ɗin:\n_(Misali: 08012345678)_`,
                    'EXAM_ENTER_PHONE',
                    { exam: chosenExam }
                );
            }

            if (currentStep === 'EXAM_ENTER_PHONE') {
                let cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.startsWith('234') && cleanPhone.length === 13) {
                    cleanPhone = '0' + cleanPhone.slice(3);
                } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
                    cleanPhone = '0' + cleanPhone;
                }

                if (cleanPhone.length !== 11 || !cleanPhone.startsWith('0')) {
                    return reply(`❌ Lambar wayar ba daidai ba ce. Sanya lambar waya mai lamba 11 (ko tura '0' don sokewa):`, 'EXAM_ENTER_PHONE', sessionData);
                }

                const exam = sessionData.exam;
                return reply(
                    `📋 *Tabbatar da Siyan Exam PIN:*\n\n• Jarabawa: *${exam.name}*\n• Lambar Waya: *${cleanPhone}*\n• Kuɗi: *₦${exam.price.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don tabbatarwa:\n_(Ko tura '0' don sokewa)_`,
                    'EXAM_CONFIRM_PIN',
                    { ...sessionData, recipient_phone: cleanPhone }
                );
            }

            if (currentStep === 'EXAM_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    return reply(`❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`, 'EXAM_CONFIRM_PIN', sessionData);
                }

                const exam = sessionData.exam;
                const phone = sessionData.recipient_phone;

                await sendWhatsAppMessage(senderPhone, `⏳ Ana sarrafa Exam PIN ɗinka, da fatan a ɗan jira...`, phoneNumberId, accessToken);

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
                        const pinDetails = data.pin || data.token || data.serial || data.details || "Za a tura maka cikakken bayanin a SMS";
                        return reply(`✅ *Exam PIN Ya Yi Nasara!* 🎉\n\n🎓 Jarabawa: *${exam.name}*\n🔑 PIN/Token: *${pinDetails}*\n📱 Lamba: *${phone}*\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    } else {
                        return reply(`❌ *Transaction bai tafi ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    }
                } catch (_) {
                    return reply(`❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`, 'IDLE', {});
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
                    return reply(`❌ Zaɓin da ka yi ba ya ciki. Zaɓi lamba 1 zuwa 7 (ko tura '0' don sokewa):`, 'ELECTRICITY_SELECT_DISCO');
                }

                return reply(`🔢 Sanya lambar Meter ɗinka:\n_(Misali: 45012345678)_`, 'ELECTRICITY_ENTER_METER', { disco: discoCode });
            }

            if (currentStep === 'ELECTRICITY_ENTER_METER') {
                const meterNo = text.replace(/\D/g, '');
                if (meterNo.length < 8) {
                    return reply(`❌ Lambar Meter ba ta da inganci. Sake dubawa ka sanya (ko tura '0' don sokewa):`, 'ELECTRICITY_ENTER_METER', sessionData);
                }

                return reply(`💰 Sanya adadin kuɗin da kake son siya (₦500 zuwa ₦50,000):\n_(Misali: 2000)_`, 'ELECTRICITY_ENTER_AMOUNT', { ...sessionData, meter_no: meterNo });
            }

            if (currentStep === 'ELECTRICITY_ENTER_AMOUNT') {
                const amount = parseInt(text.replace(/\D/g, ''), 10);
                if (isNaN(amount) || amount < 500 || amount > 50000) {
                    return reply(`❌ Mafi ƙanƙanta shine ₦500. Sanya adadi mai kyau (ko tura '0' don sokewa):`, 'ELECTRICITY_ENTER_AMOUNT', sessionData);
                }

                if (currentBalance < amount) {
                    return reply(`⚠️ Kuɗin Wallet ɗinka bai isa ba! Balance: ₦${currentBalance.toLocaleString()}.\n\n(Tura '0' don babban menu)`, 'IDLE', {});
                }

                return reply(
                    `📋 *Tabbatar da Siyan Katin Wuta:*\n\n• Meter: *${sessionData.meter_no}*\n• Kuɗi: *₦${amount.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don biya:\n_(Ko tura '0' don sokewa)_`,
                    'ELECTRICITY_CONFIRM_PIN',
                    { ...sessionData, amount: amount }
                );
            }

            if (currentStep === 'ELECTRICITY_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    return reply(`❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`, 'ELECTRICITY_CONFIRM_PIN', sessionData);
                }

                await sendWhatsAppMessage(senderPhone, `⏳ Ana sarrafa Token ɗin wutar lantarki, da fatan a ɗan jira...`, phoneNumberId, accessToken);

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
                        const token = data.token || data.meter_token || data.mainToken || "Token ya tafi cikin nasara";
                        return reply(`✅ *Katin Wuta Ya Yi Nasara!* 🎉\n\n⚡ Token: *${token}*\n🔢 Meter: *${sessionData.meter_no}*\n💰 Kuɗi: *₦${Number(sessionData.amount).toLocaleString()}*\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    } else {
                        return reply(`❌ *Ba a samu nasara ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    }
                } catch (_) {
                    return reply(`❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`, 'IDLE', {});
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
                    return reply(`❌ Zaɓi 1 na DSTV, 2 na GOTV, ko 3 na STARTIMES (ko '0' don sokewa):`, 'CABLE_SELECT_PROVIDER');
                }

                return reply(
                    `📺 Sanya lambar IUC / SmartCard na *${prov.name}*:\n_(Misali: 2012345678)_`,
                    'CABLE_ENTER_SMARTCARD',
                    { provider: prov }
                );
            }

            if (currentStep === 'CABLE_ENTER_SMARTCARD') {
                const smartCard = text.replace(/\D/g, '');
                if (smartCard.length < 8) {
                    return reply(`❌ Lambar SmartCard ba ta da inganci. Sake gwadawa (ko tura '0' don sokewa):`, 'CABLE_ENTER_SMARTCARD', sessionData);
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

                let pkgList = `📦 *Zaɓi Package na ${sessionData.provider.name}:*\n`;
                packages.forEach((pkg, idx) => {
                    pkgList += `\n${idx + 1}️⃣ ${pkg.name} - *₦${pkg.price.toLocaleString()}*`;
                });
                pkgList += `\n\n(Tura lambar package ɗin da kake so, ko '0' don sokewa)`;

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
                    return reply(`❌ Zaɓi lamba daga 1 zuwa ${packages.length} (ko tura '0' don sokewa):`, 'CABLE_SELECT_PACKAGE', sessionData);
                }

                const selectedPkg = packages[pkgIndex];
                if (currentBalance < selectedPkg.price) {
                    return reply(`⚠️ Kuɗin Wallet ɗinka bai isa ba! Farashi: ₦${selectedPkg.price.toLocaleString()}, Balance ɗinka: ₦${currentBalance.toLocaleString()}.\n\n(Tura '0' don babban menu)`, 'IDLE', {});
                }

                return reply(
                    `📋 *Tabbatar da Biyan Cable TV:*\n\n• Mai Ba Da Sabis: *${sessionData.provider.name}*\n• SmartCard/IUC: *${sessionData.smart_card}*\n• Package: *${selectedPkg.name}*\n• Kuɗi: *₦${selectedPkg.price.toLocaleString()}*\n\n🔐 Sanya *Transaction PIN* ɗinka mai lamba 4 don tabbatarwa:\n_(Ko tura '0' don sokewa)_`,
                    'CABLE_CONFIRM_PIN',
                    { ...sessionData, selected_pkg: selectedPkg }
                );
            }

            if (currentStep === 'CABLE_CONFIRM_PIN') {
                if (!profile.transaction_pin || profile.transaction_pin !== text.trim()) {
                    return reply(`❌ Transaction PIN ba daidai ba ne! Sake gwadawa (ko tura '0' don sokewa):`, 'CABLE_CONFIRM_PIN', sessionData);
                }

                const pkg = sessionData.selected_pkg;
                await sendWhatsAppMessage(senderPhone, `⏳ Ana kunna sub ɗinka na ${sessionData.provider.name}, da fatan a ɗan jira...`, phoneNumberId, accessToken);

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
                        return reply(`✅ *Biyan Cable TV Ya Yi Nasara!* 🎉\n\n📺 TV: *${sessionData.provider.name}*\n📦 Package: *${pkg.name}*\n🔢 SmartCard: *${sessionData.smart_card}*\n💰 Kuɗi: *₦${Number(pkg.price).toLocaleString()}*\n\n_Mun gode da amfani da Abu Mafhal Sub!_\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    } else {
                        return reply(`❌ *Ba a samu nasara ba:*\n${data.error || "An samu matsala"}\n\n(Tura '0' don komawa babban menu)`, 'IDLE', {});
                    }
                } catch (_) {
                    return reply(`❌ An samu matsalar sadarwa. Da fatan a sake gwadawa anjima.`, 'IDLE', {});
                }
            }

            // Fallback for unhandled input: return to main menu
            return reply(`🌟 *Abu Mafhal Sub WhatsApp Bot*\n\nBa a gane wannan zaɓin ba. Da fatan ka tura '0' ko 'menu' don ganin dukkan hidimominmu.`, 'IDLE');

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
