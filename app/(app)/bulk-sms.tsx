import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const BIGIHUB_API_URL = process.env.EXPO_PUBLIC_BIGIHUB_SMS_URL || 'https://api.bigisub.ng/api/v2/communications/sms/send/';

// Premium Colors
const NAVY = '#0A192F';
const GOLD = '#D4AF37';
const LIGHT_NAVY = '#112240';
const LIGHT_GOLD = '#F3E5AB';

const QUICK_TEMPLATES = {
    Wedding: 'We invite you to the wedding of our beloved son/daughter. Date: {date}, Venue: {venue}. Please join us!',
    Meeting: 'Reminder: Our scheduled meeting is on {date} at {time}. Venue: {venue}. Please be punctual.',
    Promo: 'Special Offer! Get {discount}% off your next purchase at our store. Valid until {date}. Visit us today!',
    Greeting: 'Wishing you a very happy and prosperous {holiday}! May this season bring you joy and peace.'
};

export default function UserBulkSMS() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);

    // User State
    const [userBalance, setUserBalance] = useState(0);
    const [userId, setUserId] = useState('');
    
    // Pricing
    const [pricePerPage, setPricePerPage] = useState(10); 

    // UI State
    const [activeTab, setActiveTab] = useState('Send');
    const [history, setHistory] = useState<any[]>([]);

    // Form State
    const [senderId, setSenderId] = useState('SMS_ALERT');
    const [message, setMessage] = useState('');
    const [recipients, setRecipients] = useState('');

    // AI State
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            setUserId(user.id);

            // Get user profile
            const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
            if (profile) {
                setUserBalance(Number(profile.balance || 0));
            }

            // Get pricing
            const { data: appSettings } = await supabase.from('app_settings').select('value').eq('key', 'user_bulk_sms_price').maybeSingle();
            if (appSettings?.value) {
                setPricePerPage(Number(appSettings.value));
            } else {
                setPricePerPage(10); // default
            }
        } catch (e: any) {
            console.error('Init error:', e.message);
        } finally {
            setInitializing(false);
        }
    };

    const fetchHistory = async () => {
        if (!userId) return;
        setLoading(true);
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('type', 'payment')
            .like('description', '%Bulk SMS%')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (data) setHistory(data);
        setLoading(false);
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === 'History') fetchHistory();
    };

    const applyTemplate = (key: keyof typeof QUICK_TEMPLATES) => {
        setMessage(QUICK_TEMPLATES[key]);
        handleTabChange('Send');
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

    const handleValidateNumbers = () => {
        if (!recipients.trim()) return Alert.alert('Notice', 'Please enter some numbers first.');
        const phoneNumbers = recipients.match(/\b\d{10,15}\b/g);
        if (phoneNumbers && phoneNumbers.length > 0) {
            const uniqueNumbers = Array.from(new Set(phoneNumbers));
            setRecipients(uniqueNumbers.join(', '));
            Alert.alert('Validation Complete', `Found and cleaned ${uniqueNumbers.length} valid phone number(s).`);
        } else {
            setRecipients('');
            Alert.alert('Notice', 'No valid numbers found.');
        }
    };

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

    // Derived values
    const numbersArray = recipients.split(/[\s,]+/).map(n => n.trim()).filter(n => n.length > 8);
    const recipientCount = numbersArray.length;
    const pageCount = message.length > 0 ? Math.ceil(message.length / 160) : 0;
    const totalCost = recipientCount * pageCount * pricePerPage;

    const executeSendSMS = async () => {
        if (!senderId) return Alert.alert('Error', 'Sender ID is required.');
        if (!message) return Alert.alert('Error', 'Message cannot be empty.');
        if (recipientCount === 0) return Alert.alert('Error', 'Please enter at least one valid phone number.');
        
        if (userBalance < totalCost) {
            return Alert.alert('Insufficient Balance', `You need ₦${totalCost.toLocaleString()} but your balance is ₦${userBalance.toLocaleString()}. Please fund your wallet.`);
        }

        Alert.alert(
            'Confirm Send',
            `Send SMS to ${recipientCount} recipient(s)?\nTotal Cost: ₦${totalCost.toLocaleString()}`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Send Now', 
                    style: 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { data: secretData, error: secretError } = await supabase
                                .from('system_secrets')
                                .select('key, value')
                                .in('key', ['BIGI_API_TOKEN', 'BIGI_API_PIN']);

                            const tokenObj = secretData?.find(s => s.key === 'BIGI_API_TOKEN');
                            const pinObj = secretData?.find(s => s.key === 'BIGI_API_PIN');

                            if (secretError || !tokenObj?.value) throw new Error('System SMS Configuration Error (Token Missing)');

                            const payload = {
                                sender_id: senderId.substring(0, 11),
                                sender: senderId.substring(0, 11),
                                message: message,
                                recipients: numbersArray.join(','),
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
                                const newBalance = userBalance - totalCost;
                                await supabase.from('profiles').update({ balance: newBalance }).eq('id', userId);
                                setUserBalance(newBalance);
                                
                                await supabase.from('transactions').insert({
                                    user_id: userId,
                                    type: 'payment',
                                    amount: totalCost,
                                    status: 'successful',
                                    description: `Bulk SMS (${pageCount} pages to ${recipientCount} numbers)`,
                                    reference: `SMS-${Date.now()}`
                                });

                                Alert.alert('Success', `SMS sent successfully to ${recipientCount} recipients! Cost: ₦${totalCost.toLocaleString()}`);
                                setMessage('');
                                setRecipients('');
                            } else {
                                let errorMsg = result.message || textResponse;
                                if (response.status === 400 && result.errors) errorMsg += ' - Details: ' + JSON.stringify(result.errors);
                                throw new Error(errorMsg || `HTTP ${response.status}`);
                            }
                        } catch (error: any) {
                            console.error('SMS Send Error:', error);
                            Alert.alert('Error', 'Failed to send SMS.\n\n' + error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (initializing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <ActivityIndicator size="large" color={NAVY} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1, backgroundColor: '#f8fafc' }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <Stack.Screen options={{
                headerTitle: "Bulk SMS",
                headerStyle: { backgroundColor: '#f8fafc' },
                headerTintColor: NAVY,
                headerShadowVisible: false,
                headerBackTitle: 'Back'
            }} />

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                
                {/* Slim Balance Card */}
                <LinearGradient 
                    colors={[NAVY, LIGHT_NAVY]} 
                    style={{ padding: 16, borderRadius: 12, marginBottom: 16 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 2 }}>Wallet Balance</Text>
                            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>
                                ₦{userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: GOLD, fontSize: 11, fontWeight: 'bold' }}>₦{pricePerPage.toFixed(2)} / Page</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* TABS NAVIGATION (Tailwind style) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', marginBottom: 16, paddingHorizontal: 2 }}>
                    {['Send', 'Templates', 'History'].map((tab) => {
                        const isActive = activeTab === tab;
                        const IconName = tab === 'Send' ? 'paper-plane-outline' : tab === 'Templates' ? 'document-text-outline' : 'time-outline';
                        return (
                            <TouchableOpacity 
                                key={tab}
                                onPress={() => handleTabChange(tab)} 
                                style={{ flex: 1, backgroundColor: isActive ? NAVY : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}
                            >
                                <Ionicons name={IconName} size={14} color={isActive ? GOLD : NAVY} />
                                <Text style={{ color: isActive ? GOLD : NAVY, fontWeight: 'bold', fontSize: 12 }}>{tab}</Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>

                {activeTab === 'Templates' && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
                        <Text style={{ color: NAVY, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>Message Templates</Text>
                        {Object.keys(QUICK_TEMPLATES).map((key) => (
                            <TouchableOpacity 
                                key={key}
                                onPress={() => applyTemplate(key as keyof typeof QUICK_TEMPLATES)}
                                style={{ backgroundColor: 'transparent', borderColor: '#e2e8f0', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}
                            >
                                <Text style={{ color: NAVY, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>{key}</Text>
                                <Text style={{ color: '#64748b', fontSize: 12 }} numberOfLines={2}>{QUICK_TEMPLATES[key as keyof typeof QUICK_TEMPLATES]}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {activeTab === 'History' && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ color: NAVY, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>Recent Campaigns</Text>
                            <TouchableOpacity onPress={fetchHistory} style={{ padding: 4 }}>
                                <Ionicons name="refresh" size={16} color={NAVY} />
                            </TouchableOpacity>
                        </View>
                        
                        {loading ? (
                            <ActivityIndicator color={GOLD} style={{ marginVertical: 20 }} />
                        ) : history.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                <Ionicons name="chatbox-outline" size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
                                <Text style={{ color: '#94a3b8', fontSize: 13 }}>No bulk SMS transactions found.</Text>
                            </View>
                        ) : (
                            history.map((item, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: index === history.length - 1 ? 0 : 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0f9ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name="checkmark" size={14} color="#0284c7" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: NAVY, fontWeight: 'bold', fontSize: 12, marginBottom: 2 }}>{item.description}</Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(item.created_at).toLocaleDateString()} • {new Date(item.created_at).toLocaleTimeString()}</Text>
                                    </View>
                                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>-₦{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {activeTab === 'Send' && (
                    <>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
                            
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, marginBottom: 8, textTransform: 'uppercase' }}>Sender ID</Text>
                            <TextInput
                                style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 14, color: NAVY, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' }}
                                value={senderId}
                                onChangeText={(t) => setSenderId(t.substring(0, 11))}
                                placeholder="e.g. MAFHAL"
                                maxLength={11}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, textTransform: 'uppercase' }}>Recipients</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity onPress={handleValidateNumbers} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Ionicons name="shield-checkmark-outline" size={12} color="#d97706" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 10, color: '#d97706', fontWeight: 'bold' }}>Validate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleImportCSV} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Ionicons name="document-attach-outline" size={12} color="#3b82f6" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 10, color: '#3b82f6', fontWeight: 'bold' }}>Import CSV</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TextInput
                                style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 14, color: NAVY, marginBottom: 4, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 80 }}
                                value={recipients}
                                onChangeText={setRecipients}
                                placeholder="08031234567, 09012345678"
                                multiline
                                textAlignVertical="top"
                                keyboardType="numbers-and-punctuation"
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 2 }}>
                                <Text style={{ fontSize: 10, color: '#94a3b8' }}>Separate numbers with commas/spaces.</Text>
                                <Text style={{ fontSize: 11, color: recipientCount > 0 ? NAVY : '#94a3b8', fontWeight: 'bold' }}>{recipientCount} Found</Text>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: NAVY, textTransform: 'uppercase' }}>Message</Text>
                                <TouchableOpacity onPress={() => setShowAIModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="sparkles" size={12} color={GOLD} />
                                    <Text style={{ fontSize: 11, color: GOLD, fontWeight: 'bold' }}>AI Assist</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, fontSize: 14, color: NAVY, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 100 }}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Type your message here..."
                                multiline
                                textAlignVertical="top"
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                <Text style={{ fontSize: 11, color: pageCount > 1 ? '#eab308' : '#64748b' }}>
                                    {message.length} chars ({pageCount} {pageCount === 1 ? 'page' : 'pages'})
                                </Text>
                            </View>
                        </View>

                        {/* Summary & Send Button */}
                        <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ color: '#64748b', fontSize: 13 }}>Total Recipients</Text>
                                <Text style={{ color: NAVY, fontSize: 13, fontWeight: 'bold' }}>{recipientCount}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ color: '#64748b', fontSize: 13 }}>Pages per SMS</Text>
                                <Text style={{ color: NAVY, fontSize: 13, fontWeight: 'bold' }}>{pageCount}</Text>
                            </View>
                            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: NAVY, fontSize: 15, fontWeight: 'bold' }}>Total Cost</Text>
                                <Text style={{ color: GOLD, fontSize: 18, fontWeight: 'bold' }}>₦{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                            </View>

                            <TouchableOpacity 
                                style={{ backgroundColor: NAVY, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20, opacity: (recipientCount === 0 || !message) ? 0.5 : 1 }}
                                onPress={executeSendSMS}
                                disabled={loading || recipientCount === 0 || !message}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color={GOLD} />
                                ) : (
                                    <Text style={{ color: GOLD, fontSize: 14, fontWeight: 'bold' }}>
                                        Pay ₦{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} & Send
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* AI ASSISTANT MODAL */}
            <Modal visible={showAIModal} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(10, 25, 47, 0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="sparkles" size={20} color={GOLD} />
                                <Text style={{ color: NAVY, fontWeight: 'bold', fontSize: 18 }}>AI Assistant</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAIModal(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={NAVY} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>What should the SMS be about? (e.g. "Write a promo for MTN 1GB at N250")</Text>
                        
                        <TextInput
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                            style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 14, color: NAVY, minHeight: 100, marginBottom: 16 }}
                            placeholder="Describe your message..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            textAlignVertical="top"
                        />

                        <TouchableOpacity 
                            onPress={handleAIGenerate}
                            disabled={aiLoading}
                            style={{ backgroundColor: aiLoading ? '#cbd5e1' : NAVY, paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                        >
                            {aiLoading ? (
                                <ActivityIndicator size="small" color={GOLD} />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={16} color={GOLD} />
                                    <Text style={{ color: GOLD, fontWeight: 'bold', fontSize: 16 }}>Generate Message</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
