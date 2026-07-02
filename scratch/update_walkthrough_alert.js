const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/pc/.gemini/antigravity-ide/brain/54f3d726-0638-466a-b3a9-b58bb8fbbbc7/walkthrough.md';
let content = fs.readFileSync(filePath, 'utf8');

const target = '## Validation Results';

const index = content.indexOf(target);
if (index !== -1) {
    const updated = content.slice(0, index) + `### 3. "No Record Found" Custom Alert Handling
- **Files modified**:
  - [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx)
  - [verify-phone.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-phone.tsx)
  - [demographic.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/demographic.tsx)
  - [delink.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/delink.tsx)
  - [ipe-clearance.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/ipe-clearance.tsx)
  - [tracking.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/tracking.tsx)
  - [validation.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/validation.tsx)
- **Modifications**: Added a check in both the API result error response and the thrown catch blocks. If the error message contains keywords like "not found", "no record", "does not exist", or "invalid or not found", the application triggers a specialized alert:
  - **Title**: \`No Record Found\`
  - **Message**: \`The record or identity you entered does not exist or has no record. Please check the details and try again.\`

---

## Validation Results`;
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated walkthrough.md with Alert updates!');
} else {
    console.error('Could not find target in walkthrough.md');
}
