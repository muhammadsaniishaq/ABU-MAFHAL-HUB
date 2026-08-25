import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verificationHistory, extractFullName } from '../../../services/verificationHistory';

export default function BVNHistoryScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const loadHistory = async () => {
        setLoading(true);
        try {
            const dbList = await verificationHistory.getAll('bvn');
            const stored = await AsyncStorage.getItem('recent_bvn_verifications');
            const localList = stored ? JSON.parse(stored) : [];

            const combinedMap = new Map();

            for (const item of localList) {
                const fullName = extractFullName(item.data || item.details, item.name || item.holder_name);
                const bvnNum = item.bvn || item.search_number || item.id;
                if (bvnNum) {
                    combinedMap.set(bvnNum, {
                        ...item,
                        bvn: bvnNum,
                        name: fullName,
                        date: item.date || 'Recently'
                    });
                }
            }

            if (dbList && dbList.length > 0) {
                for (const item of dbList) {
                    const fullName = extractFullName(item.details, item.holder_name);
                    const bvnNum = item.search_number || item.details?.bvn || item.details?.data?.bvn || item.id;
                    combinedMap.set(bvnNum, {
                        id: item.id,
                        bvn: bvnNum,
                        name: fullName,
                        date: item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
                        data: item.details
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
            "Share Tarihi",
            "Kana da tabbacin kana son goge dukkan tarihin tantance BVN?",
            [
                { text: "A'a", style: "cancel" },
                {
                    text: "I, Goge",
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
                            <Text style={styles.clearBtnText}>Share</Text>
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
                        placeholder="Nemi da Suna ko Lambar BVN..."
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
                        <Text style={styles.emptyTitle}>Babu Tarihin Tantancewa</Text>
                        <Text style={styles.emptyDesc}>Duk BVN da ka tantance zai fito a nan don sake dubawa ko bugawa kyauta.</Text>
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
                                <View style={styles.reprintBadge}>
                                    <Ionicons name="print-outline" size={14} color="#059669" />
                                    <Text style={styles.reprintText}>Reprint</Text>
                                </View>
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
