const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../supabase/functions/verify-nin/index.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `    let FEE_AMOUNT = 100; // Deduct 100 NGN by default
    
    if(searchType === 'demographic'){
        FEE_AMOUNT = 200; // Higher fee for demographic
    } else if(searchType === 'bvn'){
        FEE_AMOUNT = 150;
    } else if(searchType === 'bvn-card'){
        FEE_AMOUNT = 300;
    }`;

const replacement = `    let FEE_AMOUNT = 0; // Set to 0 for development testing/bypassing insufficient balance`;

// Normalize line endings
const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

const index = normContent.indexOf(normTarget);
if (index !== -1) {
    const updated = normContent.slice(0, index) + normReplacement + normContent.slice(index + normTarget.length);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated verify-nin FEE_AMOUNT to 0!');
} else {
    console.error('Could not find target block in verify-nin index.ts');
}
