const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/validation.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

const targetStr = `    headerSubTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },`;

const replacementStr = `    headerSubTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyTitle: {
        color: '#1e293b',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.5,
        marginLeft: 6,
    },`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log('Successfully inserted historyHeader and historyTitle styles.');
} else {
    console.error('Target string not found for replacement.');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Finished running fix_validation_styles.js.');
