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

export default function BVNHistoryScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [printingId, setPrintingId] = useState<string | null>(null);

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
                        date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
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
            <title>Official BVN Verification Slip - ${bvnNum}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc; color: #1e293b; }
                .card { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: #0f172a; color: white; padding: 20px; text-align: center; }
                .header h1 { margin: 0 0 4px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
                .header p { margin: 0; font-size: 11px; opacity: 0.8; }
                .body { padding: 24px; display: flex; gap: 20px; }
                .photo-box { width: 120px; height: 140px; background: #e2e8f0; border: 1px solid #94a3b8; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                .info { flex: 1; }
                .row { margin-bottom: 10px; }
                .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 2px; }
                .val { font-size: 14px; font-weight: bold; color: #0f172a; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .footer { background: #f1f5f9; padding: 12px 24px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
                .watermark { font-size: 16px; font-weight: 900; letter-spacing: 2px; color: #059669; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>Central Bank of Nigeria / NIBSS</h1>
                    <p>OFFICIAL BIOMETRIC VERIFICATION NUMBER (BVN) RECORD</p>
                </div>
                <div class="body">
                    <div class="photo-box">
                        ${photoSrc ? `<img src="${photoSrc}" />` : `<div style="font-size:10px;color:#64748b;">PASSPORT</div>`}
                    </div>
                    <div class="info">
                        <div class="row">
                            <div class="label">Full Name</div>
                            <div class="val">${fullName}</div>
                        </div>
                        <div class="grid-2">
                            <div class="row">
                                <div class="label">BVN Number</div>
                                <div class="val watermark">${bvnNum}</div>
                            </div>
                            <div class="row">
                                <div class="label">NIN Number</div>
                                <div class="val">${ninNum}</div>
                            </div>
                        </div>
                        <div class="grid-2">
                            <div class="row">
                                <div class="label">Date of Birth</div>
                                <div class="val">${dob}</div>
                            </div>
                            <div class="row">
                                <div class="label">Gender</div>
                                <div class="val">${gender}</div>
                            </div>
                        </div>
                        <div class="grid-2">
                            <div class="row">
                                <div class="label">Phone Number</div>
                                <div class="val">${phone}</div>
                            </div>
                            <div class="row">
                                <div class="label">State / LGA</div>
                                <div class="val">${state} / ${lga}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    Generated securely via Abu-Mafhal Integrated Hub • NIBSS Verified Record
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
            Alert.alert("Print Error", e.message);
        } finally {
            setPrintingId(null);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const filtered = history.filter(item => {
        const query = searchQuery.toLowerCase();
        return (item.name && item.name.toLowerCase().includes(query)) ||
               (item.bvn && item.bvn.includes(query));
    });

    const handleClearHistory = async () => {
        Alert.alert(
            "Clear History",
            "Are you sure you want to clear all BVN verification history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Clear",
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
                colors={['#050B14', '#0B163A']}
                style={[styles.headerGradient, { paddingTop: Math.max(insets.top, 20) + 8, paddingBottom: 24 }]}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={20} color="#ffffff" />
                    </TouchableOpacity>
                    {history.length > 0 && (
                        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <Text style={styles.titleText}>BVN Verification History</Text>
                <Text style={styles.subText}>View past verified records and reprint slips</Text>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#64748b" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by Name or BVN Number..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                {loading ? (
                    <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 40 }} />
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No Verification History</Text>
                        <Text style={styles.emptyDesc}>All verified BVN records will appear here for review and free reprinting.</Text>
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
                                    <Ionicons name="finger-print" size={20} color="#0284c7" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.holderName}>{item.name || 'BVN Holder'}</Text>
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
                                        <ActivityIndicator size="small" color="#059669" />
                                    ) : (
                                        <>
                                            <Ionicons name="print-outline" size={14} color="#059669" />
                                            <Text style={styles.reprintText}>Print Slip</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.dateText}>{item.date || 'Recently'}</Text>
                                <Text style={styles.statusText}>VERIFIED</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    clearBtnText: { color: '#f87171', fontSize: 11, fontWeight: '700', marginLeft: 4 },
    titleText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    subText: { color: '#94a3b8', fontSize: 12, marginTop: 2, marginBottom: 12 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, height: 42 },
    searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
    content: { flex: 1, padding: 16 },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 12 },
    emptyDesc: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6, lineHeight: 18 },
    card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center' },
    holderName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    bvnNumber: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
    reprintBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    reprintText: { fontSize: 11, fontWeight: '700', color: '#059669', marginLeft: 4 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    dateText: { fontSize: 11, color: '#94a3b8' },
    statusText: { fontSize: 10, fontWeight: '800', color: '#10B981' },
});
