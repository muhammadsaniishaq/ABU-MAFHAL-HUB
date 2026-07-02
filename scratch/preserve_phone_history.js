const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/supabase.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `'recent_nin_verifications',`;
const replacementStr = `'recent_nin_verifications',\n            'recent_phone_verifications',`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully added recent_phone_verifications to the preserved keys list in services/supabase.ts!');
} else {
    console.error('Target not found in services/supabase.ts');
}
