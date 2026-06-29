import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function NINHistoryScreen() {
    const router = useRouter();
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const stored = await AsyncStorage.getItem('recent_nin_verifications');
            setHistoryList(stored ? JSON.parse(stored) : []);
        } catch (e) {
            console.warn('Failed to load history', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => { loadHistory(); }, [])
    );

    const deleteHistoryItem = async (itemId: string, name: string) => {
        Alert.alert(
            'Confirm Delete',
            `Delete ${name || 'this record'} from history?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const updated = historyList.filter(item => item.id !== itemId);
                            setHistoryList(updated);
                            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
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
            'Clear All History',
            'Permanently clear all verification history? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem('recent_nin_verifications');
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
        const q = searchQuery.toLowerCase();
        return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.nin || '').includes(q) ||
            (item.layout || '').toLowerCase().includes(q)
        );
    });

    // Header right button — plain function, no styled component, to avoid CSS-interop crash
    const HeaderRight = () => (
        historyList.length > 0 ? (
            <TouchableOpacity onPress={clearAllHistory} style={s.headerBtn}>
                <Ionicons name="trash-bin-outline" size={20} color="#ff4d4d" />
            </TouchableOpacity>
        ) : null
    );

    return (
        <View style={s.root}>
            <Stack.Screen
                options={{
                    title: 'NIN History',
                    headerStyle: { backgroundColor: '#050B14' },
                    headerTintColor: '#fff',
                    headerShadowVisible: false,
                    headerRight: () => <HeaderRight />,
                }}
            />
            <StatusBar style="light" />

            {/* Hero gradient */}
            <LinearGradient colors={['#050B14', '#0B163A']} style={s.hero}>
                <Text style={s.heroTitle}>Reprint Center</Text>
                <Text style={s.heroSub}>Access past NIN prints and download them instantly for free.</Text>
            </LinearGradient>

            <View style={s.body}>
                {/* Search Bar */}
                <View style={s.searchBox}>
                    <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search by Name, NIN or Slip Type..."
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
                        <ActivityIndicator size="large" color="#0B163A" />
                    </View>
                ) : filteredList.length === 0 ? (
                    <View style={s.emptyBox}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="receipt-outline" size={32} color="#94a3b8" />
                        </View>
                        <Text style={s.emptyTitle}>No Records Found</Text>
                        <Text style={s.emptySub}>
                            {searchQuery.length > 0
                                ? 'No past verifications match your search.'
                                : "You haven't verified any NIN yet. Verified slips will appear here for free reprints."}
                        </Text>
                        {searchQuery.length === 0 && (
                            <TouchableOpacity
                                onPress={() => router.push('/nin-services/verify-nin')}
                                style={s.newBtn}
                            >
                                <Ionicons name="add-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={s.newBtnTxt}>Verify New NIN</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 60 }}>
                        <View style={s.listCard}>
                            {filteredList.map((item, idx) => (
                                <View
                                    key={item.id}
                                    style={[s.listRow, idx < filteredList.length - 1 && s.listRowBorder]}
                                >
                                    <TouchableOpacity
                                        onPress={() => router.push({
                                            pathname: '/nin-services/verify-nin',
                                            params: { reprintId: item.id }
                                        })}
                                        style={s.listLeft}
                                    >
                                        <View style={s.listIcon}>
                                            <Ionicons name="document-text" size={20} color="#0B163A" />
                                        </View>
                                        <View style={s.listInfo}>
                                            <Text style={s.listName} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={s.listMeta}>
                                                NIN: {item.nin} •{' '}
                                                <Text style={s.listLayout}>{(item.layout || '').toUpperCase()}</Text>
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={s.listRight}>
                                        <View style={s.listDateCol}>
                                            <Text style={s.listDate}>{(item.date || '').split(',')[0]}</Text>
                                            <Text style={s.listTime}>{(item.date || '').split(',')[1]?.trim()}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => deleteHistoryItem(item.id, item.name)}
                                            style={s.deleteBtn}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    hero: { paddingTop: 8, paddingBottom: 40, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    heroSub: { color: '#cbd5e1', fontSize: 12, fontWeight: '500', opacity: 0.9, marginTop: 2 },
    body: { flex: 1, paddingHorizontal: 12, marginTop: -24 },
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
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: { flex: 1, color: '#1e293b', fontWeight: '700', fontSize: 12 },

    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },

    emptyBox: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        paddingVertical: 64,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    emptyIcon: {
        backgroundColor: '#f8fafc',
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: { color: '#1e293b', fontWeight: '900', fontSize: 14, marginBottom: 4, textAlign: 'center' },
    emptySub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 16, maxWidth: 240 },
    newBtn: {
        backgroundColor: '#0B163A',
        paddingHorizontal: 24,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        flexDirection: 'row',
    },
    newBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },

    list: { flex: 1 },
    listCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    listLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
    listIcon: {
        backgroundColor: '#f8fafc',
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    listInfo: { flex: 1 },
    listName: { color: '#1e293b', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
    listMeta: { color: '#94a3b8', fontWeight: '700', fontSize: 10, marginTop: 2 },
    listLayout: { color: '#D97706', fontWeight: '900' },
    listRight: { flexDirection: 'row', alignItems: 'center' },
    listDateCol: { alignItems: 'flex-end', marginRight: 12 },
    listDate: { color: '#94a3b8', fontWeight: '700', fontSize: 9 },
    listTime: { color: '#cbd5e1', fontWeight: '700', fontSize: 8, marginTop: 2 },
    deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: '#fef2f2' },
});
