const fs = require('fs');
const path = require('path');

// 1. Fix app/nin-services/index.tsx
const indexPath = path.join(__dirname, '../app/nin-services/index.tsx');
if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    content = content.replace('style={{ flex: 1, px: 16, marginTop: -16 }}', 'style={{ flex: 1, paddingHorizontal: 16, marginTop: -16 }}');
    fs.writeFileSync(indexPath, content, 'utf8');
    console.log('Fixed index.tsx compile error.');
}

// 2. Fix app/nin-services/verify-nin.tsx
const verifyNinPath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
if (fs.existsSync(verifyNinPath)) {
    let content = fs.readFileSync(verifyNinPath, 'utf8');
    
    // Replace import statement
    const targetImport = "import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal } from 'react-native';";
    const replacementImport = "import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions, Image, Platform, Modal, StyleSheet } from 'react-native';";
    
    if (content.indexOf(targetImport) !== -1) {
        content = content.replace(targetImport, replacementImport);
        fs.writeFileSync(verifyNinPath, content, 'utf8');
        console.log('Fixed verify-nin.tsx compile error.');
    } else {
        console.error('Target import statement not found in verify-nin.tsx');
    }
}
