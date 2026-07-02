const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/StandardSlip.tsx');

const code = `/**
 * StandardSlip Component
 * Uses StyleSheet only (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

const getVal = (data: any, keys: string[], fallback = ''): string => {
    for (const k of keys) {
        const v = data?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return fallback;
};

const formatDob = (raw: string): string => {
    if (!raw || raw === 'N/A') return raw;
    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    try {
        const parts = raw.split(/[-/]/);
        if (parts.length === 3) {
            let y: string, m: string, d: string;
            if (parts[0].length === 4) { [y, m, d] = parts; } else { [d, m, y] = parts; }
            const idx = parseInt(m, 10) - 1;
            if (idx >= 0 && idx < 12) return \`\${d.padStart(2,'0')} \${MONTHS[idx]} \${y}\`;
        }
    } catch (_) {}
    return raw.toUpperCase();
};

const resolvePhoto = (photo: string | undefined | null): string | null => {
    if (!photo || photo.trim() === '') return null;
    if (photo.startsWith('data:')) return photo;
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
    return \`data:image/jpeg;base64,\${photo}\`;
};

const Silhouette = () => (
    <Svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%', marginTop: 24, transform: [{ scale: 1.1 }] }}>
        <Ellipse cx="40" cy="28" rx="18" ry="20" fill="#e2e8f0" />
        <Path d="M6,96 Q6,58 40,58 Q74,58 74,96 Z" fill="#e2e8f0" />
    </Svg>
);

export const StandardSlip = ({ data }: { data: any }) => {
    const firstName  = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName   = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob     = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawNin     = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto   = getVal(data, ['photo','image','picture','avatar','face_image']);
    const rawIssue   = getVal(data, ['issueDate','issue_date','issuance_date'], '');
 
    const dob = formatDob(rawDob);
    const cleanNin = rawNin.replace(/\\D/g, '');
    const fmtNin = cleanNin.length === 11
        ? \`\${cleanNin.slice(0,4)} \${cleanNin.slice(4,7)} \${cleanNin.slice(7)}\`
        : cleanNin || '0000 000 0000';
    
    // Spaced out 4-3-4 representation
    const displayNin = cleanNin.length === 11
        ? \`\${cleanNin.slice(0,4)} \${cleanNin.slice(4,7)} \${cleanNin.slice(7)}\`
        : '0000 000 0000';

    const givenNames = [firstName, middleName].filter(Boolean).join(' ') || 'PROUD NIGERIAN';
    const photoUri = resolvePhoto(rawPhoto);
    const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';
    
    const qrCodeUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=NIN-\${cleanNin}-\Token-\${lastName.replace(/\\s+/g, '-')}-\Token-\${firstName.replace(/\\s+/g, '-')}&color=000000&margin=1\`;

    return (
        <View style={s.card}>
            {/* Faint Background Coat of Arms Watermark */}
            <View style={s.faintWatermarkWrap}>
                <Image
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" }}
                    style={s.faintWatermark}
                    resizeMode="contain"
                />
            </View>

            {/* Slanted text watermarks */}
            <View style={s.securityWatermarkContainer}>
                <Text style={s.watermarkLeft1}>{cleanNin.length === 11 ? cleanNin.slice(4, 7) : '000'}</Text>
                <Text style={s.watermarkLeft2}>{cleanNin}</Text>
                <Text style={s.watermarkRight1}>{cleanNin}</Text>
                <Text style={s.watermarkRight2}>{cleanNin}</Text>
            </View>

            {/* Official Coat of Arms Top Center */}
            <View style={s.topCoatWrap}>
                <Image
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" }}
                    style={s.topCoat}
                    resizeMode="contain"
                />
            </View>

            {/* Grid layout */}
            <View style={s.grid}>
                {/* Column 4 - Photo */}
                <View style={s.colPhoto}>
                    <View style={s.photoPlaceholder}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
                        ) : (
                            <Silhouette />
                        )}
                    </View>
                </View>

                {/* Column 5 - Info */}
                <View style={s.colInfo}>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Surname/Nom</Text>
                        <Text style={s.infoValue} numberOfLines={1}>{lastName.toUpperCase()}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Given Names/Prénoms</Text>
                        <Text style={s.infoValue} numberOfLines={1}>{givenNames.toUpperCase()}</Text>
                    </View>
                    <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Date of Birth</Text>
                        <Text style={s.infoValue}>{dob}</Text>
                    </View>
                </View>

                {/* Column 3 - Right Panel */}
                <View style={s.colRight}>
                    <View style={s.ngaContainer}>
                        <Text style={s.ngaText}>NGA</Text>
                        <Text style={s.ngaSub}>{cleanNin}</Text>
                    </View>

                    <View style={s.qrWrap}>
                        <Image source={{ uri: qrCodeUrl }} style={s.qrImg} resizeMode="contain" />
                    </View>

                    <View style={s.issueContainer}>
                        <Text style={s.issueLabel}>ISSUE DATE</Text>
                        <Text style={s.issueVal}>{issueDate}</Text>
                    </View>
                </View>
            </View>

            {/* Bottom Row */}
            <View style={s.bottomRow}>
                <Text style={s.ninTitle}>National Identification Number (NIN)</Text>
                <Text style={s.ninVal}>{displayNin}</Text>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 535 / 330,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 14,
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative',
    },
    faintWatermarkWrap: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.04,
        zIndex: 0,
    },
    faintWatermark: {
        width: '72%',
        height: '72%',
    },
    securityWatermarkContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        opacity: 0.22,
        zIndex: 0,
    },
    watermarkLeft1: {
        position: 'absolute',
        bottom: '22%',
        left: '-5%',
        fontSize: 14,
        fontWeight: '900',
        color: '#9ca3af',
        transform: [{ rotate: '-40deg' }],
        letterSpacing: 2,
    },
    watermarkLeft2: {
        position: 'absolute',
        bottom: '10%',
        left: '-3%',
        fontSize: 14,
        fontWeight: '900',
        color: '#9ca3af',
        transform: [{ rotate: '-40deg' }],
        letterSpacing: 2,
    },
    watermarkRight1: {
        position: 'absolute',
        top: '15%',
        right: '5%',
        fontSize: 14,
        fontWeight: '900',
        color: '#9ca3af',
        transform: [{ rotate: '-35deg' }],
        letterSpacing: 2,
    },
    watermarkRight2: {
        position: 'absolute',
        bottom: '10%',
        right: '-3%',
        fontSize: 14,
        fontWeight: '900',
        color: '#9ca3af',
        transform: [{ rotate: '-35deg' }],
        letterSpacing: 2,
    },
    topCoatWrap: {
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    topCoat: {
        width: 58,
        height: 58,
    },
    grid: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'flex-end',
        zIndex: 10,
        marginBottom: 8,
        marginTop: 45,
    },
    colPhoto: {
        width: '32%',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        paddingBottom: 2,
    },
    photoPlaceholder: {
        width: 96,
        height: 118,
        backgroundColor: '#929497',
        borderWidth: 1,
        borderColor: '#9ca3af',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },
    colInfo: {
        width: '43%',
        paddingLeft: 4,
        justifyContent: 'flex-end',
        gap: 10,
        paddingBottom: 2,
    },
    infoGroup: {
        marginBottom: 2,
    },
    infoLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 1,
        letterSpacing: -0.2,
    },
    infoValue: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#000',
        letterSpacing: 0.2,
    },
    colRight: {
        width: '25%',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    ngaContainer: {
        alignItems: 'center',
        marginBottom: 2,
        width: '100%',
    },
    ngaText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#000',
        lineHeight: 22,
    },
    ngaSub: {
        fontSize: 10,
        fontWeight: '700',
        color: '#cbd5e1',
        lineHeight: 10,
        marginTop: 3,
        letterSpacing: 0.5,
    },
    qrWrap: {
        padding: 1.5,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 4,
    },
    qrImg: {
        width: 68,
        height: 68,
    },
    issueContainer: {
        alignItems: 'center',
        width: '100%',
    },
    issueLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#000',
        lineHeight: 9,
    },
    issueVal: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
        lineHeight: 10,
        marginTop: 2,
    },
    bottomRow: {
        alignItems: 'center',
        zIndex: 10,
        paddingBottom: 2,
    },
    ninTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#000',
        marginBottom: 3,
    },
    ninVal: {
        fontSize: 28,
        fontWeight: '600',
        color: '#000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        letterSpacing: 0.8,
        lineHeight: 28,
    },
});
`;

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated StandardSlip.tsx with Card style!');
