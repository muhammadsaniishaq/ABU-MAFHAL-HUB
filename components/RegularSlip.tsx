/**
 * RegularSlip Component
 * Uses StyleSheet only (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
    <Svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%' }}>
        <Ellipse cx="40" cy="28" rx="18" ry="20" fill="#cbd5e1" />
        <Path d="M6,96 Q6,58 40,58 Q74,58 74,96 Z" fill="#cbd5e1" />
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
    const trackingId = getVal(data, ['tracking_id', 'trackingId', 'tracking'], 'H6Y0NYFH00373');
    const rawGender  = getVal(data, ['gender','sex','gender_id'], 'M');
    const gender     = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
    const address    = getVal(data, ['residence_address', 'address'], '47, Harmony Avenue\nKETU ALAPERE\nLagos');

    const cleanNin = rawNin.replace(/\D/g, '');
    const givenNames = [firstName, middleName].filter(Boolean).join(', ') || 'PROUD, NIGERIAN';
    const photoUri = resolvePhoto(rawPhoto);
    const issueDate = rawIssue ? formatDob(rawIssue) : '09/09/2018';

    return (
        <View style={s.card}>
            {/* Header Section */}
            <View style={s.header}>
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    style={s.headerCoat} 
                    resizeMode="contain" 
                />
                
                <View style={s.headerCenter}>
                    <Text style={s.headerTitle}>National Identity Management System</Text>
                    <Text style={s.headerSub}>Federal Republic of Nigeria</Text>
                    <Text style={s.headerLabel}>National Identification Number Slip (NINS)</Text>
                </View>

                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" }} 
                    style={s.headerNimc} 
                    resizeMode="contain" 
                />
            </View>

            {/* Main Table Grid */}
            <View style={s.grid}>
                {/* Column 1 */}
                <View style={s.col1}>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>Tracking ID</Text>
                        <Text style={s.cellValMono}>{trackingId}</Text>
                    </View>
                    <View style={s.cellRowNIN}>
                        <Text style={s.cellLbl}>NIN</Text>
                        <View style={s.ninBadge}>
                            <Text style={s.ninBadgeTxt}>{cleanNin}</Text>
                        </View>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>Issue Date</Text>
                        <Text style={s.cellValMono}>{issueDate}</Text>
                    </View>
                    <View style={s.cellEmpty} />
                </View>

                {/* Column 2 */}
                <View style={s.col2}>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>Surname</Text>
                        <Text style={s.cellValBold} numberOfLines={1}>{lastName.toUpperCase()}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>First Name</Text>
                        <Text style={s.cellValBold} numberOfLines={1}>{firstName ? firstName.toUpperCase() : 'N/A'}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>Middle Name</Text>
                        <Text style={s.cellValBold} numberOfLines={1}>{middleName ? middleName.toUpperCase() : 'N/A'}</Text>
                    </View>
                    <View style={s.cellRow}>
                        <Text style={s.cellLbl}>Gender</Text>
                        <Text style={s.cellValBold}>{gender}</Text>
                    </View>
                </View>

                {/* Column 3 */}
                <View style={s.col3}>
                    <View style={s.addressBlock}>
                        <Text style={s.addressLbl}>Address:</Text>
                        <Text style={s.addressVal}>{address.toUpperCase()}</Text>
                    </View>
                    <View style={s.photoBox}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
                        ) : (
                            <Silhouette />
                        )}
                    </View>
                </View>
            </View>

            {/* Note Section */}
            <View style={s.noteSection}>
                <Text style={s.noteTxt}>
                    Note: <Text style={s.noteTxtNormal}>This transaction slip does not confer the right to the </Text>General Multipurpose Card<Text style={s.noteTxtNormal}> (For any enquiry please contact)</Text>
                </Text>
            </View>

            {/* Footer Section */}
            <View style={s.footer}>
                <View style={s.footerCol1}>
                    <Ionicons name="mail" size={10} color="#666" style={{ marginRight: 2 }} />
                    <Text style={s.footerTxt}>helpdesk@nimc.gov.ng</Text>
                </View>
                <View style={s.footerCol2}>
                    <Ionicons name="globe-outline" size={10} color="#2b6cb0" style={{ marginRight: 2 }} />
                    <Text style={s.footerTxt}>www.nimc.gov.ng</Text>
                </View>
                <View style={s.footerCol3}>
                    <View style={s.phoneCircle}>
                        <Ionicons name="call" size={6} color="white" />
                    </View>
                    <Text style={s.footerTxtPhone}>
                        07040144452,07040144453,{"\n"}07040144453
                    </Text>
                </View>
                <View style={s.footerCol4}>
                    <Ionicons name="save" size={10} color="#008240" style={{ marginRight: 2 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.footerCommission} numberOfLines={1}>National Identity Management Commission</Text>
                        <Text style={s.footerAddress} numberOfLines={1}>11 Sokode Crescent, Off Dalaba Street Zone 5, Wuse Abuja Nigeria</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 2.15,
        backgroundColor: '#faf9f5',
        borderWidth: 1.2,
        borderColor: '#000',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    headerCoat: {
        width: 36,
        height: 36,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    headerTitle: {
        color: '#000',
        fontSize: 10.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    headerSub: {
        color: '#000',
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 1,
    },
    headerLabel: {
        color: '#1a1a1a',
        fontSize: 7.5,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 1,
    },
    headerNimc: {
        width: 42,
        height: 30,
    },

    grid: {
        flexDirection: 'row',
        flex: 1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#000',
    },

    col1: {
        width: '28%',
        borderRightWidth: 1,
        borderColor: '#000',
    },
    cellRow: {
        flex: 1,
        borderBottomWidth: 1,
        borderColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        backgroundColor: '#faf9f5',
    },
    cellRowNIN: {
        flex: 1.2,
        borderBottomWidth: 1,
        borderColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        backgroundColor: '#faf9f5',
    },
    cellLbl: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#334155',
    },
    cellValMono: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#1e293b',
        fontFamily: 'monospace',
    },
    ninBadge: {
        borderWidth: 1,
        borderColor: '#ef4444',
        borderRadius: 99,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    ninBadgeTxt: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#000',
        fontFamily: 'monospace',
    },
    cellEmpty: {
        flex: 1,
        backgroundColor: '#faf9f5',
    },

    col2: {
        width: '39%',
        borderRightWidth: 1,
        borderColor: '#000',
    },
    cellValBold: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#000',
        flex: 1,
        textAlign: 'right',
        marginLeft: 4,
    },

    col3: {
        width: '33%',
        flexDirection: 'row',
        backgroundColor: '#faf9f5',
    },
    addressBlock: {
        flex: 1,
        padding: 6,
        justifyContent: 'flex-start',
    },
    addressLbl: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 2,
    },
    addressVal: {
        fontSize: 6,
        color: '#000',
        fontWeight: 'bold',
        lineHeight: 8,
    },
    photoBox: {
        width: 58,
        height: '100%',
        borderLeftWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
        backgroundColor: '#faf9f5',
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },

    noteSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    noteTxt: {
        fontSize: 5.5,
        color: '#000',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    noteTxtNormal: {
        fontWeight: 'normal',
    },

    footer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: '#000',
        height: 28,
        backgroundColor: '#faf9f5',
    },
    footerCol1: {
        flex: 0.9,
        borderRightWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        flexDirection: 'row',
    },
    footerCol2: {
        flex: 0.8,
        borderRightWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        flexDirection: 'row',
    },
    footerCol3: {
        flex: 1.2,
        borderRightWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        flexDirection: 'row',
    },
    footerCol4: {
        flex: 1.4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        flexDirection: 'row',
    },
    phoneCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#16a34a',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 2,
    },
    footerTxt: {
        fontSize: 5.5,
        fontWeight: 'bold',
        color: '#000',
        fontFamily: 'monospace',
    },
    footerTxtPhone: {
        fontSize: 5,
        fontWeight: 'bold',
        color: '#000',
        lineHeight: 6,
        fontFamily: 'monospace',
    },
    footerCommission: {
        fontSize: 5,
        fontWeight: 'bold',
        color: '#000',
        lineHeight: 6,
    },
    footerAddress: {
        fontSize: 4.5,
        color: '#666',
        lineHeight: 5,
    },
});
