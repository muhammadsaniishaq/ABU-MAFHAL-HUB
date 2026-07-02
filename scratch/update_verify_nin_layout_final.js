const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    return (
        <View className="flex-1 bg-slate-50">`;

const targetIndex = content.indexOf(targetStr);
if (targetIndex === -1) {
    console.error('Could not find target in verify-nin.tsx');
    process.exit(1);
}

// Keep everything before targetStr
const beforeContent = content.slice(0, targetIndex);

const newContent = `    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Verify NIN', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />
            <StatusBar style="light" />

            <LinearGradient colors={['#060d21', '#0B163A']} style={styles.headerGradient}>
                <Text style={styles.headerTitle}>Verify Identity</Text>
            </LinearGradient>

            <ScrollView style={{ flex: 1, paddingHorizontal: 12, marginTop: -20 }} contentContainerStyle={styles.scrollContent}>
                {/* 1. SLIP LAYOUT */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>1</Text>
                        </View>
                        <Text style={styles.cardTitle}>Slip Layout</Text>
                    </View>
                    <View style={styles.layoutGrid}>
                        {layouts.map((layout) => {
                            const isSelected = selectedLayout === layout.id;
                            
                            return (
                                <TouchableOpacity
                                    key={layout.id}
                                    onPress={() => setSelectedLayout(layout.id)}
                                    style={[
                                        styles.layoutButton,
                                        isSelected ? styles.layoutButtonSelected : styles.layoutButtonUnselected
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.layoutIconBox}>
                                        {(layout as any).image && (
                                            <Image 
                                                source={(layout as any).image} 
                                                style={styles.layoutImage}
                                                resizeMode="contain" 
                                            />
                                        )}
                                    </View>
                                    <Text 
                                        style={[
                                            styles.layoutLabel,
                                            isSelected ? styles.layoutLabelSelected : styles.layoutLabelUnselected
                                        ]} 
                                        numberOfLines={2}
                                    >
                                        {layout.name}
                                    </Text>
                                    <Text 
                                        style={[
                                            styles.layoutPrice,
                                            isSelected ? styles.layoutPriceSelected : styles.layoutPriceUnselected
                                        ]}
                                    >
                                        ₦{layout.price}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </View>

                {/* 2. SUPPLY ID & VERIFY */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>2</Text>
                        </View>
                        <Text style={styles.cardTitle}>Enter Details</Text>
                    </View>
                    
                    <View style={{ marginBottom: 12 }}>
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
                    </View>

                    {/* Simple Checkbox area */}
                    <View style={styles.consentContainer}>
                        <BouncyCheckbox
                            size={18}
                            fillColor="#060d21"
                            unFillColor="#FFFFFF"
                            iconStyle={{ borderColor: "#cbd5e1", borderRadius: 4 }}
                            innerIconStyle={{ borderWidth: 1, borderRadius: 4 }}
                            onPress={(isChecked: boolean) => { setConsent(isChecked) }}
                        />
                        <Text style={styles.consentText}>
                            I confirm that I have obtained consent to verify this identity.
                        </Text>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify} 
                        disabled={loading || nin.length !== 11 || !consent} 
                        style={[
                            styles.verifyButton,
                            (loading || nin.length !== 11 || !consent) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#f5a623" size="small" /> : (
                            <>
                                <Text style={styles.verifyButtonText}>VERIFY NIN</Text>
                                {!consent && <Text style={styles.verifyButtonSubtext}>(tick consent first)</Text>}
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 3. RECENT VERIFICATIONS */}
                {historyList.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.historyHeader}>
                            <Ionicons name="time" size={16} color="#f5a623" />
                            <Text style={styles.historyTitle}>Recent Prints (Reprint)</Text>
                        </View>

                        <View style={{ flexDirection: 'column' }}>
                            {historyList.map((item) => (
                                <View key={item.id} style={styles.historyItem}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setSelectedLayout(item.layout);
                                            setNin(item.nin);
                                            setResult({ status: 'success', data: item.data });
                                        }}
                                        style={styles.historyItemLeft}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.historyIconContainer}>
                                            <Ionicons name="document-text" size={16} color="#060d21" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>NIN: {item.nin} • {item.layout.toUpperCase()}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyDate}>{item.date.split(',')[0]}</Text>
                                        <TouchableOpacity 
                                            onPress={() => deleteHistoryItem(item.id)}
                                            style={styles.deleteButton}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerGradient: {
        paddingTop: 16,
        paddingBottom: 40,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scrollContent: {
        paddingBottom: 80,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
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
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepBadge: {
        backgroundColor: '#f5a623',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    stepBadgeText: {
        color: '#060d21',
        fontWeight: '900',
        fontSize: 10,
    },
    cardTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    layoutGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
    },
    layoutButton: {
        borderRadius: 12,
        padding: 4,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        width: '23.5%',
        minHeight: 90,
    },
    layoutButtonSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    layoutButtonUnselected: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    layoutIconBox: {
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
    },
    layoutImage: {
        width: '90%',
        height: '90%',
    },
    layoutLabel: {
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 2,
        textAlign: 'center',
        lineHeight: 11,
    },
    layoutLabelSelected: {
        color: '#ffffff',
    },
    layoutLabelUnselected: {
        color: '#334155',
    },
    layoutPrice: {
        fontSize: 9,
        fontWeight: '900',
        textAlign: 'center',
    },
    layoutPriceSelected: {
        color: '#f5a623',
    },
    layoutPriceUnselected: {
        color: '#64748b',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 8,
    },
    input: {
        flex: 1,
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1.5,
    },
    consentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
        marginTop: 8,
    },
    consentText: {
        color: '#334155',
        fontSize: 10,
        flex: 1,
        fontWeight: '600',
        marginLeft: 8,
        lineHeight: 13,
    },
    verifyButton: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        width: '100%',
    },
    verifyButtonActive: {
        backgroundColor: '#060d21',
    },
    verifyButtonDisabled: {
        backgroundColor: 'rgba(6, 13, 33, 0.5)',
    },
    verifyButtonText: {
        fontWeight: '800',
        color: '#ffffff',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    verifyButtonSubtext: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        marginLeft: 6,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        marginLeft: 6,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    historyItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    historyIconContainer: {
        backgroundColor: '#f8fafc',
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    historyName: {
        color: '#1e293b',
        fontWeight: '800',
        fontSize: 12,
    },
    historyMeta: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 10,
        marginTop: 1,
    },
    historyRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    historyDate: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 9,
        marginRight: 10,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
});
`;

fs.writeFileSync(filePath, beforeContent + newContent, 'utf8');
console.log('Successfully updated verify-nin.tsx layout to use explicit StyleSheet!');
