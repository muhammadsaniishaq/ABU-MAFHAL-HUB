const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Swap customHeader paddingTop to include safeArea insets
content = content.replace(
    `            {/* Main Header Row */}
            <View style={styles.customHeader}>`,
    `            {/* Main Header Row */}
            <View style={[styles.customHeader, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>`
);

// 2. Swap brand colors: Replace #9A3412 and #7C2D12 with #060d21 and #121F42
content = content.replace(/#9A3412/g, '#060d21');
content = content.replace(/#7C2D12/g, '#121F42');

// 3. Swap checkbox selected color to #060d21 to match NIMC standard
content = content.replace(/#0284c7/g, '#060d21');

// 4. Adjust the detail close button style so it renders cleanly
content = content.replace(
    `    detailHeaderIconBox: {
        backgroundColor: '#ffffff',
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },`,
    `    detailHeaderIconBox: {
        backgroundColor: '#ffffff',
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully applied safe area top padding and replaced rust color with primary dark blue brand color in ipe-clearance.tsx!');
