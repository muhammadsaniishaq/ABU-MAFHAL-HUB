const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Target the old BouncyCheckbox block
const oldCheckboxBlock = `                    {/* Simple Checkbox area */}
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
                    </View>`;

const newCheckboxBlock = `                    {/* Custom Checkbox area */}
                    <TouchableOpacity 
                        onPress={() => setConsent(!consent)} 
                        activeOpacity={0.8}
                        style={styles.consentContainer}
                    >
                        <View style={[
                            styles.checkboxBox, 
                            consent ? styles.checkboxBoxSelected : styles.checkboxBoxUnselected
                        ]}>
                            {consent && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                        </View>
                        <Text style={styles.consentText}>
                            I confirm that I have obtained consent to verify this identity.
                        </Text>
                    </TouchableOpacity>`;

content = content.replace(oldCheckboxBlock, newCheckboxBlock);

// 2. Update styles in StyleSheet
const consentTextOld = `    consentText: {
        color: '#334155',
        fontSize: 10,
        flex: 1,
        fontWeight: '600',
        marginLeft: 8,
        lineHeight: 13,
    },`;

const consentTextNew = `    consentText: {
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
    },`;

content = content.replace(consentTextOld, consentTextNew);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced BouncyCheckbox with a custom beautiful, responsive native checkbox!');
