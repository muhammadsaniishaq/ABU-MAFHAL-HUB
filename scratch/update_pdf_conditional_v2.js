const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/nin-services/verify-nin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetStart = '    const handleDownloadPdf = async () => {';
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

const replacement = `    const handleDownloadPdf = async () => {
        if (!result || !result.data) return;
        setIsSaving(true);
        try {
            let html = '';

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
            const trackingId = result.data.tracking_id || result.data.trackingId || 'H6Y0NYFH0000373';
            const address = result.data.residence_address || result.data.address || '47, Harmony Avenue\\nKETU ALAPERE\\nLagos';

            const qrCodeUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NIN-\${cleanNin}-\${surname.replace(/\\s+/g, '-')}-\${first.replace(/\\s+/g, '-')}&color=000000\`;

            if (selectedLayout === 'premium') {
                html = \`
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
            } else if (selectedLayout === 'standard') {
                html = \`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>NIN Card New Edition - Square Photo & QR Fixed</title>
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
                      height: 330px;
                      border: 1px solid #d1d5db;
                      border-radius: 8px;
                      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                      padding: 16px;
                      display: flex;
                      flex-direction: column;
                      justify-content: space-between;
                      overflow: hidden;
                      position: relative;
                      background-color: white;
                      box-sizing: border-box;
                    }

                    .faint-wm {
                      position: absolute;
                      inset: 0;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0.04;
                      pointer-events: none;
                      z-index: 0;
                    }

                    .faint-wm img {
                      width: 340px;
                      height: 340px;
                      object-fit: contain;
                    }

                    .secure-wm-container {
                      position: absolute;
                      inset: 0;
                      pointer-events: none;
                      z-index: 0;
                      overflow: hidden;
                      opacity: 0.25;
                    }

                    .secure-watermark-left {
                      position: absolute;
                      font-size: 15px;
                      font-weight: bold;
                      color: #9ca3af;
                      transform: rotate(-40deg);
                      white-space: nowrap;
                      letter-spacing: 0.1em;
                    }

                    .secure-watermark-right {
                      position: absolute;
                      font-size: 15px;
                      font-weight: bold;
                      color: #9ca3af;
                      transform: rotate(-35deg);
                      white-space: nowrap;
                      letter-spacing: 0.1em;
                    }

                    .top-coat {
                      position: absolute;
                      top: 10px;
                      left: 0;
                      right: 0;
                      display: flex;
                      justify-content: center;
                      z-index: 10;
                    }

                    .top-coat img {
                      width: 62px;
                      height: 62px;
                      object-fit: contain;
                    }

                    .grid-12 {
                      display: grid;
                      grid-template-columns: repeat(12, 1fr);
                      gap: 4px;
                      align-items: end;
                      z-index: 10;
                      position: relative;
                      margin-top: auto;
                      margin-bottom: auto;
                    }

                    .col-4 {
                      grid-column: span 4;
                      display: flex;
                      align-items: center;
                      justify-content: start;
                      padding-bottom: 8px;
                    }

                    .photo-box {
                      width: 108px;
                      height: 132px;
                      background-color: #929497;
                      border: 1px solid #9ca3af;
                      border-radius: 2px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      position: relative;
                      overflow: hidden;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }

                    .photo-box img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    }

                    .col-5 {
                      grid-column: span 5;
                      padding-left: 4px;
                      display: flex;
                      flex-direction: column;
                      gap: 12px;
                      padding-bottom: 4px;
                    }

                    .info-lbl {
                      font-size: 11px;
                      font-weight: 800;
                      color: #6b7280;
                      text-transform: uppercase;
                      margin: 0;
                      line-height: 1;
                    }

                    .info-val {
                      font-size: 15px;
                      font-weight: 700;
                      color: black;
                      margin: 3px 0 0 0;
                      line-height: 1.2;
                    }

                    .col-3 {
                      grid-column: span 3;
                      display: flex;
                      flex-direction: column;
                      align-items: end;
                      justify-content: center;
                      text-align: center;
                    }

                    .nga-box {
                      width: 88px;
                      text-align: center;
                      margin-bottom: 4px;
                    }

                    .nga-txt {
                      font-size: 25px;
                      font-weight: 800;
                      color: black;
                      display: block;
                      line-height: 1;
                    }

                    .nga-sub {
                      font-size: 12px;
                      font-weight: 700;
                      color: #cbd5e1;
                      display: block;
                      line-height: 1;
                      margin-top: 4px;
                      letter-spacing: 0.05em;
                    }

                    .qr-box {
                      padding: 2px;
                      background-color: white;
                      border: 1px solid black;
                      margin-bottom: 8px;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    }

                    .qr-box img {
                      width: 78px;
                      height: 78px;
                      display: block;
                    }

                    .issue-box {
                      width: 88px;
                      text-align: center;
                    }

                    .issue-lbl {
                      font-size: 10.5px;
                      font-weight: 900;
                      color: black;
                      display: block;
                      line-height: 1;
                    }

                    .issue-val {
                      font-size: 11.5px;
                      font-weight: 700;
                      color: black;
                      display: block;
                      line-height: 1;
                      margin-top: 4px;
                    }

                    .bottom-row {
                      text-align: center;
                      z-index: 10;
                      position: relative;
                      padding-bottom: 6px;
                    }

                    .bottom-row h3 {
                      font-size: 14px;
                      font-weight: 800;
                      color: black;
                      margin: 0 0 8px 0;
                      line-height: 1;
                    }

                    .nin-val {
                      font-size: 34px;
                      font-weight: 600;
                      font-family: monospace;
                      color: black;
                      line-height: 1;
                      word-spacing: 0.4em;
                      letter-spacing: 0.04em;
                    }
                  </style>
                </head>
                <body>
                  <div class="print-instructions">
                      <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                      <p style="margin: 4px 0 0 0; font-size: 14px; color: #555;">You may cut it out of the paper, fold and laminate as desired.</p>
                  </div>

                  <div class="card-container">
                    <div class="faint-wm">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" alt="Faint Watermark">
                    </div>

                    <div class="secure-wm-container">
                      <div class="secure-watermark-left" style="bottom: 68px; left: -35px;">\${cleanNin.length === 11 ? cleanNin.slice(4, 7) : '000'}</div>
                      <div class="secure-watermark-left" style="bottom: 28px; left: -25px;">\${cleanNin}</div>
                      
                      <div class="secure-watermark-right" style="top: 44px; right: 25px;">\${cleanNin}</div>
                      
                      <div class="secure-watermark-right" style="bottom: 25px; right: -20px;">\${cleanNin}</div>
                    </div>

                    <div class="top-coat">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" alt="Official Coat of Arms">
                    </div>

                    <div class="grid-12">
                      <div class="col-4">
                        <div class="photo-box">
                          <img src="\${photoUrl}" alt="Holder Portrait">
                        </div>
                      </div>

                      <div class="col-5">
                        <div>
                          <span class="info-lbl">Surname/Nom</span>
                          <span class="info-val">\${surname.toUpperCase()}</span>
                        </div>
                        
                        <div>
                          <span class="info-lbl">Given Names/Prénoms</span>
                          <span class="info-val">\${givenNames.toUpperCase()}</span>
                        </div>
                        
                        <div>
                          <span class="info-lbl">Date of Birth</span>
                          <span class="info-val">\${dob}</span>
                        </div>
                      </div>

                      <div class="col-3">
                        <div class="nga-box">
                          <span class="nga-txt">NGA</span>
                          <span class="nga-sub">\${cleanNin}</span>
                        </div>

                        <div class="qr-box">
                          <img src="\${qrCodeUrl}&margin=1" alt="QR Code">
                        </div>
                        
                        <div class="issue-box">
                          <span class="issue-lbl">ISSUE DATE</span>
                          <span class="issue-val">\${issueDate}</span>
                        </div>
                      </div>
                    </div>

                    <div class="bottom-row">
                      <h3>National Identification Number (NIN)</h3>
                      <div class="nin-val">\${fmtNin}</div>
                    </div>
                  </div>
                </body>
                </html>
                \`;
            } else if (selectedLayout === 'regular') {
                const addrParts = address.split('\\n');
                const addr1 = addrParts[0] || '';
                const addr2 = addrParts[1] || '';
                const addr3 = addrParts[2] || '';
                html = \`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>National Identity Management System - NIN Slip</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #ffffff;
                            margin: 0;
                            padding: 20px;
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
                            margin-bottom: 25px;
                            font-size: 15px;
                            color: #333;
                            font-weight: bold;
                        }
                        .nin-slip-container {
                            width: 100%;
                            max-width: 820px;
                            background-color: #f5f5ee;
                            border: 1px solid #9ca3af;
                            padding: 16px;
                            box-sizing: border-box;
                            position: relative;
                        }
                        .header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            border-bottom: 2px solid black;
                            padding-bottom: 12px;
                        }
                        .header-logo {
                            width: 75px;
                            height: 75px;
                            object-fit: contain;
                        }
                        .header-nimc {
                            width: 95px;
                            height: 75px;
                            object-fit: contain;
                        }
                        .header-center {
                            text-align: center;
                            flex: 1;
                            padding: 0 10px;
                        }
                        .header-center h1 {
                            font-size: 22px;
                            font-weight: bold;
                            color: #111827;
                            margin: 0;
                            letter-spacing: 0.02em;
                        }
                        .header-center p {
                            margin: 2px 0 0 0;
                            font-weight: 500;
                            color: #1f2937;
                        }
                        .grid-layout {
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                            border-bottom: 2px solid black;
                        }
                        .col-left {
                            grid-column: span 3;
                            border-right: 1px solid black;
                            display: flex;
                            flex-direction: column;
                        }
                        .col-mid {
                            grid-column: span 5;
                            border-right: 1px solid black;
                            display: flex;
                            flex-direction: column;
                        }
                        .col-right {
                            grid-column: span 4;
                            display: grid;
                            grid-template-columns: repeat(12, 1fr);
                        }
                        .cell-row {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            border-bottom: 1px solid black;
                            height: 44px;
                            align-items: center;
                        }
                        .cell-row-last {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            height: 44px;
                            align-items: center;
                        }
                        .cell-lbl {
                            padding-left: 8px;
                            font-weight: bold;
                            color: #111827;
                            font-size: 13px;
                            border-right: 1px solid black;
                            height: 100%;
                            display: flex;
                            align-items: center;
                        }
                        .cell-val {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #1f2937;
                            font-size: 13px;
                            font-family: monospace;
                            letter-spacing: 0.05em;
                        }
                        .cell-val-bold {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #1f2937;
                            font-size: 13px;
                            font-weight: bold;
                        }
                        .cell-val-nin {
                            grid-column: span 2;
                            padding-left: 12px;
                            color: #111827;
                            font-size: 15px;
                            font-weight: bold;
                            letter-spacing: 0.1em;
                            font-family: monospace;
                        }
                        .address-block {
                            grid-column: span 7;
                            padding: 12px;
                            font-size: 12px;
                            line-height: 1.5;
                            color: #111827;
                        }
                        .address-title {
                            font-weight: bold;
                            font-size: 13px;
                            margin-bottom: 4px;
                        }
                        .photo-block {
                            grid-column: span 5;
                            border-left: 1px solid black;
                            background-color: #e5e7eb;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 176px;
                            overflow: hidden;
                        }
                        .photo-block img {
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                        }
                        .note-row {
                            padding: 10px 8px;
                            border-bottom: 1px solid black;
                            font-size: 12px;
                            color: #111827;
                            font-weight: 500;
                        }
                        .footer {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            border-top: 1px solid black;
                            text-align: center;
                            margin-top: 4px;
                        }
                        .footer-col {
                            padding: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            border-right: 1px solid black;
                        }
                        .footer-col:last-child {
                            border-right: none;
                        }
                        .footer-icon {
                            width: 20px;
                            height: 20px;
                            margin-bottom: 4px;
                            color: #4b5563;
                        }
                        .footer-col span {
                            font-size: 12px;
                            font-weight: 600;
                            color: #1f2937;
                        }
                        .footer-col-right {
                            padding: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .footer-col-right .title {
                            font-size: 12px;
                            font-weight: bold;
                            color: #111827;
                        }
                        .footer-col-right .sub {
                            font-size: 9px;
                            color: #374151;
                            margin-top: 2px;
                            font-weight: 500;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-instructions">
                        <p style="margin: 0;">Please find below your new High Resolution NIN Slip</p>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; font-weight: normal;">You may cut it out of the paper, fold and laminate as desired.</p>
                    </div>

                    <div class="nin-slip-container" id="nin-slip">
                        <div class="header">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" alt="Coat of Arms of Nigeria" class="header-logo">
                            <div class="header-center">
                                <h1>National Identity Management System</h1>
                                <p style="font-size: 16px;">Federal Republic of Nigeria</p>
                                <p style="font-size: 14px; color: #374151;">National Identification Number Slip (NINS)</p>
                            </div>
                            <img src="https://images.seeklogo.com/logo-png/48/1/national-identity-management-commission-logo-png_seeklogo-489842.png" alt="NIMC Logo" class="header-nimc">
                        </div>

                        <div class="grid-layout">
                            <div class="col-left">
                                <div class="cell-row">
                                    <div class="cell-lbl">Tracking ID</div>
                                    <div class="cell-val">\${trackingId}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">NIN</div>
                                    <div class="cell-val-nin">\${cleanNin}</div>
                                </div>
                                <div class="cell-row-last">
                                    <div class="cell-lbl">Issue Date</div>
                                    <div class="cell-val">\${issueDate}</div>
                                </div>
                            </div>

                            <div class="col-mid">
                                <div class="cell-row">
                                    <div class="cell-lbl">Surname</div>
                                    <div class="cell-val-bold">\${surname.toUpperCase()}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">First Name</div>
                                    <div class="cell-val-bold">\${first.toUpperCase()}</div>
                                </div>
                                <div class="cell-row">
                                    <div class="cell-lbl">Middle Name</div>
                                    <div class="cell-val-bold">\${middle.toUpperCase()}</div>
                                </div>
                                <div class="cell-row-last">
                                    <div class="cell-lbl">Gender</div>
                                    <div class="cell-val-bold">\${gender}</div>
                                </div>
                            </div>

                            <div class="col-right">
                                <div class="address-block">
                                    <div class="address-title">Address:</div>
                                    <div>\${addr1.toUpperCase()}</div>
                                    <div style="margin-top: 18px;">\${addr2.toUpperCase()}</div>
                                    <div style="margin-top: 14px;">\${addr3.toUpperCase()}</div>
                                </div>
                                <div class="photo-block">
                                    <img src="\${photoUrl}" alt="Passport">
                                </div>
                            </div>
                        </div>

                        <div class="note-row">
                            <span style="font-weight: bold;">Note:</span> This transaction slip does not confer the right to the <span style="font-weight: bold;">General Multipurpose Card</span> (For any enquiry please contact)
                        </div>

                        <div class="footer">
                            <div class="footer-col">
                                <svg class="footer-icon" fill="currentColor" viewBox="0 0 20 20" style="width:18px; height:18px; color:#4b5563;"><path d="M5.5 14a3.5 3.5 0 010-7 3.5 3.5 0 015.96-2.54 2.5 2.5 0 013.3 3.53A4 4 0 0113.5 14h-8z"></path></svg>
                                <span>helpdesk@nimc.gov.ng</span>
                            </div>
                            <div class="footer-col">
                                <svg class="footer-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:18px; height:18px; color:#2563eb;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                                <span>www.nimc.gov.ng</span>
                            </div>
                            <div class="footer-col">
                                <svg class="footer-icon" fill="currentColor" viewBox="0 0 20 20" style="width:18px; height:18px; color:#16a34a;"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 004.587 4.587l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                                <span>07040144452, 07040144453</span>
                            </div>
                            <div class="footer-col-right">
                                <span class="title">National Identity Management Commission</span>
                                <span class="sub">11 Sokode Crescent, Off Dalaba Street Zone 5, Wuse Abuja Nigeria</span>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                \`;
            } else {
                const uri = await viewShotRef.current.capture();
                let dataUri = uri;
                if (Platform.OS !== 'web') {
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                    dataUri = \`data:image/png;base64,\${base64}\`;
                }
                html = \`
                <html>
                <head>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 0; 
                            background-color: white; 
                            display: flex; 
                            flex-direction: column;
                            align-items: center; 
                            justify-content: center; 
                            height: 100vh; 
                            font-family: Arial, sans-serif;
                            box-sizing: border-box; 
                        }
                        .page-container {
                            width: 100%;
                            max-width: 600px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        .header-text {
                            text-align: center;
                            font-size: 13px;
                            color: #333;
                            margin-bottom: 25px;
                            line-height: 1.5;
                        }
                        .card-img {
                            width: 480px;
                            border: 1px dashed #ccc;
                            border-radius: 8px;
                            overflow: hidden;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header-text">
                            <p style="margin: 0; font-weight: bold;">Please find below your new High Resolution NIN Slip</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #666;">You may cut it out of the paper, fold and laminate as desired.</p>
                        </div>
                        <div class="card-img">
                            <img src="\${dataUri}" style="width: 100%; height: auto; display: block;" />
                        </div>
                    </div>
                </body>
                </html>
                \`;
            }

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
console.log('Successfully updated verify-nin.tsx PDF download method with true paper layout!');
