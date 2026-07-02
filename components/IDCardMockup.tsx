/**
 * IDCardMockup — Premium NIN Slip
 * High-fidelity pixel-faithful replica of the Nigerian Digital NIN Slip.
 * Matches the sunburst, rosettes, watermarks, and font weights of the official template.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Line, Path, Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

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

// ─── Guilloché Security Pattern SVG ──────────────────────────────────────────
const SecurityBG = () => {
    const w = 535;
    const h = 330;
    // Lines radiating from center (267, 165)
    const lines = [
        [0,0], [60,0], [120,0], [180,0], [240,0], [300,0], [360,0], [420,0], [480,0], [535,0],
        [535,55], [535,110], [535,165], [535,220], [535,275], [535,330],
        [480,330], [420,330], [360,330], [300,330], [240,330], [180,330], [120,330], [60,330], [0,330],
        [0,275], [0,220], [0,165], [0,110], [0,55]
    ];
    const leftRadii = [30, 50, 70, 90, 110, 130];
    const rightRadii = [40, 65, 90, 115];
    
    return (
        <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFillObject}>
            {/* Sunburst Lines */}
            {lines.map(([x, y], idx) => (
                <Line
                    key={`sun-${idx}`}
                    x1={267}
                    y1={165}
                    x2={x}
                    y2={y}
                    stroke="rgba(0, 135, 81, 0.05)"
                    strokeWidth={0.75}
                />
            ))}

            {/* Rosette Left */}
            {leftRadii.map((r, idx) => (
                <Circle
                    key={`rl-${idx}`}
                    cx={40}
                    cy={290}
                    r={r}
                    fill="none"
                    stroke={`rgba(0, 135, 81, ${0.07 - idx * 0.005})`}
                    strokeWidth={0.75}
                />
            ))}

            {/* Rosette Right */}
            {rightRadii.map((r, idx) => (
                <Circle
                    key={`rr-${idx}`}
                    cx={480}
                    cy={60}
                    r={r}
                    fill="none"
                    stroke={`rgba(0, 135, 81, ${0.06 - idx * 0.005})`}
                    strokeWidth={0.75}
                />
            ))}
        </Svg>
    );
};

// ─── Coat of Arms Watermark ──────────────────────────────────────────────────
const CoatWM = () => (
    <View style={s.coatWrap} pointerEvents="none">
        <Image
            source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIKo551M65-TWEyZQ7BolTDwvb-VN6b5XQ4WEsmhRyEQ&s=10' }}
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
    const givenNames = [firstName, middleName].filter(Boolean).join(' ') || 'PROUD NIGERIAN';
    const photoUri = resolvePhoto(rawPhoto);
    const issueDate = rawIssue ? formatDob(rawIssue) : '01 JAN 2021';

    // Watermark texts
    const watermarkText = cleanNin.length === 11
        ? `${cleanNin.slice(0, 4)} ${cleanNin.slice(4)}`
        : cleanNin;
    const photoWatermark = cleanNin.length === 11 ? cleanNin.slice(4) : '';

    return (
        <View style={s.card}>
            {/* Radial Gradient Background simulation */}
            <LinearGradient
                colors={['rgba(255,255,255,0.9)', 'rgba(246,253,249,0.7)', '#d5f2de']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            {/* ── Security Pattern Background ── */}
            <SecurityBG />

            {/* ── Coat of Arms Watermark ── */}
            <CoatWM />

            {/* ── Watermark Slanted Texts ── */}
            <View style={s.watermarkLayer} pointerEvents="none">
                <Text style={[s.watermarkText, { bottom: '15%', left: -25 }]}>{watermarkText}</Text>
                <Text style={[s.watermarkText, { top: '30%', right: -15 }]}>{watermarkText}</Text>
            </View>

            {/* ════════════ CARD CONTENT ════════════ */}
            <View style={s.content}>

                {/* ─── ROW 1: Header | QR | NGA ─── */}
                <View style={s.row1}>
                    <View style={s.headerTxt}>
                        <Text style={s.fedRepTxt}>FEDERAL REPUBLIC OF NIGERIA</Text>
                        <Text style={s.ninSlipTxt}>DIGITAL NIN SLIP</Text>
                    </View>
                </View>

                {/* ─── ROW 2: Photo | Details | QR ─── */}
                <View style={s.row2}>
                    {/* Photo Box */}
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
                        {/* Photo Watermark */}
                        <Text style={s.photoWatermark}>{photoWatermark}</Text>
                    </View>

                    {/* Personal Details */}
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

                    {/* QR Code and NGA Block */}
                    <View style={s.rightCol}>
                        <View style={s.qrOuter}>
                            <QRCode
                                value={`NIN-${cleanNin}-${lastName.replace(/\s+/g, '-')}-${firstName.replace(/\s+/g, '-')}`}
                                size={54}
                                backgroundColor="white"
                                color="#000"
                            />
                        </View>
                        <View style={s.ngaBlock}>
                            <Text style={s.ngaTxt}>NGA</Text>
                            <Text style={s.issLbl}>ISSUE DATE</Text>
                            <Text style={s.issVal}>{issueDate}</Text>
                        </View>
                    </View>
                </View>

                {/* ─── NIN ─── */}
                <View style={s.ninRow}>
                    <Text style={s.ninLbl}>National Identification Number (NIN)</Text>
                    <Text style={s.ninNum}>{fmtNin}</Text>
                </View>
            </View>

            {/* Bottom green accent line */}
            <LinearGradient
                colors={['#166534', '#059669', '#166534']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.bottomLine}
            />
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    card: {
        width: '100%',
        aspectRatio: 1.62,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: '#cbd5e1',
        position: 'relative',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    coatWrap: {
        position: 'absolute',
        top: '20%', left: '30%',
        width: '40%', height: '60%',
        opacity: 0.14,
    },
    coatImg: { width: '100%', height: '100%' },

    watermarkLayer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    watermarkText: {
        position: 'absolute',
        fontSize: 10.5,
        fontWeight: 'bold',
        color: '#166534',
        opacity: 0.18,
        transform: [{ rotate: '-28deg' }],
        letterSpacing: 1,
    },

    content: {
        flex: 1,
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 12,
        justifyContent: 'space-between',
    },

    row1: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    headerTxt: { flex: 1 },
    fedRepTxt: {
        color: '#008751',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.1,
        lineHeight: 16,
    },
    ninSlipTxt: {
        color: '#000000',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginTop: 1,
    },

    row2: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginVertical: 4,
    },
    photoBox: {
        width: 80,
        height: 98,
        backgroundColor: '#e2e8f0',
        borderWidth: 1,
        borderColor: '#94a3b8',
        borderRadius: 1,
        position: 'relative',
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    photoWatermark: {
        position: 'absolute',
        bottom: 12,
        fontSize: 7.5,
        fontWeight: 'bold',
        color: 'rgba(255, 255, 255, 0.4)',
        transform: [{ rotate: '-28deg' }],
    },

    details: { flex: 1, justifyContent: 'center', gap: 3 },
    detailBlock: { marginBottom: 1 },
    detailRow: { flexDirection: 'row' },
    halfCell: { flex: 1 },
    dLbl: { color: '#6b7280', fontSize: 7.5, fontWeight: '700', letterSpacing: 0.1, textTransform: 'uppercase' },
    dVal: { color: '#000000', fontSize: 11.5, fontWeight: '900', fontFamily: 'monospace', textTransform: 'uppercase', marginTop: 0.5 },

    rightCol: {
        width: 68,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    qrOuter: {
        borderWidth: 1,
        borderColor: '#000',
        padding: 2,
        backgroundColor: '#fff',
    },
    ngaBlock: {
        alignItems: 'center',
        width: '100%',
    },
    ngaTxt: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
        lineHeight: 16,
    },
    issLbl: { color: '#6b7280', fontSize: 6, fontWeight: '800', marginTop: 2 },
    issVal: { color: '#000', fontSize: 8, fontWeight: '800', fontFamily: 'monospace' },

    ninRow: { alignItems: 'center', paddingBottom: 2 },
    ninLbl: { color: '#000', fontSize: 8, fontWeight: '700', letterSpacing: 0.1, marginBottom: 1 },
    ninNum: {
        color: '#000',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 4,
        fontFamily: 'monospace',
    },

    bottomLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        opacity: 0.6,
    },
});
