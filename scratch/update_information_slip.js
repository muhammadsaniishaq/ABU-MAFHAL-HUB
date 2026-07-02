const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/InformationSlip.tsx');

const code = `/**
 * InformationSlip Component
 * Uses StyleSheet only (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText, Ellipse, Path } from 'react-native-svg';

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
    <Svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%', marginTop: 12, transform: [{ scale: 1.15 }] }}>
        <Ellipse cx="40" cy="28" rx="18" ry="20" fill="#cbd5e1" />
        <Path d="M6,96 Q6,58 40,58 Q74,58 74,96 Z" fill="#cbd5e1" />
    </Svg>
);

const Stamp = () => (
    <Svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
        <Circle cx="60" cy="60" r="48" fill="none" stroke="#429343" strokeWidth="2.5" />
        <Circle cx="60" cy="60" r="42" fill="none" stroke="#429343" strokeWidth="0.75" />
        <Rect x="15" y="44" width="90" height="32" fill="white" stroke="#429343" strokeWidth="2.5" rx="3" />
        <SvgText x="60" y="64" fontFamily="Helvetica, Arial, sans-serif" fontWeight="900" fontSize="13.5" textAnchor="middle" fill="#429343" letterSpacing="0.5">VERIFIED</SvgText>
        <SvgText fontSize="5.5" fontWeight="bold" fill="#429343" x="48" y="32">★ ★ ★</SvgText>
        <SvgText fontSize="5.5" fontWeight="bold" fill="#429343" x="48" y="87">★ ★ ★</SvgText>
    </Svg>
);

export const InformationSlip = ({ data }: { data: any }) => {
    const firstName      = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName       = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName     = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob         = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawGender      = getVal(data, ['gender','sex','gender_id'], 'M');
    const rawNin         = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto       = getVal(data, ['photo','image','picture','avatar','face_image']);
    const trackingId     = getVal(data, ['tracking_id', 'trackingId', 'tracking'], '');
    const phone          = getVal(data, ['telephoneno', 'phoneNumber', 'phone', 'telephone'], '');
    const residenceState = getVal(data, ['residence_state', 'residenceState', 'state'], '');
    const residenceLga   = getVal(data, ['residence_lga', 'residenceLga', 'lga'], '');
    const birthState     = getVal(data, ['birthstate', 'birthState'], 'YOBE');
    const birthLga       = getVal(data, ['birthlga', 'birthLga'], '');
    const address        = getVal(data, ['residence_address', 'address'], '');

    const dob      = formatDob(rawDob);
    const gender   = rawGender.trim().toUpperCase().startsWith('M') ? 'MALE' : 'FEMALE';
    const cleanNin = rawNin.replace(/\\D/g, '');
    const photoUri = resolvePhoto(rawPhoto);

    // Format spaced NIN
    const fmtNin = cleanNin.length === 11
        ? \`\${cleanNin.slice(0,4)}  \${cleanNin.slice(4,7)}  \${cleanNin.slice(7)}\`
        : cleanNin;

    return (
        <View style={s.card}>
            <View>
                {/* Header */}
                <View style={s.header}>
                    <Image
                        source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Coat_of_arms_of_Nigeria.svg" }}
                        style={s.coatLogo}
                        resizeMode="contain"
                    />
                    
                    <View style={s.headerCenter}>
                        <Text style={s.headerTitle}>Federal Republic of Nigeria</Text>
                        <Text style={s.headerSub}>Verified NIN Details</Text>
                    </View>

                    <Image
                        source={{ uri: "https://images.seeklogo.com/logo-png/48/1/national-identity-management-commission-logo-png_seeklogo-489842.png" }}
                        style={s.nimcLogo}
                        resizeMode="contain"
                    />
                </View>

                {/* Upper Grid */}
                <View style={s.grid}>
                    {/* Left Column - Fields */}
                    <View style={s.colLeft}>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>First Name:</Text>
                            <Text style={s.fieldValue}>{firstName.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Middle Name:</Text>
                            <Text style={s.fieldValue}>{middleName.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Last Name:</Text>
                            <Text style={s.fieldValue}>{lastName.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Date of Birth:</Text>
                            <Text style={s.fieldValue}>{dob}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Gender:</Text>
                            <Text style={s.fieldValue}>{gender}</Text>
                        </View>
                    </View>

                    {/* Middle Column - Photo */}
                    <View style={s.colMid}>
                        <View style={s.photoContainer}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" />
                            ) : (
                                <Silhouette />
                            )}
                        </View>
                        <Text style={s.signatureLabel}>Signature:</Text>
                    </View>

                    {/* Right Column - Status & Stamp */}
                    <View style={s.colRight}>
                        <Text style={s.verifiedTitle}>Verified</Text>
                        <Text style={s.rightNote}>
                            This is a property of National Identity Management Commission (NIMC), Nigeria. If found, please return to the nearest NIMC's office.
                        </Text>
                        
                        <View style={s.rulesList}>
                            <Text style={s.ruleItem}>1. This NIN slip remains the property of the Federal Republic of Nigeria, and must be surrendered on demand;</Text>
                            <Text style={s.ruleItem}>2. This NIN slip does not imply nor confer the citizenship of the Federal Republic of Nigeria on the individual the document is issued to;</Text>
                            <Text style={s.ruleItem}>3. This NIN slip is valid for the lifetime of the owner and <Text style={s.redBold}>DOES NOT EXPIRE</Text></Text>
                        </View>

                        <View style={s.stampContainer}>
                            <Stamp />
                        </View>
                    </View>
                </View>

                {/* NIN Spanning Row */}
                <View style={s.ninRow}>
                    <Text style={s.ninLabel}>NIN NUMBER:</Text>
                    <Text style={s.ninValue}>{fmtNin}</Text>
                </View>

                {/* Lower Grid */}
                <View style={s.lowerGrid}>
                    {/* Lower Column 1 */}
                    <View style={s.lowerCol}>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Tracking ID:</Text>
                            <Text style={s.fieldValueNormal}>{trackingId}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Residence State:</Text>
                            <Text style={s.fieldValueNormal}>{residenceState.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Birth State:</Text>
                            <Text style={s.fieldValueNormal}>{birthState.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Address:</Text>
                            <Text style={s.fieldValueNormal} numberOfLines={1}>{address}</Text>
                        </View>
                    </View>

                    {/* Lower Column 2 */}
                    <View style={s.lowerCol}>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Phone Number:</Text>
                            <Text style={s.fieldValueNormal}>{phone}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Residence LGA/Town:</Text>
                            <Text style={s.fieldValueNormal}>{residenceLga.toUpperCase()}</Text>
                        </View>
                        <View style={s.fieldRow}>
                            <Text style={s.fieldLabel}>Birth LGA:</Text>
                            <Text style={s.fieldValueNormal}>{birthLga.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Bottom Offset State */}
            <Text style={s.bottomStateText}>{birthState.toUpperCase()}</Text>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 0.707,
        backgroundColor: '#ffffff',
        borderWidth: 1.2,
        borderColor: '#9ca3af',
        padding: 16,
        justifyContent: 'space-between',
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        paddingBottom: 6,
        marginBottom: 14,
    },
    coatLogo: {
        width: 36,
        height: 36,
    },
    nimcLogo: {
        width: 48,
        height: 36,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 6,
    },
    headerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#6c7d8a',
        textAlign: 'center',
        lineHeight: 13,
    },
    headerSub: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#72828e',
        textAlign: 'center',
        marginTop: 2,
        lineHeight: 14,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    colLeft: {
        width: '35%',
        gap: 6,
    },
    colMid: {
        width: '28%',
        alignItems: 'center',
    },
    colRight: {
        width: '35%',
        alignItems: 'center',
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        lineHeight: 10,
    },
    fieldLabel: {
        width: '40%',
        fontSize: 6.8,
        fontWeight: 'bold',
        color: '#000',
    },
    fieldValue: {
        flex: 1,
        fontSize: 6.8,
        fontWeight: 'normal',
        color: '#000',
    },
    fieldValueNormal: {
        flex: 1,
        fontSize: 6.8,
        fontWeight: 'normal',
        color: '#000',
    },
    photoContainer: {
        width: 75,
        height: 92,
        borderWidth: 1,
        borderColor: '#9ca3af',
        backgroundColor: '#e3deda',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    signatureLabel: {
        fontSize: 6.8,
        fontWeight: 'bold',
        color: '#000',
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    verifiedTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#009639',
        textTransform: 'uppercase',
        marginBottom: 1,
    },
    rightNote: {
        fontSize: 5,
        color: '#000',
        textAlign: 'center',
        lineHeight: 6.5,
        marginBottom: 3,
    },
    rulesList: {
        gap: 2,
        marginBottom: 4,
    },
    ruleItem: {
        fontSize: 5,
        color: '#000',
        lineHeight: 6,
    },
    redBold: {
        color: '#dc2626',
        fontWeight: 'bold',
    },
    stampContainer: {
        width: 44,
        height: 44,
        transform: [{ rotate: '-12deg' }],
        opacity: 0.85,
    },
    ninRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        borderBottomWidth: 1.5,
        borderColor: '#000',
        paddingVertical: 4,
        marginVertical: 10,
    },
    ninLabel: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#000',
        marginRight: 6,
    },
    ninValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        letterSpacing: 1.5,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    lowerGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    lowerCol: {
        width: '48%',
        gap: 6,
    },
    bottomStateText: {
        fontSize: 6.8,
        fontWeight: 'normal',
        color: '#000',
        alignSelf: 'flex-end',
        marginRight: 40,
        marginBottom: 20,
    },
});
`;

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated InformationSlip.tsx with true portrait layout!');
