const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Update headerStyle and add headerRight to Stack.Screen
const targetStr = `<Stack.Screen options={{ title: 'Demographic Search', headerStyle: { backgroundColor: '#581c87' }, headerTintColor: '#fff' }} />`;

const replacementStr = `<Stack.Screen options={{ 
                title: 'Demographic Search', 
                headerStyle: { backgroundColor: '#060d21' }, 
                headerTintColor: '#fff',
                headerShadowVisible: false,
                headerRight: () => (
                    <TouchableOpacity onPress={() => router.push('/nin-services/history?tab=nin')} style={{ marginRight: 8 }}>
                        <Ionicons name="time-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                )
            }} />`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log('Successfully updated demographic.tsx header design and history routing!');
} else {
    console.error('Target Stack.Screen options string not found in demographic.tsx.');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Finished running add_demographic_header_history.js.');
