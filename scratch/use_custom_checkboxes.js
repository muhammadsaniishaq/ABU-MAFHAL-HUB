const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Helper to remove BouncyCheckbox and replace JSX/styles
function upgradeFile(filePath, consentLabel) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Remove BouncyCheckbox import
    content = content.replace("import BouncyCheckbox from 'react-native-bouncy-checkbox';", "");

    // 2. Replace the checkbox JSX block
    const targetCheckboxOld = `<View style={styles.agreeRow}>
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
                    </View>`;

    const targetCheckboxOldPhone = `<View style={styles.agreeRow}>
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
                    </View>`;

    const customCheckboxJSX = `                    {/* Consent Checkbox */}
                    <TouchableOpacity 
                        onPress={() => setIsAgreed(!isAgreed)} 
                        activeOpacity={0.8}
                        style={styles.consentContainer}
                    >
                        <View style={[
                            styles.checkboxBox, 
                            isAgreed ? styles.checkboxBoxSelected : styles.checkboxBoxUnselected
                        ]}>
                            {isAgreed && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                        <Text style={styles.consentText}>
                            ${consentLabel}
                        </Text>
                    </TouchableOpacity>`;

    content = content.replace(targetCheckboxOld, customCheckboxJSX);
    content = content.replace(targetCheckboxOldPhone, customCheckboxJSX);

    // 3. Replace the styles
    content = content.replace(
        `    agreeRow: {
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
    },`,
        `    consentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    consentText: {
        color: '#475569',
        fontSize: 11,
        flex: 1,
        fontWeight: '600',
        lineHeight: 15,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    checkboxBoxSelected: {
        backgroundColor: '#060d21',
        borderColor: '#060d21',
    },
    checkboxBoxUnselected: {
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
    },`
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully upgraded checkboxes in ${path.basename(filePath)}`);
}

upgradeFile(
    path.join(projectRoot, 'app/nin-services/demographic.tsx'),
    'I confirm that I have obtained consent to verify this identity.'
);

upgradeFile(
    path.join(projectRoot, 'app/nin-services/verify-phone.tsx'),
    'I confirm that I have obtained consent to verify this phone number.'
);
