import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { supabase } from '../../services/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const BIGIHUB_API_URL = process.env.EXPO_PUBLIC_BIGIHUB_SMS_URL || 'https://api.bigisub.ng/api/v2/communications/sms/send/';

const QUICK_TEMPLATES = {
    Promotion: 'Hello {name}, enjoy 20% off on all data plans this weekend! Visit MAFHAL App now.',
    Reminder: 'Hi {name}, this is a gentle reminder to renew your subscription. Thank you!',
    Welcome: 'Welcome {name} to ABU MAFHAL! We are glad to have you on board.',
    Alert: 'URGENT: System maintenance scheduled for tonight at 12 AM. Service may be disrupted.'
};

// Premium Colors
const NAVY = '#0A192F';
const GOLD = '#D4AF37';
const LIGHT_NAVY = '#112240';
const LIGHT_GOLD = '#F3E5AB';

export default function BulkSMS() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const fetchHistory = async () => {
        const { data } = await supabase.from('audit_logs').select('*').eq('action', 'Bulk SMS Sent').order('created_at', { ascending: false }).limit(20);
        if (data) setHistory(data);
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === 'History') fetchHistory();
    };
    
    // UI State
    const [activeTab, setActiveTab] = useState('Send');
    const [deliveryTiming, setDeliveryTiming] = useState('Immediately');

    // Form State
    const [senderId, setSenderId] = useState('ABU MAFHAL');
    const [message, setMessage] = useState('');
    const [recipients, setRecipients] = useState('');

    // AI State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return Alert.alert('Notice', 'Please enter a description for the SMS.');
        
        setAiLoading(true);
        try {
            const { data: secretData } = await supabase.from('system_secrets').select('value').eq('key', 'OPENAI_API_KEY').single();
            const apiKey = secretData?.value || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

            if (!apiKey) {
                throw new Error('OpenAI API Key not found in system secrets or environment variables.');
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are an expert marketing assistant. Write a short, engaging SMS message (max 160 characters) based on the user prompt. Keep it professional but persuasive.' },
                        { role: 'user', content: aiPrompt }
                    ],
                    max_tokens: 60,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const generatedMessage = data.choices[0].message.content.trim();
                setMessage(generatedMessage);
                setShowAIModal(false);
                setAiPrompt('');
            } else {
                throw new Error(data.error?.message || 'Failed to generate message.');
            }
        } catch (error: any) {
            Alert.alert('AI Error', error.message);
        } finally {
            setAiLoading(false);
        }
    };

    const applyTemplate = (key: keyof typeof QUICK_TEMPLATES) => {
        setMessage(QUICK_TEMPLATES[key]);
    };

    const handleValidateNumbers = () => {
        if (!recipients.trim()) return Alert.alert('Notice', 'Please enter some numbers first.');
        const arr = recipients.split(/[\s,]+/).filter(n => n.trim().length > 8);
        const validCount = arr.length;
        setRecipients(arr.join(', '));
        Alert.alert('Validation Complete', `Found ${validCount} valid phone number(s).`);
    };

    const handleImportCSV = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv', '*/*'],
                copyToCacheDirectory: true
            });

            if (result.canceled === false && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                let content = '';
                
                if (Platform.OS === 'web') {
                    const res = await fetch(asset.uri);
                    content = await res.text();
                } else {
                    content = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' as any });
                }

                if (!content) {
                    Alert.alert('Error', 'File is empty or could not be read.');
                    return;
                }

                // Extract any sequence of 10 to 15 digits
                const phoneNumbers = content.match(/\b\d{10,15}\b/g);
                if (phoneNumbers && phoneNumbers.length > 0) {
                    const uniqueNumbers = Array.from(new Set(phoneNumbers));
                    setRecipients(prev => {
                        const existing = prev ? prev.trim() + (prev.trim().endsWith(',') ? ' ' : ', ') : '';
                        return existing + uniqueNumbers.join(', ');
                    });
                    Alert.alert('Success', `Imported ${uniqueNumbers.length} unique phone numbers from the file.`);
                } else {
                    Alert.alert('Notice', 'No valid phone numbers found in the selected file.');
                }
            }
        } catch (error: any) {
            console.error('Import Error:', error);
            Alert.alert('Error', 'Failed to read file: ' + error.message);
        }
    };

    const handleLoadUsers = async (type: 'all' | 'active' | 'inactive' | 'admin' | 'user') => {
        setLoading(true);
        try {
            let query = supabase.from('profiles').select('phone');
            
            if (type === 'active') query = query.eq('status', 'active');
            else if (type === 'inactive') query = query.neq('status', 'active'); // Assuming inactive includes suspended etc.
            else if (type === 'admin') query = query.eq('role', 'admin');
            else if (type === 'user') query = query.eq('role', 'user');

            const { data, error } = await query;

            if (error) throw error;
            
            const numbers = data.map(p => p.phone).filter(Boolean);
            if (numbers.length > 0) {
                setRecipients(prev => {
                    const existing = prev ? prev.trim() + (prev.trim().endsWith(',') ? ' ' : ', ') : '';
                    return existing + numbers.join(', ');
                });
                Alert.alert('Success', `Loaded ${numbers.length} phone numbers (${type.toUpperCase()}).`);
            } else {
                Alert.alert('Notice', `No phone numbers found for category: ${type}`);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const executeBigihubAPI = async () => {
        setLoading(true);
        const numbersArray = recipients.split(/[\s,]+/).map(n => n.trim()).filter(n => n.length > 8);

        try {
            const { data: secretData, error: secretError } = await supabase
                .from('system_secrets')
                .select('key, value')
                .in('key', ['BIGI_API_TOKEN', 'BIGI_API_PIN']);

            const tokenObj = secretData?.find(s => s.key === 'BIGI_API_TOKEN');
            const pinObj = secretData?.find(s => s.key === 'BIGI_API_PIN');

            if (secretError || !tokenObj?.value) {
                throw new Error('BIGI_API_TOKEN not found in API Vault.');
            }

            const payload = {
                sender_id: senderId,
                sender: senderId,
                message: message,
                recipients: numbersArray,
                pin: pinObj?.value || '1234',
                pin_code: pinObj?.value || '1234'
            };

            const response = await fetch(BIGIHUB_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${tokenObj.value}`
                },
                body: JSON.stringify(payload)
            });

            const textResponse = await response.text();
            let result: any = {};
            try { result = textResponse ? JSON.parse(textResponse) : {}; } catch (e) {}

            if (response.ok || result.status === 'success') {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('audit_logs').insert({
                        admin_id: user.id,
                        action: 'Bulk SMS Sent',
                        details: `Sent to ${numbersArray.length} users. Sender: ${senderId}`
                    });
                }
                Alert.alert('Success', `SMS dispatched successfully to ${numbersArray.length} recipients!`);
                setMessage('');
                setRecipients('');
            } else {
                let errorMsg = result.message || textResponse;
                if (response.status === 400 && result.errors) {
                    errorMsg += ' - Details: ' + JSON.stringify(result.errors);
                } else if (response.status === 400 && typeof result === 'object') {
                    errorMsg += ' - Payload Details: ' + JSON.stringify(result);
                }
                throw new Error(errorMsg || `HTTP ${response.status}`);
            }
        } catch (error: any) {
            console.error('Bigihub Error:', error);
            Alert.alert('Error', 'Failed to send SMS.\n\n' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Validation warnings calculation
    const missingMessage = message.trim().length === 0;
    const missingRecipients = recipients.trim().length === 0;
    const showWarningBox = missingMessage || missingRecipients;

    const charCount = message.length;
    const pageCount = charCount === 0 ? 0 : Math.ceil(charCount / 160);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#F8FAFC]">
            <Stack.Screen 
                options={{ 
                    title: 'Bulk SMS', 
                    headerStyle: { backgroundColor: '#F8FAFC' }, 
                    headerTintColor: NAVY,
                    headerShadowVisible: false
                }} 
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
                
                {/* TABS NAVIGATION */}
                <View className="flex-row justify-between items-center bg-[#F8FAFC] mb-6 px-2">
                    <TouchableOpacity onPress={() => handleTabChange('Send')} style={{ backgroundColor: activeTab === 'Send' ? NAVY : 'transparent' }} className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-lg">
                        <Ionicons name="paper-plane-outline" size={16} color={activeTab === 'Send' ? GOLD : NAVY} />
                        <Text style={{ color: activeTab === 'Send' ? GOLD : NAVY }} className="font-bold text-xs">Send</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => handleTabChange('Templates')} style={{ backgroundColor: activeTab === 'Templates' ? NAVY : 'transparent' }} className="flex-row items-center px-4 py-3 rounded-lg gap-1.5">
                        <Ionicons name="document-text-outline" size={16} color={activeTab === 'Templates' ? GOLD : NAVY} />
                        <Text style={{ color: activeTab === 'Templates' ? GOLD : NAVY }} className="font-bold text-xs">Templates</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleTabChange('History')} style={{ backgroundColor: activeTab === 'History' ? NAVY : 'transparent' }} className="flex-row items-center px-4 py-3 rounded-lg gap-1.5">
                        <Ionicons name="time-outline" size={16} color={activeTab === 'History' ? GOLD : NAVY} />
                        <Text style={{ color: activeTab === 'History' ? GOLD : NAVY }} className="font-bold text-xs">History</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'Templates' && (
                    <View className="bg-white rounded-3xl p-5 mb-4 border border-slate-200 shadow-sm shadow-slate-200">
                        <Text style={{ color: NAVY }} className="font-bold text-[14px] uppercase tracking-wider mb-4">Message Templates</Text>
                        {Object.keys(QUICK_TEMPLATES).map((key) => (
                            <TouchableOpacity 
                                key={key}
                                onPress={() => { applyTemplate(key as keyof typeof QUICK_TEMPLATES); handleTabChange('Send'); }}
                                style={{ backgroundColor: `${NAVY}0A`, borderColor: `${NAVY}20` }}
                                className="border p-4 rounded-xl mb-3"
                            >
                                <Text style={{ color: NAVY }} className="font-bold text-sm mb-1">{key}</Text>
                                <Text style={{ color: NAVY }} className="text-xs opacity-70">{QUICK_TEMPLATES[key as keyof typeof QUICK_TEMPLATES]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {activeTab === 'History' && (
                    <View className="bg-white rounded-3xl p-5 mb-4 border border-slate-200 shadow-sm shadow-slate-200">
                        <Text style={{ color: NAVY }} className="font-bold text-[14px] uppercase tracking-wider mb-4">Recent SMS Broadcasts</Text>
                        {history.length === 0 ? <Text style={{ color: NAVY }} className="text-sm opacity-60">No history found.</Text> : history.map((log, i) => (
                            <View key={i} className="border-b border-slate-100 py-3">
                                <Text style={{ color: NAVY }} className="font-bold text-[11px] opacity-60">{new Date(log.created_at).toLocaleString()}</Text>
                                <Text style={{ color: NAVY }} className="text-sm font-medium mt-1">{log.details}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {activeTab === 'Send' && (
                    <>
                {/* SENDER NAME CARD */}
                <View className="bg-white rounded-3xl p-5 mb-4 border shadow-sm shadow-slate-200" style={{ borderColor: `${GOLD}40` }}>
                    <Text style={{ color: NAVY }} className="font-bold text-[11px] uppercase tracking-wider mb-3">Sender Name / Subject</Text>
                    <TextInput
                        value={senderId}
                        onChangeText={setSenderId}
                        style={{ color: NAVY, borderColor: `${NAVY}20` }}
                        className="bg-slate-50 px-4 py-3 rounded-xl border text-sm font-medium"
                        placeholder="e.g. ABU MAFHAL"
                        placeholderTextColor={`${NAVY}60`}
                        maxLength={11}
                    />
                    <Text style={{ color: NAVY }} className="text-[10px] font-medium text-right mt-2 opacity-60">{senderId.length}/11</Text>
                </View>

                {/* MESSAGE CARD */}
                <View className="bg-white rounded-3xl p-5 mb-4 border border-slate-200 shadow-sm shadow-slate-200">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text style={{ color: NAVY }} className="font-bold text-[11px] uppercase tracking-wider">Message</Text>
                        <TouchableOpacity onPress={() => setShowAIModal(true)} style={{ backgroundColor: LIGHT_GOLD }} className="flex-row items-center px-3 py-1.5 rounded-full gap-1">
                            <Ionicons name="sparkles" size={12} color={NAVY} />
                            <Text style={{ color: NAVY }} className="font-bold text-[10px]">AI Assist</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {/* Quick Chips */}
                    <View className="flex-row flex-wrap gap-2 mb-4">
                        {Object.keys(QUICK_TEMPLATES).map((key) => (
                            <TouchableOpacity 
                                key={key}
                                onPress={() => applyTemplate(key as keyof typeof QUICK_TEMPLATES)}
                                style={{ backgroundColor: `${NAVY}0A`, borderColor: `${NAVY}20` }}
                                className="border px-4 py-2 rounded-full"
                            >
                                <Text style={{ color: NAVY }} className="font-bold text-[11px]">{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        style={{ color: NAVY, borderColor: `${NAVY}20` }}
                        className="bg-slate-50 px-4 py-4 rounded-xl border text-sm h-32"
                        placeholder="Type your message here... Use {name} or {phone} for personalization."
                        placeholderTextColor={`${NAVY}60`}
                        multiline
                        textAlignVertical="top"
                    />
                    <Text style={{ color: NAVY }} className="text-[10px] font-medium text-right mt-3 opacity-60">
                        {charCount} chars • {pageCount} page • Plain Text
                    </Text>
                </View>

                {/* RECIPIENTS CARD */}
                <View className="bg-white rounded-3xl p-5 mb-4 border border-slate-200 shadow-sm shadow-slate-200">
                    <Text style={{ color: NAVY }} className="font-bold text-[11px] uppercase tracking-wider mb-3">Recipients</Text>
                    
                    <TextInput
                        value={recipients}
                        onChangeText={setRecipients}
                        style={{ color: NAVY, borderColor: `${NAVY}20` }}
                        className="bg-slate-50 px-4 py-4 rounded-xl border text-sm h-28 mb-4"
                        placeholder="Enter phone numbers separated by commas, spaces or new lines. e.g. 08012345678, 08098765432"
                        placeholderTextColor={`${NAVY}60`}
                        multiline
                        textAlignVertical="top"
                        keyboardType="default"
                    />

                    <View className="flex-row flex-wrap gap-3">
                        <TouchableOpacity onPress={handleValidateNumbers} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-4 py-2.5 rounded-lg border">
                            <Text style={{ color: NAVY }} className="font-bold text-[11px]">Validate Numbers</Text>
                        </TouchableOpacity>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                            <Text style={{ color: NAVY }} className="w-full font-bold text-[11px] mb-1">Load From Database:</Text>
                            
                            <TouchableOpacity onPress={() => handleLoadUsers('all')} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-3 py-2 rounded-lg border">
                                <Text style={{ color: NAVY }} className="font-bold text-[10px]">All Users</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleLoadUsers('active')} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-3 py-2 rounded-lg border">
                                <Text style={{ color: NAVY }} className="font-bold text-[10px]">Active</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleLoadUsers('inactive')} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-3 py-2 rounded-lg border">
                                <Text style={{ color: NAVY }} className="font-bold text-[10px]">Inactive</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleLoadUsers('admin')} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-3 py-2 rounded-lg border">
                                <Text style={{ color: NAVY }} className="font-bold text-[10px]">Admins</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => handleLoadUsers('user')} style={{ backgroundColor: LIGHT_GOLD, borderColor: GOLD }} className="px-3 py-2 rounded-lg border">
                                <Text style={{ color: NAVY }} className="font-bold text-[10px]">Users Only</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* DELIVERY TIMING */}
                <View className="bg-white rounded-3xl p-5 mb-4 border border-slate-200 shadow-sm shadow-slate-200">
                    <Text style={{ color: NAVY }} className="font-bold text-[11px] uppercase tracking-wider mb-3">Delivery Timing</Text>
                    <TouchableOpacity onPress={() => Alert.alert('Notice', 'Bigisub API currently only supports Immediate delivery. Scheduled messages will be added when supported.')} style={{ borderColor: `${NAVY}20` }} className="bg-slate-50 px-4 py-4 rounded-xl border flex-row justify-between items-center">
                        <Text style={{ color: NAVY }} className="font-medium text-sm">{deliveryTiming}</Text>
                        <Ionicons name="chevron-down" size={16} color={NAVY} />
                    </TouchableOpacity>
                </View>

                {/* WARNING BOX */}
                {showWarningBox && (
                    <View style={{ backgroundColor: `${GOLD}20`, borderColor: GOLD }} className="border p-4 rounded-xl mb-4">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="warning" size={16} color={NAVY} />
                            <Text style={{ color: NAVY }} className="font-bold text-[12px]">Please complete the following:</Text>
                        </View>
                        {missingMessage && <Text style={{ color: NAVY }} className="text-[11px] ml-6 mb-1 opacity-80">• Enter a message</Text>}
                        {missingRecipients && <Text style={{ color: NAVY }} className="text-[11px] ml-6 opacity-80">• Enter at least one recipient</Text>}
                    </View>
                )}

                {/* SUBMIT BUTTON */}
                <TouchableOpacity 
                    onPress={executeBigihubAPI}
                    disabled={loading || showWarningBox}
                    style={{ backgroundColor: (loading || showWarningBox) ? `${NAVY}80` : NAVY }}
                    className="py-4 rounded-xl items-center justify-center shadow-lg shadow-blue-900/30"
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={GOLD} />
                    ) : (
                        <Text style={{ color: GOLD }} className="font-bold text-base">Send SMS</Text>
                    )}
                </TouchableOpacity>
                </>
                )}

            </ScrollView>

            {/* AI ASSISTANT MODAL */}
            <Modal visible={showAIModal} transparent animationType="slide">
                <View style={{ backgroundColor: 'rgba(10, 25, 47, 0.4)' }} className="flex-1 justify-end">
                    <View className="bg-white rounded-t-3xl p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <View className="flex-row items-center gap-2">
                                <Ionicons name="sparkles" size={20} color={GOLD} />
                                <Text style={{ color: NAVY }} className="font-bold text-lg">AI Assistant</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAIModal(false)} className="p-1">
                                <Ionicons name="close" size={24} color={NAVY} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{ color: NAVY }} className="text-xs mb-3 opacity-80">What should the SMS be about? (e.g. "Write a promo for MTN 1GB at N250")</Text>
                        
                        <TextInput
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                            style={{ color: NAVY, borderColor: `${NAVY}20` }}
                            className="bg-slate-50 px-4 py-3 rounded-xl border text-sm h-24 mb-4"
                            placeholder="Describe your message..."
                            placeholderTextColor={`${NAVY}60`}
                            multiline
                            textAlignVertical="top"
                        />

                        <TouchableOpacity 
                            onPress={handleAIGenerate}
                            disabled={aiLoading}
                            style={{ backgroundColor: aiLoading ? `${NAVY}80` : NAVY }}
                            className="py-4 rounded-xl items-center justify-center flex-row gap-2"
                        >
                            {aiLoading ? (
                                <ActivityIndicator size="small" color={GOLD} />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={16} color={GOLD} />
                                    <Text style={{ color: GOLD }} className="font-bold text-base">Generate Message</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
