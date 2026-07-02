const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = 'export default function VerifyNINScreen() {';
const helperCode = `const formatDob = (raw: string): string => {
    if (!raw || raw === 'N/A') return raw;
    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    try {
        const parts = raw.split(/[-/]/);
        if (parts.length === 3) {
            let y: string, m: string, d: string;
            if (parts[0].length === 4) { [y, m, d] = parts; } else { [d, m, y] = parts; }
            const idx = parseInt(m, 10) - 1;
            if (idx >= 0 && idx < 12) return \`\${d.padStart(2,'0')} \${MONTHS[idx]} \${y}\`;
        }
    } catch (_) {}
    return raw.toUpperCase();
};

`;

const index = content.indexOf(target);
if (index === -1) {
    console.error('Could not find Export statement');
    process.exit(1);
}

const updatedContent = content.slice(0, index) + helperCode + content.slice(index);
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Successfully added formatDob helper to verify-nin.tsx!');
