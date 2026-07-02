const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/manage/users.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = '    avatar_url?: string;\n}';
const replacement = '    avatar_url?: string;\n    credit_balance?: number;\n}';

if (!content.includes(target)) {
    // Try with CRLF
    const targetCRLF = '    avatar_url?: string;\r\n}';
    const replacementCRLF = '    avatar_url?: string;\r\n    credit_balance?: number;\r\n}';
    if (!content.includes(targetCRLF)) {
        console.error('Could not find avatar_url definition in users.tsx');
        process.exit(1);
    }
    content = content.replace(targetCRLF, replacementCRLF);
} else {
    content = content.replace(target, replacement);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added credit_balance to UserProfile interface!');
