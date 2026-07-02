const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// 1. Overwrite app/fund-wallet.tsx to immediately redirect to (app)/wallet
const fundWalletPath = path.join(projectRoot, 'app/fund-wallet.tsx');
const redirectCode = `import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function FundWalletRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/(app)/wallet');
    }, []);
    return null;
}
`;
fs.writeFileSync(fundWalletPath, redirectCode, 'utf8');
console.log('Overwrote app/fund-wallet.tsx with direct auto-redirect code.');

// 2. Modify other files to change '/fund-wallet' to '/(app)/wallet' or '/(app)/wallet'
const filesToUpdate = [
    {
        relPath: 'app/(app)/dashboard.tsx',
        replacements: [
            { from: `'/fund-wallet': 'wallet_deposit_card',`, to: `'/(app)/wallet': 'wallet_deposit_card',` },
            { from: `route: '/fund-wallet'`, to: `route: '/(app)/wallet'` }
        ]
    },
    {
        relPath: 'app/nin-services/verify-nin.tsx',
        replacements: [
            { from: `router.push('/fund-wallet')`, to: `router.push('/(app)/wallet')` }
        ]
    },
    {
        relPath: 'app/nin-services/verify-phone.tsx',
        replacements: [
            { from: `router.push('/fund-wallet')`, to: `router.push('/(app)/wallet')` }
        ]
    },
    {
        relPath: 'app/ai-chat.tsx',
        replacements: [
            { from: `route: "/fund-wallet"`, to: `route: "/(app)/wallet"` }
        ]
    },
    {
        relPath: 'app/(app)/wallet.tsx',
        replacements: [
            { 
                from: `onPress={() => router.push('/fund-wallet')}`, 
                to: `onPress={() => Alert.alert("How to Fund Wallet", "To fund your wallet, simply make a bank transfer to your Dedicated Account shown below. Your balance will be credited instantly!\\n\\nIf you don't have a dedicated account number yet, please complete your Tier 2 KYC Verification.")}` 
            }
        ]
    }
];

filesToUpdate.forEach(fileOpt => {
    const fullPath = path.join(projectRoot, fileOpt.relPath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        fileOpt.replacements.forEach(rep => {
            content = content.split(rep.from).join(rep.to);
        });

        if (content !== original) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Successfully updated ${path.basename(fileOpt.relPath)} with new Wallet path/action!`);
        } else {
            console.warn(`No replacements matched in ${path.basename(fileOpt.relPath)}`);
        }
    } else {
        console.error(`File not found: ${fullPath}`);
    }
});
