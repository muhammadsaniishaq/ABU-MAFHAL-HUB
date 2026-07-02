const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/verify-phone.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Change storage key from recent_phone_verifications to recent_nin_verifications
content = content.split('recent_phone_verifications').join('recent_nin_verifications');

// 2. Update saveHistoryItem to filter by NIN to match verify-nin.tsx
const oldSaveHistory = `    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const name = \\\`\\\${verifiedData.firstname || ''} \\\${verifiedData.surname || ''}\\\`.trim() || 'Unknown Name';
            const newItem = {
                id: \\\`phone_\\\${Date.now()}\\\`,
                phone,
                name,
                layout: selectedLayout,
                date: (() => {
                    const d = new Date();
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \\\`\\\${d.getDate()} \\\${months[d.getMonth()]} \\\${d.getFullYear()}, \\\${pad(d.getHours())}:\\\${pad(d.getMinutes())}\\\`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.phone !== newItem.phone)].slice(0, 50);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };`;

const newSaveHistory = `    const saveHistoryItem = async (verifiedData: any) => {
        try {
            const name = \`\${verifiedData.firstname || ''} \${verifiedData.surname || ''}\`.trim() || 'Unknown Name';
            const newItem = {
                id: \`verify_\${Date.now()}\`,
                nin: verifiedData.nin || 'N/A',
                name,
                layout: selectedLayout,
                date: (() => {
                    const d = new Date();
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return \`\${d.getDate()} \${months[d.getMonth()]} \${d.getFullYear()}, \${pad(d.getHours())}:\${pad(d.getMinutes())}\`;
                })(),
                data: verifiedData
            };
            
            const updated = [newItem, ...historyList.filter(item => item.nin !== newItem.nin)].slice(0, 50);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to save history item', e);
        }
    };`;

// Note: String manipulation normalization
const normalizedContent = content.replace(/\r\n/g, '\n');
const targetIndex = normalizedContent.indexOf('const saveHistoryItem = async (verifiedData: any) =>');

if (targetIndex !== -1) {
    // Find matching closing brace
    let bracesCount = 0;
    let endIndex = -1;
    for (let i = targetIndex; i < normalizedContent.length; i++) {
        if (normalizedContent[i] === '{') bracesCount++;
        else if (normalizedContent[i] === '}') {
            bracesCount--;
            if (bracesCount === 0) {
                endIndex = i;
                break;
            }
        }
    }
    if (endIndex !== -1) {
        content = normalizedContent.slice(0, targetIndex) + newSaveHistory + normalizedContent.slice(endIndex + 1);
        console.log('Successfully replaced saveHistoryItem in verify-phone.tsx');
    }
}

// 3. Update deleteHistoryItem filter to filter by NIN
const oldDeleteHistory = `    const deleteHistoryItem = async (itemId: string) => {
        try {
            const updated = historyList.filter(item => item.id !== itemId);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to delete history item', e);
        }
    };`;

const newDeleteHistory = `    const deleteHistoryItem = async (itemId: string) => {
        try {
            const updated = historyList.filter(item => item.id !== itemId);
            setHistoryList(updated);
            await AsyncStorage.setItem('recent_nin_verifications', JSON.stringify(updated));
        } catch (e) {
            console.warn('Failed to delete history item', e);
        }
    };`;
// No-op for delete since it filters by item.id which remains correct.

// 4. Update search query filter logic in JSX
content = content.replace(
    `            (item.name || '').toLowerCase().includes(q) ||
            (item.phone || '').includes(q) ||
            (item.layout || '').toLowerCase().includes(q)`,
    `            (item.name || '').toLowerCase().includes(q) ||
            (item.nin || '').includes(q) ||
            (item.layout || '').toLowerCase().includes(q)`
);

// 5. Update recent lookups list to render item.nin instead of item.phone
content = content.replace(
    `                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>Phone: {item.phone} • {(item.layout || 'premium').toUpperCase()}</Text>
                                        </View>`,
    `                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.historyName}>{item.name}</Text>
                                            <Text style={styles.historyMeta}>NIN: {item.nin} • {(item.layout || 'premium').toUpperCase()}</Text>
                                        </View>`
);

content = content.replace(
    `                                        onPress={() => {
                                            setSelectedLayout(item.layout || 'premium');
                                            setPhone(item.phone);
                                            setResult({ status: 'success', data: item.data });
                                        }}`,
    `                                        onPress={() => {
                                            setSelectedLayout(item.layout || 'premium');
                                            setPhone('');
                                            setResult({ status: 'success', data: item.data });
                                        }}`
);

// 6. Update Stack.Screen headers to include the history button
content = content.replace(
    `            <Stack.Screen options={{ title: 'Verify by Phone', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />`,
    `            <Stack.Screen options={{ 
                title: 'Verify by Phone', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff', 
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )
            }} />`
);

content = content.replace(
    `            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ title: 'Verification Details', headerStyle: { backgroundColor: '#060d21' }, headerTintColor: '#fff', headerShadowVisible: false }} />`,
    `            <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                <Stack.Screen options={{ 
                    title: 'Verification Details', 
                    headerStyle: { backgroundColor: '#060d21' }, 
                    headerTintColor: '#fff', 
                    headerShadowVisible: false,
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.push('/nin-services/history')} style={{ marginRight: 8 }}>
                            <Ionicons name="time-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    )
                }} />`
);

// 7. Change Lookup Stats title to Verification Stats in verify-phone
content = content.replace(
    `                            <Text style={styles.statsTitle}>Lookup Stats</Text>`,
    `                            <Text style={styles.statsTitle}>Verification Stats</Text>`
);

content = content.replace(
    `<Text style={styles.historyTitle}>Recent Lookups</Text>`,
    `<Text style={styles.historyTitle}>Recent Prints (Reprint)</Text>`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully unified verify-phone.tsx history with central recent_nin_verifications and added navigation header button!');
