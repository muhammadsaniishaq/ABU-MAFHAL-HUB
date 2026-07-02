const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Add DateTimePicker import
if (!content.includes("import DateTimePicker")) {
    content = content.replace(
        `import BouncyCheckbox from 'react-native-bouncy-checkbox';`,
        `import BouncyCheckbox from 'react-native-bouncy-checkbox';\nimport DateTimePicker from '@react-native-community/datetimepicker';`
    );
}

// 2. Replace Date Picker States & functions in demographic.tsx
const oldDatePickerStates = `    // Calendar Date Picker States
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
        const formatted = \`\${pad(selectedDay)}-\\$\${pad(currentMonth + 1)}-\\currentYear\`;
        setDob(formatted);
        setShowDatePickerModal(false);
    };`;

// Note: The previous code had a slightly different replacement block for handleConfirmDate, let's find the exact block:
const targetStateAreaStart = `    // Calendar Date Picker States`;
const targetStateAreaEnd = `    const isDobValid = (val: string) => {`;

const targetIndexStart = content.indexOf(targetStateAreaStart);
const targetIndexEnd = content.indexOf(targetStateAreaEnd);

if (targetIndexStart !== -1 && targetIndexEnd !== -1) {
    const newStateBlock = `    // Calendar Date Picker States (using @react-native-community/datetimepicker)
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [date, setDate] = useState(new Date(1995, 0, 1)); // Default: 01-01-1995

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (event.type === 'dismissed') {
            setShowDatePicker(false);
            return;
        }
        const currentDate = selectedDate || date;
        setDate(currentDate);
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            const d = currentDate.getDate();
            const m = currentDate.getMonth() + 1;
            const y = currentDate.getFullYear();
            const pad = (n: number) => n.toString().padStart(2, '0');
            setDob(\`\${pad(d)}-\${pad(m)}-\${y}\`);
        }
    };

    const handleConfirmIOSDate = () => {
        setShowDatePicker(false);
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = date.getFullYear();
        const pad = (n: number) => n.toString().padStart(2, '0');
        setDob(\`\${pad(d)}-\${pad(m)}-\${y}\`);
    };`;

    content = content.slice(0, targetIndexStart) + newStateBlock + '\n\n' + content.slice(targetIndexEnd);
    console.log('Successfully replaced Date Picker states and callbacks with DateTimePicker code.');
}

// 3. Replace the TouchableOpacity toggle to trigger showDatePicker
content = content.replace(
    `onPress={() => setShowDatePickerModal(true)}`,
    `onPress={() => setShowDatePicker(true)}`
);

// 4. Locate and Replace the old Custom Calendar Modal with native DateTimePicker modal code
const oldCalendarModalStart = `                    {/* Premium Calendar Date Picker Modal */}`;
const oldCalendarModalEnd = `                    </Modal>`;

const calendarIndexStart = content.indexOf(oldCalendarModalStart);
const calendarIndexEnd = content.indexOf(oldCalendarModalEnd, calendarIndexStart);

if (calendarIndexStart !== -1 && calendarIndexEnd !== -1) {
    const newCalendarModalCode = `                    {/* Standard React Native Community DateTimePicker Wrapper */}
                    {Platform.OS === 'android' && showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                            maximumDate={new Date()}
                        />
                    )}

                    {Platform.OS === 'ios' && (
                        <Modal
                            transparent
                            visible={showDatePicker}
                            animationType="fade"
                            onRequestClose={() => setShowDatePicker(false)}
                        >
                            <View style={styles.calendarModalOverlay}>
                                <View style={styles.calendarCard}>
                                    <Text style={[styles.sheetTitle, { marginBottom: 16, textAlign: 'center' }]}>Select Date of Birth</Text>
                                    <DateTimePicker
                                        value={date}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event, selectedDate) => {
                                            if (selectedDate) setDate(selectedDate);
                                        }}
                                        maximumDate={new Date()}
                                        style={{ height: 160 }}
                                    />
                                    <View style={styles.calFooter}>
                                        <TouchableOpacity 
                                            onPress={() => setShowDatePicker(false)}
                                            style={styles.calCancelBtn}
                                        >
                                            <Text style={styles.calCancelBtnText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={handleConfirmIOSDate}
                                            style={styles.calConfirmBtn}
                                        >
                                            <Text style={styles.calConfirmBtnText}>Confirm</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </Modal>
                    )}`;

    content = content.slice(0, calendarIndexStart) + newCalendarModalCode + content.slice(calendarIndexEnd + oldCalendarModalEnd.length);
    console.log('Successfully replaced Custom Calendar Modal with standard DateTimePicker components.');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully integrated @react-native-community/datetimepicker into demographic.tsx!');
