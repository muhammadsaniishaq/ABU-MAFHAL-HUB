/**
 * IDCardMockup — Premium NIN Slip
 * Pixel-faithful replica of the Nigerian Digital NIN Slip.
 * Uses StyleSheet + SVG for security patterns; handles base64 & URL photos.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Line, Path, Ellipse } from 'react-native-svg';

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

const resolvePhoto = (photo: string | undefined | null): string | null => {
    if (!photo || photo.trim() === '') return null;
    if (photo.startsWith('data:')) return photo;
    if (photo.startsWith('http://') || photo.startsWith('https://')) return photo;
    return `data:image/jpeg;base64,${photo}`;
};

// ─── Security Background SVG ─────────────────────────────────────────────────
const SecurityBG = () => {
    const w = 500;
    const h = 315;
    const radii = [25, 45, 65, 85, 105, 125, 145, 165, 185, 205, 225, 245, 265, 285, 305, 325, 345, 365, 385, 405, 425, 445, 465, 485];
    const hLines = Array.from({ length: Math.ceil(h / 12) }, (_, i) => i * 12);
    return (
        <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFillObject}>
            {/* Fine horizontal ruling lines */}
            {hLines.map((y, i) => (
                <Line key={`h${i}`} x1="0" y1={y} x2={w} y2={y}
                    stroke="#10b981" strokeWidth="0.3" opacity="0.14" />
            ))}
            {/* Left radiating arcs */}
            {radii.map((r, i) => (
                <Circle key={`lc${i}`} cx={0} cy={h / 2} r={r}
                    stroke="#10b981" strokeWidth="0.5" fill="none" opacity="0.22" />
            ))}
            {/* Right radiating arcs */}
            {radii.map((r, i) => (
                <Circle key={`rc${i}`} cx={w} cy={h / 2} r={r}
                    stroke="#10b981" strokeWidth="0.5" fill="none" opacity="0.22" />
            ))}
            {/* Center overlapping wavy arcs */}
            {radii.map((r, i) => (
                <Circle key={`cc${i}`} cx={w / 2} cy={h / 2} r={r}
                    stroke="#10b981" strokeWidth="0.3" fill="none" opacity="0.12" />
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
    const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';

    return (
        <View style={s.card}>
            {/* ── Security Pattern Background ── */}
            <SecurityBG />

            {/* ── Coat of Arms Watermark ── */}
            <CoatWM />

            {/* ── Green accent bars ── */}
            <View style={s.topBar} />
            <View style={s.bottomBar} />

            {/* ════════════ CARD CONTENT ════════════ */}
            <View style={s.content}>

                {/* ─── ROW 1: Header | QR | NGA ─── */}
                <View style={s.row1}>
                    <View style={s.headerTxt}>
                        <Text style={s.fedRepTxt}>FEDERAL REPUBLIC OF NIGERIA</Text>
                        <Text style={s.ninSlipTxt}>DIGITAL NIN SLIP</Text>
                    </View>

                    {/* QR code */}
                    <View style={s.qrOuter}>
                        <View style={s.qrInner}>
                            <QRCode
                                value={cleanNin.length > 0 ? cleanNin : 'UNKNOWN'}
                                size={56}
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

                    {/* Personal details (Labels small & grey, Values large, bold & black) */}
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
        aspectRatio: 1.586,
        backgroundColor: '#ffffff',  // Pure white card body, pattern lines provide the green look
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: '#008240',
        position: 'relative',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    topBar: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 7,
        backgroundColor: '#008240',
    },
    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
        backgroundColor: '#008240',
    },
    coatWrap: {
        position: 'absolute',
        top: '20%', left: '30%',
        width: '40%', height: '60%',
        opacity: 0.12,  // Made slightly more visible
    },
    coatImg: { width: '100%', height: '100%' },

    content: {
        flex: 1,
        paddingTop: 14,
        paddingBottom: 8,
        paddingHorizontal: 12,
        justifyContent: 'space-between',
    },

    row1: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    headerTxt: { flex: 1, paddingRight: 4 },
    fedRepTxt: {
        color: '#008240',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.1,
        lineHeight: 13,
    },
    ninSlipTxt: {
        color: '#000000',
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginTop: 2,
    },
    qrOuter: {
        borderWidth: 1,
        borderColor: '#bbb',
        padding: 2,
        backgroundColor: '#fff',
        marginRight: 4,
        marginTop: -2,
    },
    qrInner: {
        backgroundColor: '#fff',
    },
    ngaBlock: {
        width: 48,
        alignItems: 'center',
        paddingTop: 0,
    },
    ngaTxt: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.5,
        lineHeight: 18,
    },
    issLbl: { color: '#666', fontSize: 5.5, fontWeight: '700', marginTop: 4, letterSpacing: 0.2 },
    issVal: { color: '#000', fontSize: 7.5, fontWeight: 'bold' },

    row2: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginVertical: 4,
    },
    photoBox: {
        width: 68,
        height: 85,
        backgroundColor: '#cbd5e1',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 8,
        overflow: 'hidden',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#94a3b8',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    photoImg: { width: '100%', height: '100%' },
    details: { flex: 1, justifyContent: 'center', gap: 3 },
    detailBlock: { marginBottom: 2 },
    detailRow: { flexDirection: 'row' },
    halfCell: { flex: 1 },
    dLbl: { color: '#64748b', fontSize: 6.5, fontWeight: 'bold', letterSpacing: 0.2, textTransform: 'uppercase' },
    dVal: { color: '#000000', fontSize: 9.5, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 0.5 },

    mottoRow: { alignItems: 'center', marginVertical: 1 },
    mottoTxt: { color: '#008240', fontSize: 6, fontWeight: 'bold', fontStyle: 'italic', letterSpacing: 0.6 },

    ninRow: { alignItems: 'center', paddingBottom: 2 },
    ninLbl: { color: '#000', fontSize: 7.5, fontWeight: 'bold', letterSpacing: 0.2, marginBottom: 1 },
    ninNum: {
        color: '#000',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 4,
        fontFamily: 'monospace',
    },
});
