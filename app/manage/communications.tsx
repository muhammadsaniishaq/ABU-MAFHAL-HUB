import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';


// import * as Notifications from 'expo-notifications'; // Removed due to Expo Go SDK 53 limitations

// MOCK CONSTANTS (Kept for quick fill, but sending is real)
const TEMPLATES = {
    email: [
        { id: 'welcome', title: 'Welcome Series', subject: 'Welcome to Abu Mafhal Sub! 🚀', body: 'Hi {{name}},\n\nWelcome to the future of finance. We are excited to have you on board.' },
        { id: 'kyc_reminder', title: 'KYC Reminder', subject: 'Action Required: Verify Identity', body: 'Hello {{name}},\n\nPlease complete your KYC verification to unlock higher limits.' },
        { id: 'promo', title: 'Season Promo', subject: 'Special Offer Just for You!', body: 'Hi {{name}},\n\nEnjoy 5% cashback on all airtime purchases this weekend!' }
    ],
    sms: [
        { id: 'security', title: 'Security Alert', body: 'Security: New login detected on your account. If this wasn\'t you, contact support immediately.' },
        { id: 'otp', title: 'OTP Code', body: 'Your verification code is: {{otp}}. Do not share this.' }
    ],
    push: [
        { id: 'maintenance', title: 'System Maint.', body: '⚠️ System maintenance scheduled for 2 AM tonight.' },
        { id: 'balance', title: 'Low Balance', body: 'Your balance is running low. Top up now to stay connected.' }
    ]
};

export default function CommunicationManager() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'email' | 'sms' | 'push'>('email');
    const [recipientMode, setRecipientMode] = useState<'single' | 'all' | 'admins'>('single');
    
    // Form State
    const [recipientInput, setRecipientInput] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [actionRoute, setActionRoute] = useState('');
    
    // UI State
    const [sending, setSending] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('communication_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (data) {
            // Map DB structure to UI structure
            const mapped = data.map(log => ({
                id: log.id,
                type: log.channel,
                recipient: log.recipient,
                subject: log.subject,
                body: log.content,
                status: log.status, // e.g. 'sent'
                priority: log.metadata?.priority === true, // Check metadata
                timestamp: new Date(log.created_at)
            }));
            setHistory(mapped);
        }
    };

    // Enhanced State
    const [isScheduled, setIsScheduled] = useState(false);
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // --- ACTIONS ---

    const handleSend = async () => {
        if (!body || (activeTab === 'email' && !subject)) {
            Alert.alert("Missing Content", "Please fill in all required fields.");
            return;
        }
        if (recipientMode === 'single' && !recipientInput) {
            Alert.alert("Missing Recipient", "Please specify a user ID or Email.");
            return;
        }

        setSending(true);

        try {
            // 1. Prepare Payload
            const payload: any = {
                type: activeTab,
                recipient_mode: recipientMode,
                recipient: recipientInput,
                subject: activeTab === 'email' ? subject : undefined,
                body: body,
                priority: isHighPriority ? 'high' : 'normal',
                scheduled_for: isScheduled ? new Date(Date.now() + 86400000).toISOString() : undefined 
            };

            // 2. PRIMARY: Direct DB Insert for Push (Reliable for Expo Go / Realtime)
            if (activeTab === 'push' && !isScheduled) {
                let targetUserIds: string[] = [];

                if (recipientMode === 'single') {
                    // Try to resolve email/phone to ID if needed, or assume input IS the ID
                    if (recipientInput.includes('@')) {
                         const { data: users } = await supabase.from('profiles').select('id').eq('email', recipientInput).single();
                         if (users) targetUserIds = [users.id];
                    } else if (/^\d+$/.test(recipientInput) || recipientInput.startsWith('+')) {
                        // Looks like a phone number?
                        const { data: users } = await supabase.from('profiles').select('id').eq('phone', recipientInput).single();
                         if (users) targetUserIds = [users.id];
                    } else if (recipientInput.length === 36) {
                        // Assume it's a UUID
                        targetUserIds = [recipientInput];
                    } else {
                        // Fallback or error - prevent inserting garbage that crashes UUID type
                        console.warn("Invalid recipient format ignored:", recipientInput);
                    }
                } else if (recipientMode === 'all') {
                    // Fetch ALL user IDs (LIMIT to 500 for safety in this demo)
                    const { data: users } = await supabase.from('profiles').select('id').limit(500);
                     if (users) targetUserIds = users.map(u => u.id);
                } else if (recipientMode === 'admins') {
                    const { data: users } = await supabase.from('profiles').select('id').in('role', ['admin', 'super_admin']);
                    if (users) targetUserIds = users.map(u => u.id);
                }

                if (targetUserIds.length > 0) {
                     const notificationsToInsert = targetUserIds.map(id => ({
                        user_id: id,
                        title: subject || 'New Message',
                        body: body,
                        data: { priority: isHighPriority ? 'high' : 'normal', route: actionRoute || undefined },
                        created_at: new Date().toISOString()
                     }));

                     const { error: pushError } = await supabase.from('notifications').insert(notificationsToInsert);
                     if (pushError) console.error("Direct Push Insert Error:", pushError);
                     else {
                         console.log(`Directly inserted ${notificationsToInsert.length} notifications.`);
                         
                         // Fix: Log to communication_logs MANUALLY since we bypassed the Edge Function
                         await supabase.from('communication_logs').insert({
                            channel: 'push',
                            recipient: recipientMode === 'single' ? recipientInput : recipientMode,
                            subject: subject,
                            content: body,
                            status: 'sent',
                            metadata: { priority: isHighPriority }
                        });
                     }
                }
            }


            // 3. Fallback/Secondary: Edge Function Call (Good for Emails/SMS/Remote Push)
            // We still call this because it handles Email/SMS sending via 3rd party APIs
            if (activeTab !== 'push' || isScheduled) { // Skip for immediate push since we did it above
                const { data, error } = await supabase.functions.invoke('send-communication', {
                    body: payload
                });

                if (error) {
                    console.warn("Edge Function failed, logging to DB...", error);
                    // Log to communication_logs so history is preserved
                     await supabase.from('communication_logs').insert({
                        channel: activeTab,
                        recipient: recipientMode === 'single' ? recipientInput : recipientMode,
                        subject: subject,
                        content: body,
                        status: isScheduled ? 'scheduled' : 'sent',
                        metadata: { priority: isHighPriority, formatted_html: payload.body }
                    });
                }
            }

            // 4. Update UI History
            const newLog = {
                id: Date.now().toString(),
                type: activeTab,
                recipient: recipientMode === 'all' ? 'All Users' : (recipientMode === 'admins' ? 'All Admins' : recipientInput),
                subject: activeTab === 'email' ? subject : '(No Subject)',
                body: body,
                status: isScheduled ? 'Scheduled' : 'Sent',
                priority: isHighPriority,
                timestamp: new Date()
            };
            setHistory([newLog, ...history]);
            
            Alert.alert("Success", activeTab.toUpperCase() + (isScheduled ? " scheduled!" : " sent successfully!"));
            
            // Reset
            setBody('');
            setSubject('');
            setActionRoute('');
            setIsScheduled(false);
            setIsHighPriority(false);

        } catch (e: any) {
            Alert.alert("Delivery Failed", e.message || "Unknown error occurred.");
        } finally {
            setSending(false);
        }
    };

    const generateWithAi = async () => {
        if (!aiPrompt) return;
        setAiGenerating(true);
        
        // Mock AI Generation - In production this would call an Edge Function wrapping OpenAI
        setTimeout(() => {
            let generated = "";
            if (activeTab === 'email') {
                generated = `Dear User,\n\nBased on your request regarding "${aiPrompt}", we are pleased to inform you that we have updated our policies to better serve you.\n\nThank you for choosing us.\n\nBest,\nAdmin Team`;
            } else {
                generated = `Alert: Regarding ${aiPrompt}. Please check your dashboard for details. Thank you.`;
            }
            
            setBody(generated);
            setAiGenerating(false);
            setShowAiModal(false);
            setAiPrompt('');
        }, 2000);
    };

    const applyTemplate = (tmpl: any) => {
        if (tmpl.subject) setSubject(tmpl.subject);
        setBody(tmpl.body);
    };

    // --- RENDERERS ---

    const renderTabs = () => (
        <View className="flex-row bg-[#f8fafc] border border-slate-200 p-1 rounded-xl mb-4 shadow-sm">
            <TouchableOpacity 
                onPress={() => setActiveTab('email')}
                className={`flex-1 py-1.5 items-center rounded-lg ${activeTab === 'email' ? 'bg-[#0d1b3e] shadow-sm' : ''}`}
            >
                <Text className={`font-bold capitalize text-[11px] ${activeTab === 'email' ? 'text-[#f5a623]' : 'text-slate-500'}`}>Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                onPress={() => setActiveTab('sms')}
                className={`flex-1 py-1.5 items-center rounded-lg ${activeTab === 'sms' ? 'bg-[#0d1b3e] shadow-sm' : ''}`}
            >
                <Text className={`font-bold capitalize text-[11px] ${activeTab === 'sms' ? 'text-[#f5a623]' : 'text-slate-500'}`}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => setActiveTab('push')}
                className={`flex-1 py-1.5 items-center rounded-lg ${activeTab === 'push' ? 'bg-[#0d1b3e] shadow-sm' : ''}`}
            >
                <Text className={`font-bold capitalize text-[11px] ${activeTab === 'push' ? 'text-[#f5a623]' : 'text-slate-500'}`}>Push</Text>
            </TouchableOpacity>
        </View>
    );

    const renderRecipientSelector = () => (
        <View className="mb-4 z-10">
            <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1.5">To Recipient(s)</Text>
            <View className="flex-row gap-1.5 mb-1.5">
                {[
                    { id: 'single', label: 'Single', icon: 'person' },
                    { id: 'all', label: 'All', icon: 'people' },
                    { id: 'admins', label: 'Admins', icon: 'shield' }
                ].map((mode: any) => (
                    <TouchableOpacity 
                        key={mode.id}
                        onPress={() => setRecipientMode(mode.id)}
                        className={`flex-1 flex-row items-center justify-center py-1.5 rounded-lg border ${recipientMode === mode.id ? 'bg-[#f5a623]/10 border-[#f5a623]' : 'bg-white border-slate-200'}`}
                    >
                        <Ionicons name={mode.icon} size={12} color={recipientMode === mode.id ? '#d4890e' : '#64748B'} />
                        <Text className={`ml-1 text-[10px] font-bold ${recipientMode === mode.id ? 'text-[#0d1b3e]' : 'text-slate-600'}`}>{mode.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {recipientMode === 'single' && (
                <TextInput 
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-xs shadow-sm"
                    placeholder={activeTab === 'email' ? "Enter email address..." : "Enter Phone or User ID..."}
                    value={recipientInput}
                    onChangeText={setRecipientInput}
                />
            )}
        </View>
    );

    const renderAiModal = () => (
        <Modal visible={showAiModal} transparent animationType="fade" onRequestClose={() => setShowAiModal(false)}>
            <BlurView intensity={90} tint="dark" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
                <View className="bg-white rounded-2xl p-5 shadow-2xl border border-[#f5a623]">
                    <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center gap-2">
                            <LinearGradient colors={['#f5a623', '#d4890e']} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="sparkles" size={14} color="#0d1b3e" />
                            </LinearGradient>
                            <Text className="text-base font-black text-[#0d1b3e]">Cortex AI Writer</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowAiModal(false)}>
                            <Ionicons name="close" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                    
                    <Text className="text-slate-500 text-xs mb-3">Tell Cortex what you want to communicate, and it will draft a professional message for you.</Text>
                    
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[80px] text-slate-800 mb-3 text-xs"
                        placeholder="e.g. Write a polite apology for the server downtime yesterday..."
                        multiline
                        textAlignVertical="top"
                        value={aiPrompt}
                        onChangeText={setAiPrompt}
                    />

                    <TouchableOpacity 
                        onPress={generateWithAi}
                        disabled={aiGenerating || !aiPrompt}
                        className={`py-3 rounded-xl items-center flex-row justify-center gap-2 ${aiGenerating ? 'bg-[#0d1b3e]/70' : 'bg-[#0d1b3e]'}`}
                    >
                        {aiGenerating ? (
                            <ActivityIndicator color="#f5a623" />
                        ) : (
                            <>
                                <Ionicons name="flash" size={16} color="#f5a623" />
                                <Text className="text-[#f5a623] font-bold text-sm">Generate Draft</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Modal>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Premium Header - Navy & Gold */}
            <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, zIndex: 10 }}>
                <SafeAreaView edges={['top']}>
                    <View className="flex-row items-center px-4 pt-2 mb-2">
                        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 rounded-full bg-white/10 items-center justify-center border border-[#f5a623]/30">
                            <Ionicons name="arrow-back" size={16} color="#f5a623" />
                        </TouchableOpacity>
                        <View className="flex-1 items-center">
                            <Text className="text-white font-bold text-base">Comms Center</Text>
                            <Text className="text-[#f5a623] text-[10px] mt-0.5">Engage Users</Text>
                        </View>
                        <View className="w-8" />
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 150 }}>
                {renderTabs()}
                
                {renderRecipientSelector()}

                {/* Templates Quick Bar */}
                <View className="mb-4">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1.5">Quick Templates</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {(TEMPLATES[activeTab] || []).map((tmpl: any) => (
                            <TouchableOpacity 
                                key={tmpl.id} 
                                onPress={() => applyTemplate(tmpl)}
                                className="mr-2 bg-white border border-[#f5a623]/50 px-3 py-1.5 rounded-full shadow-sm"
                            >
                                <Text className="text-[#0d1b3e] text-[10px] font-bold">{tmpl.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View className="flex-row justify-between mb-4 gap-2">
                    {/* Scheduling */}
                    <View className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl shadow-sm">
                        <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-slate-500 text-[10px] font-bold uppercase">Schedule</Text>
                            <Switch value={isScheduled} onValueChange={setIsScheduled} trackColor={{false: '#E2E8F0', true: '#f5a623'}} thumbColor={isScheduled ? '#0d1b3e' : '#f8fafc'} />
                        </View>
                        {isScheduled ? (
                            <TouchableOpacity className="bg-[#f5a623]/10 p-1.5 rounded-lg items-center border border-[#f5a623]/30">
                                <Text className="text-[#0d1b3e] text-[10px] font-bold">Tomorrow, 9:00 AM</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text className="text-slate-400 text-[10px] italic">Send immediately</Text>
                        )}
                    </View>

                    {/* Priority */}
                    <View className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl shadow-sm">
                        <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-slate-500 text-[10px] font-bold uppercase">Priority</Text>
                            <Switch value={isHighPriority} onValueChange={setIsHighPriority} trackColor={{false: '#E2E8F0', true: '#EF4444'}} />
                        </View>
                        <View className="flex-row items-center gap-1">
                            {isHighPriority && <Ionicons name="alert-circle" size={12} color="#EF4444" />}
                            <Text className={`text-[10px] font-bold ${isHighPriority ? 'text-red-500' : 'text-slate-400 italic'}`}>
                                {isHighPriority ? 'High Importance' : 'Normal'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Editor */}
                <View className="bg-white rounded-xl p-3 border border-[#0d1b3e]/10 mb-6 shadow-sm">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-[#0d1b3e] font-bold text-sm">Message Content</Text>
                        <TouchableOpacity 
                            onPress={() => setShowAiModal(true)}
                            className="bg-[#f5a623]/10 px-2.5 py-1 rounded-lg border border-[#f5a623]/30 flex-row items-center gap-1 shadow-sm"
                        >
                            <Ionicons name="sparkles" size={12} color="#0d1b3e" />
                            <Text className="text-[#0d1b3e] font-bold text-[10px]">AI Drafter</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'email' && (
                        <View className="mb-3">
                            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1 ml-1">Subject Line</Text>
                            <TextInput 
                                className="bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-[#0d1b3e] font-bold text-xs shadow-sm"
                                placeholder="Compelling subject..."
                                value={subject}
                                onChangeText={setSubject}
                            />
                        </View>
                    )}

                    <View>
                        <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1 ml-1">Message Body</Text>
                        <TextInput 
                            className="bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-[#0d1b3e] min-h-[100px] text-xs shadow-sm"
                            placeholder={`Type your ${activeTab} content here...`}
                            multiline
                            textAlignVertical="top"
                            value={body}
                            onChangeText={setBody}
                        />
                    </View>

                    {activeTab === 'push' && (
                        <View className="mt-3">
                            <Text className="text-slate-400 text-[10px] font-bold uppercase mb-1 ml-1">Action Route (Optional)</Text>
                            <View className="flex-row gap-1">
                                <TextInput 
                                    className="flex-1 bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-[#0d1b3e] text-xs shadow-sm"
                                    placeholder="e.g. /transfer"
                                    value={actionRoute}
                                    onChangeText={setActionRoute}
                                />
                                {/* New Feature: Quick Routes */}
                                <TouchableOpacity 
                                    onPress={() => setActionRoute('/wallet')}
                                    className="bg-[#0d1b3e] px-2 py-2 rounded-lg items-center justify-center shadow-sm"
                                >
                                    <Text className="text-[#f5a623] text-[9px] font-bold uppercase">Wallet</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                <View className="flex-row gap-3 mb-6">
                    <TouchableOpacity 
                        onPress={() => setShowPreview(true)}
                        className="flex-1 py-3 rounded-xl items-center border border-[#0d1b3e]/30 bg-white shadow-sm"
                    >
                        <Text className="text-[#0d1b3e] font-bold text-sm">Preview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleSend}
                        disabled={sending}
                        className={`flex-[2] py-3 rounded-xl items-center shadow-md ${sending ? 'bg-[#0d1b3e]/70' : 'bg-[#0d1b3e]'}`}
                    >
                        {sending ? (
                            <ActivityIndicator color="#f5a623" />
                        ) : (
                            <View className="flex-row items-center gap-1.5">
                                <Ionicons name={isScheduled ? "calendar" : "paper-plane"} size={16} color="#f5a623" />
                                <Text className="text-[#f5a623] font-bold text-sm">
                                    {isScheduled ? 'Schedule Send' : `Send ${activeTab === 'email' ? 'Email' : 'Message'}`}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* History Section - Enhanced */}
                <View className="mb-6">
                    <Text className="text-[#0d1b3e] font-bold text-sm mb-3">Live Activity Logs</Text>
                    {history.length === 0 ? (
                        <View className="items-center py-6 bg-white/50 rounded-xl border border-dashed border-slate-300">
                            <Ionicons name="documents-outline" size={32} color="#CBD5E1" />
                            <Text className="text-slate-400 mt-2 text-[10px] font-medium">No recent logs</Text>
                        </View>
                    ) : (
                        history.map((log) => (
                            <View key={log.id} className="bg-white p-3 rounded-xl border border-slate-200 mb-2 flex-row items-center justify-between shadow-sm">
                                <View className="flex-row items-center gap-2 flex-1">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${
                                        log.type === 'email' ? 'bg-[#0d1b3e]/10' : (log.type === 'sms' ? 'bg-[#f5a623]/20' : 'bg-slate-100')
                                    }`}>
                                        <Ionicons name={
                                            log.type === 'email' ? 'mail' : (log.type === 'sms' ? 'chatbubble' : 'notifications')
                                        } size={14} color={
                                            log.type === 'email' ? '#0d1b3e' : (log.type === 'sms' ? '#d4890e' : '#64748B')
                                        } />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-1.5">
                                            <Text className="font-bold text-[#0d1b3e] text-xs" numberOfLines={1}>{log.subject}</Text>
                                            {log.priority && <Ionicons name="alert-circle" size={10} color="#EF4444" />}
                                        </View>
                                        <Text className="text-[9px] text-slate-400">To: {log.recipient}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <View className={`px-1.5 py-0.5 rounded mb-0.5 ${
                                        log.status === 'Scheduled' ? 'bg-[#f5a623]/20' : 'bg-green-100'
                                    }`}>
                                        <Text className={`text-[8px] font-bold ${
                                            log.status === 'Scheduled' ? 'text-[#d4890e]' : 'text-green-700'
                                        }`}>{log.status.toUpperCase()}</Text>
                                    </View>
                                    <Text className="text-[8px] text-slate-400">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>

            {renderAiModal()}
            
            {/* Preview Modal */}
            <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
                 <BlurView intensity={90} tint="dark" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
                    <View className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#f5a623]">
                        <View className="bg-[#0d1b3e] p-3 flex-row justify-between items-center">
                            <Text className="text-[#f5a623] font-bold text-sm">Message Preview</Text>
                            <TouchableOpacity onPress={() => setShowPreview(false)}>
                                <Ionicons name="close-circle" size={20} color="#f5a623" />
                            </TouchableOpacity>
                        </View>
                        <View className="p-4">
                            {isHighPriority && (
                                <View className="bg-red-50 border border-red-100 p-2 rounded-lg flex-row items-center gap-2 mb-3">
                                    <Ionicons name="alert-circle" size={14} color="#EF4444" />
                                    <Text className="text-red-700 font-bold text-[10px]">High Priority Dispatch</Text>
                                </View>
                            )}
                            
                            <View className="mb-3">
                                <Text className="text-slate-400 text-[10px] uppercase font-bold">Channel</Text>
                                <Text className="text-[#0d1b3e] font-bold capitalize text-xs">{activeTab}</Text>
                            </View>

                            {activeTab === 'email' && (
                                <View className="mb-3">
                                    <Text className="text-slate-400 text-[10px] uppercase font-bold">Subject</Text>
                                    <Text className="text-[#0d1b3e] text-sm font-bold leading-5">{subject || '(No Subject)'}</Text>
                                </View>
                            )}

                            <View className="bg-[#f8fafc] p-3 rounded-xl border border-slate-200 min-h-[80px]">
                                <Text className="text-slate-700 leading-4 text-xs">{body || '(Empty Body)'}</Text>
                            </View>
                            
                            {isScheduled && (
                                <View className="mt-3 flex-row items-center gap-2 bg-[#f5a623]/10 p-2 rounded-xl border border-[#f5a623]/30">
                                    <Ionicons name="time" size={14} color="#0d1b3e" />
                                    <Text className="text-[#0d1b3e] text-[10px] font-bold">Scheduled Delivery: Tomorrow, 9:00 AM</Text>
                                </View>
                            )}

                            <TouchableOpacity 
                                onPress={() => setShowPreview(false)}
                                className="mt-4 bg-slate-100 py-2.5 rounded-xl items-center border border-slate-200"
                            >
                                <Text className="text-slate-600 font-bold text-xs">Close Preview</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                 </BlurView>
            </Modal>
        </View>
    );
}
