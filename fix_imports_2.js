const fs = require('fs');
const path = require('path');

const filesAppLevel = [
  'data.tsx', 'airtime.tsx', 'bills.tsx', 'education.tsx', 'bvn-services.tsx', 
  'crypto.tsx', 'kyc.tsx', 'virtual-cards.tsx', 'transfer.tsx', 'saved-cards.tsx', 
  'savings.tsx', 'loans.tsx', 'insurance.tsx', 'investments.tsx', 'qr-pay.tsx', 
  'beneficiaries.tsx', 'support.tsx'
].map(f => path.join('app', '(app)', f));

// For files in app/(app)/, any imports matching ../../../ should be reverted to ../../
filesAppLevel.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/from '\.\.\/\.\.\/\.\.\//g, "from '../../");
    content = content.replace(/require\('\.\.\/\.\.\/\.\.\//g, "require('../../");
    fs.writeFileSync(f, content);
  }
});

// For files in app/(app)/nin-services/, they were originally in app/nin-services/
// Original depth: ../../ to reach root. 
// Now they are in app/(app)/nin-services/, so depth is ../../../ to reach root.
// If my script ran twice on them, they might have ../../../../ now!
const ninDir = path.join('app', '(app)', 'nin-services');
if (fs.existsSync(ninDir)) {
  fs.readdirSync(ninDir).forEach(f => {
    if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const p = path.join(ninDir, f);
      let content = fs.readFileSync(p, 'utf8');
      content = content.replace(/from '\.\.\/\.\.\/\.\.\/\.\.\//g, "from '../../../");
      content = content.replace(/require\('\.\.\/\.\.\/\.\.\/\.\.\//g, "require('../../../");
      
      // Let's also ensure anything that was ../../ that should be ../../../ is correct.
      // Actually, if my previous script ran twice, ../../ became ../../../../
      // If it originally had ../ (unlikely for nin-services), it became ../../../
      fs.writeFileSync(p, content);
    }
  });
}
console.log('Fixed imports');
