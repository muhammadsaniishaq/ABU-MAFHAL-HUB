const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add state for showGenderModal
const targetState = `    // Demographic Inputs
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');`;

const newState = `    // Demographic Inputs
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');
    const [showGenderModal, setShowGenderModal] = useState(false);

    // Modern Date of Birth Formatting and Validation Helpers
    const handleDobChange = (text: string) => {
        let cleaned = text.replace(/[^0-9-]/g, '');
        cleaned = cleaned.replace(/-+/g, '-');
        
        const digits = cleaned.replace(/\\D/g, '');
        let formatted = digits;
        if (digits.length > 2) {
            formatted = digits.slice(0, 2) + '-' + digits.slice(2);
        }
        if (digits.length > 4) {
            formatted = digits.slice(0, 2) + '-' + digits.slice(2, 4) + '-' + digits.slice(4, 8);
        }
        setDob(formatted);
    };

    const isDobValid = (val: string) => {
        const regex = /^\\d{2}-\\d{2}-\\d{4}$/;
        if (!regex.test(val)) return false;
        const parts = val.split('-').map(Number);
        const d = parts[0];
        const m = parts[1];
        const y = parts[2];
        if (d < 1 || d > 31) return false;
        if (m < 1 || m > 12) return false;
        const currentYear = new Date().getFullYear();
        if (y < 1900 || y > currentYear) return false;
        return true;
    };`;

content = content.replace(targetState, newState);

// 2. Replace Date of Birth input field to support modern auto-formatting and validation checkmark
const targetDobInput = `                    <Text style={styles.label}>Date of Birth (DD-MM-YYYY)</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="e.g. 15-08-1995"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={dob}
                            onChangeText={setDob}
                            editable={!loading}
                        />
                    </View>`;

const newDobInput = `                    <Text style={styles.label}>Date of Birth (DD-MM-YYYY)</Text>
                    <View style={[
                        styles.inputContainer,
                        dob.length > 0 && (isDobValid(dob) ? styles.inputContainerSuccess : styles.inputContainerWarning)
                    ]}>
                        <Ionicons name="calendar-outline" size={16} color={dob.length > 0 ? (isDobValid(dob) ? '#10b981' : '#f5a623') : '#94a3b8'} />
                        <TextInput
                            placeholder="DD-MM-YYYY (e.g. 15-08-1995)"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={dob}
                            onChangeText={handleDobChange}
                            maxLength={10}
                            keyboardType="number-pad"
                            editable={!loading}
                        />
                        {dob.length > 0 && (
                            <Ionicons 
                                name={isDobValid(dob) ? "checkmark-circle" : "alert-circle"} 
                                size={18} 
                                color={isDobValid(dob) ? "#10b981" : "#f5a623"} 
                                style={{ marginLeft: 8 }}
                            />
                        )}
                    </View>`;

content = content.replace(targetDobInput, newDobInput);

// 3. Replace Gender buttons row with Dropdown selector and Sheet modal
const targetGenderSelector = `                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderRow}>
                        <TouchableOpacity 
                            onPress={() => setGender('m')} 
                            style={[
                                styles.genderButton,
                                gender === 'm' ? styles.genderButtonActive : styles.genderButtonInactive
                            ]}
                            activeOpacity={0.8}
                        >
                            <Text style={gender === 'm' ? styles.genderTextActive : styles.genderTextInactive}>MALE</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setGender('f')} 
                            style={[
                                styles.genderButton,
                                gender === 'f' ? styles.genderButtonActive : styles.genderButtonInactive
                            ]}
                            activeOpacity={0.8}
                        >
                            <Text style={gender === 'f' ? styles.genderTextActive : styles.genderTextInactive}>FEMALE</Text>
                        </TouchableOpacity>
                    </View>`;

const newGenderSelector = `                    <Text style={styles.label}>Gender</Text>
                    <TouchableOpacity 
                        onPress={() => setShowGenderModal(true)} 
                        style={styles.dropdownContainer}
                        activeOpacity={0.85}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="male-female-outline" size={18} color="#94a3b8" />
                            <Text style={styles.dropdownValue}>
                                {gender === 'm' ? 'MALE' : 'FEMALE'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color="#64748b" />
                    </TouchableOpacity>

                    {/* Gender Selection Dropdown Sheet Modal */}
                    <Modal
                        transparent
                        visible={showGenderModal}
                        animationType="slide"
                        onRequestClose={() => setShowGenderModal(false)}
                    >
                        <View style={styles.dropdownModalOverlay}>
                            <TouchableOpacity 
                                style={{ flex: 1 }} 
                                activeOpacity={1} 
                                onPress={() => setShowGenderModal(false)} 
                            />
                            <View style={styles.dropdownSheet}>
                                <View style={styles.sheetHeader}>
                                    <View style={styles.sheetHandle} />
                                    <Text style={styles.sheetTitle}>Select Gender</Text>
                                </View>
                                
                                <TouchableOpacity 
                                    onPress={() => {
                                        setGender('m');
                                        setShowGenderModal(false);
                                    }}
                                    style={[
                                        styles.sheetOption,
                                        gender === 'm' && styles.sheetOptionSelected
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.sheetOptionIcon}>👨</Text>
                                        <Text style={[
                                            styles.sheetOptionText,
                                            gender === 'm' && styles.sheetOptionTextSelected
                                        ]}>MALE</Text>
                                    </View>
                                    {gender === 'm' && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => {
                                        setGender('f');
                                        setShowGenderModal(false);
                                    }}
                                    style={[
                                        styles.sheetOption,
                                        gender === 'f' && styles.sheetOptionSelected
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.sheetOptionIcon}>👩</Text>
                                        <Text style={[
                                            styles.sheetOptionText,
                                            gender === 'f' && styles.sheetOptionTextSelected
                                        ]}>FEMALE</Text>
                                    </View>
                                    {gender === 'f' && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>`;

content = content.replace(targetGenderSelector, newGenderSelector);

// 4. Update verify button condition to also ensure DOB validity
content = content.replace(
    `disabled={loading || !firstname.trim() || !lastname.trim() || !dob.trim()}`,
    `disabled={loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)}`
);

content = content.replace(
    `verifyButtonDisabled : styles.verifyButtonActive`,
    `(loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)) ? styles.verifyButtonDisabled : styles.verifyButtonActive`
);

// 5. Append new styles to styles block
const targetStylesEnd = `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },
});`;

const newStyles = `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },
    inputContainerSuccess: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4',
    },
    inputContainerWarning: {
        borderColor: '#f5a623',
        backgroundColor: '#fffbeb',
    },
    dropdownContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 16,
        marginTop: 4,
    },
    dropdownValue: {
        marginLeft: 8,
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 14,
    },
    dropdownModalOverlay: {
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
    },
    sheetHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e2e8f0',
        marginBottom: 12,
    },
    sheetTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0d1b3e',
        letterSpacing: 0.2,
    },
    sheetOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#f8fafc',
    },
    sheetOptionSelected: {
        backgroundColor: '#ecfdf5',
        borderColor: '#10b981',
    },
    sheetOptionIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    sheetOptionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    sheetOptionTextSelected: {
        color: '#10b981',
    },
});`;

content = content.replace(targetStylesEnd, newStyles);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully added modern Date of Birth validation and Gender dropdown modal menu to demographic.tsx!');
