const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Fix style type casting
content = content.replace(
    `style={styles.slipPreviewImage}`,
    `style={styles.slipPreviewImage as any}`
);

// 2. Fix invalid font weights
content = content.replace("fontWeight: '950'", "fontWeight: '900'");
content = content.replace("fontWeight: '850'", "fontWeight: '800'");

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully fixed type errors in ipe-clearance.tsx styles!');
