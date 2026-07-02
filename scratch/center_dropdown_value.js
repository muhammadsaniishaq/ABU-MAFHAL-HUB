const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Replace dropdown selector button content to be centered
const targetDropdown = `                            <TouchableOpacity 
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
                            </TouchableOpacity>`;

const newDropdown = `                            <TouchableOpacity 
                                onPress={() => setShowGenderModal(true)} 
                                style={[styles.dropdownContainer, { justifyContent: 'center' }]}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="male-female-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                                <Text style={[styles.dropdownValue, { fontSize: 13, marginLeft: 0, marginRight: 6 }]}>
                                    {gender === 'm' ? 'MALE' : 'FEMALE'}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color="#64748b" />
                            </TouchableOpacity>`;

if (content.includes(targetDropdown)) {
    content = content.replace(targetDropdown, newDropdown);
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('Successfully centered the gender dropdown selector value in demographic.tsx!');
} else {
    // Try matching without indentations
    const normContent = content.replace(/\r\n/g, '\n');
    const lookupStr = `style={styles.dropdownContainer}\n                                activeOpacity={0.85}\n                            >\n                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>\n                                    <Ionicons name="male-female-outline" size={16} color="#94a3b8" />\n                                    <Text style={[styles.dropdownValue, { fontSize: 13, marginLeft: 6 }]}>\n                                        {gender === 'm' ? 'MALE' : 'FEMALE'}\n                                    </Text>\n                                </View>\n                                <Ionicons name="chevron-down" size={14} color="#64748b" />`;
    
    if (normContent.includes(lookupStr)) {
        const replacementStr = `style={[styles.dropdownContainer, { justifyContent: 'center' }]}\n                                activeOpacity={0.85}\n                            >\n                                <Ionicons name="male-female-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />\n                                <Text style={[styles.dropdownValue, { fontSize: 13, marginLeft: 0, marginRight: 6 }]}>\n                                    {gender === 'm' ? 'MALE' : 'FEMALE'}\n                                </Text>\n                                <Ionicons name="chevron-down" size={14} color="#64748b" />`;
        content = normContent.replace(lookupStr, replacementStr);
        fs.writeFileSync(targetPath, content, 'utf8');
        console.log('Successfully centered the gender dropdown selector value (normalized match) in demographic.tsx!');
    } else {
        console.error('Target dropdown layout pattern not found in demographic.tsx');
    }
}
