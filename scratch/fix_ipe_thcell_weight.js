const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/ipe-clearance.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace("fontWeight: '850'", "fontWeight: '800'");
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully fixed thCell style type error in ipe-clearance.tsx!');
