const fs = require('fs');
const path = require('path');

const files = [
  'data.tsx', 'airtime.tsx', 'bills.tsx', 'education.tsx', 'bvn-services.tsx', 
  'crypto.tsx', 'kyc.tsx', 'virtual-cards.tsx', 'transfer.tsx', 'saved-cards.tsx', 
  'savings.tsx', 'loans.tsx', 'insurance.tsx', 'investments.tsx', 'qr-pay.tsx', 
  'beneficiaries.tsx', 'support.tsx'
].map(f => path.join('app', '(app)', f));

// add files in nin-services as well
const ninDir = path.join('app', '(app)', 'nin-services');
if (fs.existsSync(ninDir)) {
  fs.readdirSync(ninDir).forEach(f => {
    if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      files.push(path.join(ninDir, f));
    }
  });
}

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    
    // update imports
    content = content.replace(/from '\.\.\//g, "from '../../");
    content = content.replace(/import (.*?) from '\.\.\//g, "import $1 from '../../");
    content = content.replace(/require\('\.\.\//g, "require('../../");
    
    fs.writeFileSync(f, content);
    console.log('Updated ' + f);
  }
});
