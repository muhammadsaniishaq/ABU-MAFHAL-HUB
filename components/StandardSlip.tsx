/**
 * StandardSlip Component
 * Uses StyleSheet (no NativeWind className) for robust rendering in ViewShot and PDF.
 * Correctly resolves raw base64 and HTTP photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
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

export const StandardSlip = ({ data }: { data: any }) => {
    const firstName  = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName   = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob     = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawNin     = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto   = getVal(data, ['photo','image','picture','avatar','face_image']);
    const rawIssue   = getVal(data, ['issueDate','issue_date','issuance_date'], '');

    const dob      = formatDob(rawDob);
    const cleanNin = rawNin.replace(/\D/g, '');
    const fmtNin   = cleanNin.length === 11
        ? `${cleanNin.slice(0, 4)} ${cleanNin.slice(4, 7)} ${cleanNin.slice(7)}`
        : cleanNin || '0000 000 0000';
    const givenNames = [firstName, middleName].filter(Boolean).join(', ') || 'PROUD, NIGERIAN';
    const photoUri = resolvePhoto(rawPhoto);
    const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';

    return (
        <View style={s.card}>
            {/* Background Watermark Coat of Arms */}
            <View style={s.coatWrap}>
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    style={s.coatImg} 
                    resizeMode="contain" 
                />
            </View>
            
            {/* Main Content Container */}
            <View style={s.content}>
                
                {/* Header Section */}
                <View style={s.header}>
                    <View style={s.headerCoat}>
                        <Image 
                            source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png" }} 
                            style={s.headerCoatImg} 
                            resizeMode="contain" 
                        />
                    </View>
                </View>

                {/* Middle Section */}
                <View style={s.mid}>
                    
                    {/* Photo */}
                    <View style={s.photoBox}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={s.photoImg} resizeMode="cover" />
                        ) : (
                            <Silhouette />
                        )}
                    </View>

                    {/* Details Column */}
                    <View style={s.details}>
                        <View style={s.detailBlock}>
                            <Text style={s.dLbl}>Surname/Nom</Text>
                            <Text style={s.dVal}>{lastName.toUpperCase()}</Text>
                        </View>
                        
                        <View style={s.detailBlock}>
                            <Text style={s.dLbl}>Given Names/Prénoms</Text>
                            <Text style={s.dVal}>{givenNames.toUpperCase()}</Text>
                        </View>

                        <View style={s.detailBlock}>
                            <Text style={s.dLbl}>Date of Birth</Text>
                            <Text style={s.dVal}>{dob}</Text>
                        </View>
                    </View>

                    {/* Right column: NGA, QR Code & Issue Date */}
                    <View style={s.rightBlock}>
                        <View style={s.ngaBlock}>
                            <Text style={s.ngaTxt}>NGA</Text>
                            <Text style={s.ninMeta} numberOfLines={1}>{cleanNin}</Text>
                        </View>
                        
                        <View style={s.qrOuter}>
                            <QRCode value={cleanNin || "UNKNOWN"} size={52} backgroundColor="transparent" />
                        </View>
                        
                        <View style={s.issBlock}>
                            <Text style={s.issLbl}>ISSUE DATE</Text>
                            <Text style={s.issVal}>{issueDate}</Text>
                        </View>
                    </View>

                </View>

                {/* Bottom Section */}
                <View style={s.bottom}>
                    <Text style={s.ninLbl}>
                        National Identification Number (NIN)
                    </Text>
                    <Text style={s.ninNum}>
                        {fmtNin}
                    </Text>
                </View>

            </View>
        </View>
    );
};

const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1.586,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: '#bbb',
        position: 'relative',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    coatWrap: {
        position: 'absolute',
        top: '20%', left: '30%',
        width: '40%', height: '60%',
        opacity: 0.04,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coatImg: { width: 140, height: 140 },

    content: {
        flex: 1,
        padding: 10,
        justifyContent: 'space-between',
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 38,
    },
    headerCoat: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCoatImg: {
        width: 38,
        height: 38,
    },

    mid: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginVertical: 4,
    },
    photoBox: {
        width: 68,
        height: 85,
        backgroundColor: '#e2e8f0',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 8,
        overflow: 'hidden',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    photoImg: { width: '100%', height: '100%' },

    details: {
        flex: 1,
        justifyContent: 'center',
        gap: 3,
    },
    detailBlock: {
        marginBottom: 2,
    },
    dLbl: { color: '#64748b', fontSize: 6.5, fontWeight: 'bold', letterSpacing: 0.2, textTransform: 'uppercase' },
    dVal: { color: '#000000', fontSize: 9.5, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 0.5 },

    rightBlock: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        paddingVertical: 2,
    },
    ngaBlock: {
        alignItems: 'center',
    },
    ngaTxt: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.5,
        lineHeight: 18,
    },
    ninMeta: {
        color: '#888',
        fontSize: 5.5,
        fontWeight: '700',
        marginTop: 1,
    },
    qrOuter: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 1,
        backgroundColor: '#fff',
    },
    issBlock: {
        alignItems: 'center',
    },
    issLbl: { color: '#888', fontSize: 5.5, fontWeight: '700', letterSpacing: 0.2 },
    issVal: { color: '#000', fontSize: 7, fontWeight: 'bold' },

    bottom: {
        alignItems: 'center',
        paddingBottom: 2,
    },
    ninLbl: {
        color: '#111',
        fontSize: 7.5,
        fontWeight: 'bold',
        letterSpacing: 0.2,
        marginBottom: 1,
    },
    ninNum: {
        color: '#000',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 4,
        fontFamily: 'monospace',
    },
});
