const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add safe area import at the top
const importTarget = "import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';";
const importReplacement = "import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';";

content = content.replace(importTarget, importReplacement);

// 2. Add useSafeAreaInsets inside VerifyNINScreen
const screenStartTarget = `export default function VerifyNINScreen() {
    const { reprintId } = useLocalSearchParams();`;
const screenStartReplacement = `export default function VerifyNINScreen() {
    const insets = useSafeAreaInsets();
    const { reprintId } = useLocalSearchParams();`;

content = content.replace(screenStartTarget, screenStartReplacement);

// 3. Update the first LinearGradient style to include safe area inset padding
const firstGradientTarget = `<LinearGradient colors={['#060d21', '#0B163A']} style={styles.headerGradient}>`;
const firstGradientReplacement = `<LinearGradient colors={['#060d21', '#0B163A']} style={[styles.headerGradient, { paddingTop: insets.top > 0 ? insets.top + 10 : 24 }]}>`;

content = content.replace(firstGradientTarget, firstGradientReplacement);

// 4. Update the second LinearGradient (details header) to include safe area inset padding
const secondGradientTarget = `                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: 16, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>`;

const secondGradientReplacement = `                {/* Header Banner */}
                <LinearGradient colors={['#060d21', '#121F42']} style={{ paddingTop: insets.top > 0 ? insets.top + 12 : 24, paddingBottom: 48, paddingHorizontal: 16, alignItems: 'center' }}>`;

content = content.replace(secondGradientTarget, secondGradientReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added useSafeAreaInsets to verify-nin.tsx and fixed safe area header padding!');
