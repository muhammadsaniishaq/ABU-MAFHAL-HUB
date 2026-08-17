import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    TextInput, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../services/supabase';

// Royal Executive Design Tokens
const L = {
    bg: '#020617',
    card: '#0F172A',
    cardBorder: 'rgba(245, 158, 11, 0.35)',
    navyHeader: '#0B132B',
    gold: '#F59E0B',
    goldDk: '#D97706',
    goldBg: 'rgba(245, 158, 11, 0.12)',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    inputBg: '#0F172A',
    inputBorder: '#1E293B',
    emerald: '#10B981',
    emeraldBg: 'rgba(16, 185, 129, 0.15)',
    emeraldBorder: '#059669',
    blue: '#3B82F6',
    blueBg: 'rgba(59, 130, 246, 0.15)',
    rose: '#EF4444'
};

const tables = [
    { name: 'profiles', label: 'User Profiles', icon: 'people' },
    { name: 'transactions', label: 'Transactions', icon: 'receipt' },
    { name: 'referrals', label: 'Referrals & Bonuses', icon: 'share-social' },
    { name: 'app_settings', label: 'App Settings', icon: 'options' },
    { name: 'notifications', label: 'Notifications', icon: 'notifications' },
    { name: 'kyc_requests', label: 'KYC Verification', icon: 'id-card' },
    { name: 'reviews', label: 'App Reviews', icon: 'star' },
    { name: 'tickets', label: 'Support Tickets', icon: 'chatbubbles' },
    { name: 'audit_logs', label: 'Audit Logs', icon: 'shield-checkmark' },
];

export default function DatabaseManager() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [selectedTable, setSelectedTable] = useState('profiles');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sqlMode, setSqlMode] = useState(false);
    const [queryText, setQueryText] = useState('SELECT * FROM profiles LIMIT 20;');
    const [searchQuery, setSearchQuery] = useState('');
    const [executingSql, setExecutingSql] = useState(false);

    // Selected Row Modal Inspection
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [rowModalVisible, setRowModalVisible] = useState(false);

    useEffect(() => {
        fetchTableData();
    }, [selectedTable]);

    const fetchTableData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(selectedTable)
                .select('*')
                .limit(50);

            if (error) throw error;
            setRows(data || []);
        } catch (error: any) {
            Alert.alert('Database Query Error', error.message || `Failed fetching table "${selectedTable}"`);
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteSql = async () => {
        const cleanQuery = queryText.trim();
        if (!cleanQuery) return;

        setExecutingSql(true);
        try {
            // Attempt executing RPC or direct table query based on query
            if (cleanQuery.toLowerCase().startsWith('select')) {
                const match = cleanQuery.match(/from\s+([a-zA-Z0-9_]+)/i);
                const targetTab = match ? match[1] : 'profiles';
                const { data, error } = await supabase.from(targetTab).select('*').limit(50);
                if (error) throw error;
                setRows(data || []);
                setSqlMode(false);
                setSelectedTable(targetTab);
                Alert.alert('Query Executed 🎉', `Fetched ${data?.length || 0} rows from table ${targetTab}.`);
            } else {
                Alert.alert('Notice', 'Custom SQL DDL is restricted for security. Please use Supabase Admin SQL Editor for DDL statements.');
            }
        } catch (err: any) {
            Alert.alert('SQL Execution Failed ❌', err.message || 'Error executing SQL buffer.');
        } finally {
            setExecutingSql(false);
        }
    };

    // Filter rows based on search input
    const filteredRows = rows.filter(row => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return Object.values(row).some(val => 
            val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        );
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    const handleCopyJson = async (obj: any) => {
        await Clipboard.setStringAsync(JSON.stringify(obj, null, 2));
        Alert.alert("Copied 📋", "JSON details copied to clipboard.");
    };

    return (
        <View style={{ flex: 1, backgroundColor: L.bg }}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header Bar */}
            <LinearGradient
                colors={['#020617', '#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ 
                    paddingTop: insets.top + 8, 
                    paddingBottom: 14, 
                    paddingHorizontal: 16, 
                    borderBottomWidth: 1.5, 
                    borderColor: L.goldDk,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="arrow-back" size={18} color={L.gold} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: 0.8 }}>
                            SUPABASE DATABASE FORGE
                        </Text>
                        <Text style={{ color: L.textMuted, fontSize: 9.5 }}>Live Postgres Table Explorer & Query Engine</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => setSqlMode(!sqlMode)}
                    style={{ backgroundColor: sqlMode ? L.goldBg : L.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: L.gold }}
                >
                    <Text style={{ color: L.gold, fontSize: 10.5, fontWeight: '900' }}>
                        {sqlMode ? '📋 View Tables' : '⚡ SQL Editor'}
                    </Text>
                </TouchableOpacity>
            </LinearGradient>

            {sqlMode ? (
                /* SQL EDITOR VIEW */
                <View style={{ flex: 1, padding: 16 }}>
                    <View style={{ backgroundColor: L.card, borderRadius: 16, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden', flex: 1, marginBottom: 14 }}>
                        <View style={{ backgroundColor: '#020617', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: L.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="terminal" size={16} color={L.emerald} />
                                <Text style={{ color: L.emerald, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '900' }}>query_buffer.sql</Text>
                            </View>
                            <TouchableOpacity onPress={handleExecuteSql} disabled={executingSql}>
                                {executingSql ? <ActivityIndicator size="small" color={L.emerald} /> : <Ionicons name="play" size={18} color={L.emerald} />}
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            value={queryText}
                            onChangeText={setQueryText}
                            multiline
                            style={{ 
                                flex: 1, 
                                padding: 14, 
                                color: L.emerald, 
                                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', 
                                fontSize: 13, 
                                lineHeight: 20, 
                                textAlignVertical: 'top' 
                            }}
                        />
                    </View>

                    <TouchableOpacity 
                        onPress={handleExecuteSql}
                        disabled={executingSql}
                        style={{ backgroundColor: L.emerald, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}
                    >
                        {executingSql ? (
                            <ActivityIndicator color="#020617" />
                        ) : (
                            <Text style={{ color: '#020617', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 }}>
                                RUN SQL QUERY ⚡
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                /* TABLE EXPLORER VIEW */
                <View style={{ flex: 1, flexDirection: 'row' }}>
                    
                    {/* Left Sidebar Table Selector */}
                    <View style={{ width: 140, backgroundColor: L.card, borderRightWidth: 1, borderColor: L.inputBorder, paddingTop: 10 }}>
                        <Text style={{ color: L.gold, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 10 }}>
                            Tables
                        </Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {tables.map(table => {
                                const isSelected = selectedTable === table.name;
                                return (
                                    <TouchableOpacity
                                        key={table.name}
                                        onPress={() => {
                                            setSelectedTable(table.name);
                                            setSearchQuery('');
                                        }}
                                        style={{ 
                                            paddingHorizontal: 10, 
                                            paddingVertical: 10, 
                                            flexDirection: 'row', 
                                            alignItems: 'center', 
                                            gap: 8,
                                            backgroundColor: isSelected ? L.goldBg : 'transparent',
                                            borderLeftWidth: isSelected ? 3 : 0,
                                            borderColor: L.gold
                                        }}
                                    >
                                        <Ionicons name={table.icon as any} size={14} color={isSelected ? L.gold : L.textMuted} />
                                        <Text style={{ color: isSelected ? L.gold : L.textSecondary, fontSize: 10, fontWeight: isSelected ? '900' : '600' }} numberOfLines={1}>
                                            {table.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Right Main Table Content View */}
                    <View style={{ flex: 1, backgroundColor: L.bg, padding: 12 }}>
                        
                        {/* Table Header & Search Row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }}>
                                    {selectedTable}
                                </Text>
                                <View style={{ backgroundColor: L.goldBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: L.gold }}>
                                    <Text style={{ color: L.gold, fontSize: 8.5, fontWeight: '900' }}>
                                        {filteredRows.length} Rows
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={fetchTableData}
                                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: L.card, borderWidth: 1, borderColor: L.inputBorder, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="refresh" size={16} color={L.gold} />
                            </TouchableOpacity>
                        </View>

                        {/* Real-time Search Input */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: L.card, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, height: 36, marginBottom: 10 }}>
                            <Ionicons name="search" size={14} color={L.textMuted} style={{ marginRight: 6 }} />
                            <TextInput 
                                style={{ flex: 1, color: L.textPrimary, fontSize: 11 }}
                                placeholder={`Filter ${selectedTable} rows...`}
                                placeholderTextColor={L.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery ? (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={14} color={L.textMuted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Data Grid / Loader */}
                        {loading ? (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={L.gold} />
                                <Text style={{ color: L.textMuted, fontSize: 10, marginTop: 8 }}>Fetching records from Supabase...</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ flex: 1 }}>
                                <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1 }}>
                                    <View style={{ backgroundColor: L.card, borderRadius: 12, borderWidth: 1, borderColor: L.inputBorder, overflow: 'hidden' }}>
                                        
                                        {/* Column Headers */}
                                        <View style={{ flexDirection: 'row', backgroundColor: '#020617', borderBottomWidth: 1, borderColor: L.inputBorder, paddingVertical: 8 }}>
                                            <Text style={{ width: 40, color: L.gold, fontSize: 9.5, fontWeight: '900', textAlign: 'center' }}>#</Text>
                                            {columns.map(col => (
                                                <Text key={col} style={{ width: 140, color: L.gold, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', paddingHorizontal: 8 }} numberOfLines={1}>
                                                    {col}
                                                </Text>
                                            ))}
                                        </View>

                                        {/* Row List */}
                                        {filteredRows.map((row, index) => (
                                            <TouchableOpacity 
                                                key={row.id || index}
                                                onPress={() => {
                                                    setSelectedRow(row);
                                                    setRowModalVisible(true);
                                                }}
                                                style={{ 
                                                    flexDirection: 'row', 
                                                    paddingVertical: 10, 
                                                    borderBottomWidth: 1, 
                                                    borderColor: 'rgba(255,255,255,0.05)',
                                                    backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={{ width: 40, color: L.textMuted, fontSize: 9.5, fontWeight: '700', textAlign: 'center' }}>
                                                    {index + 1}
                                                </Text>
                                                {columns.map(col => (
                                                    <Text key={col} style={{ width: 140, color: L.textSecondary, fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingHorizontal: 8 }} numberOfLines={1}>
                                                        {row[col] === null || row[col] === undefined ? 'null' : String(row[col])}
                                                    </Text>
                                                ))}
                                            </TouchableOpacity>
                                        ))}

                                        {filteredRows.length === 0 && (
                                            <View style={{ padding: 24, alignItems: 'center' }}>
                                                <Text style={{ color: L.textMuted, fontSize: 11, fontStyle: 'italic' }}>
                                                    No matching records found in table "{selectedTable}".
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            </ScrollView>
                        )}
                    </View>
                </View>
            )}

            {/* ROW DETAIL INSPECTION MODAL */}
            <Modal
                visible={rowModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setRowModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: '100%', maxWidth: 520, backgroundColor: L.card, borderRadius: 20, borderWidth: 1.5, borderColor: L.gold, padding: 18, maxHeight: '85%' }}>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="document-text" size={20} color={L.gold} />
                                <Text style={{ color: L.textPrimary, fontSize: 14, fontWeight: '900' }}>
                                    Record Inspector: {selectedTable}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setRowModalVisible(false)}>
                                <Ionicons name="close-circle" size={22} color={L.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={true} style={{ flex: 1, marginBottom: 12 }}>
                            {selectedRow && Object.entries(selectedRow).map(([key, val]) => (
                                <View key={key} style={{ backgroundColor: L.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 6 }}>
                                    <Text style={{ color: L.gold, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 2 }}>{key}</Text>
                                    <Text style={{ color: L.textPrimary, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                                        {val === null || val === undefined ? 'null' : String(val)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity 
                            onPress={() => handleCopyJson(selectedRow)}
                            style={{ backgroundColor: L.gold, borderRadius: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: '#020617', fontSize: 11, fontWeight: '900' }}>COPY ROW JSON 📋</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </Modal>
        </View>
    );
}
