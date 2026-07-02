const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/pc/.gemini/antigravity-ide/brain/54f3d726-0638-466a-b3a9-b58bb8fbbbc7/walkthrough.md';
let content = fs.readFileSync(filePath, 'utf8');

const target = '### 2. Standard Card (New Edition Card Layout)';

const index = content.indexOf(target);
if (index !== -1) {
    const updated = content.slice(0, index) + `### 2. Standard Card (New Edition Card Layout)
- **UI Component Update**: Re-implemented [StandardSlip.tsx](file:///c:/ABU-MAFHAL-HUB/components/StandardSlip.tsx) with the new square photo card layout:
  - Faint Coat of Arms watermark and slanted background text watermarks.
  - Square photo/avatar placeholder, NGA, QR code, and spaced-out bottom NIN.
- **Vector PDF Layout**: Updated \`handleDownloadPdf\` in [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx) to export a matching high-fidelity card PDF when Standard is selected.

### 3. Information Slip (True Portrait A4 Layout)
- **UI Component Update**: Re-implemented [InformationSlip.tsx](file:///c:/ABU-MAFHAL-HUB/components/InformationSlip.tsx) to match the portrait A4 sheet layout:
  - Colored Nigeria Coat of Arms (left), NIMC logo (right), and large grey titles centered at the top.
  - 3-column top grid displaying demographic details (left), signature label and vertical photo placeholder (middle), and green "Verified" title, rules list, and circular stamp (right).
  - Center spanning row for the large spaced out NIN.
  - Lower grid displaying tracking ID, residence state/LGA, birth state/LGA, address, and phone number.
- **Vector PDF Layout**: Updated \`handleDownloadPdf\` in [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx) to render a matching high-fidelity A4 portrait PDF when "Information" is selected.

` + content.slice(index + target.length + `### 2. Standard Card (New Edition Card Layout)
- **UI Component Update**: Re-implemented [StandardSlip.tsx](file:///c:/ABU-MAFHAL-HUB/components/StandardSlip.tsx) with the new square photo card layout:
  - Faint Coat of Arms watermark and slanted background text watermarks.
  - Square photo/avatar placeholder, NGA, QR code, and spaced-out bottom NIN.
- **Vector PDF Layout**: Updated \`handleDownloadPdf\` in [verify-nin.tsx](file:///c:/ABU-MAFHAL-HUB/app/nin-services/verify-nin.tsx) to export a matching high-fidelity card PDF when Standard is selected.`.length);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Successfully updated walkthrough.md with Information layout updates!');
} else {
    console.error('Could not find target in walkthrough.md');
}
