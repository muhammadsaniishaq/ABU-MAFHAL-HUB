const fs = require('fs');
const file = 'app/manage/settings.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add 'features' to activeTab and state
content = content.replace("const [activeTab, setActiveTab] = useState<'system' | 'economics' | 'api'>('system');", 
const [activeTab, setActiveTab] = useState<'system' | 'features' | 'economics' | 'api'>('system');

    // Feature Flags
    const allKnownFeatures = [
      'feature_transfer', 'feature_airtime', 'feature_data', 'feature_education',
      'feature_bills', 'feature_cards', 'feature_savings', 'feature_loans',
      'feature_crypto', 'feature_analytics', 'feature_rewards', 'feature_qr',
      'feature_invest', 'feature_insurance', 'feature_bvn', 'feature_nin', 'feature_cac',
      'feature_smile', 'feature_social'
    ];
    
    const [features, setFeatures] = useState<Record<string, boolean>>(
        allKnownFeatures.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    ););

// 2. Add hidden_features parser
content = content.replace("if (s.key === 'global_announcement') {", 
if (s.key === 'hidden_features') {
                        try {
                            const hiddenList = JSON.parse(s.value);
                            setFeatures(prev => {
                                const newFeatures = { ...prev };
                                hiddenList.forEach(feat => { newFeatures[feat] = false; });
                                return newFeatures;
                            });
                        } catch (e) { }
                    }
                    if (s.key === 'global_announcement') {);

// 3. Add hidden_features save logic in handleUpdateSettings
content = content.replace("// Update System Settings", 
// Update System Settings
            const hiddenFeaturesList = Object.entries(features)
                .filter(([_, isVisible]) => !isVisible)
                .map(([key, _]) => key);
);

// 4. Add hidden_features to settingsToSave
content = content.replace("{ key: 'hide_user_balances', value: String(hideUserBalances) },", 
{ key: 'hide_user_balances', value: String(hideUserBalances) },
                { key: 'hidden_features', value: JSON.stringify(hiddenFeaturesList) },);

// 5. Inject Features tab UI block
const uiBlock = 
                {activeTab === 'features' && (
                    <View style={s.section}>
                        <Text style={s.groupLabel}>Utility & Bills</Text>
                        <View style={s.card}>
                            <ToggleRow title="Airtime Top-up" subtitle="Toggle airtime recharge feature" icon="phone-portrait" color="#f97316" value={features['feature_airtime'] ?? true} onValueChange={(val) => setFeatures({...features, feature_airtime: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Data Bundles" subtitle="Toggle data subscription feature" icon="wifi" color="#22c55e" value={features['feature_data'] ?? true} onValueChange={(val) => setFeatures({...features, feature_data: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Smile Data" subtitle="Toggle Smile internet data" icon="globe" color="#ec4899" value={features['feature_smile'] ?? true} onValueChange={(val) => setFeatures({...features, feature_smile: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Cable TV & Bills" subtitle="Toggle DSTV, GOTV, Electricity" icon="tv" color="#8b5cf6" value={features['feature_bills'] ?? true} onValueChange={(val) => setFeatures({...features, feature_bills: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Education (WAEC/NECO)" subtitle="Toggle result checker pins" icon="school" color="#06b6d4" value={features['feature_education'] ?? true} onValueChange={(val) => setFeatures({...features, feature_education: val})} />
                        </View>

                        <Text style={s.groupLabel}>Transfers & Cards</Text>
                        <View style={s.card}>
                            <ToggleRow title="Fund Transfers" subtitle="Toggle bank transfers" icon="swap-horizontal" color="#2563eb" value={features['feature_transfer'] ?? true} onValueChange={(val) => setFeatures({...features, feature_transfer: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Virtual Cards" subtitle="Toggle USD/NGN virtual cards" icon="card" color="#14b8a6" value={features['feature_cards'] ?? true} onValueChange={(val) => setFeatures({...features, feature_cards: val})} />
                        </View>

                        <Text style={s.groupLabel}>Financial & Crypto</Text>
                        <View style={s.card}>
                            <ToggleRow title="Crypto Trading" subtitle="Toggle cryptocurrency exchange" icon="logo-bitcoin" color="#f59e0b" value={features['feature_crypto'] ?? true} onValueChange={(val) => setFeatures({...features, feature_crypto: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Savings" subtitle="Toggle savings" icon="wallet" color="#10b981" value={features['feature_savings'] ?? true} onValueChange={(val) => setFeatures({...features, feature_savings: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Investments" subtitle="Toggle investments feature" icon="trending-up" color="#0ea5e9" value={features['feature_invest'] ?? true} onValueChange={(val) => setFeatures({...features, feature_invest: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Loans" subtitle="Toggle loan services" icon="cash" color="#ef4444" value={features['feature_loans'] ?? true} onValueChange={(val) => setFeatures({...features, feature_loans: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Insurance" subtitle="Toggle insurance services" icon="shield-checkmark" color="#6366f1" value={features['feature_insurance'] ?? true} onValueChange={(val) => setFeatures({...features, feature_insurance: val})} />
                        </View>

                        <Text style={s.groupLabel}>Extras & Analytics</Text>
                        <View style={s.card}>
                            <ToggleRow title="Social Boost" subtitle="Toggle social media boosting" icon="rocket" color="#ec4899" value={features['feature_social'] ?? true} onValueChange={(val) => setFeatures({...features, feature_social: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Analytics" subtitle="Toggle user analytics dashboard" icon="pie-chart" color="#8b5cf6" value={features['feature_analytics'] ?? true} onValueChange={(val) => setFeatures({...features, feature_analytics: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="Rewards" subtitle="Toggle rewards and points" icon="gift" color="#ec4899" value={features['feature_rewards'] ?? true} onValueChange={(val) => setFeatures({...features, feature_rewards: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="QR Pay" subtitle="Toggle QR code payments" icon="qr-code" color="#14b8a6" value={features['feature_qr'] ?? true} onValueChange={(val) => setFeatures({...features, feature_qr: val})} />
                        </View>

                        <Text style={s.groupLabel}>Identity & Verification</Text>
                        <View style={s.card}>
                            <ToggleRow title="BVN Verification" subtitle="Toggle BVN lookup service" icon="finger-print" color="#3b82f6" value={features['feature_bvn'] ?? true} onValueChange={(val) => setFeatures({...features, feature_bvn: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="NIN Registration" subtitle="Toggle NIN lookup service" icon="person-add" color="#10b981" value={features['feature_nin'] ?? true} onValueChange={(val) => setFeatures({...features, feature_nin: val})} />
                            <View style={s.divider} />
                            <ToggleRow title="CAC Registration" subtitle="Toggle business registration" icon="briefcase" color="#8b5cf6" value={features['feature_cac'] ?? true} onValueChange={(val) => setFeatures({...features, feature_cac: val})} />
                        </View>
                        
                        <TouchableOpacity onPress={handleUpdateSettings} style={s.saveBtn} activeOpacity={0.8}>
                            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                    <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={s.saveBtnText}>Save Features</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
;
content = content.replace("{activeTab === 'economics' && (", uiBlock + "\n                {activeTab === 'economics' && (");

// 6. Inject tab button
const tabBtn = 
                        <TouchableOpacity onPress={() => setActiveTab('system')} style={[s.tabBtn, activeTab === 'system' && s.tabBtnActive]}>
                            <Ionicons name="settings-outline" size={14} color={activeTab === 'system' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />
                            <Text style={[s.tabText, activeTab === 'system' && s.tabTextActive]}>System</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setActiveTab('features')} style={[s.tabBtn, activeTab === 'features' && s.tabBtnActive]}>
                            <Ionicons name="apps-outline" size={14} color={activeTab === 'features' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />
                            <Text style={[s.tabText, activeTab === 'features' && s.tabTextActive]}>Features</Text>
                        </TouchableOpacity>
;
content = content.replace("<TouchableOpacity onPress={() => setActiveTab('system')} style={[s.tabBtn, activeTab === 'system' && s.tabBtnActive]}>\n                            <Ionicons name=\"settings-outline\" size={14} color={activeTab === 'system' ? '#0d1b3e' : '#94a3b8'} style={{ marginRight: 4 }} />\n                            <Text style={[s.tabText, activeTab === 'system' && s.tabTextActive]}>System</Text>\n                        </TouchableOpacity>", tabBtn);

// 7. Fix styling
content = content.replace("tabBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },", "tabBtn: { flex: 1, minWidth: 90, flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },");

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
