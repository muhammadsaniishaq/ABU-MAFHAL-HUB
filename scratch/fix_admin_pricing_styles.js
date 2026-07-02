const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/manage/nin-pricing.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace("fontWeight: '750'", "fontWeight: '700'");
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully fixed style type error in nin-pricing.tsx!');
