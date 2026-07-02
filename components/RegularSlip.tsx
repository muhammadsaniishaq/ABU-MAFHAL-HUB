/**
 * RegularSlip Component
 * Uses StyleSheet only (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
            if (idx >= 0 && idx < 12) return `${d.padStart(2,'0')} ${MONTHS[idx]} ${y}`;
        }
    } catch (_) {}
    return raw.toUpperCase();
};

const resolvePhoto = (photo: string | undefined | null): string | null => {
    if (!photo || photo.trim() === '') return null;
    if (photo.startsWith('data:')) return photo;
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
    return `data:image/jpeg;base64,${photo}`;
};

const Silhouette = () => (
    <Svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%', marginTop: 24, transform: [{ scale: 1.1 }] }}>
        <Ellipse cx="40" cy="28" rx="18" ry="20" fill="#e2e8f0" />
        <Path d="M6,96 Q6,58 40,58 Q74,58 74,96 Z" fill="#e2e8f0" />
    </Svg>
);

export const RegularSlip = ({ data }: { data: any }) => {
    const firstName  = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName   = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob     = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawNin     = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto   = getVal(data, ['photo','image','picture','avatar','face_image']);
    const rawIssue   = getVal(data, ['issueDate','issue_date','issuance_date'], '');
    const trackingId = getVal(data, ['tracking_id', 'trackingId', 'tracking'], 'H6Y0NYFH0000373');
    const rawGender  = getVal(data, ['gender','sex','gender_id'], 'M');
    const gender     = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
    const address    = getVal(data, ['residence_address', 'address'], '47, Harmony Avenue\nKETU ALAPERE\nLagos');

    const dob = formatDob(rawDob);
    const cleanNin = rawNin.replace(/\D/g, '');
    const issueDate = rawIssue ? formatDob(rawIssue) : '09/09/2018';
    const photoUri = resolvePhoto(rawPhoto);

    // Format address lines
    const addressLines = address.split('\n');
    const addrLine1 = addressLines[0] || '';
    const addrLine2 = addressLines[1] || '';
    const addrLine3 = addressLines[2] || '';

    return (
        <View style={s.card}>
            {/* Header */}
            <View style={s.header}>
                <Image
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/320px-Coat_of_arms_of_Nigeria.svg.png" }}
                    style={s.headerLogo}
                    resizeMode="contain"
                />
                
                <View style={s.headerCenter}>
                    <Text style={s.title}>National Identity Management System</Text>
                    <Text style={s.subTitle}>Federal Republic of Nigeria</Text>
                    <Text style={s.slipTitle}>National Identification Number Slip (NINS)</Text>
                </View>

                <Image
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" }}
                    style={s.headerNimc}
                    resizeMode="contain"
                />
            </View>

            {/* Grid */}
            <View style={s.grid}>
                {/* Column 3 - Left Panel */}
                <View style={s.colLeft}>
                    <View style={s.cellRow}>
                        <Text style={s.cellLabel}>Tracking ID</Text>
                        <Text style={s.cellValue} numberOfLines={1}>{trackingId}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLabel}>NIN</Text>
                        <Text style={s.cellValueNIN}>{cleanNin}</Text>
                    </View>
                    <View style={s.cellRowLast}>
                        <Text style={s.cellLabel}>Issue Date</Text>
                        <Text style={s.cellValue}>{issueDate}</Text>
                    </View>
                </View>

                {/* Column 5 - Middle Panel */}
                <View style={s.colMiddle}>
                    <View style={s.cellRow}>
                        <Text style={s.cellLabel}>Surname</Text>
                        <Text style={s.cellValueBold} numberOfLines={1}>{lastName.toUpperCase()}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLabel}>First Name</Text>
                        <Text style={s.cellValueBold} numberOfLines={1}>{firstName.toUpperCase()}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLabel}>Middle Name</Text>
                        <Text style={s.cellValueBold} numberOfLines={1}>{middleName.toUpperCase()}</Text>
                    </View>
                    <View style={s.cellRowLast}>
                        <Text style={s.cellLabel}>Gender</Text>
                        <Text style={s.cellValue}>{gender}</Text>
                    </View>
                </View>

                {/* Column 4 - Right Panel */}
                <View style={s.colRight}>
                    <View style={s.addressCol}>
                        <Text style={s.addressTitle}>Address:</Text>
                        <Text style={s.addressText} numberOfLines={1}>{addrLine1.toUpperCase()}</Text>
                        <Text style={[s.addressText, { marginTop: 12 }]} numberOfLines={1}>{addrLine2.toUpperCase()}</Text>
                        <Text style={[s.addressText, { marginTop: 8 }]} numberOfLines={1}>{addrLine3.toUpperCase()}</Text>
                    </View>

                    <View style={s.photoCol}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
                        ) : (
                            <Silhouette />
                        )}
                    </View>
                </View>
            </View>

            {/* Note Section */}
            <View style={s.noteRow}>
                <Text style={s.noteText}>
                    <Text style={s.noteTextBold}>Note:</Text> This transaction slip does not confer the right to the <Text style={s.noteTextBold}>General Multipurpose Card</Text> (For any enquiry please contact)
                </Text>
            </View>

            {/* Footer */}
            <View style={s.footer}>
                <View style={[s.footerCol, { borderRightWidth: 1, borderColor: '#000' }]}>
                    <Ionicons name="mail-outline" size={10} color="#4b5563" />
                    <Text style={s.footerText}>helpdesk@nimc.gov.ng</Text>
                </View>
                
                <View style={[s.footerCol, { borderRightWidth: 1, borderColor: '#000' }]}>
                    <Ionicons name="globe-outline" size={10} color="#2563eb" />
                    <Text style={s.footerText}>www.nimc.gov.ng</Text>
                </View>

                <View style={[s.footerCol, { borderRightWidth: 1, borderColor: '#000' }]}>
                    <Ionicons name="call-outline" size={10} color="#16a34a" />
                    <Text style={s.footerText}>07040144452, 07040144453</Text>
                </View>

                <View style={s.footerColRight}>
                    <Ionicons name="document-text-outline" size={10} color="#1e3a8a" />
                    <Text style={s.footerText} numberOfLines={1}>National Identity Management Commission</Text>
                    <Text style={s.footerTextSmall} numberOfLines={1}>11 Sokode Crescent, Off Dalaba Street Zone 5, Wuse Abuja Nigeria</Text>
                </View>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1012 / 340,
        backgroundColor: '#faf9f5',
        borderWidth: 1,
        borderColor: '#000000',
        padding: 6,
        justifyContent: 'space-between',
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1.5,
        borderColor: '#000',
        paddingBottom: 4,
    },
    headerLogo: {
        width: 38,
        height: 38,
    },
    headerNimc: {
        width: 48,
        height: 38,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 12.5,
        fontWeight: 'bold',
        color: '#000',
        fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
        textAlign: 'center',
        lineHeight: 13,
    },
    subTitle: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#000',
        textAlign: 'center',
        marginTop: 1,
        lineHeight: 9,
    },
    slipTitle: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginTop: 1,
        lineHeight: 8,
    },
    grid: {
        flexDirection: 'row',
        borderBottomWidth: 1.5,
        borderColor: '#000',
        flex: 1,
    },
    colLeft: {
        width: '27%',
        borderRightWidth: 1,
        borderColor: '#000',
        justifyContent: 'space-between',
    },
    colMiddle: {
        width: '38%',
        borderRightWidth: 1,
        borderColor: '#000',
        justifyContent: 'space-between',
    },
    colRight: {
        width: '35%',
        flexDirection: 'row',
    },
    cellRow: {
        flexDirection: 'row',
        height: 18,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#000',
        paddingLeft: 4,
    },
    cellRowLast: {
        flexDirection: 'row',
        height: 18,
        alignItems: 'center',
        paddingLeft: 4,
    },
    cellLabel: {
        width: '35%',
        fontSize: 7,
        fontWeight: 'bold',
        color: '#000',
    },
    cellValue: {
        flex: 1,
        fontSize: 8,
        fontWeight: '600',
        color: '#1f2937',
        borderLeftWidth: 1,
        borderColor: '#000',
        paddingLeft: 4,
        height: '100%',
        textAlignVertical: 'center',
        lineHeight: 18,
    },
    cellValueBold: {
        flex: 1,
        fontSize: 8,
        fontWeight: 'bold',
        color: '#000',
        borderLeftWidth: 1,
        borderColor: '#000',
        paddingLeft: 4,
        height: '100%',
        textAlignVertical: 'center',
        lineHeight: 18,
    },
    cellValueNIN: {
        flex: 1,
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#000',
        borderLeftWidth: 1,
        borderColor: '#000',
        paddingLeft: 4,
        height: '100%',
        textAlignVertical: 'center',
        letterSpacing: 0.5,
        lineHeight: 18,
    },
    addressCol: {
        width: '58%',
        padding: 3,
        justifyContent: 'flex-start',
    },
    addressTitle: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 1,
    },
    addressText: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#1f2937',
        lineHeight: 8,
    },
    photoCol: {
        width: '42%',
        borderLeftWidth: 1,
        borderColor: '#000',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e2e8f0',
        overflow: 'hidden',
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },
    noteRow: {
        paddingVertical: 2,
        paddingHorizontal: 2,
        borderBottomWidth: 1,
        borderColor: '#000',
    },
    noteText: {
        fontSize: 6.8,
        fontWeight: '500',
        color: '#000',
    },
    noteTextBold: {
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
    },
    footerCol: {
        width: '22%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    footerColRight: {
        width: '34%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    footerText: {
        fontSize: 6,
        fontWeight: 'bold',
        color: '#000',
        marginLeft: 2,
        textAlign: 'center',
    },
    footerTextSmall: {
        fontSize: 5,
        color: '#374151',
        textAlign: 'center',
        marginTop: 0.5,
    },
});
