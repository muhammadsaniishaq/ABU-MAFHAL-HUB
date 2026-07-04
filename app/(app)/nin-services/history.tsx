import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image } from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NINHistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { tab } = useLocalSearchParams();

    // Tab state: 'nin' | 'ipe' | 'validation' | 'personalization'
    const [activeTab, setActiveTab] = useState<'nin' | 'ipe' | 'validation' | 'personalization' | 'bvn'>('nin');
    
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

    // Sync tab param if provided
    useEffect(() => {
        if (tab && ['nin', 'ipe', 'validation', 'personalization', 'bvn'].includes(tab as string)) {
            setActiveTab(tab as any);
        }
    }, [tab]);

    const getStorageKeyForTab = (t: string) => {
        switch (t) {
            case 'ipe': return 'recent_ipe_requests';
            case 'validation': return 'recent_validation_requests';
            case 'personalization': return 'recent_personalization_requests';
            case 'bvn': return 'recent_bvn_requests';
            case 'nin':
            default:
                return 'recent_nin_verifications';
        }
    };

    const loadHistory = async (targetTab = activeTab) => {
        setLoading(true);
        try {
            const key = getStorageKeyForTab(targetTab);
            const stored = await AsyncStorage.getItem(key);
            setHistoryList(stored ? JSON.parse(stored) : []);
        } catch (e) {
            console.warn('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    // Load history when tab changes or screen gains focus
    useFocusEffect(
        useCallback(() => {
            loadHistory(activeTab);
        }, [activeTab])
    );

    const deleteHistoryItem = async (itemId: string, name: string) => {
        Alert.alert(
            'Confirm Delete',
            `Delete record for ${name || 'this request'} from history?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updated = historyList.filter(item => item.id !== itemId);
                            setHistoryList(updated);
                            const key = getStorageKeyForTab(activeTab);
                            await AsyncStorage.setItem(key, JSON.stringify(updated));
                        } catch {
                            Alert.alert('Error', 'Failed to delete record');
                        }
                    }
                }
            ]
        );
    };

    const clearAllHistory = async () => {
        const catName = activeTab === 'nin' ? 'NIN Slips' : activeTab === 'ipe' ? 'IPE Clearance' : activeTab === 'validation' ? 'Validation' : activeTab === 'personalization' ? 'Personalization' : 'BVN';
        Alert.alert(
            'Clear History',
            `Permanently clear all ${catName} history? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const key = getStorageKeyForTab(activeTab);
                            await AsyncStorage.removeItem(key);
                            setHistoryList([]);
                        } catch {
                            Alert.alert('Error', 'Failed to clear history');
                        }
                    }
                }
            ]
        );
    };

    const filteredList = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        // Search by target/NIN/Name
        const name = item.name || item.data?.name || item.data?.fullName || [item.data?.firstname, item.data?.lastname].filter(Boolean).join(' ') || '';
        const target = item.target || item.nin || '';
        const slip = item.slip || item.layout || '';
        return (
            name.toLowerCase().includes(q) ||
            target.toLowerCase().includes(q) ||
            slip.toLowerCase().includes(q)
        );
    });

    return (
        <View style={s.root}>
            <StatusBar style="light" />
            
            {/* Custom Header */}
            <View style={{ 
                paddingTop: Math.max(insets.top, 24) + 16, 
                paddingBottom: 16, 
                paddingHorizontal: 16, 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                backgroundColor: '#060d21'
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Reprint Center</Text>
                {historyList.length > 0 ? (
                    <TouchableOpacity onPress={clearAllHistory} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 32 }} />
                )}
            </View>

            {/* Custom Modern Alert / Detail view Modal */}
            <Modal
                transparent
                visible={!!selectedHistoryItem}
                animationType="slide"
                onRequestClose={() => setSelectedHistoryItem(null)}
            >
                <View style={s.detailOverlay}>
                    {selectedHistoryItem && (
                        <View style={s.detailCard}>
                            <LinearGradient colors={['#060d21', '#121F42']} style={s.detailHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                                        <View style={s.detailHeaderIconBox}>
                                            <Ionicons name="document-text" size={18} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.detailHeaderSubtitle}>REPRINT REQUEST</Text>
                                            <Text style={s.detailHeaderTitle} numberOfLines={1}>
                                                {selectedHistoryItem.name || selectedHistoryItem.data?.name || selectedHistoryItem.data?.fullName || [selectedHistoryItem.data?.firstname, selectedHistoryItem.data?.lastname].filter(Boolean).join(' ') || 'RECORD'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        style={s.detailCloseBtn} 
                                        onPress={() => setSelectedHistoryItem(null)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="close" size={18} color="#ffffff" />
                                    </TouchableOpacity>
                                </View>
                                <View style={s.detailBadgesRow}>
                                    <View style={s.detailBadgeCompleted}>
                                        <Ionicons name="checkmark-circle" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                                        <Text style={s.detailBadgeText}>Completed</Text>
                                    </View>
                                    <View style={s.detailBadgeSlip}>
                                        <Text style={s.detailBadgeText}>{(selectedHistoryItem.slip || selectedHistoryItem.layout || 'Service').toUpperCase()}</Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            <ScrollView style={s.detailScroll} contentContainerStyle={{ padding: 16 }}>
                                <View style={s.detailFieldFull}>
                                    <Text style={s.detailFieldLabel}>FULL NAME</Text>
                                    <Text style={s.detailFieldVal}>
                                        {selectedHistoryItem.name || selectedHistoryItem.data?.name || selectedHistoryItem.data?.fullName || [selectedHistoryItem.data?.firstname, selectedHistoryItem.data?.lastname].filter(Boolean).join(' ') || 'MUHAMMAD SANI ISYAKU'}
                                    </Text>
                                </View>

                                <View style={s.detailRow}>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>DATE OF BIRTH</Text>
                                        <Text style={s.detailFieldVal}>{selectedHistoryItem.data?.dob || selectedHistoryItem.data?.birthdate || '—'}</Text>
                                    </View>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>NIN / TARGET</Text>
                                        <Text style={s.detailFieldVal}>{selectedHistoryItem.target || selectedHistoryItem.nin || '—'}</Text>
                                    </View>
                                </View>

                                <View style={s.detailRow}>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>SERVICE CATEGORY</Text>
                                        <Text style={s.detailFieldVal}>{activeTab.toUpperCase()}</Text>
                                    </View>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>AMOUNT PAID</Text>
                                        <Text style={s.detailFieldVal}>₦{(selectedHistoryItem.amount || 0).toLocaleString()}</Text>
                                    </View>
                                </View>

                                <View style={s.detailMessageRow}>
                                    <Ionicons name="chatbubble-outline" size={14} color="#64748b" style={{ marginRight: 8, marginTop: 1 }} />
                                    <Text style={s.detailMessageText}>Completed and stored locally inside your mobile terminal memory.</Text>
                                </View>

                                <TouchableOpacity 
                                    style={s.detailDownloadBtn}
                                    onPress={() => {
                                        Alert.alert('Download Started', 'Reprinting document and downloading to your local storage...');
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="download-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={s.detailDownloadBtnText}>Download Slip</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    )}
                </View>
            </Modal>


            {/* Category Tabs */}
            <View style={s.tabContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('nin')}
                        style={[s.tabButton, activeTab === 'nin' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="document-text" size={13} color={activeTab === 'nin' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'nin' && s.tabTextActive]}>NIN Slips</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ipe')}
                        style={[s.tabButton, activeTab === 'ipe' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="shield-checkmark" size={13} color={activeTab === 'ipe' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'ipe' && s.tabTextActive]}>IPE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('validation')}
                        style={[s.tabButton, activeTab === 'validation' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="checkmark-circle" size={13} color={activeTab === 'validation' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'validation' && s.tabTextActive]}>Validation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('personalization')}
                        style={[s.tabButton, activeTab === 'personalization' && s.tabButtonActive, { paddingHorizontal: 16, marginRight: 4 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sparkles" size={13} color={activeTab === 'personalization' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'personalization' && s.tabTextActive]}>Personalize</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('bvn')}
                        style={[s.tabButton, activeTab === 'bvn' && s.tabButtonActive, { paddingHorizontal: 16 }]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="finger-print" size={13} color={activeTab === 'bvn' ? '#ffffff' : '#64748b'} />
                        <Text style={[s.tabText, activeTab === 'bvn' && s.tabTextActive]}>BVN</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={s.body}>
                {/* Search Bar */}
                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by Name or NIN..."
                        placeholderTextColor="#94a3b8"
                        style={s.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#cbd5e1" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <View style={s.centerBox}>
                        <ActivityIndicator size="large" color="#060d21" />
                    </View>
                ) : filteredList.length === 0 ? (
                    <View style={s.emptyBox}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="receipt-outline" size={28} color="#94a3b8" />
                        </View>
                        <Text style={s.emptyTitle}>No Records Found</Text>
                        <Text style={s.emptySub}>
                            {searchQuery.length > 0
                                ? 'No past verifications match your search.'
                                : "You haven't run any transactions in this category yet."}
                        </Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                        <View style={{ minWidth: '100%', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', alignSelf: 'flex-start' }}>
                            {/* Table Header */}
                            <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={{ width: 70, fontSize: 10, fontWeight: '800', color: '#64748b' }}>ACTION</Text>
                                <Text style={{ width: 70, fontSize: 10, fontWeight: '800', color: '#64748b' }}>AVATAR</Text>
                                <Text style={{ flex: 2, minWidth: 120, fontSize: 10, fontWeight: '800', color: '#64748b' }}>NAME</Text>
                                <Text style={{ flex: 1.5, minWidth: 100, fontSize: 10, fontWeight: '800', color: '#64748b' }}>NIN/TARGET</Text>
                                <Text style={{ flex: 1, minWidth: 80, fontSize: 10, fontWeight: '800', color: '#64748b' }}>STATUS</Text>
                                <Text style={{ flex: 1, minWidth: 70, fontSize: 10, fontWeight: '800', color: '#64748b' }}>TYPE</Text>
                                <Text style={{ flex: 1.5, minWidth: 90, fontSize: 10, fontWeight: '800', color: '#64748b' }}>DATE</Text>
                                <Text style={{ width: 60, fontSize: 10, fontWeight: '800', color: '#64748b', textAlign: 'center' }}>DELETE</Text>
                            </View>

                            {/* Table Body */}
                            <View>
                                {filteredList.map((item, idx) => {
                                    const recordName = item.name || item.data?.name || item.data?.fullName || [item.data?.firstname, item.data?.lastname].filter(Boolean).join(' ') || 'RECORD';
                                    const recordTarget = item.target || item.nin || '—';
                                    return (
                                        <View key={item.id} style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: idx === filteredList.length - 1 ? 0 : 1, borderColor: '#f1f5f9', alignItems: 'center' }}>
                                            <View style={{ width: 70 }}>
                                                <TouchableOpacity onPress={() => setSelectedHistoryItem(item)} style={{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                    <Text style={{ color: '#0284c7', fontSize: 10, fontWeight: '800' }}>VIEW</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ width: 70 }}>
                                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Ionicons name="document-text" size={14} color="#94a3b8" />
                                                </View>
                                            </View>
                                            <Text style={{ flex: 2, minWidth: 120, fontSize: 12, fontWeight: '700', color: '#1e293b' }} numberOfLines={1}>{recordName}</Text>
                                            <Text style={{ flex: 1.5, minWidth: 100, fontSize: 12, color: '#475569', fontWeight: '600' }}>{recordTarget}</Text>
                                            <View style={{ flex: 1, minWidth: 80 }}>
                                                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                    <Text style={{ color: '#10b981', fontSize: 9, fontWeight: '800' }}>DONE</Text>
                                                </View>
                                            </View>
                                            <Text style={{ flex: 1, minWidth: 70, fontSize: 11, color: '#64748b', fontWeight: '700' }}>{(item.slip || item.layout || 'REGULAR').toUpperCase()}</Text>
                                            <Text style={{ flex: 1.5, minWidth: 90, fontSize: 11, color: '#64748b' }}>{(item.date || '').split(',')[0]}</Text>
                                            <View style={{ width: 60, alignItems: 'center' }}>
                                                <TouchableOpacity onPress={() => deleteHistoryItem(item.id, recordName)} style={{ padding: 4 }}>
                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f4f6fb' },
    customHeader: {
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerIconContainer: {
        width: 38,
        height: 38,
        borderRadius: 11,
        backgroundColor: '#060d21',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerMainTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    headerSubTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    tabContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 4,
        marginHorizontal: 16,
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        height: 48,
        justifyContent: 'center',
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 38,
        borderRadius: 12,
    },
    tabButtonActive: {
        backgroundColor: '#060d21',
    },
    tabText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        marginLeft: 6,
    },
    tabTextActive: {
        color: '#ffffff',
    },
    body: { flex: 1, paddingHorizontal: 16, marginTop: 16 },
    headerBtn: { marginRight: 8, padding: 4 },

    searchBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: { flex: 1, color: '#1e293b', fontWeight: '700', fontSize: 11.5 },

    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },

    emptyBox: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 64,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    emptyIcon: {
        backgroundColor: '#f8fafc',
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: { color: '#1e293b', fontWeight: '900', fontSize: 13.5, marginBottom: 4, textAlign: 'center' },
    emptySub: { color: '#94a3b8', fontSize: 11, textAlign: 'center', lineHeight: 16, maxWidth: 240, fontWeight: '500' },

    list: { flex: 1 },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    listLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
    listIcon: {
        backgroundColor: '#f8fafc',
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    listInfo: { flex: 1 },
    listName: { color: '#1e293b', fontWeight: '900', fontSize: 11.5, textTransform: 'uppercase' },
    listMeta: { color: '#94a3b8', fontWeight: '700', fontSize: 9.5, marginTop: 2 },
    listLayout: { color: '#d97706', fontWeight: '900', fontSize: 9 },
    listRight: { flexDirection: 'row', alignItems: 'center' },
    listDateCol: { alignItems: 'flex-end', marginRight: 12 },
    listDate: { color: '#94a3b8', fontWeight: '700', fontSize: 9 },
    listTime: { color: '#cbd5e1', fontWeight: '700', fontSize: 8, marginTop: 1 },
    deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: '#fef2f2' },

    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    detailCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        width: '100%',
        maxWidth: 380,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 8,
    },
    detailHeader: {
        padding: 20,
        alignItems: 'flex-start',
    },
    detailHeaderIconBox: {
        backgroundColor: '#ffffff',
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    detailHeaderSubtitle: {
        color: '#f5a623',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    detailHeaderTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '900',
        marginTop: 1,
    },
    detailCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailBadgesRow: {
        flexDirection: 'row',
        marginTop: 14,
    },
    detailBadgeCompleted: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    detailBadgeSlip: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    detailBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
    },
    detailScroll: {
        maxHeight: 400,
    },
    detailFieldFull: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
    },
    detailFieldLabel: {
        fontSize: 8.5,
        color: '#94a3b8',
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    detailFieldVal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailFieldHalf: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        width: '48.5%',
    },
    detailMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        marginTop: 4,
        marginBottom: 16,
    },
    detailMessageText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    detailDownloadBtn: {
        backgroundColor: '#060d21',
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#060d21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
        marginBottom: 12,
    },
    detailDownloadBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 14,
    },
});
