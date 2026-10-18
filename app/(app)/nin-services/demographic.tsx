import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform, Modal, Image, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import ViewShot from 'react-native-view-shot';
import { api } from '../../../services/api';
import { supabase } from '../../../services/supabase';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
import { IDCardMockup } from '../../../components/IDCardMockup';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

const formatDob = (raw: string): string => {
    if (!raw || raw === 'N/A') return 'N/A';
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    try {
        const parts = raw.split(/[-/]/);
        if (parts.length === 3) {
            let y: string, m: string, d: string;
            if (parts[0].length === 4) { [y, m, d] = parts; } else { [d, m, y] = parts; }
            const idx = parseInt(m, 10) - 1;
            if (idx >= 0 && idx < 12) return `${d.padStart(2, '0')} ${MONTHS[idx]} ${y}`;
        }
    } catch (_) {}
    return raw.toUpperCase();
};

export default function DemographicScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const viewShotRef = useRef<any>(null);

    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [servicePrice, setServicePrice] = useState<number>(150);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    // Alert Modal State
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const showAlert = (title: string, message: string, type: AlertType = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) setUserBalance(Number(data.balance));
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    const fetchServicePrice = async () => {
        try {
            const { data } = await supabase
                .from('service_pricing')
                .select('cost_price, markup_price')
                .eq('id', 'nin_demographic')
                .maybeSingle();

            if (data) {
                const total = Number(data.cost_price || 0) + Number(data.markup_price || 0);
                if (total > 0) setServicePrice(total);
            }
        } catch (e) {
            console.warn('Failed to load dynamic price for demographic search', e);
        }
    };

    useEffect(() => {
        fetchWalletBalance();
        fetchServicePrice();
    }, []);

    const handleVerify = async () => {
        const cleanFirst = firstname.trim();
        const cleanLast = lastname.trim();
        const cleanDob = dob.trim();

        if (!cleanFirst) {
            return showAlert('First Name Required', 'Please enter the applicant\'s first name.', 'warning');
        }
        if (!cleanLast) {
            return showAlert('Last Name Required', 'Please enter the applicant\'s last name.', 'warning');
        }
        if (!cleanDob) {
            return showAlert('Date of Birth Required', 'Please enter the Date of Birth in DD-MM-YYYY format.', 'warning');
        }

        if (userBalance !== null && userBalance < servicePrice) {
            return showAlert(
                'Insufficient Balance',
                `Your wallet balance is ₦${userBalance.toLocaleString()}. Required fee is ₦${servicePrice.toLocaleString()}. Please fund your wallet.`,
                'error'
            );
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.identity.verifyDemographic(
                { firstname: cleanFirst, lastname: cleanLast, gender, dob: cleanDob },
                'nin_demographic'
            );

            if (res && res.isValid) {
                const rawData = res.data?.data || res.data || {};
                setResult(res);
                showAlert('Record Found', 'Demographic search retrieved verified NIMC record.', 'success');

                await verificationHistory.save({
                    service_category: 'nin',
                    service_type: 'nin_demographic',
                    search_number: rawData.nin || `${cleanFirst} ${cleanLast}`,
                    holder_name: `${cleanFirst} ${cleanLast}`,
                    layout: 'Demographic Lookup',
                    details: rawData,
                });

                fetchWalletBalance();
            } else {
                showAlert('No Record Found', res?.message || 'No matching citizen record found with provided details.', 'error');
            }
        } catch (e: any) {
            const msg = e.message || 'An error occurred during demographic search.';
            showAlert('Search Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!result || !result.data) return;
        setIsSaving(true);
        try {
            const personData = result.data?.data || result.data || {};
            const pdfBase64 = personData.pdf_base64 || result.pdf_base64;

            if (pdfBase64) {
                let cleanBase64 = String(pdfBase64);
                if (cleanBase64.includes('base64,')) {
                    cleanBase64 = cleanBase64.split('base64,')[1];
                }
                cleanBase64 = cleanBase64.trim().replace(/\s/g, '');

                if (Platform.OS === 'web') {
                    const byteCharacters = atob(cleanBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `demographic_nin_slip_${firstname || 'official'}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                    showAlert('Download Complete', 'Official NIN Slip PDF downloaded.', 'success');
                    return;
                } else {
                    const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                    const fileUri = `${docDir}demographic_nin_slip_${firstname || 'official'}.pdf`;
                    await FileSystem.writeAsStringAsync(fileUri, cleanBase64, { encoding: ((FileSystem as any).EncodingType?.Base64 || 'base64') as any });
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Download Official NIN Slip' });
                    }
                    return;
                }
            }

            // Fallback: Capture offscreen ViewShot and print
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                if (Platform.OS === 'web') {
                    const link = document.createElement('a');
                    link.download = `demographic_slip_${firstname || 'record'}.png`;
                    link.href = uri;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    await Print.printAsync({ uri });
                }
            }
        } catch (e: any) {
            showAlert('Download Error', e.message || 'Failed to download slip.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPng = async () => {
        if (!viewShotRef.current) return;
        setIsSaving(true);
        try {
            const uri = await viewShotRef.current.capture();
            if (Platform.OS === 'web') {
                const link = document.createElement('a');
                link.download = `demographic_slip_${firstname || 'record'}.png`;
                link.href = uri;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showAlert('Download Complete', 'Official NIN Slip PNG downloaded.', 'success');
            } else {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save NIN Slip PNG' });
                } else {
                    showAlert('Saved', 'PNG saved successfully.', 'success');
                }
            }
        } catch (e: any) {
            showAlert('PNG Export Failed', e.message || 'Failed to save PNG image.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Result View (1-Page Modern Compact Layout) ───────────────────────────
    if (result) {
        const personData = result.data?.data || result.data || {};
        const firstName = personData.firstname || personData.first_name || firstname;
        const middleName = personData.middlename || personData.middle_name || '';
        const surname = personData.surname || personData.last_name || lastname;
        const fullName = [firstName, middleName, surname].filter(Boolean).join(' ') || 'CITIZEN DOSSIER';
        const rawNin = personData.nin || personData.number || 'N/A';
        const cleanNin = String(rawNin).replace(/\D/g, '');
        const displayNin = cleanNin.length === 11
            ? `${cleanNin.slice(0, 4)} ${cleanNin.slice(4, 7)} ${cleanNin.slice(7)}`
            : cleanNin || 'N/A';
        const trackingId = personData.trackingId || personData.tracking_id || 'NIMC-DEMO-SYNC';
        const formattedDob = formatDob(personData.dob || personData.birthdate || dob);
        const genderText = (personData.gender || gender || 'M').trim().toUpperCase().startsWith('F') ? 'FEMALE' : 'MALE';
        const phoneVal = personData.phone || personData.phoneNumber || personData.telephoneno || 'N/A';
        const stateOfOrigin = personData.birthstate || personData.birthState || personData.state_of_origin || 'N/A';
        const lgaOfOrigin = personData.birthlga || personData.birthLga || personData.lga_of_origin || 'N/A';

        const userPhoto = personData.photo || personData.image;
        const photoUri = userPhoto
            ? (userPhoto.startsWith('data:') || userPhoto.startsWith('http') ? userPhoto : `data:image/jpeg;base64,${userPhoto}`)
            : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL363G0d9u3u5YQ&s';

        return (
            <View style={{ flex: 1, backgroundColor: '#071630' }}>
                <Stack.Screen options={{ title: 'Demographic Details', headerStyle: { backgroundColor: '#071630' }, headerTintColor: '#F5A623', headerShadowVisible: false }} />
                <StatusBar style="light" />

                {/* Offscreen ViewShot for PDF / PNG Slip generation */}
                <View style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }}>
                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: 420, backgroundColor: '#ffffff' }}>
                        <IDCardMockup data={personData} />
                    </ViewShot>
                </View>

                {/* Download Format Modal */}
                <Modal
                    transparent
                    visible={isDownloadModalOpen}
                    animationType="fade"
                    onRequestClose={() => setIsDownloadModalOpen(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(7, 22, 48, 0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#0B2246', borderRadius: 24, padding: 22, width: '100%', maxWidth: 350, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' }}>
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245, 166, 35, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                <Ionicons name="download-outline" size={24} color="#F5A623" />
                            </View>
                            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>Download Official Slip</Text>
                            <Text style={{ color: '#CBD5E1', fontSize: 11, marginTop: 4, marginBottom: 18 }}>Choose your preferred format</Text>

                            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsDownloadModalOpen(false);
                                        handleDownloadPdf();
                                    }}
                                    style={{ flex: 1, backgroundColor: 'rgba(245, 166, 35, 0.12)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F5A623' }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="document-text" size={28} color="#F5A623" />
                                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginTop: 6 }}>PDF Document</Text>
                                    <Text style={{ color: '#CBD5E1', fontSize: 10, marginTop: 2 }}>Print-ready</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setIsDownloadModalOpen(false);
                                        handleDownloadPng();
                                    }}
                                    style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#10B981' }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="image" size={28} color="#10B981" />
                                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginTop: 6 }}>Image (PNG)</Text>
                                    <Text style={{ color: '#CBD5E1', fontSize: 10, marginTop: 2 }}>HD Card</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={() => setIsDownloadModalOpen(false)} style={{ paddingVertical: 6 }}>
                                <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: 13 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Top Compact Brand Bar */}
                <View style={{ paddingHorizontal: 16, paddingTop: insets.top > 0 ? insets.top + 6 : 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => setResult(null)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.25)' }} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={18} color="#F5A623" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15 }}>Demographic Verified</Text>
                    </View>

                    <TouchableOpacity onPress={() => setIsDownloadModalOpen(true)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245, 166, 35, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F5A623' }} activeOpacity={0.7}>
                        <Ionicons name="download-outline" size={18} color="#F5A623" />
                    </TouchableOpacity>
                </View>

                {/* 🌟 1-PAGE MODERN COMPACT DOSSIER 🌟 */}
                <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16, justifyContent: 'space-between' }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 6 }}>
                        {/* Header: Photo + Name + NIN with Copy */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                            <View style={{ position: 'relative' }}>
                                <View style={{ padding: 2, borderRadius: 16, borderWidth: 2, borderColor: '#F5A623', backgroundColor: '#FFFFFF' }}>
                                    <Image source={{ uri: photoUri }} style={{ width: 72, height: 84, borderRadius: 12, backgroundColor: '#E2E8F0' }} />
                                </View>
                                <View style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }}>
                                    <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                                </View>
                            </View>

                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}>
                                        <Text style={{ color: '#15803D', fontWeight: '800', fontSize: 9.5 }}>VERIFIED 100%</Text>
                                    </View>
                                    <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700' }}>NIMC RECORD</Text>
                                </View>
                                <Text style={{ color: '#071630', fontWeight: '900', fontSize: 14.5, textTransform: 'uppercase', lineHeight: 18 }} numberOfLines={2}>
                                    {fullName}
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                    <Text style={{ color: '#071630', fontWeight: '800', fontSize: 13, letterSpacing: 0.6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {displayNin}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (cleanNin) {
                                                await Clipboard.setStringAsync(cleanNin);
                                                showAlert('Copied!', 'NIN copied to clipboard.', 'success');
                                            }
                                        }}
                                        style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}
                                    >
                                        <Text style={{ color: '#F5A623', fontWeight: '800', fontSize: 9 }}>COPY</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Citizen Details Grid */}
                        <View style={{ paddingTop: 10, gap: 7 }}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 }}>
                                    <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700' }}>DATE OF BIRTH</Text>
                                    <Text style={{ color: '#071630', fontWeight: '800', fontSize: 12, marginTop: 1 }}>{formattedDob}</Text>
                                </View>
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 }}>
                                    <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700' }}>GENDER</Text>
                                    <Text style={{ color: '#071630', fontWeight: '800', fontSize: 12, marginTop: 1 }}>{genderText}</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 }}>
                                    <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700' }}>STATE / LGA</Text>
                                    <Text style={{ color: '#071630', fontWeight: '800', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                                        {stateOfOrigin} / {lgaOfOrigin}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 }}>
                                    <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700' }}>PHONE</Text>
                                    <Text style={{ color: '#071630', fontWeight: '800', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                                        {phoneVal}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ backgroundColor: '#F8FAFC', padding: 8, borderRadius: 10 }}>
                                <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700' }}>TRACKING ID</Text>
                                <Text style={{ color: '#071630', fontWeight: '800', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 1 }}>
                                    {trackingId}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Bottom Action Buttons */}
                    <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={handleDownloadPdf}
                                disabled={isSaving}
                                style={{ flex: 1, height: 48, backgroundColor: '#F5A623', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }}
                                activeOpacity={0.8}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#071630" />
                                ) : (
                                    <>
                                        <Ionicons name="document-text" size={17} color="#071630" />
                                        <Text style={{ color: '#071630', fontWeight: '900', fontSize: 13 }}>Download PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleDownloadPng}
                                disabled={isSaving}
                                style={{ flex: 1, height: 48, backgroundColor: '#0B2246', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#F5A623' }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="image" size={17} color="#F5A623" />
                                <Text style={{ color: '#F5A623', fontWeight: '900', fontSize: 13 }}>Save PNG</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => setResult(null)}
                            style={{ height: 44, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }}
                            activeOpacity={0.8}
                        >
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>SEARCH ANOTHER DEMOGRAPHIC</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <BrandAlertModal
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                />
            </View>
        );
    }

    // ── Input Form View ───────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#071630' }}>
            <Stack.Screen
                options={{
                    title: 'Demographic Search',
                    headerStyle: { backgroundColor: '#071630' },
                    headerTintColor: '#F5A623',
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/nin-services/history?tab=nin')} style={{ marginRight: 8 }}>
                            <Ionicons name="time-outline" size={22} color="#F5A623" />
                        </TouchableOpacity>
                    ),
                }}
            />
            <StatusBar style="light" />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                {/* Header Card */}
                <View style={{ backgroundColor: '#0B2246', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.25)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245, 166, 35, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="people" size={24} color="#F5A623" />
                        </View>
                        <View style={{ backgroundColor: 'rgba(245, 166, 35, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 166, 35, 0.3)' }}>
                            <Text style={{ color: '#F5A623', fontWeight: '800', fontSize: 11 }}>Fee: ₦{servicePrice.toLocaleString()}</Text>
                        </View>
                    </View>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 17, marginTop: 14 }}>Demographic NIN Lookup</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                        Search and retrieve official citizen NIN records using Full Name, Date of Birth, and Gender.
                    </Text>
                </View>

                {/* Input Fields */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 }}>
                    <Text style={{ color: '#071630', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>FIRST NAME</Text>
                    <TextInput
                        placeholder="Enter first name"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        value={firstname}
                        onChangeText={setFirstname}
                        autoCapitalize="characters"
                    />

                    <Text style={{ color: '#071630', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>LAST NAME / SURNAME</Text>
                    <TextInput
                        placeholder="Enter last name"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        value={lastname}
                        onChangeText={setLastname}
                        autoCapitalize="characters"
                    />

                    <Text style={{ color: '#071630', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>DATE OF BIRTH (DD-MM-YYYY)</Text>
                    <TextInput
                        placeholder="e.g. 15-05-1990"
                        placeholderTextColor="#94A3B8"
                        style={styles.input}
                        value={dob}
                        onChangeText={setDob}
                    />

                    <Text style={{ color: '#071630', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>GENDER</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                        <TouchableOpacity
                            onPress={() => setGender('m')}
                            style={[
                                styles.genderBtn,
                                gender === 'm' ? { backgroundColor: '#071630', borderColor: '#F5A623' } : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                            ]}
                        >
                            <Ionicons name="male" size={18} color={gender === 'm' ? '#F5A623' : '#64748B'} />
                            <Text style={{ color: gender === 'm' ? '#FFFFFF' : '#64748B', fontWeight: '800', fontSize: 13 }}>MALE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setGender('f')}
                            style={[
                                styles.genderBtn,
                                gender === 'f' ? { backgroundColor: '#071630', borderColor: '#F5A623' } : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                            ]}
                        >
                            <Ionicons name="female" size={18} color={gender === 'f' ? '#F5A623' : '#64748B'} />
                            <Text style={{ color: gender === 'f' ? '#FFFFFF' : '#64748B', fontWeight: '800', fontSize: 13 }}>FEMALE</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={handleVerify}
                        disabled={loading}
                        style={{ height: 52, borderRadius: 14, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center', shadowColor: '#F5A623', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#071630" />
                        ) : (
                            <Text style={{ color: '#071630', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>SEARCH DEMOGRAPHICS</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <BrandAlertModal
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 50,
        marginBottom: 16,
        color: '#071630',
        fontWeight: '700',
        fontSize: 14,
    },
    genderBtn: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        borderWidth: 1.5,
    },
});
