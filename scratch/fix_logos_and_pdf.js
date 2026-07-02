const fs = require('fs');
const path = require('path');

// Target logo replacements
const OLD_COAT_URL = "https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg";
const NEW_COAT_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png";

const OLD_NIMC_URL = "https://images.seeklogo.com/logo-png/48/1/national-identity-management-commission-logo-png_seeklogo-489842.png";
const NEW_NIMC_URL = "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png";

const files = [
    '../components/InformationSlip.tsx',
    '../components/RegularSlip.tsx',
    '../components/StandardSlip.tsx',
    '../app/nin-services/verify-nin.tsx'
];

files.forEach(relPath => {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        // Perform replacements
        content = content.split(OLD_COAT_URL).join(NEW_COAT_URL);
        content = content.split(OLD_NIMC_URL).join(NEW_NIMC_URL);

        // Specific fix for verify-nin.tsx PDF Information Slip CSS sizing
        if (relPath.endsWith('verify-nin.tsx')) {
            // Find .logo-coat style rule and insert the img rule
            const coatRule = `.logo-coat {
                            width: 85px;
                            height: 85px;
                            object-fit: contain;
                        }`;
            const targetRuleNormal = coatRule.replace(/\r\n/g, '\n');
            
            // Search dynamically by normalizing whitespace
            const normalizedContent = content.replace(/\r\n/g, '\n');
            const targetIndex = normalizedContent.indexOf(targetRuleNormal);
            
            if (targetIndex !== -1) {
                const replacementRule = `.logo-coat {
                            width: 85px;
                            height: 85px;
                            object-fit: contain;
                        }
                        .logo-coat img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }
                        .logo-nimc img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }`;
                content = normalizedContent.slice(0, targetIndex) + replacementRule + normalizedContent.slice(targetIndex + targetRuleNormal.length);
                console.log('Inserted .logo-coat img CSS sizing in verify-nin.tsx!');
            } else {
                // Try simpler replacement
                content = content.replace(
                    `logo-coat {`,
                    `logo-coat {`
                );
                console.warn('Could not find exact .logo-coat block, using fallback replacement...');
                // Let's do a fallback replacement of .logo-coat rule
                content = content.replace(
                    /\.logo-coat\s*\{\s*width:\s*85px;\s*height:\s*85px;\s*object-fit:\s*contain;\s*\}/g,
                    `.logo-coat { width: 85px; height: 85px; object-fit: contain; } .logo-coat img { width: 100%; height: 100%; object-fit: contain; } .logo-nimc img { width: 100%; height: 100%; object-fit: contain; }`
                );
            }
        }

        if (content !== original) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Successfully replaced logos and fixed styles in ${path.basename(relPath)}`);
        } else {
            console.log(`No replacements needed for ${path.basename(relPath)}`);
        }
    } else {
        console.error(`File path does not exist: ${fullPath}`);
    }
});
