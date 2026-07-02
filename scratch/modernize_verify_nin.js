const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Clipboard to imports
content = content.replace(
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';",
    "import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { Clipboard } from 'react-native';"
);

// 2. Update DEFAULT_LAYOUTS with badges
const oldLayouts = `const DEFAULT_LAYOUTS = [
    { id: 'premium', db_id: 'nin_premium', name: 'Premium', price: 200, type: 'prem', image: require('../../assets/images/premium.png') },
    { id: 'standard', db_id: 'nin_standard', name: 'Standard', price: 200, type: 'nonprem', image: require('../../assets/images/standard.png') },
    { id: 'regular', db_id: 'nin_regular', name: 'Regular', price: 180, type: 'nonprem', image: require('../../assets/images/regular.png') },
    { id: 'info', db_id: 'nin_info', name: 'Information', price: 200, type: 'nonprem', image: require('../../assets/images/info.png') },
];`;

const newLayouts = `const DEFAULT_LAYOUTS = [
    { id: 'premium', db_id: 'nin_premium', name: 'Premium Card', price: 200, type: 'prem', image: require('../../assets/images/premium.png'), badge: 'Digital ID' },
    { id: 'standard', db_id: 'nin_standard', name: 'Standard Card', price: 200, type: 'nonprem', image: require('../../assets/images/standard.png'), badge: 'Color Card' },
    { id: 'regular', db_id: 'nin_regular', name: 'Regular Slip', price: 180, type: 'nonprem', image: require('../../assets/images/regular.png'), badge: 'B&W Slip' },
    { id: 'info', db_id: 'nin_info', name: 'Information', price: 200, type: 'nonprem', image: require('../../assets/images/info.png'), badge: 'Full Sheet' },
];`;

content = content.replace(oldLayouts, newLayouts);

// 3. Add state hooks for wallet balance, FAQ accordion, paste function
const stateStartTarget = `    const { reprintId } = useLocalSearchParams();
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
    const [searchQuery, setSearchQuery] = useState('');`;

const stateStartReplacement = `    const { reprintId } = useLocalSearchParams();
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
    
    // Additional Premium States
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    const faqs = [
        { q: 'Yaya wannan tsarin yake aiki?', a: 'Zaɓi katin da kake buƙata (Premium, Standard, Regular ko Info), rubuta lambar NIN ɗinka guda 11, sannan ka danna Verify. Katinka zai fito nan take cikin tsari na zamani don saukewa ko bugawa.' },
        { q: 'Nawa ne kuɗin tantancewa?', a: 'Kuɗin kowane tsari yana nan a rubuce a ƙasan kowane kati. Za a cire kuɗin ne kawai idan an samu nasarar tantance lambar.' },
        { q: 'Zan iya sake sauke katin da na riga na biya?', a: 'Haka ne! Dukan katunan da ka fitar a baya suna nan a ajiye a cikin rukunin "Recent Prints" (Tarihi). Zaka iya sake duba su ko sauke su (PDF ko PNG) kyauta ba tare da an sake cire ko sisi ba.' }
    ];

    const fetchWalletBalance = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
                if (data) {
                    setUserBalance(Number(data.balance));
                }
            }
        } catch (e) {
            console.warn('Failed to load wallet balance', e);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getString();
            const clean = text.replace(/\\D/g, '').slice(0, 11);
            setNin(clean);
            showAlert('Pasted Successfully', 'NIN copied from your clipboard has been pasted.', 'success');
        } catch (e) {
            console.warn('Failed to paste from clipboard', e);
        }
    };`;

content = content.replace(stateStartTarget, stateStartReplacement);

// Update useEffect to fetch balance
content = content.replace(
    `        fetchPrices();
        loadHistory();
    }, []);`,
    `        fetchPrices();
        loadHistory();
        fetchWalletBalance();
    }, []);`
);

// 4. Update the layout item rendering inside return to add badges
const layoutItemOld = `                                    <View style={styles.layoutIconBox}>
                                        {(layout as any).image && (
                                            <Image 
                                                source={(layout as any).image} 
                                                style={styles.layoutImage}
                                                resizeMode="contain" 
                                            />
                                        )}
                                    </View>`;

const layoutItemNew = `                                    <View style={[
                                        styles.badgeContainer,
                                        isSelected ? styles.badgeSelected : styles.badgeUnselected
                                    ]}>
                                        <Text style={[
                                            styles.badgeText,
                                            isSelected ? styles.badgeTextSelected : styles.badgeTextUnselected
                                        ]}>
                                            {(layout as any).badge}
                                        </Text>
                                    </View>
                                    <View style={styles.layoutIconBox}>
                                        {(layout as any).image && (
                                            <Image 
                                                source={(layout as any).image} 
                                                style={styles.layoutImage}
                                                resizeMode="contain" 
                                            />
                                        )}
                                    </View>`;

content = content.replace(layoutItemOld, layoutItemNew);

// 5. Update input container in form screen to include Paste helper and length indicator
const inputContainerOld = `                    <View style={{ marginBottom: 12 }}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="keypad" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter 11-Digit NIN"
                                placeholderTextColor="#94a3b8"
                                style={styles.input}
                                keyboardType="number-pad" 
                                maxLength={11} 
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                        </View>
                    </View>`;

const inputContainerNew = `                    <View style={{ marginBottom: 12 }}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="keypad" size={16} color="#94a3b8" />
                            <TextInput
                                placeholder="Enter 11-Digit NIN"
                                placeholderTextColor="#94a3b8"
                                style={styles.input}
                                keyboardType="number-pad" 
                                maxLength={11} 
                                value={nin} 
                                onChangeText={setNin} 
                                editable={!loading}
                            />
                            {nin.length > 0 && (
                                <Text style={[
                                    styles.lenIndicator,
                                    nin.length === 11 ? styles.lenIndicatorSuccess : styles.lenIndicatorWarning
                                ]}>
                                    {nin.length}/11
                                </Text>
                            )}
                            <TouchableOpacity 
                                style={styles.pasteBtn} 
                                onPress={handlePaste}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="clipboard-outline" size={14} color="#060d21" />
                                <Text style={styles.pasteBtnText}>Paste</Text>
                            </TouchableOpacity>
                        </View>
                    </View>`;

content = content.replace(inputContainerOld, inputContainerNew);

// 6. Insert Wallet Status Bar at the top of the form, and FAQ section at the bottom of the form
const scrollStartOld = `<ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }} contentContainerStyle={styles.scrollContent}>`;

const scrollStartNew = `<ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: 12 }} contentContainerStyle={styles.scrollContent}>
                
                {/* Wallet Balance widget */}
                <View style={styles.walletBar}>
                    <View style={styles.walletLeft}>
                        <Ionicons name="wallet-outline" size={20} color="#060d21" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.walletLabel}>Tantancewa Balance</Text>
                            <Text style={styles.walletVal}>
                                {userBalance !== null ? \`₦\${userBalance.toLocaleString()}\` : 'Loading...'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={styles.fundBtn}
                        onPress={() => router.push('/fund-wallet')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add-circle" size={14} color="#ffffff" />
                        <Text style={styles.fundBtnText}>Fund</Text>
                    </TouchableOpacity>
                </View>`;

content = content.replace(scrollStartOld, scrollStartNew);

// FAQ Accordion to be added right before the end of scroll content (before historyList)
const faqAccordionBlock = `                {/* FAQ / Guidelines Section */}
                <View style={styles.card}>
                    <View style={styles.historyHeader}>
                        <Ionicons name="help-circle" size={16} color="#f5a623" />
                        <Text style={styles.historyTitle}>FAQ & Guidelines</Text>
                    </View>
                    {faqs.map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                            <View key={idx} style={styles.faqItem}>
                                <TouchableOpacity 
                                    style={styles.faqHeader} 
                                    onPress={() => setExpandedFaq(isExpanded ? null : idx)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                                    <Ionicons 
                                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                                        size={14} 
                                        color="#64748b" 
                                    />
                                </TouchableOpacity>
                                {isExpanded && (
                                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                                )}
                            </View>
                        );
                    })}
                </View>

`;

content = content.replace('                {/* ID Analytics / Verification Stats Widget */}', faqAccordionBlock + '                {/* ID Analytics / Verification Stats Widget */}');

// 7. Add Styles to Stylesheet
const stylesOld = `    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },`;

const stylesNew = `    walletBar: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletLabel: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    walletVal: {
        fontSize: 15,
        fontWeight: '900',
        color: '#060d21',
        marginTop: 1,
    },
    fundBtn: {
        backgroundColor: '#060d21',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fundBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 11,
        marginLeft: 4,
    },
    badgeContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 5,
    },
    badgeSelected: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    badgeUnselected: {
        backgroundColor: '#f1f5f9',
    },
    badgeText: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    badgeTextSelected: {
        color: '#ffffff',
    },
    badgeTextUnselected: {
        color: '#64748b',
    },
    lenIndicator: {
        fontSize: 10,
        fontWeight: '800',
        marginRight: 8,
    },
    lenIndicatorSuccess: {
        color: '#10b981',
    },
    lenIndicatorWarning: {
        color: '#f5a623',
    },
    pasteBtn: {
        backgroundColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 8,
        height: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pasteBtnText: {
        color: '#060d21',
        fontWeight: '800',
        fontSize: 10,
        marginLeft: 3,
    },
    faqItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 10,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    faqQuestion: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 11.5,
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        color: '#64748b',
        fontSize: 11,
        marginTop: 6,
        lineHeight: 16,
        fontWeight: '500',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },`;

content = content.replace(stylesOld, stylesNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully completed full verification modernization and added all key conveniences (Wallet Bar, Paste Helper, Live Counter, Badges, FAQ Accordion)!');
