/**
 * InformationSlip Component
 * Uses StyleSheet only (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

export const InformationSlip = ({ data }: { data: any }) => {
    const firstName      = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName       = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName     = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob         = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawGender      = getVal(data, ['gender','sex','gender_id'], 'f');
    const rawNin         = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto       = getVal(data, ['photo','image','picture','avatar','face_image']);
    const trackingId     = getVal(data, ['tracking_id', 'trackingId', 'tracking'], 'H6Y0NYFH00373');
    const phone          = getVal(data, ['telephoneno', 'phoneNumber', 'phone', 'telephone'], 'N/A');
    const residenceState = getVal(data, ['residence_state', 'residenceState', 'state'], 'N/A');
    const residenceLga   = getVal(data, ['residence_lga', 'residenceLga', 'lga'], 'N/A');
    const birthState     = getVal(data, ['birthstate', 'birthState'], 'N/A');
    const birthLga       = getVal(data, ['birthlga', 'birthLga'], 'N/A');
    const address        = getVal(data, ['residence_address', 'address'], 'N/A');

    const dob      = formatDob(rawDob);
    const gender   = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
    const cleanNin = rawNin.replace(/\D/g, '');
    const photoUri = resolvePhoto(rawPhoto);

    return (
        <View style={s.card}>
            
            {/* Header */}
            <View style={s.header}>
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    style={s.headerCoat} 
                    resizeMode="contain" 
                />
                
                <View style={s.headerCenter}>
                    <Text style={s.headerTitle}>Federal Republic of Nigeria</Text>
                    <Text style={s.headerLabel}>Verified NIN Details</Text>
                </View>
                
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" }} 
                    style={s.headerNimc} 
                    resizeMode="contain" 
                />
            </View>

            {/* Main Content Area */}
            <View style={s.main}>
                
                {/* Left Column (Details + Photo + Lower Details) */}
                <View style={s.leftCol}>
                    
                    {/* Top Section: First 5 fields + Circular Photo */}
                    <View style={s.topRow}>
                        {/* Fields */}
                        <View style={s.fields}>
                            <View style={s.fieldRow}>
                                <Text style={s.fieldLbl}>First Name:</Text>
                                <Text style={s.fieldVal} numberOfLines={1}>{firstName ? firstName.toUpperCase() : 'N/A'}</Text>
                            </View>
                            <View style={s.fieldRow}>
                                <Text style={s.fieldLbl}>Middle Name:</Text>
                                <Text style={s.fieldVal} numberOfLines={1}>{middleName ? middleName.toUpperCase() : 'N/A'}</Text>
                            </View>
                            <View style={s.fieldRow}>
                                <Text style={s.fieldLbl}>Last Name:</Text>
                                <Text style={s.fieldVal} numberOfLines={1}>{lastName.toUpperCase()}</Text>
                            </View>
                            <View style={s.fieldRow}>
                                <Text style={s.fieldLbl}>Date of birth:</Text>
                                <Text style={s.fieldValMono} numberOfLines={1}>{dob}</Text>
                            </View>
                            <View style={s.fieldRow}>
                                <Text style={s.fieldLbl}>Gender:</Text>
                                <Text style={s.fieldValMono} numberOfLines={1}>{gender}</Text>
                            </View>
                        </View>

                        {/* Circular Photo */}
                        <View style={s.photoCircle}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
                            ) : (
                                <Ionicons name="person" size={32} color="#90cdf4" />
                            )}
                        </View>
                    </View>

                    {/* NIN Number spanning row */}
                    <View style={s.ninRow}>
                        <Text style={s.ninLbl}>NIN Number:</Text>
                        <Text style={s.ninVal}>{cleanNin}</Text>
                    </View>

                    {/* Lower Details */}
                    <View style={s.lower}>
                        <View style={s.lowerRow}>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Tracking ID:</Text>
                                <Text style={s.valLowerMono} numberOfLines={1}>{trackingId}</Text>
                            </View>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Phone Number:</Text>
                                <Text style={s.valLowerMono} numberOfLines={1}>{phone}</Text>
                            </View>
                        </View>

                        <View style={s.lowerRow}>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Residence State:</Text>
                                <Text style={s.valLower} numberOfLines={1}>{residenceState.toUpperCase()}</Text>
                            </View>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Residence LGA:</Text>
                                <Text style={s.valLower} numberOfLines={1}>{residenceLga.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={s.lowerRow}>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Birth State:</Text>
                                <Text style={s.valLower} numberOfLines={1}>{birthState.toUpperCase()}</Text>
                            </View>
                            <View style={s.halfCell}>
                                <Text style={s.lblLower}>Birth LGA:</Text>
                                <Text style={s.valLower} numberOfLines={1}>{birthLga.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={s.addressRow}>
                            <Text style={s.lblLowerAddress}>Address:</Text>
                            <Text style={s.valLowerAddress} numberOfLines={1}>{address.toUpperCase()}</Text>
                        </View>
                    </View>

                </View>

                {/* Right Column (Verified, Warning, Terms) */}
                <View style={s.rightCol}>
                    
                    {/* Top: Verified & Warning */}
                    <View style={s.rightTop}>
                        <Text style={s.verifiedTxt}>Verified</Text>
                        <Text style={s.warningTxt}>
                            This is a property of National Identity Management Commission (NIMC), Nigeria.
                            If found, please return to the nearest NIMC's office or contact +234 815 769 1214, +234 815 769 1071
                        </Text>
                    </View>
                    
                    {/* Bottom: Bullet terms */}
                    <View style={s.terms}>
                        <View style={s.termRow}>
                            <Text style={s.termNum}>1.</Text>
                            <Text style={s.termTxt}>This NIN slip remains the property of the Federal Republic of Nigeria, and MUST be surrendered on demand;</Text>
                        </View>
                        <View style={s.termRow}>
                            <Text style={s.termNum}>2.</Text>
                            <Text style={s.termTxt}>This NIN slip does not imply nor confer citizenship of the Federal Republic of Nigeria on the individual the document is issued to;</Text>
                        </View>
                        <View style={s.termRow}>
                            <Text style={s.termNum}>3.</Text>
                            <Text style={s.termTxt}>This NIN slip is valid for the lifetime of the holder and <Text style={s.red}>DOES NOT EXPIRE.</Text></Text>
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1.8,
        backgroundColor: '#ffffff',
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: '#cbd5e1',
        padding: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 6,
        marginBottom: 6,
    },
    headerCoat: {
        width: 32,
        height: 32,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1b3b6f',
    },
    headerLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1b3b6f',
        marginTop: 1,
    },
    headerNimc: {
        width: 40,
        height: 28,
    },

    main: {
        flexDirection: 'row',
        flex: 1,
    },

    leftCol: {
        flex: 1.6,
        paddingRight: 10,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fields: {
        flex: 1.3,
        justifyContent: 'center',
    },
    fieldRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    fieldLbl: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#1b3b6f',
        width: 70,
    },
    fieldVal: {
        fontSize: 8.5,
        color: '#1e293b',
        fontWeight: 'bold',
        flex: 1,
    },
    fieldValMono: {
        fontSize: 8.5,
        color: '#1e293b',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        flex: 1,
    },
    photoCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#ebf3fc',
        borderWidth: 1,
        borderColor: '#aed0ee',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },

    ninRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        paddingVertical: 4,
        marginVertical: 4,
    },
    ninLbl: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#1b3b6f',
        marginRight: 6,
    },
    ninVal: {
        fontSize: 10,
        color: '#0f172a',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        letterSpacing: 0.5,
    },

    lower: {
        gap: 2,
    },
    lowerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    halfCell: {
        flexDirection: 'row',
        flex: 1,
    },
    lblLower: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#1b3b6f',
        width: 65,
    },
    valLower: {
        fontSize: 7.5,
        color: '#334155',
        fontWeight: 'bold',
        flex: 1,
    },
    valLowerMono: {
        fontSize: 7.5,
        color: '#334155',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        flex: 1,
    },
    addressRow: {
        flexDirection: 'row',
        marginTop: 2,
    },
    lblLowerAddress: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#1b3b6f',
        width: 65,
    },
    valLowerAddress: {
        fontSize: 7.5,
        color: '#334155',
        fontWeight: 'bold',
        flex: 1,
    },

    rightCol: {
        flex: 0.9,
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
        paddingLeft: 10,
        justifyContent: 'space-between',
    },
    rightTop: {
        alignItems: 'center',
    },
    verifiedTxt: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#16a34a',
        letterSpacing: -0.5,
        textTransform: 'uppercase',
    },
    warningTxt: {
        fontSize: 5.5,
        textAlign: 'center',
        color: '#64748b',
        marginTop: 2,
        lineHeight: 7.5,
    },
    terms: {
        marginTop: 4,
    },
    termRow: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    termNum: {
        fontSize: 5.5,
        fontWeight: 'bold',
        color: '#1e293b',
        marginRight: 1,
    },
    termTxt: {
        fontSize: 5.5,
        color: '#475569',
        lineHeight: 7,
        flex: 1,
    },
    red: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
});
