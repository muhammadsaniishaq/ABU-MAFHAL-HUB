const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Import useRouter
content = content.replace(
    `import { Stack } from 'expo-router';`,
    `import { Stack, useRouter } from 'expo-router';`
);

// 2. Define router inside DemographicScreen
content = content.replace(
    `export default function DemographicScreen() {`,
    `export default function DemographicScreen() {
    const router = useRouter();`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully added useRouter and router instance to demographic.tsx!');
