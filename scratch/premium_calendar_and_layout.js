const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Add States for Date Picker
const oldStates = `    // Demographic Inputs
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

const newStates = `    // Demographic Inputs
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');
    const [showGenderModal, setShowGenderModal] = useState(false);

    // Calendar Date Picker States
    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [currentYear, setCurrentYear] = useState(1995);
    const [currentMonth, setCurrentMonth] = useState(0); // 0 = Jan
    const [selectedDay, setSelectedDay] = useState(1);
    const [yearSelectMode, setYearSelectMode] = useState(false);
    const [monthSelectMode, setMonthSelectMode] = useState(false);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handleConfirmDate = () => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = \`\${pad(selectedDay)}-\${pad(currentMonth + 1)}-\${currentYear}\`;
        setDob(formatted);
        setShowDatePickerModal(false);
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
        const nowY = new Date().getFullYear();
        if (y < 1900 || y > nowY) return false;
        return true;
    };`;

content = content.replace(oldStates, newStates);

// 2. Locate and Replace the Demographic inputs Form section to display side-by-side inputs
const targetFormArea = `                    <Text style={styles.label}>First Name</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="e.g. Muhammad"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={firstname}
                            onChangeText={setFirstname}
                            editable={!loading}
                        />
                    </View>

                    <Text style={styles.label}>Last Name (Surname)</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="e.g. Sani"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={lastname}
                            onChangeText={setLastname}
                            editable={!loading}
                        />
                    </View>

                    <Text style={styles.label}>Date of Birth (DD-MM-YYYY)</Text>
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
                    </View>

                    <Text style={styles.label}>Gender</Text>
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
                    </TouchableOpacity>`;

const newFormArea = `                    <Text style={styles.label}>First Name</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="e.g. Muhammad"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={firstname}
                            onChangeText={setFirstname}
                            editable={!loading}
                        />
                    </View>

                    <Text style={styles.label}>Last Name (Surname)</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={16} color="#94a3b8" />
                        <TextInput
                            placeholder="e.g. Sani"
                            placeholderTextColor="#94a3b8"
                            style={styles.inputStyle}
                            value={lastname}
                            onChangeText={setLastname}
                            editable={!loading}
                        />
                    </View>

                    {/* DOB & Gender Side by Side Grid Row */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                        <View style={{ flex: 1.1 }}>
                            <Text style={styles.label}>Date of Birth</Text>
                            <TouchableOpacity 
                                onPress={() => setShowDatePickerModal(true)}
                                style={[
                                    styles.inputContainer,
                                    dob.length > 0 && (isDobValid(dob) ? styles.inputContainerSuccess : styles.inputContainerWarning)
                                ]}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="calendar-outline" size={16} color={dob.length > 0 ? '#10b981' : '#94a3b8'} />
                                <Text style={[
                                    styles.inputStyle, 
                                    { fontSize: 13, color: dob ? '#1e293b' : '#94a3b8', paddingVertical: 12, marginLeft: 6 }
                                ]} numberOfLines={1}>
                                    {dob || 'Select Date'}
                                </Text>
                                {dob.length > 0 && isDobValid(dob) && (
                                    <Ionicons name="checkmark-circle" size={14} color="#10b981" style={{ marginLeft: 4 }} />
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={{ flex: 0.9 }}>
                            <Text style={styles.label}>Gender</Text>
                            <TouchableOpacity 
                                onPress={() => setShowGenderModal(true)} 
                                style={styles.dropdownContainer}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="male-female-outline" size={16} color="#94a3b8" />
                                    <Text style={[styles.dropdownValue, { fontSize: 13, marginLeft: 6 }]}>
                                        {gender === 'm' ? 'MALE' : 'FEMALE'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-down" size={14} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Premium Calendar Date Picker Modal */}
                    <Modal
                        transparent
                        visible={showDatePickerModal}
                        animationType="fade"
                        onRequestClose={() => setShowDatePickerModal(false)}
                    >
                        <View style={styles.calendarModalOverlay}>
                            <View style={styles.calendarCard}>
                                {/* Calendar Header */}
                                <View style={styles.calendarHeader}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (currentMonth === 0) {
                                                setCurrentMonth(11);
                                                setCurrentYear(prev => prev - 1);
                                            } else {
                                                setCurrentMonth(prev => prev - 1);
                                            }
                                        }}
                                        style={styles.calNavBtn}
                                    >
                                        <Ionicons name="chevron-back" size={18} color="#060d21" />
                                    </TouchableOpacity>

                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity onPress={() => { setMonthSelectMode(!monthSelectMode); setYearSelectMode(false); }}>
                                            <Text style={styles.calHeaderTitle}>{MONTHS[currentMonth]}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setYearSelectMode(!yearSelectMode); setMonthSelectMode(false); }}>
                                            <Text style={styles.calHeaderTitle}>{currentYear}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (currentMonth === 11) {
                                                setCurrentMonth(0);
                                                setCurrentYear(prev => prev + 1);
                                            } else {
                                                setCurrentMonth(prev => prev + 1);
                                            }
                                        }}
                                        style={styles.calNavBtn}
                                    >
                                        <Ionicons name="chevron-forward" size={18} color="#060d21" />
                                    </TouchableOpacity>
                                </View>

                                {/* Month Selection Mode Grid */}
                                {monthSelectMode ? (
                                    <View style={styles.gridContainer}>
                                        <View style={styles.monthsGrid}>
                                            {MONTHS.map((m, idx) => (
                                                <TouchableOpacity 
                                                    key={m}
                                                    onPress={() => {
                                                        setCurrentMonth(idx);
                                                        setMonthSelectMode(false);
                                                    }}
                                                    style={[
                                                        styles.monthGridCell,
                                                        currentMonth === idx && styles.monthGridCellActive
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.monthGridText,
                                                        currentMonth === idx && styles.monthGridTextActive
                                                    ]}>{m}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ) : yearSelectMode ? (
                                    /* Year Selection Mode Scrollable Grid */
                                    <View style={styles.gridContainer}>
                                        <ScrollView contentContainerStyle={styles.yearsGrid} showsVerticalScrollIndicator={false}>
                                            {Array.from({ length: 95 }, (_, idx) => 2026 - idx).map(yr => (
                                                <TouchableOpacity 
                                                    key={yr}
                                                    onPress={() => {
                                                        setCurrentYear(yr);
                                                        setYearSelectMode(false);
                                                    }}
                                                    style={[
                                                        styles.yearGridCell,
                                                        currentYear === yr && styles.yearGridCellActive
                                                    ]}
                                                >
                                                    <Text style={[
                                                        styles.yearGridText,
                                                        currentYear === yr && styles.yearGridTextActive
                                                    ]}>{yr}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                ) : (
                                    /* Normal Calendar Days Grid */
                                    <View>
                                        {/* Weekday Labels Header */}
                                        <View style={styles.weekdaysRow}>
                                            {WEEKDAYS.map((day, idx) => (
                                                <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
                                            ))}
                                        </View>

                                        {/* Days Grid */}
                                        <View style={styles.daysGrid}>
                                            {(() => {
                                                const totalDays = getDaysInMonth(currentMonth, currentYear);
                                                const firstDayIdx = getFirstDayOfMonth(currentMonth, currentYear);
                                                const cells = [];

                                                // Blank cells before first day
                                                for (let i = 0; i < firstDayIdx; i++) {
                                                    cells.push(<View key={\`blank_\${i}\`} style={styles.dayCellEmpty} />);
                                                }

                                                // Days cells
                                                for (let d = 1; d <= totalDays; d++) {
                                                    const isSelected = selectedDay === d;
                                                    cells.push(
                                                        <TouchableOpacity 
                                                            key={\`day_\${d}\`}
                                                            onPress={() => setSelectedDay(d)}
                                                            style={[
                                                                styles.dayCell,
                                                                isSelected && styles.dayCellSelected
                                                            ]}
                                                        >
                                                            <Text style={[
                                                                styles.dayCellText,
                                                                isSelected && styles.dayCellTextSelected
                                                            ]}>{d}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                }
                                                return cells;
                                            })()}
                                        </View>
                                    </View>
                                )}

                                {/* Calendar Footer Buttons */}
                                <View style={styles.calFooter}>
                                    <TouchableOpacity 
                                        onPress={() => setShowDatePickerModal(false)}
                                        style={styles.calCancelBtn}
                                    >
                                        <Text style={styles.calCancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={handleConfirmDate}
                                        style={styles.calConfirmBtn}
                                    >
                                        <Text style={styles.calConfirmBtnText}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>`;

content = content.replace(targetFormArea, newFormArea);

// 3. Remove marginBottom from dropdownContainer since it is now side-by-side
content = content.replace(
    `    dropdownContainer: {
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
    },`,
    `    dropdownContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginTop: 4,
    },`
);

// 4. Append Calendar Modal styles to stylesheet block
const styleMarker = `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },`;

const calStyles = `    genderTextInactive: {
        color: '#94a3b8',
        fontWeight: '800',
        fontSize: 12,
    },
    calendarModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 11, 20, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    calendarCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 10,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 12,
    },
    calHeaderTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#060d21',
        textTransform: 'uppercase',
    },
    calNavBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    weekdaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    weekdayLabel: {
        width: '14%',
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '800',
        color: '#94a3b8',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        width: '100%',
    },
    dayCell: {
        width: '14%',
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 2,
        borderRadius: 18,
    },
    dayCellSelected: {
        backgroundColor: '#f5a623',
    },
    dayCellEmpty: {
        width: '14%',
        height: 36,
    },
    dayCellText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    dayCellTextSelected: {
        color: '#060d21',
    },
    gridContainer: {
        height: 200,
        justifyContent: 'center',
    },
    monthsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
    },
    monthGridCell: {
        width: '30%',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    monthGridCellActive: {
        backgroundColor: '#f5a623',
        borderColor: '#f5a623',
    },
    monthGridText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    monthGridTextActive: {
        color: '#060d21',
    },
    yearsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    yearGridCell: {
        width: '22%',
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    yearGridCellActive: {
        backgroundColor: '#f5a623',
        borderColor: '#f5a623',
    },
    yearGridText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
    },
    yearGridTextActive: {
        color: '#060d21',
    },
    calFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
    },
    calCancelBtn: {
        flex: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    calCancelBtnText: {
        color: '#64748b',
        fontWeight: '800',
        fontSize: 12,
    },
    calConfirmBtn: {
        flex: 1,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        borderRadius: 12,
        backgroundColor: '#060d21',
    },
    calConfirmBtnText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 12,
    },`;

content = content.replace(styleMarker, calStyles);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully completed premium Calendar Picker and side-by-side layout updates in demographic.tsx!');
