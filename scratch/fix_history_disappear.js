const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/supabase.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    // Clear AsyncStorage for both Web and Native
    try {
        await AsyncStorage.clear();
    } catch(e) {
        console.error("AsyncStorage clear failed", e);
    }`;

const replacementStr = `    // Clear AsyncStorage selectively to preserve NIN history, transaction PIN, and biometrics setup
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const preservedKeys = [
            'recent_nin_verifications',
            'biometrics_setup_completed',
            'biometrics_enabled',
            'user_transaction_pin',
            'data_favorites'
        ];
        const keysToRemove = allKeys.filter(k => !preservedKeys.includes(k));
        await AsyncStorage.multiRemove(keysToRemove);
        console.log('Cleared session and cache keys, preserving NIN history & security settings.');
    } catch(e) {
        console.error("AsyncStorage partial clear failed", e);
        // Fallback to clear if multiRemove fails
        try {
            await AsyncStorage.clear();
        } catch (innerErr) {
            console.error("AsyncStorage fallback clear failed", innerErr);
        }
    }`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = targetStr.replace(/\r\n/g, '\n');
const normReplacement = replacementStr.replace(/\r\n/g, '\n');

const index = normContent.indexOf(normTarget);
if (index !== -1) {
    const updated = normContent.slice(0, index) + normReplacement + normContent.slice(index + normTarget.length);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated services/supabase.ts with selective AsyncStorage cleaning!');
} else {
    console.error('Could not find forceSignOut target in services/supabase.ts');
}
