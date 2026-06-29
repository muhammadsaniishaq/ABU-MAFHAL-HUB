import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Line, Path, Ellipse, G } from 'react-native-svg';

// ─── Helpers ────────────────────────────────────────────────────────────────
const getVal = (data: any, keys: string[], fallback = 'N/A'): string => {
    for (const k of keys) {
        if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
            return String(data[k]);
        }
    }
    return fallback;
};

const formatDob = (dob: string): string => {
    if (!dob || dob === 'N/A') return dob;
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    try {
        // Try "YYYY-MM-DD" or "DD-MM-YYYY" or "DD/MM/YYYY"
        const parts = dob.split(/[-/]/);
        if (parts.length === 3) {
            let y: string, m: string, d: string;
            if (parts[0].length === 4) { [y, m, d] = parts; }
            else { [d, m, y] = parts; }
            const mIdx = parseInt(m, 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                return `${d.padStart(2,'0')} ${months[mIdx]} ${y}`;
            }
        }
    } catch (_) {}
    return dob.toUpperCase();
};

// ─── Security Guild / Lathe background ──────────────────────────────────────
const SecurityBackground = () => (
    <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 860 542">
        {/* Left concentric circles */}
        {[40,70,100,130,160,190,220,250,280,310,340,370,400].map((r, i) => (
            <Circle key={`lc-${i}`} cx="0" cy="271" r={r} stroke="#00732e" strokeWidth="0.6" fill="none" opacity="0.25" />
        ))}
        {/* Right concentric circles */}
        {[40,70,100,130,160,190,220,250,280,310,340,370,400].map((r, i) => (
            <Circle key={`rc-${i}`} cx="860" cy="271" r={r} stroke="#00732e" strokeWidth="0.6" fill="none" opacity="0.25" />
        ))}
        {/* Top concentric semicircles */}
        {[50,90,130,170,210,250,290,330].map((r, i) => (
            <Circle key={`tc-${i}`} cx="430" cy="0" r={r} stroke="#00732e" strokeWidth="0.5" fill="none" opacity="0.18" />
        ))}
        {/* Bottom concentric semicircles */}
        {[50,90,130,170,210,250,290,330].map((r, i) => (
            <Circle key={`bc-${i}`} cx="430" cy="542" r={r} stroke="#00732e" strokeWidth="0.5" fill="none" opacity="0.18" />
        ))}
        {/* Fine horizontal ruling lines */}
        {Array.from({ length: 28 }).map((_, i) => (
            <Line key={`hl-${i}`} x1="0" y1={i * 20} x2="860" y2={i * 20} stroke="#00732e" strokeWidth="0.3" opacity="0.12" />
        ))}
    </Svg>
);

// ─── Coat of Arms watermark ─────────────────────────────────────────────────
const CoatWatermark = () => (
    <View style={s.coatWrap}>
        <Image
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png' }}
            style={s.coatImg}
            resizeMode="contain"
        />
    </View>
);

// ─── Main component ─────────────────────────────────────────────────────────
export const IDCardMockup = ({ data }: { data: any }) => {
    const firstName  = getVal(data, ['firstname','first_name','firstName','first'], '');
    const lastName   = getVal(data, ['surname','last_name','lastName','lastname','last'], '');
    const middleName = getVal(data, ['middlename','middle_name','middleName','middle'], '');
    const rawDob     = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01 OCT 1960');
    const formattedDob = formatDob(rawDob);
    const rawGender  = getVal(data, ['gender','sex','gender_id'], 'f');
    const gender     = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
    const rawNin     = getVal(data, ['nin','number','nin_number','national_id','identity_number'], '00000000000');
    const cleanNin   = rawNin.replace(/\D/g, '');
    const fmtNin     = cleanNin.length === 11
        ? `${cleanNin.slice(0,4)} ${cleanNin.slice(4,7)} ${cleanNin.slice(7)}`
        : cleanNin;
    const photo = getVal(data, ['photo','image','picture','avatar','face_image'], '');
    // Issue date from data or default
    const issueDate = getVal(data, ['issueDate','issue_date'], '01 JAN 2021');

    const givenNames = [firstName, middleName].filter(Boolean).join(', ');

    return (
        <View style={s.card}>
            {/* ── Background Security Pattern ── */}
            <SecurityBackground />

            {/* ── Green gradient top bar ── */}
            <View style={s.topBar} />

            {/* ── Green gradient bottom bar ── */}
            <View style={s.bottomBar} />

            {/* ── Coat of Arms Watermark ── */}
            <CoatWatermark />

            {/* ── Card Content ── */}
            <View style={s.content}>

                {/* ── TOP ROW: Header + QR + NGA ── */}
                <View style={s.topRow}>

                    {/* Left header block */}
                    <View style={s.headerBlock}>
                        <Text style={s.fedTitle}>FEDERAL REPUBLIC OF NIGERIA</Text>
                        <Text style={s.ninSlipLabel}>DIGITAL NIN SLIP</Text>
                    </View>

                    {/* QR Code box */}
                    <View style={s.qrBox}>
                        <QRCode
                            value={cleanNin || 'UNKNOWN'}
                            size={70}
                            backgroundColor="white"
                            color="black"
                        />
                    </View>

                    {/* NGA + Issue Date */}
                    <View style={s.ngaBlock}>
                        <Text style={s.ngaText}>NGA</Text>
                        <Text style={s.issueLbl}>ISSUE DATE</Text>
                        <Text style={s.issueDt}>{issueDate}</Text>
                    </View>
                </View>

                {/* ── MIDDLE ROW: Photo + Details ── */}
                <View style={s.midRow}>

                    {/* Photo */}
                    <View style={s.photoBox}>
                        {photo && (photo.startsWith('http') || photo.startsWith('data:')) ? (
                            <Image source={{ uri: photo }} style={s.photoImg} resizeMode="cover" />
                        ) : (
                            <View style={s.photoPlaceholder}>
                                {/* Silhouette SVG */}
                                <Svg viewBox="0 0 100 120" style={{ width: 60, height: 72 }}>
                                    <Ellipse cx="50" cy="32" rx="22" ry="24" fill="#b0b8c1" />
                                    <Path d="M10,110 Q10,72 50,72 Q90,72 90,110 Z" fill="#b0b8c1" />
                                </Svg>
                            </View>
                        )}
                    </View>

                    {/* Personal Details */}
                    <View style={s.detailsBlock}>
                        <View style={s.detailRow}>
                            <Text style={s.detailLbl}>SURNAME/NOM</Text>
                            <Text style={s.detailVal}>{lastName || 'RESIDENT'}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLbl}>GIVEN NAMES/PRÉNOMS</Text>
                            <Text style={s.detailVal}>{givenNames || 'PROUD, NIGERIAN'}</Text>
                        </View>
                        <View style={s.detailRowHalf}>
                            <View style={s.halfCell}>
                                <Text style={s.detailLbl}>DATE OF BIRTH</Text>
                                <Text style={s.detailVal}>{formattedDob}</Text>
                            </View>
                            <View style={s.halfCell}>
                                <Text style={s.detailLbl}>SEX/SEXE</Text>
                                <Text style={s.detailVal}>{gender}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── BOTTOM MOTTO BAR ── */}
                <View style={s.mottoBar}>
                    <Text style={s.mottoText}>UNITY AND FAITH, PEACE AND PROGRESS</Text>
                </View>

                {/* ── NIN SECTION ── */}
                <View style={s.ninSection}>
                    <Text style={s.ninLabel}>National Identification Number (NIN)</Text>
                    <Text style={s.ninNumber}>{fmtNin}</Text>
                </View>
            </View>
        </View>
    );
};

// ─── Styles ─────────────────────────────────────────────────────────────────
// Card is credit-card ratio: 85.6mm × 54mm ≈ 1.586
const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1.586,
        backgroundColor: '#f5f9f0',  // Very light green-white, like the real card
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#c8d8c0',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: '#006633',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 5,
        backgroundColor: '#006633',
    },
    coatWrap: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -70 }, { translateY: -70 }],
        opacity: 0.06,
        width: 140,
        height: 140,
    },
    coatImg: {
        width: 140,
        height: 140,
    },
    content: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4,
        justifyContent: 'space-between',
    },

    // Top row
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    headerBlock: {
        flex: 1,
        paddingRight: 6,
    },
    fedTitle: {
        color: '#006633',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.2,
        lineHeight: 13,
    },
    ninSlipLabel: {
        color: '#111',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginTop: 1,
    },
    qrBox: {
        width: 74,
        height: 74,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 1,
    },
    ngaBlock: {
        width: 52,
        alignItems: 'center',
        paddingLeft: 4,
        paddingTop: 2,
    },
    ngaText: {
        color: '#111',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    issueLbl: {
        color: '#555',
        fontSize: 6.5,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 0.3,
    },
    issueDt: {
        color: '#111',
        fontSize: 7.5,
        fontWeight: '600',
        letterSpacing: 0.2,
    },

    // Middle row
    midRow: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        marginVertical: 2,
    },
    photoBox: {
        width: 70,
        height: 90,
        borderRadius: 3,
        backgroundColor: '#c5cdd4',
        overflow: 'hidden',
        marginRight: 10,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 22,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 8,
        borderWidth: 1,
        borderColor: '#aab4be',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: '#c5cdd4',
        overflow: 'hidden',
    },
    photoImg: {
        width: '100%',
        height: '100%',
    },
    detailsBlock: {
        flex: 1,
        justifyContent: 'center',
        gap: 5,
    },
    detailRow: {
        marginBottom: 4,
    },
    detailRowHalf: {
        flexDirection: 'row',
    },
    halfCell: {
        flex: 1,
    },
    detailLbl: {
        color: '#7a8e99',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
    detailVal: {
        color: '#111',
        fontSize: 9.5,
        fontWeight: '400',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },

    // Motto bar
    mottoBar: {
        alignItems: 'center',
        marginVertical: 2,
    },
    mottoText: {
        color: '#555',
        fontSize: 6,
        fontWeight: '600',
        letterSpacing: 0.8,
        fontStyle: 'italic',
    },

    // NIN section
    ninSection: {
        alignItems: 'center',
        paddingBottom: 4,
    },
    ninLabel: {
        color: '#111',
        fontSize: 7.5,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 1,
    },
    ninNumber: {
        color: '#000',
        fontSize: 22,
        fontWeight: '300',
        letterSpacing: 5,
        fontFamily: 'monospace',
    },
});
