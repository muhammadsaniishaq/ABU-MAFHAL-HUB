const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../supabase/functions/verify-nin/index.ts');
let content = fs.readFileSync(filePath, 'utf8');

const target = `    const searchType = requestData.searchType || type
    const searchValue = requestData.searchValue || value`;

const replacement = `    const searchType = requestData.searchType || type
    const searchValue = requestData.searchValue || value

    if (!searchType) {
      return jsonOk({ error: 'Missing search type' })
    }

    const FEE_AMOUNT = 0; // Set to 0 for development testing/bypassing insufficient balance`;

const index = content.indexOf(target);
if (index !== -1) {
    const updated = content.slice(0, index + target.length) + '\n' + replacement.slice(target.length);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated verify-nin Edge Function with FEE_AMOUNT = 0!');
} else {
    console.error('Could not find target in verify-nin index.ts');
}
