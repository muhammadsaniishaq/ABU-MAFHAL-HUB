import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BVNHistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('recent_bvn_requests');
            setHistoryList(stored ? JSON.parse(stored) : []);
        } catch (e) {
            console.warn('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
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
                            await AsyncStorage.setItem('recent_bvn_requests', JSON.stringify(updated));
                        } catch {
                            Alert.alert('Error', 'Failed to delete record');
                        }
                    }
                }
            ]
        );
    };

    const clearAllHistory = async () => {
        Alert.alert(
            'Clear History',
            `Permanently clear all BVN history? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem('recent_bvn_requests');
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
        const name = item.data?.firstName || item.data?.first_name || item.data?.name || item.data?.fullName || [item.data?.firstname, item.data?.lastname].filter(Boolean).join(' ') || '';
        const target = item.target || item.bvn || item.data?.bvn || item.data?.phoneNumber1 || '';
        const slip = item.slip || '';
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
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>BVN History</Text>
                {historyList.length > 0 ? (
                    <TouchableOpacity onPress={clearAllHistory} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 32 }} />
                )}
            </View>

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
                                            <Ionicons name="finger-print" size={18} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.detailHeaderSubtitle}>BVN VERIFICATION</Text>
                                            <Text style={s.detailHeaderTitle} numberOfLines={1}>
                                                {[selectedHistoryItem.data?.firstName || selectedHistoryItem.data?.first_name, selectedHistoryItem.data?.lastName || selectedHistoryItem.data?.last_name].filter(Boolean).join(' ') || selectedHistoryItem.data?.name || 'RECORD HOLDER'}
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
                                        <Text style={s.detailBadgeText}>{(selectedHistoryItem.slip || 'Verification').toUpperCase()}</Text>
                                    </View>
                                </View>
                            </LinearGradient>

                            <ScrollView style={s.detailScroll} contentContainerStyle={{ padding: 16 }}>
                                <View style={s.detailFieldFull}>
                                    <Text style={s.detailFieldLabel}>FULL NAME</Text>
                                    <Text style={s.detailFieldVal}>
                                        {[selectedHistoryItem.data?.firstName || selectedHistoryItem.data?.first_name, selectedHistoryItem.data?.middleName || selectedHistoryItem.data?.middle_name, selectedHistoryItem.data?.lastName || selectedHistoryItem.data?.last_name].filter(Boolean).join(' ') || selectedHistoryItem.data?.name || '—'}
                                    </Text>
                                </View>

                                <View style={s.detailRow}>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>DATE OF BIRTH</Text>
                                        <Text style={s.detailFieldVal}>{selectedHistoryItem.data?.dateOfBirth || selectedHistoryItem.data?.dob || '—'}</Text>
                                    </View>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>SEARCH TARGET</Text>
                                        <Text style={s.detailFieldVal}>{selectedHistoryItem.target || '—'}</Text>
                                    </View>
                                </View>

                                <View style={s.detailRow}>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>VERIFIED BVN</Text>
                                        <Text style={s.detailFieldVal}>{selectedHistoryItem.data?.bvn || selectedHistoryItem.data?.number || '—'}</Text>
                                    </View>
                                    <View style={s.detailFieldHalf}>
                                        <Text style={s.detailFieldLabel}>AMOUNT PAID</Text>
                                        <Text style={s.detailFieldVal}>₦{(selectedHistoryItem.amount || 0).toLocaleString()}</Text>
                                    </View>
                                </View>

                                <View style={s.detailMessageRow}>
                                    <Ionicons name="information-circle-outline" size={14} color="#64748b" style={{ marginRight: 8, marginTop: 1 }} />
                                    <Text style={s.detailMessageText}>This record is stored securely on your device.</Text>
                                </View>

                            </ScrollView>
                        </View>
                    )}
                </View>
            </Modal>


            <View style={s.body}>
                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by Name or Number..."
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
                                ? 'No verifications match your search.'
                                : "You haven't run any BVN verifications yet."}
                        </Text>
                    </View>
                ) : (
                    <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 60 }}>
                        <View style={s.listCard}>
                            {filteredList.map((item, idx) => {
                                const recordName = [item.data?.firstName || item.data?.first_name, item.data?.lastName || item.data?.last_name].filter(Boolean).join(' ') || item.data?.name || 'RECORD';
                                const recordTarget = item.target || '—';
                                return (
                                    <View
                                        key={item.id}
                                        style={[s.listRow, idx < filteredList.length - 1 && s.listRowBorder]}
                                    >
                                        <TouchableOpacity
                                            onPress={() => setSelectedHistoryItem(item)}
                                            style={s.listLeft}
                                        >
                                            <View style={s.listIcon}>
                                                <Ionicons name="finger-print" size={18} color="#060d21" />
                                            </View>
                                            <View style={s.listInfo}>
                                                <Text style={s.listName} numberOfLines={1}>
                                                    {recordName}
                                                </Text>
                                                <Text style={s.listMeta}>
                                                    {recordTarget} •{' '}
                                                    <Text style={s.listLayout}>{(item.slip || 'Verification').toUpperCase()}</Text>
                                                </Text>
                                            </View>
                                        </TouchableOpacity>

                                        <View style={s.listRight}>
                                            <View style={s.listDateCol}>
                                                <Text style={s.listDate}>{(item.date || '').split(',')[0]}</Text>
                                                <Text style={s.listTime}>{(item.date || '').split(',')[1]?.trim() || ''}</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => deleteHistoryItem(item.id, recordName)}
                                                style={s.deleteBtn}
                                            >
                                                <Ionicons name="trash-outline" size={13} color="#DC2626" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f4f6fb' },
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
});
