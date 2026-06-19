import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

type MainTabType = 'verify' | 'personalize' | 'modify';
type VerifyTabType = 'nin' | 'phone' | 'demo';
type ModifyTabType = 'name' | 'dob';
type ViewType = 'menu' | 'result' | 'personalization_result' | 'modification_result';

const { width, height } = Dimensions.get('window');

// ─── DIGITAL ID CARD MOCKUP ──────────────────────────────────────────────────
const IDCardMockup = ({ data }: { data: any }) => {
    const getVal = (keys: string[], fallback: string | null = 'N/A') => {
        for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
                return String(data[k]);
            }
        }
        return fallback;
    };

    const firstName = getVal(['first_name', 'firstName', 'firstname', 'first']);
    const lastName = getVal(['last_name', 'lastName', 'lastname', 'surname', 'last']);
    const middleName = getVal(['middle_name', 'middleName', 'middlename', 'middle'], '');
    const dob = getVal(['dob', 'dateOfBirth', 'date_of_birth', 'birthdate']);
    const genderVal = getVal(['gender', 'sex', 'gender_id'], 'f') || 'f';
    const gender = genderVal.toUpperCase() === 'M' || genderVal.toLowerCase().startsWith('m') ? 'MALE' : 'FEMALE';
    const nin = getVal(['nin', 'number', 'nin_number', 'national_id', 'identity_number']);
    const state = getVal(['state', 'state_of_origin', 'stateOfOrigin'], 'Yobe');
    const lga = getVal(['lga', 'lga_of_origin', 'lgaOfOrigin'], 'Gashua');
    const photo = getVal(['photo', 'image', 'picture', 'avatar', 'face_image'], null);

    return (
        <View className="w-full aspect-[1.586] rounded-3xl overflow-hidden border border-emerald-600/30 shadow-xl mb-6 relative bg-emerald-950">
            {/* Holographic Security Gradients */}
            <LinearGradient
                colors={['#064e3b', '#022c22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
            />
            {/* Nigerian Flag Ribbon Watermark */}
            <View className="absolute inset-0 flex-row opacity-[0.04]">
                <View className="flex-1 bg-green-500" />
                <View className="flex-1 bg-white" />
                <View className="flex-1 bg-green-500" />
            </View>

            {/* Guilloche Radial Lines Watermark (Mocked via overlapping circles) */}
            <View className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full border border-emerald-500/10 opacity-30" />
            <View className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full border border-emerald-400/10 opacity-30" />
            <View className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full border border-emerald-300/10 opacity-30" />

            {/* ID Card Header */}
            <View className="px-5 pt-4 pb-2 border-b border-white/10 flex-row justify-between items-center bg-black/20">
                <View className="flex-row items-center">
                    <Ionicons name="shield" size={18} color="#C5A059" />
                    <View className="ml-2">
                        <Text className="text-white text-[9px] font-black uppercase tracking-widest leading-3">Federal Republic of Nigeria</Text>
                        <Text className="text-emerald-400 text-[8px] font-bold uppercase tracking-wider leading-3">National Identity Management Commission</Text>
                    </View>
                </View>
                <View className="flex-row gap-0.5">
                    <View className="w-1.5 h-4 bg-green-600 rounded-sm" />
                    <View className="w-1.5 h-4 bg-white rounded-sm" />
                    <View className="w-1.5 h-4 bg-green-600 rounded-sm" />
                </View>
            </View>

            {/* ID Card Body */}
            <View className="flex-1 flex-row p-4 items-center">
                {/* Photo Section */}
                <View className="mr-4 items-center justify-center">
                    <View className="p-0.5 bg-emerald-600/30 rounded-2xl border border-white/25">
                        {photo && photo.startsWith('http') ? (
                            <Image
                                source={{ uri: photo }}
                                className="w-[76px] h-[95px] rounded-[14px]"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-[76px] h-[95px] bg-emerald-900/60 rounded-[14px] items-center justify-center border border-white/5">
                                <Ionicons name="person" size={40} color="rgba(255,255,255,0.15)" />
                            </View>
                        )}
                    </View>
                    <Text className="text-[7px] text-emerald-400 font-bold uppercase mt-1 tracking-wider">Verified NIMC</Text>
                </View>

                {/* Details Section */}
                <View className="flex-1 justify-between h-full py-0.5">
                    <View>
                        {/* SURNAME */}
                        <View className="flex-row items-center mb-0.5">
                            <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">Surname:</Text>
                            <Text className="text-white text-[11px] font-black uppercase tracking-tight flex-1">{lastName}</Text>
                        </View>
                        {/* GIVEN NAMES */}
                        <View className="flex-row items-center mb-0.5">
                            <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">First Name:</Text>
                            <Text className="text-white text-[11px] font-black uppercase tracking-tight flex-1">{firstName} {middleName}</Text>
                        </View>
                        {/* DOB & GENDER */}
                        <View className="flex-row justify-between mb-0.5 mr-2">
                            <View className="flex-row items-center">
                                <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">D.O.B:</Text>
                                <Text className="text-white text-[9px] font-extrabold uppercase tracking-tight">{dob}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-emerald-500 text-[7px] font-bold uppercase mr-1">Sex:</Text>
                                <Text className="text-white text-[9px] font-extrabold uppercase tracking-tight">{gender}</Text>
                            </View>
                        </View>
                        {/* ORIGIN */}
                        <View className="flex-row items-center">
                            <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">Origin:</Text>
                            <Text className="text-emerald-300 text-[8px] font-semibold uppercase tracking-tight flex-1">{lga} LGA, {state} State</Text>
                        </View>
                    </View>

                    {/* NIN NUMBER BLOCK */}
                    <View className="bg-emerald-900/40 border border-emerald-500/20 px-3 py-1 rounded-xl flex-row justify-between items-center mr-2 mt-1">
                        <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-wider">NIN:</Text>
                        <Text className="text-[#C5A059] text-[12px] font-black uppercase tracking-[2.5px]">{nin}</Text>
                    </View>
                </View>
            </View>

            {/* Smart Chips / Coat of Arms Watermark decoration */}
            <View className="absolute bottom-4 left-4 opacity-15">
                <Ionicons name="ribbon-outline" size={24} color="white" />
            </View>
        </View>
    );
};

export default function NINServicesScreen() {
    const [mainTab, setMainTab] = useState<MainTabType>('verify');
    const [verifySubTab, setVerifySubTab] = useState<VerifyTabType>('nin');
    const [modifySubTab, setModifySubTab] = useState<ModifyTabType>('name');
    const [view, setView] = useState<ViewType>('menu');

    // Forms input states
    const [nin, setNin] = useState('');
    const [phone, setPhone] = useState('');
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [middlename, setMiddlename] = useState('');
    const [gender, setGender] = useState<'m' | 'f'>('m');
    const [dob, setDob] = useState(''); // DD-MM-YYYY

    // Modification Form states
    const [modNIN, setModNIN] = useState('');
    const [modFirstname, setModFirstname] = useState('');
    const [modLastname, setModLastname] = useState('');
    const [modMiddlename, setModMiddlename] = useState('');
    const [modPhone, setModPhone] = useState('');
    const [modDOB, setModDOB] = useState(''); // DD-MM-YYYY

    // Loading & Result States
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [resultSuccess, setResultSuccess] = useState(false);

    const resetForm = () => {
        setView('menu');
        setResult(null);
        setNin('');
        setPhone('');
        setFirstname('');
        setLastname('');
        setMiddlename('');
        setDob('');
        setModNIN('');
        setModFirstname('');
        setModLastname('');
        setModMiddlename('');
        setModPhone('');
        setModDOB('');
    };

    // ─── API HANDLERS ────────────────────────────────────────────────────────
    const handleNINVerify = async () => {
        if (nin.length !== 11) {
            Alert.alert('Incomplete', 'Please enter a valid 11-digit NIN');
            return;
        }
        setLoading(true);
        try {
            const res = await api.identity.validateNIN(nin);
            setResult(res);
            setResultSuccess(res.isValid);
            setView('result');
        } catch (e: any) {
            Alert.alert('Verification Failed', e.message || 'Service unreachable');
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneVerify = async () => {
        if (phone.length < 10) {
            Alert.alert('Incomplete', 'Please enter a valid phone number');
            return;
        }
        setLoading(true);
        try {
            // NIN with Phone endpoint
            const res = await api.identity.verifyNINWithPhone(phone);
            setResult(res);
            setResultSuccess(res.isValid);
            setView('result');
        } catch (e: any) {
            Alert.alert('Verification Failed', e.message || 'Service unreachable');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoVerify = async () => {
        if (!firstname || !lastname || !dob) {
            Alert.alert('Incomplete', 'Please fill all required fields');
            return;
        }
        setLoading(true);
        try {
            const res = await api.identity.verifyDemographic({ firstname, lastname, gender, dob });
            setResult(res);
            setResultSuccess(res.isValid);
            setView('result');
        } catch (e: any) {
            Alert.alert('Verification Failed', e.message || 'Service unreachable');
        } finally {
            setLoading(false);
        }
    };

    const handlePersonalizationSearch = async () => {
        if (nin.length !== 11) {
            Alert.alert('Incomplete', 'Please enter an 11-digit NIN');
            return;
        }
        setLoading(true);
        try {
            const res = await api.identity.getPersonalization(nin);
            setResult(res);
            setResultSuccess(res.isValid);
            setView('personalization_result');
        } catch (e: any) {
            Alert.alert('Search Failed', e.message || 'Personalization check failed');
        } finally {
            setLoading(false);
        }
    };

    const handleModificationSubmit = async () => {
        if (!modNIN) {
            Alert.alert('Required', 'NIN is required for modification');
            return;
        }
        setLoading(true);
        try {
            let res;
            if (modifySubTab === 'name') {
                res = await api.identity.requestModification({
                    number: modNIN,
                    firstname: modFirstname || undefined,
                    lastname: modLastname || undefined,
                    middlename: modMiddlename || undefined,
                    phone: modPhone || undefined
                });
            } else {
                if (!modDOB) {
                    Alert.alert('Required', 'New Date of Birth is required');
                    setLoading(false);
                    return;
                }
                res = await api.identity.requestDOBModification(modNIN, modDOB);
            }
            setResult(res);
            setResultSuccess(res.isValid);
            setView('modification_result');
        } catch (e: any) {
            Alert.alert('Request Failed', e.message || 'Failed to submit modification');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (value: string, label: string) => {
        await Clipboard.setStringAsync(value);
        Alert.alert('Copied ✓', `${label} has been copied to your clipboard.`);
    };

    // ─── RENDERS ─────────────────────────────────────────────────────────────
    const renderResultView = () => {
        const data = result?.data || result?.rawData || {};
        const fields = Object.entries(data).filter(([k]) => k !== 'photo' && k !== 'image' && k !== 'picture' && k !== 'avatar' && k !== 'face_image');

        return (
            <View className="w-full">
                {/* Result Card Watermark & Header */}
                <View className="mb-6 items-center">
                    <Text className="text-emerald-500 font-extrabold text-sm uppercase tracking-widest mb-1">Verification Status</Text>
                    <Text className="text-slate-900 font-black text-2xl">Digital Verification Receipt</Text>
                </View>

                {resultSuccess ? (
                    <IDCardMockup data={data} />
                ) : (
                    <View className="bg-red-50 p-6 rounded-3xl mb-6 border border-red-100 items-center">
                        <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                            <Ionicons name="close-circle" size={36} color="#DC2626" />
                        </View>
                        <Text className="text-red-800 text-xl font-bold mb-1">Verification Failed</Text>
                        <Text className="text-red-600 text-sm text-center leading-5">{result?.message || 'NIN record could not be verified.'}</Text>
                    </View>
                )}

                {/* Extended Details List */}
                {resultSuccess && fields.length > 0 && (
                    <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm mb-6">
                        <Text className="text-slate-400 text-[10px] font-black uppercase mb-4 tracking-widest">Retrieved Meta Data</Text>
                        {fields.map(([key, value]) => {
                            const displayKey = key.replace(/_/g, ' ');
                            const displayValue = String(value);
                            return (
                                <View key={key} className="flex-row justify-between items-center py-3.5 border-b border-slate-50 last:border-b-0">
                                    <Text className="text-slate-500 text-xs capitalize flex-1">{displayKey}</Text>
                                    <View className="flex-row items-center gap-2 max-w-[65%]">
                                        <Text className="text-slate-800 font-bold text-xs text-right" numberOfLines={2}>
                                            {displayValue}
                                        </Text>
                                        <TouchableOpacity onPress={() => handleCopy(displayValue, displayKey)}>
                                            <Ionicons name="copy-outline" size={14} color="#0056D2" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <TouchableOpacity
                    onPress={resetForm}
                    className="bg-emerald-700 h-16 rounded-2xl items-center justify-center flex-row shadow-lg shadow-emerald-700/25"
                >
                    <Ionicons name="arrow-back" size={20} color="white" />
                    <Text className="text-white font-bold ml-2 text-base">Perform Another Search</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderPersonalizationResult = () => {
        return (
            <View className="w-full">
                <View className="mb-6 items-center">
                    <Text className="text-emerald-500 font-extrabold text-sm uppercase tracking-widest mb-1">Card Production Status</Text>
                    <Text className="text-slate-900 font-black text-2xl">Enrollment Details</Text>
                </View>

                {resultSuccess ? (
                    <View className="gap-y-6">
                        {/* Tracker Timeline Card */}
                        <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-6">Tracking Timeline</Text>
                            
                            {[
                                { title: 'Enrollment Confirmed', desc: 'NIMC database record parsed and valid.', done: true },
                                { title: 'Card Personalization', desc: 'Card details template generated & queued.', done: true },
                                { title: 'Print Queue Allocation', desc: 'Ready for batch printing allocation.', done: false },
                            ].map((step, idx, arr) => (
                                <View key={idx} className="flex-row items-start">
                                    <View className="items-center mr-4">
                                        <View className={`w-8 h-8 rounded-full items-center justify-center border ${step.done ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-50 border-slate-200'}`}>
                                            <Ionicons name={step.done ? 'checkmark' : 'ellipse'} size={14} color={step.done ? 'white' : '#94A3B8'} />
                                        </View>
                                        {idx < arr.length - 1 && (
                                            <View className={`w-[2px] h-10 ${step.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                        )}
                                    </View>
                                    <View className="flex-1 pt-0.5">
                                        <Text className={`font-bold text-sm ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>{step.title}</Text>
                                        <Text className="text-slate-400 text-xs mt-0.5 leading-4">{step.desc}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Details */}
                        <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Enrollment Data</Text>
                            {Object.entries(result?.data || {}).slice(0, 8).map(([k, v]) => (
                                <View key={k} className="flex-row justify-between py-3 border-b border-slate-50 last:border-0">
                                    <Text className="text-slate-500 text-xs capitalize">{k.replace(/_/g, ' ')}</Text>
                                    <Text className="text-slate-800 font-bold text-xs">{String(v)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View className="bg-red-50 p-6 rounded-3xl mb-6 border border-red-100 items-center">
                        <Ionicons name="alert-circle" size={36} color="#DC2626" className="mb-3" />
                        <Text className="text-red-800 text-lg font-bold mb-1">NIN Not Found</Text>
                        <Text className="text-red-600 text-sm text-center">{result?.message || 'Could not find enrollment data.'}</Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={resetForm}
                    className="bg-emerald-700 h-16 rounded-2xl items-center justify-center flex-row shadow-lg shadow-emerald-700/25 mt-6"
                >
                    <Ionicons name="arrow-back" size={20} color="white" />
                    <Text className="text-white font-bold ml-2 text-base">Check Another Status</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderModificationResult = () => {
        return (
            <View className="w-full items-center justify-center py-10">
                <View className="w-20 h-20 rounded-full bg-emerald-100 items-center justify-center mb-6">
                    <Ionicons name="checkbox" size={44} color="#107C10" />
                </View>
                <Text className="text-slate-900 font-black text-2xl text-center mb-2">Request Submitted</Text>
                <Text className="text-slate-500 text-center text-sm leading-5 px-6 mb-8">
                    Your NIN modification request has been queued. NIMC database synchronization takes 24-48 hours.
                </Text>

                <View className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-8">
                    <View className="flex-row justify-between py-2">
                        <Text className="text-slate-400 text-xs uppercase font-bold">NIN Number</Text>
                        <Text className="text-slate-800 font-bold text-xs">{modNIN}</Text>
                    </View>
                    <View className="flex-row justify-between py-2">
                        <Text className="text-slate-400 text-xs uppercase font-bold">Request Type</Text>
                        <Text className="text-slate-800 font-bold text-xs">{modifySubTab === 'name' ? 'Detail Modification' : 'DOB Correction'}</Text>
                    </View>
                    <View className="flex-row justify-between py-2">
                        <Text className="text-slate-400 text-xs uppercase font-bold">Status</Text>
                        <Text className="text-amber-600 font-bold text-xs">Pending Approval</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={resetForm}
                    className="bg-emerald-700 h-16 rounded-2xl w-full items-center justify-center flex-row shadow-lg shadow-emerald-700/25"
                >
                    <Ionicons name="arrow-back" size={20} color="white" />
                    <Text className="text-white font-bold ml-2 text-base">Done</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderVerifyForm = () => {
        return (
            <View>
                {/* Sub-tabs switch */}
                <View className="flex-row bg-slate-100 rounded-2xl p-1 mb-6 border border-slate-200/50">
                    {(['nin', 'phone', 'demo'] as const).map(sub => (
                        <TouchableOpacity
                            key={sub}
                            onPress={() => setVerifySubTab(sub)}
                            className={`flex-1 items-center justify-center py-2.5 rounded-xl ${verifySubTab === sub ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`font-bold text-xs ${verifySubTab === sub ? 'text-slate-900' : 'text-slate-400'}`}>
                                {sub === 'nin' ? 'NIN' : sub === 'phone' ? 'Phone' : 'Demographics'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {verifySubTab === 'nin' && (
                    <View>
                        <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">National ID Number</Text>
                        <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-16 mb-6 shadow-sm shadow-slate-100">
                            <Ionicons name="finger-print-outline" size={22} color="#94A3B8" />
                            <TextInput
                                placeholder="Enter 11-digit NIN"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-3 text-slate-800 font-bold text-base"
                                keyboardType="number-pad"
                                maxLength={11}
                                value={nin}
                                onChangeText={setNin}
                                editable={!loading}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleNINVerify}
                            disabled={nin.length !== 11 || loading}
                            className={`h-16 rounded-2xl items-center justify-center flex-row ${nin.length === 11 && !loading ? 'bg-emerald-700 shadow-md shadow-emerald-700/20' : 'bg-slate-200'}`}
                        >
                            {loading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Ionicons name="scan-outline" size={20} color={nin.length === 11 ? 'white' : '#9CA3AF'} />
                                    <Text className={`font-bold ml-2 text-base ${nin.length === 11 ? 'text-white' : 'text-gray-400'}`}>Verify NIN Number</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {verifySubTab === 'phone' && (
                    <View>
                        <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">Linked Phone Number</Text>
                        <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-16 mb-6 shadow-sm shadow-slate-100">
                            <Ionicons name="call-outline" size={22} color="#94A3B8" />
                            <TextInput
                                placeholder="e.g. 08012345678"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-3 text-slate-800 font-bold text-base"
                                keyboardType="phone-pad"
                                maxLength={14}
                                value={phone}
                                onChangeText={setPhone}
                                editable={!loading}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handlePhoneVerify}
                            disabled={phone.length < 10 || loading}
                            className={`h-16 rounded-2xl items-center justify-center flex-row ${phone.length >= 10 && !loading ? 'bg-emerald-700 shadow-md shadow-emerald-700/20' : 'bg-slate-200'}`}
                        >
                            {loading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Ionicons name="search-outline" size={20} color={phone.length >= 10 ? 'white' : '#9CA3AF'} />
                                    <Text className={`font-bold ml-2 text-base ${phone.length >= 10 ? 'text-white' : 'text-gray-400'}`}>Lookup by Phone</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {verifySubTab === 'demo' && (
                    <View>
                        <View className="flex-row gap-3 mb-4">
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">First Name</Text>
                                <View className="bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 justify-center">
                                    <TextInput
                                        placeholder="e.g. Usman"
                                        placeholderTextColor="#9CA3AF"
                                        className="text-slate-800 font-semibold"
                                        value={firstname}
                                        onChangeText={setFirstname}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">Last Name</Text>
                                <View className="bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 justify-center">
                                    <TextInput
                                        placeholder="e.g. John"
                                        placeholderTextColor="#9CA3AF"
                                        className="text-slate-800 font-semibold"
                                        value={lastname}
                                        onChangeText={setLastname}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                        </View>

                        <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">Gender</Text>
                        <View className="flex-row gap-3 mb-4">
                            {(['m', 'f'] as const).map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    onPress={() => setGender(opt)}
                                    className={`flex-1 h-14 rounded-2xl items-center justify-center border ${gender === opt ? 'bg-emerald-900 border-emerald-900' : 'bg-white border-slate-200'}`}
                                >
                                    <Text className={`font-bold text-sm ${gender === opt ? 'text-white' : 'text-slate-500'}`}>
                                        {opt === 'm' ? 'MALE' : 'FEMALE'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">Date of Birth (DD-MM-YYYY)</Text>
                        <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-14 mb-6 shadow-sm shadow-slate-100">
                            <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
                            <TextInput
                                placeholder="e.g. 15-08-1990"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-3 text-slate-800 font-semibold"
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                                value={dob}
                                onChangeText={setDob}
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleDemoVerify}
                            disabled={!firstname || !lastname || !dob || loading}
                            className={`h-16 rounded-2xl items-center justify-center flex-row ${firstname && lastname && dob && !loading ? 'bg-emerald-700 shadow-md shadow-emerald-700/20' : 'bg-slate-200'}`}
                        >
                            {loading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Ionicons name="people-outline" size={20} color={firstname && lastname && dob ? 'white' : '#9CA3AF'} />
                                    <Text className={`font-bold ml-2 text-base ${firstname && lastname && dob ? 'text-white' : 'text-gray-400'}`}>Verify Demographics</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderPersonalizeForm = () => {
        return (
            <View>
                <View className="bg-emerald-900 p-6 rounded-3xl mb-6 relative overflow-hidden">
                    <View className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
                    <Ionicons name="card" size={32} color="#C5A059" />
                    <Text className="text-white text-lg font-black mt-3 mb-1">NIN Card Status Tracking</Text>
                    <Text className="text-emerald-200 text-xs leading-4">Check status of your physical NIMC card print personalization and shipping queue.</Text>
                </View>

                <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">NIN Number</Text>
                <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-16 mb-6 shadow-sm shadow-slate-100">
                    <Ionicons name="finger-print-outline" size={22} color="#94A3B8" />
                    <TextInput
                        placeholder="Enter 11-digit NIN"
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-3 text-slate-800 font-bold text-base"
                        keyboardType="number-pad"
                        maxLength={11}
                        value={nin}
                        onChangeText={setNin}
                        editable={!loading}
                    />
                </View>

                <TouchableOpacity
                    onPress={handlePersonalizationSearch}
                    disabled={nin.length !== 11 || loading}
                    className={`h-16 rounded-2xl items-center justify-center flex-row ${nin.length === 11 && !loading ? 'bg-emerald-700 shadow-md shadow-emerald-700/20' : 'bg-slate-200'}`}
                >
                    {loading ? <ActivityIndicator color="white" /> : (
                        <>
                            <Ionicons name="locate-outline" size={20} color={nin.length === 11 ? 'white' : '#9CA3AF'} />
                            <Text className={`font-bold ml-2 text-base ${nin.length === 11 ? 'text-white' : 'text-gray-400'}`}>Track Card Status</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderModifyForm = () => {
        return (
            <View>
                {/* Form Sub Tabs */}
                <View className="flex-row bg-slate-100 rounded-2xl p-1 mb-6 border border-slate-200/50">
                    {(['name', 'dob'] as const).map(sub => (
                        <TouchableOpacity
                            key={sub}
                            onPress={() => setModifySubTab(sub)}
                            className={`flex-1 items-center justify-center py-2.5 rounded-xl ${modifySubTab === sub ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`font-bold text-xs ${modifySubTab === sub ? 'text-slate-900' : 'text-slate-400'}`}>
                                {sub === 'name' ? 'Modify Info' : 'Correct DOB'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">NIN Number (Required)</Text>
                <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-16 mb-4 shadow-sm shadow-slate-100">
                    <Ionicons name="lock-closed-outline" size={22} color="#94A3B8" />
                    <TextInput
                        placeholder="NIN to modify"
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-3 text-slate-800 font-bold text-base"
                        keyboardType="number-pad"
                        maxLength={11}
                        value={modNIN}
                        onChangeText={setModNIN}
                        editable={!loading}
                    />
                </View>

                {modifySubTab === 'name' ? (
                    <View className="gap-y-4">
                        <View>
                            <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">New First Name</Text>
                            <View className="bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 justify-center">
                                <TextInput
                                    placeholder="Enter new first name"
                                    placeholderTextColor="#9CA3AF"
                                    className="text-slate-800 font-semibold"
                                    value={modFirstname}
                                    onChangeText={setModFirstname}
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">New Last Name</Text>
                            <View className="bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 justify-center">
                                <TextInput
                                    placeholder="Enter new last name"
                                    placeholderTextColor="#9CA3AF"
                                    className="text-slate-800 font-semibold"
                                    value={modLastname}
                                    onChangeText={setModLastname}
                                    editable={!loading}
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">New Phone Number</Text>
                            <View className="bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100 justify-center">
                                <TextInput
                                    placeholder="Enter new phone number"
                                    placeholderTextColor="#9CA3AF"
                                    className="text-slate-800 font-semibold"
                                    keyboardType="phone-pad"
                                    value={modPhone}
                                    onChangeText={setModPhone}
                                    editable={!loading}
                                />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View className="mb-4">
                        <Text className="text-slate-500 text-xs font-black mb-2 uppercase tracking-widest">Correct Date of Birth (DD-MM-YYYY)</Text>
                        <View className="flex-row items-center bg-white border border-slate-200/80 rounded-2xl px-4 h-14 shadow-sm shadow-slate-100">
                            <Ionicons name="calendar-outline" size={20} color="#94A3B8" />
                            <TextInput
                                placeholder="e.g. 25-12-1995"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-3 text-slate-800 font-semibold"
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                                value={modDOB}
                                onChangeText={setModDOB}
                                editable={!loading}
                            />
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    onPress={handleModificationSubmit}
                    disabled={!modNIN || loading}
                    className={`h-16 rounded-2xl items-center justify-center flex-row mt-6 ${modNIN && !loading ? 'bg-emerald-700 shadow-md shadow-emerald-700/20' : 'bg-slate-200'}`}
                >
                    {loading ? <ActivityIndicator color="white" /> : (
                        <>
                            <Ionicons name="send-outline" size={20} color={modNIN ? 'white' : '#9CA3AF'} />
                            <Text className={`font-bold ml-2 text-base ${modNIN ? 'text-white' : 'text-gray-400'}`}>Submit Modification Request</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen
                options={{
                    title: 'NIN Identity Portal',
                    headerStyle: { backgroundColor: '#064e3b' },
                    headerTintColor: '#C5A059',
                    headerTitleStyle: { fontWeight: 'black', fontSize: 18 },
                    headerShadowVisible: false
                }}
            />
            <StatusBar style="light" />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                {view === 'result' && renderResultView()}
                {view === 'personalization_result' && renderPersonalizationResult()}
                {view === 'modification_result' && renderModificationResult()}

                {view === 'menu' && (
                    <View>
                        {/* Powered Header Badge */}
                        <View className="flex-row items-center justify-end mb-5">
                            <View className="flex-row items-center bg-white border border-slate-100 px-3.5 py-1.5 rounded-full shadow-sm">
                                <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                                <Text className="text-slate-500 font-bold text-[10px] tracking-wide uppercase">NIMC Live Database</Text>
                            </View>
                        </View>

                        {/* Top Category Swapper */}
                        <View className="flex-row bg-white rounded-3xl p-1.5 border border-slate-100 mb-8 shadow-sm">
                            {(['verify', 'personalize', 'modify'] as const).map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setMainTab(tab)}
                                    className={`flex-1 flex-row items-center justify-center h-12 rounded-2xl gap-1.5 ${mainTab === tab ? 'bg-emerald-950 shadow-md shadow-emerald-950/20' : ''}`}
                                >
                                    <Ionicons
                                        name={tab === 'verify' ? 'shield-checkmark' : tab === 'personalize' ? 'card' : 'create'}
                                        size={16}
                                        color={mainTab === tab ? '#C5A059' : '#94A3B8'}
                                    />
                                    <Text className={`font-black text-xs ${mainTab === tab ? 'text-[#C5A059]' : 'text-slate-400'}`}>
                                        {tab === 'verify' ? 'Verify' : tab === 'personalize' ? 'Track Card' : 'Modify'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Content Forms */}
                        {mainTab === 'verify' && renderVerifyForm()}
                        {mainTab === 'personalize' && renderPersonalizeForm()}
                        {mainTab === 'modify' && renderModifyForm()}

                        {/* Info Banner */}
                        <View className="mt-8 bg-emerald-50/60 border border-emerald-100 rounded-3xl p-5 flex-row items-start">
                            <Ionicons name="information-circle" size={20} color="#059669" />
                            <Text className="text-emerald-800 text-xs ml-3 flex-1 leading-5">
                                This portal is authenticated via NIMC integration APIs. All transactions are securely audited and billable per query.
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
