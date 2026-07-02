const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStart = 'const handleDownloadPdf = async () => {';
const targetEnd = '    useEffect(() => {';

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) {
    console.error('Could not find start of handleDownloadPdf');
    process.exit(1);
}

const endIndex = content.indexOf(targetEnd, startIndex);
if (endIndex === -1) {
    console.error('Could not find useEffect after handleDownloadPdf');
    process.exit(1);
}

const replacement = `const handleDownloadPdf = async () => {
        if (!result || !result.data) return;
        setIsSaving(true);
        try {
            const rawPhoto = result.data.photo || result.data.image || result.data.picture || '';
            const photoUrl = rawPhoto.startsWith('data:') || rawPhoto.startsWith('http')
                ? rawPhoto
                : rawPhoto ? \`data:image/jpeg;base64,\${rawPhoto}\` : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL363G0d9u3u5YQ&s';
            
            const rawDob = result.data.birthdate || result.data.dob || result.data.dateOfBirth || '';
            const dob = formatDob(rawDob);
            const rawGender = result.data.gender || result.data.sex || 'F';
            const gender = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
            const rawNin = result.data.nin || result.data.number || '';
            const cleanNin = rawNin.replace(/\\D/g, '');
            const fmtNin = cleanNin.length === 11
                ? \`\${cleanNin.slice(0,4)} \${cleanNin.slice(4,7)} \${cleanNin.slice(7)}\`
                : cleanNin;
            const watermarkText = cleanNin.length === 11 ? \`\${cleanNin.slice(0, 4)} \${cleanNin.slice(4)}\` : cleanNin;
            const photoWatermark = cleanNin.length === 11 ? cleanNin.slice(4) : '';
            const surname = result.data.surname || result.data.last_name || 'RESIDENT';
            const first = result.data.firstname || result.data.first_name || '';
            const middle = result.data.middlename || result.data.middle_name || '';
            const givenNames = [first, middle].filter(Boolean).join(' ');
            const rawIssue = result.data.issueDate || result.data.issue_date || '';
            const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';

            const qrCodeUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NIN-\${cleanNin}-\${surname.replace(/\\s+/g, '-')}-\${first.replace(/\\s+/g, '-')}&color=000000\`;

            const html = \`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Digital NIN Slip Print Page</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #ffffff;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .print-instructions {
                            text-align: center;
                            margin-bottom: 40px;
                            font-size: 16px;
                            color: #111;
                            line-height: 1.5;
                        }

                        .card-container {
                            width: 535px;
                            border: 1px solid #d1d5db;
                            border-radius: 2px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            overflow: hidden;
                            background-color: white;
                        }

                        .card-front {
                            width: 535px;
                            height: 330px;
                            padding: 14px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            overflow: hidden;
                            position: relative;
                            border-bottom: 1px dashed #9ca3af;
                            
                            background-color: #ffffff;
                            background-image: 
                                radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.9) 0%, rgba(246, 253, 249, 0.7) 50%, #d5f2de 100%),
                                url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='535' height='330' viewBox='0 0 535 330'%3E%3Cdefs%3E%3Cg id='rosette-left'%3E%3Ccircle cx='40' cy='290' r='30' fill='none' stroke='rgba(0, 135, 81, 0.07)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='50' fill='none' stroke='rgba(0, 135, 81, 0.06)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='70' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='90' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='110' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3Ccircle cx='40' cy='290' r='130' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3C/g%3E%3Cg id='rosette-right'%3E%3Ccircle cx='480' cy='60' r='40' fill='none' stroke='rgba(0, 135, 81, 0.06)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='65' fill='none' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='90' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3Ccircle cx='480' cy='60' r='115' fill='none' stroke='rgba(0, 135, 81, 0.04)' stroke-width='0.75'/%3E%3C/g%3E%3C/defs%3E%3Cpath d='M267,165 L0,0 M267,165 L60,0 M267,165 L120,0 M267,165 L180,0 M267,165 L240,0 M267,165 L300,0 M267,165 L360,0 M267,165 L420,0 M267,165 L480,0 M267,165 L535,0 M267,165 L535,55 M267,165 L535,110 M267,165 L535,165 M267,165 L535,220 M267,165 L535,275 M267,165 L535,330 M267,165 L480,330 M267,165 L420,330 M267,165 L360,330 M267,165 L300,330 M267,165 L240,330 M267,165 L180,330 M267,165 L120,330 M267,165 L60,330 M267,165 L0,330 M267,165 L0,275 M267,165 L0,220 M267,165 L0,165 M267,165 L0,110 M267,165 L0,55' stroke='rgba(0, 135, 81, 0.05)' stroke-width='0.75'/%3E%3Cuse href='%23rosette-left'/%3E%3Cuse href='%23rosette-right'/%3E%3C/svg%3E");
                        }

                        .card-back {
                            width: 535px;
                            height: 330px;
                            background-color: white;
                            padding: 24px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            text-align: center;
                            transform: rotate(180deg);
                            position: relative;
                        }

                        .card-back-border {
                            position: absolute;
                            top: 16px;
                            bottom: 16px;
                            left: 16px;
                            right: 16px;
                            border: 1px solid #d1d5db;
                            border-radius: 1px;
                            pointer-events: none;
                        }

                        .coat-watermark {
                            position: absolute;
                            top: 22px;
                            bottom: 22px;
                            left: 0;
                            right: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: 0.14;
                            pointer-events: none;
                            z-index: 0;
                        }

                        .coat-watermark img {
                            width: 200px;
                            height: 200px;
                            object-fit: contain;
                            mix-blend-mode: multiply;
                        }

                        .slant-watermark-container {
                            position: absolute;
                            inset: 0;
                            pointer-events: none;
                            z-index: 0;
                            overflow: hidden;
                            opacity: 0.18;
                        }

                        .slant-watermark {
                            position: absolute;
                            font-size: 10.5px;
                            font-weight: bold;
                            color: #166534;
                            transform: rotate(-28deg);
                            white-space: nowrap;
                            letter-spacing: 0.05em;
                        }

                        .header-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            z-index: 10;
                            position: relative;
                        }

                        .header-title {
                            color: #008751;
                            font-weight: 900;
                            font-size: 18px;
                            letter-spacing: 0.01em;
                            margin: 0;
                            line-height: 1.1;
                        }

                        .header-subtitle {
                            color: #000000;
                            font-weight: 800;
                            font-size: 13px;
                            letter-spacing: -0.02em;
                            margin: 2px 0 0 0;
                            line-height: 1.1;
                        }

                        .details-grid {
                            display: flex;
                            align-items: center;
                            margin: auto 0;
                            z-index: 10;
                            position: relative;
                        }

                        .photo-col {
                            width: 86px;
                            margin-right: 12px;
                        }

                        .photo-box {
                            width: 86px;
                            height: 112px;
                            border: 1px solid #166534;
                            background-color: #f3f4f6;
                            overflow: hidden;
                            position: relative;
                            border-radius: 1px;
                        }

                        .photo-box img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }

                        .photo-watermark {
                            position: absolute;
                            bottom: 2px;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 6px;
                            font-weight: bold;
                            color: #166534;
                            opacity: 0.4;
                            transform: rotate(-15deg);
                            pointer-events: none;
                        }

                        .info-col {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            gap: 8px;
                        }

                        .info-label {
                            font-size: 6.5px;
                            font-weight: 700;
                            color: #4b5563;
                            display: block;
                            line-height: 1;
                            margin-bottom: 2px;
                            text-transform: uppercase;
                        }

                        .info-value {
                            font-size: 11px;
                            font-weight: 800;
                            color: #000000;
                            display: block;
                            line-height: 1;
                        }

                        .dob-sex-row {
                            display: flex;
                            gap: 16px;
                        }

                        .right-col {
                            width: 78px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            margin-left: 8px;
                        }

                        .qr-box {
                            width: 78px;
                            height: 78px;
                            padding: 3px;
                            background-color: white;
                            border: 1px solid #000000;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                        }

                        .qr-box img {
                            width: 72px;
                            height: 72px;
                            display: block;
                        }

                        .nga-container {
                            width: 78px;
                            text-align: center;
                            margin-top: 4px;
                        }

                        .nga-text {
                            font-size: 18px;
                            font-weight: 900;
                            color: #000000;
                            display: block;
                            line-height: 1;
                        }

                        .issue-lbl {
                            font-size: 7.5px;
                            font-weight: 800;
                            color: #6b7280;
                            display: block;
                            line-height: 1;
                            margin-top: 3px;
                            text-transform: uppercase;
                        }

                        .issue-val {
                            font-size: 9.5px;
                            font-weight: 800;
                            color: #000000;
                            font-family: monospace;
                            display: block;
                            line-height: 1;
                            margin-top: 2px;
                        }

                        .bottom-row {
                            text-align: center;
                            z-index: 10;
                            position: relative;
                            margin-top: auto;
                            padding-bottom: 2px;
                        }

                        .nin-title {
                            font-size: 10px;
                            font-weight: 700;
                            color: #000000;
                            line-height: 1;
                            margin: 0 0 4px 0;
                        }

                        .nin-value {
                            font-size: 27px;
                            font-weight: 900;
                            font-family: monospace;
                            color: #000000;
                            line-height: 1;
                            word-spacing: 0.38em;
                            letter-spacing: 0.03em;
                        }

                        .bottom-line {
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            height: 3px;
                            background: linear-gradient(to right, #166534, #059669, #166534);
                            opacity: 0.4;
                        }

                        /* Disclaimer styles */
                        .disclaimer-container {
                            max-width: 430px;
                            padding: 0 8px;
                            z-index: 10;
                        }

                        .disclaimer-title {
                            font-size: 16px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #000000;
                            margin: 0;
                            line-height: 1;
                        }

                        .disclaimer-sub {
                            font-size: 10px;
                            font-style: italic;
                            font-family: Georgia, serif;
                            color: #4b5563;
                            margin: 4px 0 0 0;
                        }

                        .disclaimer-p {
                            font-size: 10px;
                            line-height: 1.5;
                            color: #000000;
                            font-weight: 600;
                            margin: 12px 0;
                        }

                        .caution-title {
                            font-size: 12.5px;
                            font-weight: 900;
                            text-transform: uppercase;
                            color: #000000;
                            margin: 12px 0 0 0;
                            line-height: 1;
                        }

                        .caution-p {
                            font-size: 9px;
                            line-height: 1.4;
                            color: #1f2937;
                            font-weight: 500;
                            margin: 8px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-instructions">
                        <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                        <p style="margin: 4px 0 0 0; font-size: 14px; color: #555;">You may cut it out of the paper, fold and laminate as desired.</p>
                    </div>

                    <div class="card-container">
                        <!-- FRONT SIDE -->
                        <div class="card-front">
                            <div class="coat-watermark">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIKo551M65-TWEyZQ7BolTDwvb-VN6b5XQ4WEsmhRyEQ&s=10" alt="Nigeria Coat of Arms">
                            </div>

                            <div class="slant-watermark-container">
                                <div class="slant-watermark" style="bottom: 15%; left: -25px;">\${watermarkText}</div>
                                <div class="slant-watermark" style="top: 30%; right: -15px;">\${watermarkText}</div>
                            </div>

                            <div class="header-row">
                                <div>
                                    <h1 class="header-title">FEDERAL REPUBLIC OF NIGERIA</h1>
                                    <h2 class="header-subtitle">DIGITAL NIN SLIP</h2>
                                </div>
                            </div>

                            <div class="details-grid">
                                <div class="photo-col">
                                    <div class="photo-box">
                                        <img src="\${photoUrl}" alt="Holder Portrait">
                                        <div class="photo-watermark">\${photoWatermark}</div>
                                    </div>
                                </div>

                                <div class="info-col">
                                    <div>
                                        <span class="info-label">SURNAME/NOM</span>
                                        <span class="info-value">\${surname.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <span class="info-label">GIVEN NAMES/PRÉNOMS</span>
                                        <span class="info-value">\${givenNames.toUpperCase()}</span>
                                    </div>
                                    <div class="dob-sex-row">
                                        <div>
                                            <span class="info-label">DATE OF BIRTH</span>
                                            <span class="info-value" style="font-size:12.5px;">\${dob}</span>
                                        </div>
                                        <div>
                                            <span class="info-label">SEX/SEXE</span>
                                            <span class="info-value" style="font-size:12.5px;">\${gender}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="right-col">
                                    <div class="qr-box">
                                        <img src="\${qrCodeUrl}" alt="Security Barcode Matrix">
                                    </div>
                                    <div class="nga-container">
                                        <span class="nga-text">NGA</span>
                                        <span class="issue-lbl">ISSUE DATE</span>
                                        <span class="issue-val">\${issueDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="bottom-row">
                                <h3 class="nin-title">National Identification Number (NIN)</h3>
                                <div class="nin-value">\${fmtNin}</div>
                            </div>

                            <div class="bottom-line"></div>
                        </div>

                        <!-- BACK SIDE -->
                        <div class="card-back">
                            <div class="card-back-border"></div>
                            
                            <div class="disclaimer-container">
                                <h2 class="disclaimer-title">DISCLAIMER</h2>
                                <p class="disclaimer-sub">Trust, but verify</p>
                                
                                <p class="disclaimer-p">
                                    Kindly ensure each time this ID is presented, that you verify the credentials using a Government-APPROVED verification resource.<br>
                                    The details on the front of this NIN Slip must EXACTLY match the verification result.
                                </p>

                                <h3 class="caution-title">CAUTION!</h3>

                                <p class="caution-p">
                                    If this NIN was not issued to the person on the front of this document, please DO NOT attempt to scan, photocopy or replicate the personal data contained herein.<br>
                                    You are only permitted to scan the barcode for the purpose of identity verification.<br>
                                    The <span style="font-weight: bold;">FEDERAL GOVERNMENT OF NIGERIA</span> assumes no responsibility if you accept any variance in the scan result or do not scan the 2D barcode overleaf.
                                </p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            \`;

            if (Platform.OS === 'web') {
                await Print.printAsync({ html });
            } else {
                const { uri: pdfUri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(pdfUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Download NIN Slip (PDF)',
                        UTI: 'com.adobe.pdf'
                    });
                } else {
                    Alert.alert("Error", "Sharing is not available on this device.");
                }
            }
        } catch (e: any) {
            Alert.alert("Error", "Failed to download PDF: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };
    
`;

const updatedContent = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Successfully updated verify-nin.tsx PDF download method!');
