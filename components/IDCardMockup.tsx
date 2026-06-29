/**
 * IDCardMockup — Premium NIN Slip
 * Pixel-faithful replica of the Nigerian Digital NIN Slip.
 * Uses StyleSheet + SVG for security patterns; handles base64 & URL photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Line, Path, Ellipse, G, Defs, Pattern, Rect } from 'react-native-svg';

// ─── Helpers ────────────────────────────────────────────────────────────────
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

/** Resolve photo to a usable Image URI.
 *  IDPro returns raw base64 (no prefix). URLs and data URIs also handled. */
const resolvePhoto = (photo: string | undefined | null): string | null => {
    if (!photo || photo.trim() === '') return null;
    if (photo.startsWith('data:')) return photo;                        // already data URI
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo; // URL
    // Assume raw base64 JPEG (IDPro standard)
    return `data:image/jpeg;base64,${photo}`;
};

// ─── Security Background SVG ─────────────────────────────────────────────────
// Mirrors the concentric-circle guild pattern on a real NIN slip
const SecurityBG = ({ w, h }: { w: number; h: number }) => {
    const radii = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420];
    const hLines = Array.from({ length: Math.ceil(h / 14) }, (_, i) => i * 14);
    return (
        <Svg width={w} height={h} style={StyleSheet.absoluteFillObject}>
            {/* Horizontal ruling lines — very faint */}
            {hLines.map((y, i) => (
                <Line key={`h${i}`} x1="0" y1={y} x2={w} y2={y}
                    stroke="#1a7a3c" strokeWidth="0.35" opacity="0.18" />
            ))}
            {/* Left concentric circles */}
            {radii.map((r, i) => (
                <Circle key={`lc${i}`} cx={0} cy={h / 2} r={r}
                    stroke="#1a7a3c" strokeWidth="0.6" fill="none" opacity="0.28" />
            ))}
            {/* Right concentric circles */}
            {radii.map((r, i) => (
                <Circle key={`rc${i}`} cx={w} cy={h / 2} r={r}
                    stroke="#1a7a3c" strokeWidth="0.6" fill="none" opacity="0.28" />
            ))}
            {/* Top-center fan */}
            {[40, 80, 120, 160, 200, 240].map((r, i) => (
                <Circle key={`tc${i}`} cx={w / 2} cy={0} r={r}
                    stroke="#1a7a3c" strokeWidth="0.4" fill="none" opacity="0.15" />
            ))}
            {/* Bottom-center fan */}
            {[40, 80, 120, 160, 200, 240].map((r, i) => (
                <Circle key={`bc${i}`} cx={w / 2} cy={h} r={r}
                    stroke="#1a7a3c" strokeWidth="0.4" fill="none" opacity="0.15" />
            ))}
        </Svg>
    );
};

// ─── Coat of Arms Watermark ──────────────────────────────────────────────────
const CoatWM = () => (
    <View style={s.coatWrap} pointerEvents="none">
        <Image
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/512px-Coat_of_arms_of_Nigeria.svg.png' }}
            style={s.coatImg}
            resizeMode="contain"
        />
    </View>
);

// ─── Person Silhouette (when no photo) ──────────────────────────────────────
const Silhouette = () => (
    <Svg viewBox="0 0 80 100" style={{ width: '100%', height: '100%' }}>
        <Ellipse cx="40" cy="28" rx="18" ry="20" fill="#a8b4be" />
        <Path d="M6,96 Q6,58 40,58 Q74,58 74,96 Z" fill="#a8b4be" />
    </Svg>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export const IDCardMockup = ({ data }: { data: any }) => {
    // --- field extraction ---
    const firstName  = getVal(data, ['firstname','first_name','firstName','first']);
    const lastName   = getVal(data, ['surname','last_name','lastName','lastname','last'], 'RESIDENT');
    const middleName = getVal(data, ['middlename','middle_name','middleName','middle']);
    const rawDob     = getVal(data, ['birthdate','dob','dateOfBirth','date_of_birth'], '01-OCT-1960');
    const rawGender  = getVal(data, ['gender','sex','gender_id'], 'f');
    const rawNin     = getVal(data, ['nin','number','nin_number','national_id'], '00000000000');
    const rawPhoto   = getVal(data, ['photo','image','picture','avatar','face_image']);
    const rawIssue   = getVal(data, ['issueDate','issue_date','issuance_date'], '');

    const dob      = formatDob(rawDob);
    const gender   = rawGender.trim().toUpperCase().startsWith('M') ? 'M' : 'F';
    const cleanNin = rawNin.replace(/\D/g, '');
    const fmtNin   = cleanNin.length === 11
        ? `${cleanNin.slice(0,4)} ${cleanNin.slice(4,7)} ${cleanNin.slice(7)}`
        : cleanNin || '0000 000 0000';
    const givenNames = [firstName, middleName].filter(Boolean).join(', ') || 'PROUD, NIGERIAN';
    const photoUri = resolvePhoto(rawPhoto);
    // Format issue date or default
    const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';

    return (
        <View style={s.card}>
            {/* ── Security Pattern Background ── */}
            <View style={StyleSheet.absoluteFillObject}>
                <SecurityBG w={500} h={315} />
            </View>

            {/* ── Coat of Arms Watermark ── */}
            <CoatWM />

            {/* ── Green accent bars ── */}
            <View style={s.topBar} />
            <View style={s.bottomBar} />

            {/* ════════════ CARD CONTENT ════════════ */}
            <View style={s.content}>

                {/* ─── ROW 1: Header | QR | NGA ─── */}
                <View style={s.row1}>
                    {/* Header text */}
                    <View style={s.headerTxt}>
                        <Text style={s.fedRepTxt}>FEDERAL REPUBLIC OF NIGERIA</Text>
                        <Text style={s.ninSlipTxt}>DIGITAL NIN SLIP</Text>
                    </View>

                    {/* QR code in white bordered box */}
                    <View style={s.qrOuter}>
                        <View style={s.qrInner}>
                            <QRCode
                                value={cleanNin.length > 0 ? cleanNin : 'UNKNOWN'}
                                size={62}
                                backgroundColor="white"
                                color="#000"
                            />
                        </View>
                    </View>

                    {/* NGA + issue date */}
                    <View style={s.ngaBlock}>
                        <Text style={s.ngaTxt}>NGA</Text>
                        <Text style={s.issLbl}>ISSUE DATE</Text>
                        <Text style={s.issVal}>{issueDate}</Text>
                    </View>
                </View>

                {/* ─── ROW 2: Photo | Details ─── */}
                <View style={s.row2}>
                    {/* Photo */}
                    <View style={s.photoBox}>
                        {photoUri ? (
                            <Image
                                source={{ uri: photoUri }}
                                style={s.photoImg}
                                resizeMode="cover"
                            />
                        ) : (
                            <Silhouette />
                        )}
                    </View>

                    {/* Personal details */}
                    <View style={s.details}>
                        <View style={s.detailBlock}>
                            <Text style={s.dLbl}>SURNAME/NOM</Text>
                            <Text style={s.dVal}>{lastName.toUpperCase()}</Text>
                        </View>
                        <View style={s.detailBlock}>
                            <Text style={s.dLbl}>GIVEN NAMES/PRÉNOMS</Text>
                            <Text style={s.dVal}>{givenNames.toUpperCase()}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <View style={s.halfCell}>
                                <Text style={s.dLbl}>DATE OF BIRTH</Text>
                                <Text style={s.dVal}>{dob}</Text>
                            </View>
                            <View style={s.halfCell}>
                                <Text style={s.dLbl}>SEX/SEXE</Text>
                                <Text style={s.dVal}>{gender}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ─── Motto ─── */}
                <View style={s.mottoRow}>
                    <Text style={s.mottoTxt}>UNITY AND FAITH, PEACE AND PROGRESS</Text>
                </View>

                {/* ─── NIN ─── */}
                <View style={s.ninRow}>
                    <Text style={s.ninLbl}>National Identification Number (NIN)</Text>
                    <Text style={s.ninNum}>{fmtNin}</Text>
                </View>
            </View>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1.586,          // ISO credit-card ratio 85.6 × 54 mm
        backgroundColor: '#eef6e4',  // light green-white, matches real slip
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: '#b8d4a0',
        position: 'relative',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
    },
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 7,
        backgroundColor: '#006633',
    },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
        backgroundColor: '#006633',
    },
    coatWrap: {
        position: 'absolute',
        top: '20%', left: '30%',
        width: '40%', height: '60%',
        opacity: 0.07,
    },
    coatImg: { width: '100%', height: '100%' },

    // ── content
    content: {
        flex: 1,
        paddingTop: 12,
        paddingBottom: 6,
        paddingHorizontal: 10,
        justifyContent: 'space-between',
    },

    // ── row 1
    row1: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    headerTxt: { flex: 1, paddingRight: 4 },
    fedRepTxt: {
        color: '#006633',
        fontSize: 10.5,
        fontWeight: '900',
        letterSpacing: 0.1,
        lineHeight: 13,
    },
    ninSlipTxt: {
        color: '#111',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 1.8,
        marginTop: 2,
    },
    qrOuter: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 2,
        backgroundColor: '#fff',
        marginRight: 4,
    },
    qrInner: {
        backgroundColor: '#fff',
        padding: 1,
    },
    ngaBlock: {
        width: 48,
        alignItems: 'center',
        paddingTop: 2,
    },
    ngaTxt: {
        color: '#111',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: -0.5,
        lineHeight: 20,
    },
    issLbl: { color: '#555', fontSize: 5.5, fontWeight: '700', marginTop: 5, letterSpacing: 0.2 },
    issVal: { color: '#111', fontSize: 7, fontWeight: '600' },

    // ── row 2
    row2: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginVertical: 2,
    },
    photoBox: {
        width: 68,
        height: 85,
        backgroundColor: '#c0c9d0',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 8,
        overflow: 'hidden',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#aab0b8',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    photoImg: { width: '100%', height: '100%' },
    details: { flex: 1, justifyContent: 'center', gap: 4 },
    detailBlock: { marginBottom: 3 },
    detailRow: { flexDirection: 'row' },
    halfCell: { flex: 1 },
    dLbl: { color: '#6a8090', fontSize: 6.5, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
    dVal: { color: '#111', fontSize: 9, fontWeight: '400', letterSpacing: 0.9, textTransform: 'uppercase' },

    // ── motto
    mottoRow: { alignItems: 'center', marginVertical: 1 },
    mottoTxt: { color: '#555', fontSize: 5.5, fontWeight: '600', fontStyle: 'italic', letterSpacing: 0.6 },

    // ── NIN
    ninRow: { alignItems: 'center', paddingBottom: 2 },
    ninLbl: { color: '#111', fontSize: 7, fontWeight: '700', letterSpacing: 0.2, marginBottom: 1 },
    ninNum: {
        color: '#000',
        fontSize: 21,
        fontWeight: '300',
        letterSpacing: 5,
        fontFamily: 'monospace',
    },
});
