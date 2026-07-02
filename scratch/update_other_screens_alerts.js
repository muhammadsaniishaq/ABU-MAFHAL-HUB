const fs = require('fs');
const path = require('path');

const files = [
    'demographic.tsx',
    'verify-phone.tsx',
    'delink.tsx',
    'ipe-clearance.tsx',
    'tracking.tsx',
    'validation.tsx'
];

const alertHandlerReplacement = `        } catch (e: any) {
            const errM = e.message || '';
            if (errM.toLowerCase().includes('not found') || errM.toLowerCase().includes('no record') || errM.toLowerCase().includes('does not exist') || errM.toLowerCase().includes('not exist') || errM.toLowerCase().includes('invalid or not found')) {
                Alert.alert('No Record Found', 'The record or identity you entered does not exist or has no record. Please check the details and try again.');
            } else {
                Alert.alert('Request Failed', errM || 'An error occurred. Please try again.');
            }
        }`;

files.forEach(file => {
    const filePath = path.join(__dirname, '../app/nin-services/', file);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the catch block matching 'catch (e: any) {\n            Alert.alert('Request Failed', e.message);'
    const targetPattern = /\} catch \(e: any\) \{\s*Alert\.alert\('Request Failed', e\.message\);\s*\}/g;
    
    if (targetPattern.test(content)) {
        content = content.replace(targetPattern, alertHandlerReplacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully updated alerts in ${file}!`);
    } else {
        console.log(`No match for standard catch alert in ${file}.`);
    }
});
