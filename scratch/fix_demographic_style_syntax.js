const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../app/nin-services/demographic.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const badCode = `                        style={[
                            styles.verifyButton,
                            (loading || !firstname.trim() || !lastname.trim() || !dob.trim()) ? styles.(loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}`;

const goodCode = `                        style={[
                            styles.verifyButton,
                            (loading || !firstname.trim() || !lastname.trim() || !isDobValid(dob)) ? styles.verifyButtonDisabled : styles.verifyButtonActive
                        ]}`;

if (content.includes(badCode)) {
    content = content.replace(badCode, goodCode);
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log('Successfully fixed demographic verify button style syntax!');
} else {
    console.error('Target badCode pattern not found in demographic.tsx');
}
