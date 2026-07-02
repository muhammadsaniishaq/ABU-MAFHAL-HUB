const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Add import statement at the top of the file
const targetImportStr = "import * as Print from '../../services/api';"; // Let's find where to insert it safely.
// Let's insert it after 'import * as Print from \'expo-print\';'
const printImport = "import * as Print from 'expo-print';";
const newImport = "import * as Print from 'expo-print';\nimport DateTimePicker from '@react-native-community/datetimepicker';";

if (content.includes(printImport)) {
    content = content.replace(printImport, newImport);
    console.log('Successfully added DateTimePicker import to demographic.tsx.');
} else {
    // Fallback: prepend at the beginning
    content = "import DateTimePicker from '@react-native-community/datetimepicker';\n" + content;
    console.log('Fallback: Prepended DateTimePicker import to demographic.tsx.');
}

// 2. Fix the iOS DateTimePicker onChange callback parameter typing
const targetOnChange = `                                    <DateTimePicker
                                        value={date}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event, selectedDate) => {
                                            if (selectedDate) setDate(selectedDate);
                                        }}`;

const fixedOnChange = `                                    <DateTimePicker
                                        value={date}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event: any, selectedDate?: Date) => {
                                            if (selectedDate) setDate(selectedDate);
                                        }}`;

if (content.includes(targetOnChange)) {
    content = content.replace(targetOnChange, fixedOnChange);
    console.log('Successfully fixed type definitions for iOS DateTimePicker onChange callback.');
} else {
    // Try matching normalized whitespace
    const normOnChange = `onChange={(event, selectedDate) => {\n                                            if (selectedDate) setDate(selectedDate);\n                                        }}`;
    const normFixed = `onChange={(event: any, selectedDate?: Date) => {\n                                            if (selectedDate) setDate(selectedDate);\n                                        }}`;
    if (content.includes(normOnChange)) {
        content = content.replace(normOnChange, normFixed);
        console.log('Successfully fixed type definitions for iOS DateTimePicker onChange callback (normalized match).');
    } else {
        console.error('Target onChange callback pattern not found in demographic.tsx');
    }
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Finished running fix_datetimepicker_imports.js.');
