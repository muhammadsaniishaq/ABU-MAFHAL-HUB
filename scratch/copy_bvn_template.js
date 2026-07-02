const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\pc\\.gemini\\antigravity-ide\\brain\\54f3d726-0638-466a-b3a9-b58bb8fbbbc7\\media__1782689702695.png';
const dest = path.join(__dirname, '../assets/images/bvn_card_template.png');

if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log('Successfully copied BVN card template to assets/images/bvn_card_template.png!');
} else {
    console.error('Source file not found at:', src);
}
