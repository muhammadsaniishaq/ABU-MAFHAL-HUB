const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// 1. Update demographic.tsx
const demographicPath = path.join(projectRoot, 'app/nin-services/demographic.tsx');
if (fs.existsSync(demographicPath)) {
    let content = fs.readFileSync(demographicPath, 'utf8');

    // Add BouncyCheckbox import if not present
    if (!content.includes("import BouncyCheckbox")) {
        content = content.replace(
            `import { IDCardMockup } from '../../components/IDCardMockup';`,
            `import { IDCardMockup } from '../../components/IDCardMockup';\nimport BouncyCheckbox from 'react-native-bouncy-checkbox';`
        );
    }

    // Add isAgreed state
    content = content.replace(
        `    const [showGenderModal, setShowGenderModal] = useState(false);`,
        `    const [showGenderModal, setShowGenderModal] = useState(false);\n    const [isAgreed, setIsAgreed] = useState(false);`
    );

    // Center Gender selection modal (change animationType to fade and overlay to centered)
    content = content.replace(
        `                    <Modal
                        transparent
                        visible={showGenderModal}
                        animationType="slide"
                        onRequestClose={() => setShowGenderModal(false)}
                    >`,
        `                    <Modal
                        transparent
                        visible={showGenderModal}
                        animationType="fade"
                        onRequestClose={() => setShowGenderModal(false)}
                    >`
    );

    content = content.replace(
        `                        <View style={styles.dropdownModalOverlay}>
                            <TouchableOpacity 
                                style={{ flex: 1 }} 
                                activeOpacity={1} 
                                onPress={() => setShowGenderModal(false)} 
                            />
                            <View style={styles.dropdownSheet}>
                                <View style={styles.sheetHeader}>
                                    <View style={styles.sheetHandle} />
                                    <Text style={styles.sheetTitle}>Select Gender</Text>
                                </View>`,
        `                        <View style={styles.dropdownModalOverlay}>
                            <TouchableOpacity 
                                style={StyleSheet.absoluteFillObject} 
                                activeOpacity={1} 
                                onPress={() => setShowGenderModal(false)} 
                            />
                            <View style={styles.dropdownSheet}>
                                <View style={styles.sheetHeader}>
                                    <Text style={styles.sheetTitle}>Select Gender</Text>
                                </View>`
    );

    // Modify Gender dropdown overlay and sheet styles to center them
    content = content.replace(
        `    dropdownModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.5)',
        justifyContent: 'flex-end',
    },
    dropdownSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 12,
    },`,
        `    dropdownModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    dropdownSheet: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 20,
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },`
    );

    // Add Checkbox JSX in demographic.tsx before Verify button
    const targetVerifyBtnLine = `                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify}`;
    
    const newVerifyBtnLine = `                    {/* Consent Checkbox */}
                    <View style={styles.agreeRow}>
                        <BouncyCheckbox
                            size={18}
                            fillColor="#060d21"
                            unFillColor="#FFFFFF"
                            iconStyle={{ borderColor: "#060d21" }}
                            innerIconStyle={{ borderWidth: 1.5 }}
                            isChecked={isAgreed}
                            onPress={(isChecked: boolean) => setIsAgreed(isChecked)}
                        />
                        <Text style={styles.agreeText}>I agree that I have consent of the owner of this identity to perform this lookup.</Text>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify}`;

    if (!content.includes("isChecked={isAgreed}")) {
        content = content.replace(targetVerifyBtnLine, newVerifyBtnLine);
    }

    // Add isAgreed condition to disabled verify button
    content = content.replace(
        `disabled={loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)}`,
        `disabled={loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob) || !isAgreed}`
    );

    content = content.replace(
        `(loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)) ? styles.verifyButtonDisabled : styles.verifyButtonActive`,
        `(loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob) || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive`
    );

    // Add agreeRow and agreeText styles
    if (!content.includes("agreeRow: {")) {
        content = content.replace(
            `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },`,
            `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },
    agreeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    agreeText: {
        color: '#64748b',
        fontSize: 10.5,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },`
        );
    }

    fs.writeFileSync(demographicPath, content, 'utf8');
    console.log('Successfully updated demographic.tsx with centered gender modal and consent checkbox!');
}

// 2. Update verify-phone.tsx
const phonePath = path.join(projectRoot, 'app/nin-services/verify-phone.tsx');
if (fs.existsSync(phonePath)) {
    let content = fs.readFileSync(phonePath, 'utf8');

    // Add BouncyCheckbox import
    if (!content.includes("import BouncyCheckbox")) {
        content = content.replace(
            `import { IDCardMockup } from '../../components/IDCardMockup';`,
            `import { IDCardMockup } from '../../components/IDCardMockup';\nimport BouncyCheckbox from 'react-native-bouncy-checkbox';`
        );
    }

    // Add isAgreed state
    if (!content.includes("const [isAgreed, setIsAgreed] = useState(false);")) {
        content = content.replace(
            `    const [selectedLayout, setSelectedLayout] = useState('premium');`,
            `    const [selectedLayout, setSelectedLayout] = useState('premium');\n    const [isAgreed, setIsAgreed] = useState(false);`
        );
    }

    // Add Checkbox JSX before Verify Button
    const targetVerifyBtnLine = `                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify}`;
    
    const newVerifyBtnLine = `                    {/* Consent Checkbox */}
                    <View style={styles.agreeRow}>
                        <BouncyCheckbox
                            size={18}
                            fillColor="#060d21"
                            unFillColor="#FFFFFF"
                            iconStyle={{ borderColor: "#060d21" }}
                            innerIconStyle={{ borderWidth: 1.5 }}
                            isChecked={isAgreed}
                            onPress={(isChecked: boolean) => setIsAgreed(isChecked)}
                        />
                        <Text style={styles.agreeText}>I agree that I have consent of the owner of this phone number to perform this lookup.</Text>
                    </View>

                    {/* Verify Button */}
                    <TouchableOpacity 
                        onPress={handleVerify}`;

    if (!content.includes("isChecked={isAgreed}")) {
        content = content.replace(targetVerifyBtnLine, newVerifyBtnLine);
    }

    // Update disabled state for phone verify button
    content = content.replace(
        `disabled={loading || phone.length < 10}`,
        `disabled={loading || phone.length < 10 || !isAgreed}`
    );

    content = content.replace(
        `(loading || phone.length < 10) ? styles.verifyButtonDisabled : styles.verifyButtonActive`,
        `(loading || phone.length < 10 || !isAgreed) ? styles.verifyButtonDisabled : styles.verifyButtonActive`
    );

    // Add agreeRow and agreeText styles
    if (!content.includes("agreeRow: {")) {
        content = content.replace(
            `    layoutPriceUnselected: {
        color: '#64748b',
    },`,
            `    layoutPriceUnselected: {
        color: '#64748b',
    },
    agreeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    agreeText: {
        color: '#64748b',
        fontSize: 10.5,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },`
        );
    }

    fs.writeFileSync(phonePath, content, 'utf8');
    console.log('Successfully updated verify-phone.tsx with consent checkbox!');
}
