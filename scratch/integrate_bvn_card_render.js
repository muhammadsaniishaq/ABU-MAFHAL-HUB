const fs = require('fs');
const path = require('path');

const bvnPath = path.join(__dirname, '../app/bvn-services.tsx');

if (fs.existsSync(bvnPath)) {
    let content = fs.readFileSync(bvnPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // 1. Add ImageBackground to imports if not present
    content = content.replace(
        "import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image, Platform } from 'react-native';",
        "import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, StyleSheet, Image, Platform, ImageBackground } from 'react-native';"
    );

    // 2. Replace slipImageBox preview source with bvn_card_template.png
    content = content.replace(
        "source={require('../assets/images/premium.png')}",
        "source={require('../assets/images/bvn_card_template.png')}"
    );

    // 3. Update the verified card display to support ImageBackground overlay for BVN Card
    const oldCardMarkup = `                    {/* Gorgeous ID card preview */}
                    <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.idPreviewCard}>
                        {/* Watermark grid background pattern */}
                        <View style={styles.cardWatermarkGrid} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.cardLogoText}>BVN NIGERIA</Text>
                            <Ionicons name="wifi" size={18} color="#f5a623" style={{ transform: [{ rotate: '90deg' }] }} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <View style={styles.cardPortraitBox}>
                                <Image source={{ uri: photoUrl }} style={styles.cardPortrait} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.cardFieldLabel}>HOLDER NAME</Text>
                                <Text style={styles.cardFieldVal} numberOfLines={1}>{fullName}</Text>

                                <Text style={[styles.cardFieldLabel, { marginTop: 10 }]}>BVN NUMBER</Text>
                                <Text style={styles.cardFieldVal}>{result.number || result.bvn || inputValue}</Text>
                            </View>
                        </View>

                        <View style={styles.cardBottomRow}>
                            <View>
                                <Text style={styles.cardFieldLabel}>DATE OF BIRTH</Text>
                                <Text style={styles.cardFieldVal}>{result.dateOfBirth || result.dob || '—'}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.cardFieldLabel}>GENDER</Text>
                                <Text style={styles.cardFieldVal}>{(result.gender || '—').toUpperCase()}</Text>
                            </View>
                        </View>
                    </LinearGradient>`;

    const newCardMarkup = `                    {/* Gorgeous ID card preview */}
                    {searchType === 'card' ? (
                        <ImageBackground 
                            source={require('../assets/images/bvn_card_template.png')} 
                            style={styles.bvnCardBackground}
                            imageStyle={{ borderRadius: 16 }}
                            resizeMode="cover"
                        >
                            {/* Portrait Photo on Left */}
                            <View style={styles.bvnCardPortraitContainer}>
                                <Image source={{ uri: photoUrl }} style={styles.bvnCardPortrait} />
                            </View>

                            {/* Surname */}
                            <View style={[styles.bvnCardTextRow, { top: '24%' }]}>
                                <Text style={styles.bvnCardTextBold}>{result.lastName || result.last_name || '—'}</Text>
                            </View>

                            {/* First Name / Other Name */}
                            <View style={[styles.bvnCardTextRow, { top: '44%' }]}>
                                <Text style={styles.bvnCardTextBold}>
                                    {[result.firstName || result.first_name, result.middleName || result.middle_name].filter(Boolean).join(' ') || '—'}
                                </Text>
                            </View>

                            {/* Date of Birth & Gender & Issue Date */}
                            <View style={[styles.bvnCardTextRow, { top: '63%', flexDirection: 'row', width: '65%' }]}>
                                <View style={{ width: '42%' }}>
                                    <Text style={styles.bvnCardTextBold}>{result.dateOfBirth || result.dob || '—'}</Text>
                                </View>
                                <View style={{ width: '28%' }}>
                                    <Text style={styles.bvnCardTextBold}>{(result.gender || '—').toUpperCase()}</Text>
                                </View>
                                <View style={{ width: '30%', paddingLeft: 5 }}>
                                    <Text style={styles.bvnCardTextBold}>
                                        {(() => {
                                            const d = new Date();
                                            const pad = (n) => n.toString().padStart(2, '0');
                                            return \`\${pad(d.getDate())}-\${pad(d.getMonth() + 1)}-\${d.getFullYear()}\`;
                                        })()}
                                    </Text>
                                </View>
                            </View>

                            {/* BVN Number */}
                            <View style={[styles.bvnCardTextRow, { top: '82%' }]}>
                                <Text style={[styles.bvnCardTextBold, { fontSize: 13, letterSpacing: 1.5, color: '#060d21' }]}>
                                    {result.number || result.bvn || inputValue}
                                </Text>
                            </View>
                        </ImageBackground>
                    ) : (
                        <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.idPreviewCard}>
                            {/* Watermark grid background pattern */}
                            <View style={styles.cardWatermarkGrid} />
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.cardLogoText}>BVN NIGERIA</Text>
                                <Ionicons name="wifi" size={18} color="#f5a623" style={{ transform: [{ rotate: '90deg' }] }} />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={styles.cardPortraitBox}>
                                    <Image source={{ uri: photoUrl }} style={styles.cardPortrait} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={styles.cardFieldLabel}>HOLDER NAME</Text>
                                    <Text style={styles.cardFieldVal} numberOfLines={1}>{fullName}</Text>

                                    <Text style={[styles.cardFieldLabel, { marginTop: 10 }]}>BVN NUMBER</Text>
                                    <Text style={styles.cardFieldVal}>{result.number || result.bvn || inputValue}</Text>
                                </View>
                            </View>

                            <View style={styles.cardBottomRow}>
                                <View>
                                    <Text style={styles.cardFieldLabel}>DATE OF BIRTH</Text>
                                    <Text style={styles.cardFieldVal}>{result.dateOfBirth || result.dob || '—'}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.cardFieldLabel}>GENDER</Text>
                                    <Text style={styles.cardFieldVal}>{(result.gender || '—').toUpperCase()}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    )}`;

    content = content.replace(oldCardMarkup, newCardMarkup);

    // 4. Add the styles for the BVN Card overlay to the stylesheet
    const oldStylesEnd = `    detailCard: {
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
});`;

    const newStylesEnd = `    detailCard: {
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
    bvnCardBackground: {
        width: '100%',
        height: 220,
        marginBottom: 16,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    bvnCardPortraitContainer: {
        position: 'absolute',
        left: '6%',
        top: '26%',
        width: '23%',
        height: '56%',
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#a1a1aa',
    },
    bvnCardPortrait: {
        width: '100%',
        height: '100%',
    },
    bvnCardTextRow: {
        position: 'absolute',
        left: '32%',
        width: '60%',
    },
    bvnCardTextBold: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
});`;

    content = content.replace(oldStylesEnd, newStylesEnd);
    fs.writeFileSync(bvnPath, content, 'utf8');
    console.log('Successfully completed full integration of bvn_card_template.png and verified card rendering layout overlay!');
}
