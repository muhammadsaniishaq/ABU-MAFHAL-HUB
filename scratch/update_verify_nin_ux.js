const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add customAlert and searchQuery state hooks
const stateHookTarget = `    const { reprintId } = useLocalSearchParams();
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [nin, setNin] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const viewShotRef = useRef<any>(null);`;

const stateHookReplacement = `    const { reprintId } = useLocalSearchParams();
    const [selectedLayout, setSelectedLayout] = useState('premium');
    const [nin, setNin] = useState('');
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const viewShotRef = useRef<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Custom Smooth Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setCustomAlert({
            visible: true,
            title,
            message,
            type
        });
    };`;

content = content.replace(stateHookTarget, stateHookReplacement);

// 2. Replace Alert.alert with showAlert
content = content.split('Alert.alert("Error", "Sharing is not available on this device.");').join('showAlert("Sharing Unavailable", "Sharing is not available on this device.", "warning");');
content = content.split('Alert.alert("Error", "Failed to download PNG: " + e.message);').join('showAlert("PNG Download Failed", e.message, "error");');
content = content.split('Alert.alert("Error", "Failed to download PDF: " + e.message);').join('showAlert("PDF Download Failed", e.message, "error");');
content = content.split("Alert.alert('NIN Invalid', 'Please enter a valid 11-digit NIN number.');").join("showAlert('NIN Invalid', 'Please enter a valid 11-digit NIN number.', 'warning');");
content = content.split("Alert.alert('Consent Required', 'You must tick the consent checkbox before verifying.');").join("showAlert('Consent Required', 'You must tick the consent checkbox before verifying.', 'warning');");
content = content.split("Alert.alert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.');").join("showAlert('Insufficient Balance', 'Your wallet balance is too low. Please fund your wallet and try again.', 'error');");
content = content.split("Alert.alert('Session Expired', 'Please log out and log in again, then retry.');").join("showAlert('Session Expired', 'Please log out and log in again, then retry.', 'error');");
content = content.split("Alert.alert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.');").join("showAlert('No Record Found', 'The NIN you entered does not exist or has no record. Please check the number and try again.', 'error');");
content = content.split("Alert.alert('Verification Failed', msg);").join("showAlert('Verification Failed', msg, 'error');");
content = content.split("Alert.alert('Network Error', errM || 'A network error occurred. Please check your connection and try again.');").join("showAlert('Network Error', errM || 'A network error occurred. Please check your connection and try again.', 'error');");

// 3. Update the UI Render Method
const uiRenderStart = `    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            <LinearGradient colors={['#060d21', '#0B163A']} style={styles.headerGradient}>
                <Text style={styles.headerTitle}>Verify Identity</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -20 }} contentContainerStyle={styles.scrollContent}>`;

const uiRenderReplacement = `    // Filter history based on search
    const filteredHistory = historyList.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (item.name || '').toLowerCase().includes(q) ||
            (item.nin || '').includes(q) ||
            (item.layout || '').toLowerCase().includes(q)
        );
    });

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            {/* Premium Loader Modal */}
            {loading && (
                <Modal transparent visible={loading} animationType="fade">
                    <View style={styles.loaderOverlay}>
                        <View style={styles.loaderCard}>
                            <ActivityIndicator size="large" color="#f5a623" />
                            <Text style={styles.loaderTitle}>Verifying Identity</Text>
                            <Text style={styles.loaderSub}>Connecting to NIMC Secure Gateway...</Text>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Custom Modern Decorated Alert Modal */}
            <Modal
                transparent
                visible={customAlert.visible}
                animationType="fade"
                onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.alertOverlay}>
                    <View style={styles.alertCard}>
                        <View style={[
                            styles.alertIconBg,
                            customAlert.type === 'success' ? styles.alertSuccessIcon :
                            customAlert.type === 'error' ? styles.alertErrorIcon :
                            customAlert.type === 'warning' ? styles.alertWarningIcon : styles.alertInfoIcon
                        ]}>
                            <Ionicons 
                                name={
                                    customAlert.type === 'success' ? 'checkmark-circle' :
                                    customAlert.type === 'error' ? 'close-circle' :
                                    customAlert.type === 'warning' ? 'warning' : 'information-circle'
                                } 
                                size={36} 
                                color={
                                    customAlert.type === 'success' ? '#10b981' :
                                    customAlert.type === 'error' ? '#ef4444' :
                                    customAlert.type === 'warning' ? '#f5a623' : '#3b82f6'
                                } 
                            />
                        </View>
                        <Text style={styles.alertTitle}>{customAlert.title}</Text>
                        <Text style={styles.alertMessage}>{customAlert.message}</Text>
                        <TouchableOpacity 
                            style={styles.alertButton} 
                            onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.alertButtonText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <LinearGradient colors={['#060d21', '#0B163A']} style={styles.headerGradient}>
                <Text style={styles.headerTitle}>Verify Identity</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }} contentContainerStyle={styles.scrollContent}>`;

content = content.replace(uiRenderStart, uiRenderReplacement);

// 4. Update the recent verifications list in the JSX to use filteredHistory and add the Stats and Search Bar
const historyListStart = `                {/* 3. RECENT VERIFICATIONS */}
                {historyList.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.historyHeader}>
                            <Ionicons name="time" size={16} color="#f5a623" />
                            <Text style={styles.historyTitle}>Recent Prints (Reprint)</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {historyList.map((item) => (`;

const historyListReplacement = `                {/* ID Analytics / Verification Stats Widget */}
                {historyList.length > 0 && (
                    <View style={styles.statsCard}>
                        <View style={styles.statsHeader}>
                            <Ionicons name="analytics" size={16} color="#f5a623" />
                            <Text style={styles.statsTitle}>Verification Stats</Text>
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>{historyList.length}</Text>
                                <Text style={styles.statLabel}>Total Prints</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => item.layout === 'premium').length}
                                </Text>
                                <Text style={styles.statLabel}>Premium</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => item.layout === 'standard').length}
                                </Text>
                                <Text style={styles.statLabel}>Standard</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statBox}>
                                <Text style={styles.statNum}>
                                    {historyList.filter(item => ['regular', 'info'].includes(item.layout)).length}
                                </Text>
                                <Text style={styles.statLabel}>Other Slips</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Search Bar for past reprints */}
                {historyList.length > 0 && (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="Search past prints (Name or NIN)..."
                            placeholderTextColor="#94a3b8"
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* 3. RECENT VERIFICATIONS */}
                {filteredHistory.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.historyHeader}>
                            <Ionicons name="time" size={16} color="#f5a623" />
                            <Text style={styles.historyTitle}>Recent Prints (Reprint)</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {filteredHistory.map((item) => (`;

content = content.replace(historyListStart, historyListReplacement);

// 5. Update the stylesheet style rules at the end of the file
const styleDefStart = `const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },`;

const styleDefReplacement = `const styles = StyleSheet.create({
    loaderOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    loaderTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginTop: 16,
        letterSpacing: -0.2,
    },
    loaderSub: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 6,
        fontWeight: '500',
    },
    alertOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    alertCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: '85%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    alertIconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    alertSuccessIcon: {
        backgroundColor: '#ecfdf5',
    },
    alertErrorIcon: {
        backgroundColor: '#fef2f2',
    },
    alertWarningIcon: {
        backgroundColor: '#fff7ed',
    },
    alertInfoIcon: {
        backgroundColor: '#eff6ff',
    },
    alertTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0d1b3e',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    alertMessage: {
        fontSize: 12,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        fontWeight: '500',
        paddingHorizontal: 8,
    },
    alertButton: {
        backgroundColor: '#0d1b3e',
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: '#0d1b3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    alertButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 13,
    },
    statsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginLeft: 6,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0d1b3e',
    },
    statLabel: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#f1f5f9',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 0.5,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '600',
        fontSize: 13,
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },`;

content = content.replace(styleDefStart, styleDefReplacement);

// 6. Make layout button wide 48% (2 columns instead of 4)
content = content.replace(`    layoutButton: {
        borderRadius: 12,
        padding: 4,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        width: '23.5%',
        minHeight: 90,
    },`, `    layoutButton: {
        borderRadius: 16,
        padding: 10,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        width: '48.5%',
        minHeight: 110,
        backgroundColor: '#ffffff',
    },`);

content = content.replace(`    layoutIconBox: {
        width: '100%',
        height: 36,
        marginBottom: 6,
        backgroundColor: '#ffffff',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 0.5,
    },`, `    layoutIconBox: {
        width: '100%',
        height: 48,
        marginBottom: 8,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 0.5,
    },`);

content = content.replace(`    layoutLabel: {
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 2,
        textAlign: 'center',
        lineHeight: 11,
    },`, `    layoutLabel: {
        fontSize: 10.5,
        fontWeight: '800',
        marginBottom: 4,
        textAlign: 'center',
        lineHeight: 13,
    },`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated verify-nin.tsx layout arrangements, added stats widget, search functionality, and premium custom Alert/Loader modals!');
