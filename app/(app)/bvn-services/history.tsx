import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';
import * as Print from 'expo-print';
import BrandAlertModal, { AlertType } from '../../../components/BrandAlertModal';

export default function BVNHistoryScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [printingId, setPrintingId] = useState<string | null>(null);
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

    const showAlert = (title: string, message: string, type: AlertType = 'error') => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const dbList = await verificationHistory.getAll('bvn');
            const stored = await AsyncStorage.getItem('recent_bvn_verifications');
            const localList = stored ? JSON.parse(stored) : [];

            const combinedMap = new Map();

            for (const item of localList) {
                const raw = item.data || item.details || {};
                const fullName = extractFullName(raw, item.name || item.holder_name);
                const bvnNum = item.bvn || raw.idNumber || raw.bvn || item.search_number || item.id;
                if (bvnNum) {
                    combinedMap.set(bvnNum, {
                        ...item,
                        bvn: bvnNum,
                        name: fullName,
                        date: item.date || 'Recently',
                        data: raw
                    });
                }
            }

            if (dbList && dbList.length > 0) {
                for (const item of dbList) {
                    const raw = item.details?.data?.data || item.details?.data || item.details || {};
                    const fullName = extractFullName(raw, item.holder_name);
                    const bvnNum = item.search_number || raw.idNumber || raw.bvn || item.details?.bvn || item.id;
                    combinedMap.set(bvnNum, {
                        id: item.id,
                        bvn: bvnNum,
                        name: fullName,
                        date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently',
                        data: raw
                    });
                }
            }

            setHistory(Array.from(combinedMap.values()));
        } catch (e) {
            console.warn('Failed to load BVN history', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSlip = async (item: any) => {
        const raw = item.data || {};
        const fn = raw.firstName || raw.first_name || '';
        const mn = raw.middleName || raw.middle_name || '';
        const ln = raw.lastName || raw.surname || '';
        const fullName = `${fn} ${mn} ${ln}`.trim() || raw.fullName || raw.name || item.name || 'BVN HOLDER';
        const bvnNum = raw.idNumber || raw.bvn || item.bvn || 'N/A';
        const ninNum = raw.nin || 'N/A';
        const dob = raw.dateOfBirth || raw.dob || raw.birthdate || 'N/A';
        const phone = raw.mobile || raw.phoneNumber1 || raw.phoneNumber || raw.phone || 'N/A';
        const gender = raw.gender || 'N/A';
        const state = raw.stateOfOrigin || raw.state || 'N/A';
        const lga = raw.lgaOfOrigin || raw.lga || 'N/A';
        const rawImg = raw.image || raw.photo || '';
        const photoSrc = rawImg ? (rawImg.startsWith('data:') ? rawImg : `data:image/jpeg;base64,${rawImg}`) : '';

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Official BVN Slip - ${bvnNum}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; color: #0B192C; }
                .card { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; border: 2px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden; }
                .header { background: #0B192C; color: white; padding: 14px; text-align: center; border-bottom: 2px solid #D4AF37; }
                .header h1 { margin: 0 0 2px 0; font-size: 15px; text-transform: uppercase; color: #D4AF37; letter-spacing: 0.5px; }
                .header p { margin: 0; font-size: 10px; opacity: 0.8; }
                .body { padding: 16px; display: flex; gap: 14px; }
                .photo-box { width: 90px; height: 110px; background: #FEF9E7; border: 1px solid #D4AF37; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                .info { flex: 1; }
                .row { margin-bottom: 6px; }
                .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 1px; }
                .val { font-size: 12px; font-weight: bold; color: #0B192C; }
                .val-highlight { color: #B45309; font-size: 14px; }
                .footer { background: #f8fafc; padding: 8px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>BANK VERIFICATION RECORD</h1>
                    <p>Official Verification Slip</p>
                </div>
                <div class="body">
                    <div class="photo-box">
                        ${photoSrc ? `<img src="${photoSrc}" />` : `<span style="font-size:24px; color:#B45309; font-weight:bold;">${fullName.charAt(0)}</span>`}
                    </div>
                    <div class="info">
                        <div class="row"><div class="label">Full Name</div><div class="val">${fullName}</div></div>
                        <div class="row"><div class="label">BVN Number</div><div class="val val-highlight">${bvnNum}</div></div>
                        <div class="row"><div class="label">Date of Birth & Gender</div><div class="val">${dob} • ${gender}</div></div>
                        <div class="row"><div class="label">Phone Number</div><div class="val">${phone}</div></div>
                        <div class="row"><div class="label">State / LGA</div><div class="val">${state} / ${lga}</div></div>
                    </div>
                </div>
                <div class="footer">
                    Abu-Mafhal Integrated Hub • NIBSS Verified Record
                </div>
            </div>
        </body>
        </html>
        `;

        setPrintingId(item.id || item.bvn);
        try {
            if (Platform.OS === 'web') {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(html);
                    printWindow.document.close();
                    printWindow.print();
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (e: any) {
            showAlert("Print Error", e.message || "Failed to print verification slip.", "error");
        } finally {
            setPrintingId(null);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const filtered = history.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.bvn && item.bvn.includes(query))
        );
    });

    const handleClearHistory = () => {
        Alert.alert(
            "Clear History",
            "Are you sure you want to clear your local BVN history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.removeItem('recent_bvn_verifications');
                        setHistory([]);
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            <LinearGradient
                colors={['#0B192C', '#06101E']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 6, paddingBottom: 20 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={18} color="#ffffff" />
                    </TouchableOpacity>
                    {history.length > 0 && (
                        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={13} color="#ef4444" />
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={styles.titleText}>BVN History</Text>
                <Text style={styles.subText}>View past verified records and reprints</Text>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Name or BVN..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={15} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
                {loading ? (
                    <ActivityIndicator size="small" color="#D4AF37" style={{ marginTop: 30 }} />
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No Verification History</Text>
                        <Text style={styles.emptyDesc}>All verified BVN records will appear here for free reprinting.</Text>
                    </View>
                ) : (
                    filtered.map((item) => (
                        <TouchableOpacity
                            key={item.id || item.bvn}
                            style={styles.card}
                            activeOpacity={0.8}
                            onPress={() => router.push({
                                pathname: '/(app)/bvn-services/verify',
                                params: { bvnNumber: item.bvn }
                            })}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="finger-print-outline" size={18} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.holderName} numberOfLines={1}>{item.name || 'BVN Holder'}</Text>
                                    <Text style={styles.bvnNumber}>{item.bvn}</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.reprintBadge}
                                    activeOpacity={0.7}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handlePrintSlip(item);
                                    }}
                                >
                                    {printingId === (item.id || item.bvn) ? (
                                        <ActivityIndicator size="small" color="#0B192C" />
                                    ) : (
                                        <>
                                            <Ionicons name="print-outline" size={13} color="#0B192C" />
                                            <Text style={styles.reprintText}>Print</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.dateText}>{item.date || 'Recently'}</Text>
                                <View style={styles.statusPill}>
                                    <Text style={styles.statusText}>VERIFIED</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
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
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    clearBtnText: { color: '#f87171', fontSize: 10, fontWeight: '700', marginLeft: 3 },
    titleText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 11, marginTop: 1, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, height: 38 },
    searchInput: { flex: 1, fontSize: 12, color: '#0B192C' },
    content: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingHorizontal: 20 },
    emptyTitle: { fontSize: 14, fontWeight: '800', color: '#475569', marginTop: 10 },
    emptyDesc: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 4, lineHeight: 16 },
    card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF9E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    holderName: { fontSize: 13, fontWeight: '800', color: '#0B192C' },
    bvnNumber: { fontSize: 11, color: '#B45309', marginTop: 1, fontWeight: '700' },
    reprintBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9E7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    reprintText: { fontSize: 10, fontWeight: '700', color: '#0B192C', marginLeft: 3 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    dateText: { fontSize: 10, color: '#94a3b8' },
    statusPill: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusText: { fontSize: 9, fontWeight: '800', color: '#15803d' },
});
