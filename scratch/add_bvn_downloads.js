const fs = require('fs');
const path = require('path');

const bvnPath = path.join(__dirname, '../app/bvn-services.tsx');

if (fs.existsSync(bvnPath)) {
    let content = fs.readFileSync(bvnPath, 'utf8');
    content = content.replace(/\r\n/g, '\n');

    // 1. Add ViewShot, Sharing, FileSystem, Print, and useRef imports
    content = content.replace(
        "import { useState, useEffect } from 'react';",
        "import { useState, useEffect, useRef } from 'react';\nimport ViewShot from 'react-native-view-shot';\nimport * as Sharing from 'expo-sharing';\nimport * as FileSystem from 'expo-file-system';\nimport * as Print from 'expo-print';"
    );

    // 2. Add useRef inside BVNVerificationScreen component
    content = content.replace(
        "    const insets = useSafeAreaInsets();",
        "    const insets = useSafeAreaInsets();\n    const viewShotRef = useRef<any>(null);\n    const [isSaving, setIsSaving] = useState(false);"
    );

    // 3. Add handleDownloadPdf and handleDownloadPng functions
    const downloadHandlers = `    const handleDownloadPng = async () => {
        if (!viewShotRef.current) return;
        try {
            setIsSaving(true);
            const uri = await viewShotRef.current.capture();
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Download BVN Card (PNG)'
                });
            } else {
                showAlert("Sharing Unavailable", "Sharing is not available on this device.", "warning");
            }
        } catch (e: any) {
            showAlert("PNG Download Failed", e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!viewShotRef.current) return;
        try {
            setIsSaving(true);
            const uri = await viewShotRef.current.capture();
            let dataUri = uri;
            if (Platform.OS !== 'web') {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                dataUri = \`data:image/png;base64,\${base64}\`;
            }

            const html = \`
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
                        <p style="margin: 0; font-weight: bold;">Please find below your high resolution verified BVN card/slip details.</p>
                    </div>
                    <div class="card-img">
                        <img src="\${dataUri}" style="width: 100%; height: auto; display: block;" />
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
                        dialogTitle: 'Download BVN Card (PDF)',
                        UTI: 'com.adobe.pdf'
                    });
                } else {
                    showAlert("Sharing Unavailable", "Sharing is not available on this device.", "warning");
                }
            }
        } catch (e: any) {
            showAlert("PDF Download Failed", e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };`;

    content = content.replace(
        "    const getPhotoUrl = (data: any) => {",
        downloadHandlers + "\n\n    const getPhotoUrl = (data: any) => {"
    );

    // 4. Wrap preview card inside ViewShot
    const oldCardView = `                    {/* Gorgeous ID card preview */}
                    {searchType === 'card' ? (
                        <ImageBackground 
                            source={require('../assets/images/bvn_card_template.png')} 
                            style={styles.bvnCardBackground}
                            imageStyle={{ borderRadius: 16 }}
                            resizeMode="cover"
                        >
                            {/* Portrait Photo on Left */}
                            <View style={styles.bvnCardPortraitContainer}>
                                <Image source={{ uri: photoUrl }} style={styles.bvnCardPortrait} />
                            </View>

                            {/* Surname */}
                            <View style={[styles.bvnCardTextRow, { top: '24%' }]}>
                                <Text style={styles.bvnCardTextBold}>{result.lastName || result.last_name || '—'}</Text>
                            </View>

                            {/* First Name / Other Name */}
                            <View style={[styles.bvnCardTextRow, { top: '44%' }]}>
                                <Text style={styles.bvnCardTextBold}>
                                    {[result.firstName || result.first_name, result.middleName || result.middle_name].filter(Boolean).join(' ') || '—'}
                                </Text>
                            </View>

                            {/* Date of Birth & Gender & Issue Date */}
                            <View style={[styles.bvnCardTextRow, { top: '63%', flexDirection: 'row', width: '65%' }]}>
                                <View style={{ width: '42%' }}>
                                    <Text style={styles.bvnCardTextBold}>{result.dateOfBirth || result.dob || '—'}</Text>
                                </View>
                                <View style={{ width: '28%' }}>
                                    <Text style={styles.bvnCardTextBold}>{(result.gender || '—').toUpperCase()}</Text>
                                </View>
                                <View style={{ width: '30%', paddingLeft: 5 }}>
                                    <Text style={styles.bvnCardTextBold}>
                                        {(() => {
                                            const d = new Date();
                                            const pad = (n) => n.toString().padStart(2, '0');
                                            return \`\${pad(d.getDate())}-\${pad(d.getMonth() + 1)}-\${d.getFullYear()}\`;
                                        })()}
                                    </Text>
                                </View>
                            </View>

                            {/* BVN Number */}
                            <View style={[styles.bvnCardTextRow, { top: '82%' }]}>
                                <Text style={[styles.bvnCardTextBold, { fontSize: 13, letterSpacing: 1.5, color: '#060d21' }]}>
                                    {result.number || result.bvn || inputValue}
                                </Text>
                            </View>
                        </ImageBackground>
                    ) : (
                        <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.idPreviewCard}>
                            {/* Watermark grid background pattern */}
                            <View style={styles.cardWatermarkGrid} />
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={styles.cardLogoText}>BVN NIGERIA</Text>
                                <Ionicons name="wifi" size={18} color="#f5a623" style={{ transform: [{ rotate: '90deg' }] }} />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={styles.cardPortraitBox}>
                                    <Image source={{ uri: photoUrl }} style={styles.cardPortrait} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={styles.cardFieldLabel}>HOLDER NAME</Text>
                                    <Text style={styles.cardFieldVal} numberOfLines={1}>{fullName}</Text>

                                    <Text style={[styles.cardFieldLabel, { marginTop: 10 }]}>BVN NUMBER</Text>
                                    <Text style={styles.cardFieldVal}>{result.number || result.bvn || inputValue}</Text>
                                </View>
                            </View>

                            <View style={styles.cardBottomRow}>
                                <View>
                                    <Text style={styles.cardFieldLabel}>DATE OF BIRTH</Text>
                                    <Text style={styles.cardFieldVal}>{result.dateOfBirth || result.dob || '—'}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.cardFieldLabel}>GENDER</Text>
                                    <Text style={styles.cardFieldVal}>{(result.gender || '—').toUpperCase()}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    )}`;

    const newCardView = `                    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%', backgroundColor: '#f4f6fb' }}>
                        {searchType === 'card' ? (
                            <ImageBackground 
                                source={require('../assets/images/bvn_card_template.png')} 
                                style={styles.bvnCardBackground}
                                imageStyle={{ borderRadius: 16 }}
                                resizeMode="cover"
                            >
                                {/* Portrait Photo on Left */}
                                <View style={styles.bvnCardPortraitContainer}>
                                    <Image source={{ uri: photoUrl }} style={styles.bvnCardPortrait} />
                                </View>

                                {/* Surname */}
                                <View style={[styles.bvnCardTextRow, { top: '24%' }]}>
                                    <Text style={styles.bvnCardTextBold}>{result.lastName || result.last_name || '—'}</Text>
                                </View>

                                {/* First Name / Other Name */}
                                <View style={[styles.bvnCardTextRow, { top: '44%' }]}>
                                    <Text style={styles.bvnCardTextBold}>
                                        {[result.firstName || result.first_name, result.middleName || result.middle_name].filter(Boolean).join(' ') || '—'}
                                    </Text>
                                </View>

                                {/* Date of Birth & Gender & Issue Date */}
                                <View style={[styles.bvnCardTextRow, { top: '63%', flexDirection: 'row', width: '65%' }]}>
                                    <View style={{ width: '42%' }}>
                                        <Text style={styles.bvnCardTextBold}>{result.dateOfBirth || result.dob || '—'}</Text>
                                    </View>
                                    <View style={{ width: '28%' }}>
                                        <Text style={styles.bvnCardTextBold}>{(result.gender || '—').toUpperCase()}</Text>
                                    </View>
                                    <View style={{ width: '30%', paddingLeft: 5 }}>
                                        <Text style={styles.bvnCardTextBold}>
                                            {(() => {
                                                const d = new Date();
                                                const pad = (n) => n.toString().padStart(2, '0');
                                                return \`\${pad(d.getDate())}-\${pad(d.getMonth() + 1)}-\${d.getFullYear()}\`;
                                            })()}
                                        </Text>
                                    </View>
                                </View>

                                {/* BVN Number */}
                                <View style={[styles.bvnCardTextRow, { top: '82%' }]}>
                                    <Text style={[styles.bvnCardTextBold, { fontSize: 13, letterSpacing: 1.5, color: '#060d21' }]}>
                                        {result.number || result.bvn || inputValue}
                                    </Text>
                                </View>
                            </ImageBackground>
                        ) : (
                            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.idPreviewCard}>
                                {/* Watermark grid background pattern */}
                                <View style={styles.cardWatermarkGrid} />
                                
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={styles.cardLogoText}>BVN NIGERIA</Text>
                                    <Ionicons name="wifi" size={18} color="#f5a623" style={{ transform: [{ rotate: '90deg' }] }} />
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                    <View style={styles.cardPortraitBox}>
                                        <Image source={{ uri: photoUrl }} style={styles.cardPortrait} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 16 }}>
                                        <Text style={styles.cardFieldLabel}>HOLDER NAME</Text>
                                        <Text style={styles.cardFieldVal} numberOfLines={1}>{fullName}</Text>

                                        <Text style={[styles.cardFieldLabel, { marginTop: 10 }]}>BVN NUMBER</Text>
                                        <Text style={styles.cardFieldVal}>{result.number || result.bvn || inputValue}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardBottomRow}>
                                    <View>
                                        <Text style={styles.cardFieldLabel}>DATE OF BIRTH</Text>
                                        <Text style={styles.cardFieldVal}>{result.dateOfBirth || result.dob || '—'}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.cardFieldLabel}>GENDER</Text>
                                        <Text style={styles.cardFieldVal}>{(result.gender || '—').toUpperCase()}</Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        )}
                    </ViewShot>

                    {/* Download Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                        <TouchableOpacity 
                            onPress={handleDownloadPdf}
                            disabled={isSaving}
                            style={{ flex: 1, backgroundColor: '#0284c7', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginRight: 6, elevation: 1 }}
                        >
                            <Ionicons name="document-text-outline" size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Download PDF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleDownloadPng}
                            disabled={isSaving}
                            style={{ flex: 1, backgroundColor: '#f5a623', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginLeft: 6, elevation: 1 }}
                        >
                            <Ionicons name="image-outline" size={18} color="#060d21" />
                            <Text style={{ color: '#060d21', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>Download PNG</Text>
                        </TouchableOpacity>
                    </View>`;

    content = content.replace(oldCardView, newCardView);
    fs.writeFileSync(bvnPath, content, 'utf8');
    console.log('Successfully added download PDF & PNG functionality to bvn-services.tsx using ViewShot!');
}
