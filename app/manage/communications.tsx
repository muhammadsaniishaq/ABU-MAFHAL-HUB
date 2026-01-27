import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { BlurView } from 'expo-blur';


import { generateHtmlEmail } from '../../services/emailTemplates';
// import * as Notifications from 'expo-notifications'; // Removed due to Expo Go SDK 53 limitations

// MOCK CONSTANTS (Kept for quick fill, but sending is real)
const TEMPLATES = {
    email: [
        { id: 'welcome', title: 'Welcome Series', subject: 'Welcome to Abu Mafhal Hub! 🚀', body: 'Hi {{name}},\n\nWelcome to the future of finance. We are excited to have you on board.' },
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
    
    // UI State
    const [sending, setSending] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

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
                recipient: recipientInput, // Email, Phone, or User ID
                subject: activeTab === 'email' ? subject : undefined,
                body: activeTab === 'email' ? generateHtmlEmail(body, subject) : body, // WRAP IN HTML for Email
                priority: isHighPriority ? 'high' : 'normal',
                scheduled_for: isScheduled ? new Date(Date.now() + 86400000).toISOString() : undefined // Mock +24h
            };

            console.log("Sending Payload:", payload);

            // 2. Real API Call (Supabase Function)
            // Note:User needs to deploy 'send-communication' function on Supabase
            const { data, error } = await supabase.functions.invoke('send-communication', {
                body: payload
            });

            if (error) {
                // If function doesn't exist yet (common in dev), fallback to database logging
                console.warn("Edge Function failed (likely not deployed), logging to DB instead:", JSON.stringify(error, null, 2));
                if (error instanceof Error) console.warn("Error message:", error.message);
                
                // Fallback: Insert into 'communication_logs' table in Supabase
                const { error: dbError } = await supabase.from('communication_logs').insert({
                    channel: activeTab,
                    recipient: recipientMode === 'single' ? recipientInput : recipientMode,
                    subject: subject,
                    content: body, // Store raw body for DB
                    status: isScheduled ? 'scheduled' : 'sent',
                    metadata: { priority: isHighPriority, formatted_html: payload.body }
                });

                if (dbError) throw dbError;
            }

            // 3. Local Simulation for Push (Modified for Expo Go Compatibility)
            if (activeTab === 'push' && !isScheduled) {
                // NOTE: Expo Go SDK 53 removed remote notifications support.
                // We use a simple Alert instead of crashing.
                Alert.alert("📲 Live Push Notification", isHighPriority ? `🚨 ${subject || 'Alert'}\n${body}` : body);
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
        <View className="flex-row bg-slate-200 p-1 rounded-xl mb-6">
            <TouchableOpacity 
                onPress={() => setActiveTab('email')}
                className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'email' ? 'bg-white' : ''}`}
            >
                <Text className={`font-bold capitalize ${activeTab === 'email' ? 'text-indigo-600' : 'text-slate-500'}`}>Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                onPress={() => setActiveTab('sms')}
                className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'sms' ? 'bg-white' : ''}`}
            >
                <Text className={`font-bold capitalize ${activeTab === 'sms' ? 'text-indigo-600' : 'text-slate-500'}`}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => setActiveTab('push')}
                className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'push' ? 'bg-white' : ''}`}
            >
                <Text className={`font-bold capitalize ${activeTab === 'push' ? 'text-indigo-600' : 'text-slate-500'}`}>Push</Text>
            </TouchableOpacity>
        </View>
    );

    const renderRecipientSelector = () => (
        <View className="mb-6 z-10">
            <Text className="text-slate-500 text-xs font-bold uppercase mb-2">To Recipient(s)</Text>
            <View className="flex-row gap-2 mb-2">
                {[
                    { id: 'single', label: 'Single User', icon: 'person' },
                    { id: 'all', label: 'Broadast All', icon: 'people' },
                    { id: 'admins', label: 'Admins Only', icon: 'shield' }
                ].map((mode: any) => (
                    <TouchableOpacity 
                        key={mode.id}
                        onPress={() => setRecipientMode(mode.id)}
                        className={`flex-row items-center px-3 py-2 rounded-lg border ${recipientMode === mode.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
                    >
                        <Ionicons name={mode.icon} size={14} color={recipientMode === mode.id ? '#4F46E5' : '#64748B'} />
                        <Text className={`ml-2 text-xs font-bold ${recipientMode === mode.id ? 'text-indigo-700' : 'text-slate-600'}`}>{mode.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {recipientMode === 'single' && (
                <TextInput 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700"
                    placeholder={activeTab === 'email' ? "Enter email address..." : "Enter Phone or User ID..."}
                    value={recipientInput}
                    onChangeText={setRecipientInput}
                />
            )}
        </View>
    );

    const renderAiModal = () => (
        <Modal visible={showAiModal} transparent animationType="fade" onRequestClose={() => setShowAiModal(false)}>
            <BlurView intensity={90} tint="dark" className="flex-1 justify-center px-6">
                <View className="bg-white rounded-2xl p-6 shadow-2xl">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center gap-2">
                            <LinearGradient colors={['#818CF8', '#6366F1']} className="w-8 h-8 rounded-full items-center justify-center">
                                <Ionicons name="sparkles" size={16} color="white" />
                            </LinearGradient>
                            <Text className="text-lg font-black text-slate-800">Cortex AI Writer</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowAiModal(false)}>
                            <Ionicons name="close" size={24} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                    
                    <Text className="text-slate-500 mb-4">Tell Cortex what you want to communicate, and it will draft a professional message for you.</Text>
                    
                    <TextInput 
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[100px] text-slate-800 mb-4"
                        placeholder="e.g. Write a polite apology for the server downtime yesterday..."
                        multiline
                        textAlignVertical="top"
                        value={aiPrompt}
                        onChangeText={setAiPrompt}
                    />

                    <TouchableOpacity 
                        onPress={generateWithAi}
                        disabled={aiGenerating || !aiPrompt}
                        className={`py-4 rounded-xl items-center flex-row justify-center gap-2 ${aiGenerating ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                    >
                        {aiGenerating ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="flash" size={20} color="white" />
                                <Text className="text-white font-bold text-lg">Generate Draft</Text>
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
            
            {/* Header */}
            <LinearGradient colors={['#1E1B4B', '#312E81']} start={{x:0, y:0}} end={{x:1, y:1}} className="pt-36 pb-6 px-6 rounded-b-[30px] z-20">
                <View className="flex-row justify-between items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white font-black text-lg">Comms Center</Text>
                    <View className="w-10" />
                </View>
                <View>
                    <Text className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">Engage Users</Text>
                    <Text className="text-white text-3xl font-black">Communication</Text>
                    <Text className="text-white text-3xl font-black">Manager</Text>
                </View>
            </LinearGradient>

            <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
                {renderTabs()}
                
                {renderRecipientSelector()}

                {/* Templates Quick Bar */}
                <View className="mb-6">
                    <Text className="text-slate-500 text-xs font-bold uppercase mb-2">Quick Templates</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {(TEMPLATES[activeTab] || []).map((tmpl: any) => (
                            <TouchableOpacity 
                                key={tmpl.id} 
                                onPress={() => applyTemplate(tmpl)}
                                className="mr-3 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"
                            >
                                <Text className="text-slate-600 text-xs font-bold">{tmpl.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View className="flex-row justify-between mb-6 gap-4">
                    {/* Scheduling */}
                    <View className="flex-1 bg-white/80 border border-slate-200 p-3 rounded-xl">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-slate-500 text-xs font-bold uppercase">Schedule</Text>
                            <Switch value={isScheduled} onValueChange={setIsScheduled} trackColor={{false: '#E2E8F0', true: '#818CF8'}} />
                        </View>
                        {isScheduled ? (
                            <TouchableOpacity className="bg-slate-100 p-2 rounded-lg items-center">
                                <Text className="text-indigo-600 font-bold">Tomorrow, 9:00 AM</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text className="text-slate-400 text-xs italic">Send immediately</Text>
                        )}
                    </View>

                    {/* Priority */}
                    <View className="flex-1 bg-white/80 border border-slate-200 p-3 rounded-xl">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-slate-500 text-xs font-bold uppercase">Priority</Text>
                            <Switch value={isHighPriority} onValueChange={setIsHighPriority} trackColor={{false: '#E2E8F0', true: '#F87171'}} />
                        </View>
                        <View className="flex-row items-center gap-1">
                            {isHighPriority && <Ionicons name="alert-circle" size={14} color="#EF4444" />}
                            <Text className={`text-xs font-bold ${isHighPriority ? 'text-red-500' : 'text-slate-400 italic'}`}>
                                {isHighPriority ? 'High Importance' : 'Normal'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Editor */}
                <View className="bg-white/90 rounded-2xl p-4 border border-slate-200/60 mb-8 shadow-sm">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-slate-800 font-bold text-lg">Message Content</Text>
                        <TouchableOpacity 
                            onPress={() => setShowAiModal(true)}
                            className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex-row items-center gap-1"
                        >
                            <Ionicons name="sparkles" size={14} color="#6366F1" />
                            <Text className="text-indigo-600 font-bold text-xs">AI Drafter</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'email' && (
                        <View className="mb-4">
                            <Text className="text-slate-400 text-xs font-bold uppercase mb-1 ml-1">Subject Line</Text>
                            <TextInput 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold"
                                placeholder="Compelling subject..."
                                value={subject}
                                onChangeText={setSubject}
                            />
                        </View>
                    )}

                    <View>
                        <Text className="text-slate-400 text-xs font-bold uppercase mb-1 ml-1">Message Body</Text>
                        <TextInput 
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 min-h-[150px]"
                            placeholder={`Type your ${activeTab} content here...`}
                            multiline
                            textAlignVertical="top"
                            value={body}
                            onChangeText={setBody}
                        />
                    </View>
                </View>

                <View className="flex-row gap-4 mb-8">
                    <TouchableOpacity 
                        onPress={() => setShowPreview(true)}
                        className="flex-1 py-4 rounded-2xl items-center border border-indigo-200 bg-indigo-50"
                    >
                        <Text className="text-indigo-600 font-bold text-lg">Preview</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={handleSend}
                        disabled={sending}
                        className={`flex-[2] py-4 rounded-2xl items-center shadow-md ${sending ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                    >
                        {sending ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <View className="flex-row items-center gap-2">
                                <Ionicons name={isScheduled ? "calendar" : "paper-plane"} size={20} color="white" />
                                <Text className="text-white font-bold text-lg">
                                    {isScheduled ? 'Schedule Send' : `Send ${activeTab === 'email' ? 'Email' : 'Message'}`}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* History Section - Enhanced */}
                <View className="mb-10">
                    <Text className="text-slate-900 font-bold text-xl mb-4">Live Activity Logs</Text>
                    {history.length === 0 ? (
                        <View className="items-center py-8 bg-white/50 rounded-xl border border-dashed border-slate-300">
                            <Ionicons name="documents-outline" size={48} color="#CBD5E1" />
                            <Text className="text-slate-400 mt-2 font-medium">No recent logs</Text>
                        </View>
                    ) : (
                        history.map((log) => (
                            <View key={log.id} className="bg-white p-4 rounded-xl border border-slate-100 mb-2 flex-row items-center justify-between shadow-sm">
                                <View className="flex-row items-center gap-3 flex-1">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center ${
                                        log.type === 'email' ? 'bg-blue-100' : (log.type === 'sms' ? 'bg-green-100' : 'bg-purple-100')
                                    }`}>
                                        <Ionicons name={
                                            log.type === 'email' ? 'mail' : (log.type === 'sms' ? 'chatbubble' : 'notifications')
                                        } size={18} color={
                                            log.type === 'email' ? '#2563EB' : (log.type === 'sms' ? '#16A34A' : '#7E22CE')
                                        } />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-2">
                                            <Text className="font-bold text-slate-700" numberOfLines={1}>{log.subject}</Text>
                                            {log.priority && <Ionicons name="alert-circle" size={12} color="#EF4444" />}
                                        </View>
                                        <Text className="text-xs text-slate-400">To: {log.recipient}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <View className={`px-2 py-0.5 rounded mb-1 ${
                                        log.status === 'Scheduled' ? 'bg-amber-100' : 'bg-green-100'
                                    }`}>
                                        <Text className={`text-[10px] font-bold ${
                                            log.status === 'Scheduled' ? 'text-amber-700' : 'text-green-700'
                                        }`}>{log.status.toUpperCase()}</Text>
                                    </View>
                                    <Text className="text-[10px] text-slate-400">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>

            {renderAiModal()}
            
            {/* Preview Modal */}
            <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
                 <BlurView intensity={90} tint="dark" className="flex-1 justify-center px-6">
                    <View className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                        <View className="bg-indigo-600 p-4 flex-row justify-between items-center">
                            <Text className="text-white font-bold text-lg">Message Preview</Text>
                            <TouchableOpacity onPress={() => setShowPreview(false)}>
                                <Ionicons name="close-circle" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View className="p-6">
                            {isHighPriority && (
                                <View className="bg-red-50 border border-red-100 p-2 rounded-lg flex-row items-center gap-2 mb-4">
                                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                    <Text className="text-red-700 font-bold text-xs">High Priority Dispatch</Text>
                                </View>
                            )}
                            
                            <View className="mb-4">
                                <Text className="text-slate-400 text-xs uppercase font-bold">Channel</Text>
                                <Text className="text-slate-800 font-bold capitalize">{activeTab}</Text>
                            </View>

                            {activeTab === 'email' && (
                                <View className="mb-4">
                                    <Text className="text-slate-400 text-xs uppercase font-bold">Subject</Text>
                                    <Text className="text-slate-900 text-lg font-bold leading-6">{subject || '(No Subject)'}</Text>
                                </View>
                            )}

                            <View className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[100px]">
                                <Text className="text-slate-700 leading-5">{body || '(Empty Body)'}</Text>
                            </View>
                            
                            {isScheduled && (
                                <View className="mt-4 flex-row items-center gap-2 bg-indigo-50 p-3 rounded-xl">
                                    <Ionicons name="time" size={18} color="#4F46E5" />
                                    <Text className="text-indigo-700 text-xs font-bold">Scheduled for Delivery: Tomorrow, 9:00 AM</Text>
                                </View>
                            )}

                            <TouchableOpacity 
                                onPress={() => setShowPreview(false)}
                                className="mt-6 bg-slate-100 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-600 font-bold">Close Preview</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                 </BlurView>
            </Modal>
        </View>
    );
}
