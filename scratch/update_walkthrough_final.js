const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/pc/.gemini/antigravity-ide/brain/54f3d726-0638-466a-b3a9-b58bb8fbbbc7/walkthrough.md';
let content = fs.readFileSync(filePath, 'utf8');

const target = '## Update - 2026-06-30 (Regular NIN Card New Edition)';

const index = content.indexOf(target);
if (index !== -1) {
    const updated = content.slice(0, index) + `## Update - 2026-06-30 (True Paper Slip & Card Edition)

We have updated the slip designs and PDF generator according to your latest visual templates:

### 1. Regular Slip (True Paper NINS Layout)
- **UI Component Update**: Re-implemented [RegularSlip.tsx](file:///c:/ABU-MAFHAL-HUB/components/RegularSlip.tsx) to match the official green paper slip design:
  - Colored Nigeria Coat of Arms (left) and NIMC Logo (right) with the official title centered.
  - Three-section grid panel mapping tracking ID, NIN, surname, given names, gender, address block, and portrait photo.
  - Disclaimer caution note text and 4-column contact footer matching the layout.
- **Vector PDF Layout**: Updated \`handleDownloadPdf\` in [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx) to export a matching high-fidelity green paper slip PDF.

### 2. Standard Card (New Edition Card Layout)
- **UI Component Update**: Re-implemented [StandardSlip.tsx](file:///c:/ABU-MAFHAL-HUB/components/StandardSlip.tsx) with the new square photo card layout:
  - Faint Coat of Arms watermark and slanted background text watermarks.
  - Square photo/avatar placeholder, NGA, QR code, and spaced-out bottom NIN.
- **Vector PDF Layout**: Updated \`handleDownloadPdf\` in [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx) to export a matching high-fidelity card PDF when Standard is selected.

---

## Validation Results

### TypeScript Verification
Ran compiler check to verify type safety:
\`\`\`bash
npx tsc --noEmit
\`\`\`
**Status**: Passed. All compilation errors in the slip components, admin user manager, and verification screen are successfully resolved.
`;
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated walkthrough.md to final layout definitions!');
} else {
    console.error('Could not find target in walkthrough.md');
}
