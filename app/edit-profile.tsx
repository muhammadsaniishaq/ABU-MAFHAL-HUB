import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Alert, 
    Image, ActivityIndicator, Platform, KeyboardAvoidingView 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Executive Light Navy & Gold Design Tokens
const L = {
    bg: '#F4F6FB',
    card: '#FFFFFF',
    cardBorder: 'rgba(218, 165, 32, 0.35)',
    navyHeader: '#0F172A',
    navyMid: '#1C2541',
    navyDark: '#0B132B',
    gold: '#F5A623',
    goldDk: '#D97706',
    goldAmber: '#B45309',
    goldBg: 'rgba(254, 243, 199, 0.75)',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
    emerald: '#10B981',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    rose: '#E11D48',
    roseBg: '#FFF1F2',
    roseBorder: '#FECDD3',
    blue: '#3B82F6',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

export default function EditProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Profile Data States
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [customId, setCustomId] = useState(''); 
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // Logic & Contact States
    const [isPhoneLocked, setIsPhoneLocked] = useState(false);
    const [address, setAddress] = useState('');
    const [gender, setGender] = useState('');
    const [dob, setDob] = useState('');
    const [state, setState] = useState('');
    const [nextOfKinName, setNextOfKinName] = useState('');
    const [nextOfKinPhone, setNextOfKinPhone] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (data) {
                    setFullName(data.full_name || '');
                    setUsername(data.username || '');
                    setEmail(data.email || user.email || '');
                    setPhone(data.phone || '');
                    if (data.phone && data.phone.length > 5) {
                        setIsPhoneLocked(true);
                    }
                    setCustomId(data.custom_id || 'ID-PENDING');
                    setAvatarUrl(data.avatar_url || null);
                    setAddress(data.address || '');
                    setGender(data.gender || '');
                    setDob(data.dob || '');
                    setState(data.state || '');
                    setNextOfKinName(data.next_of_kin_name || '');
                    setNextOfKinPhone(data.next_of_kin_phone || '');
                }
            }
        } catch (error) {
            console.log('Error fetching profile', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            uploadImage(result.assets[0]);
        }
    };

    const uploadImage = async (image: ImagePicker.ImagePickerAsset) => {
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (!image.base64) throw new Error('No image data');

            const fileName = `${user.id}/${Date.now()}.jpg`;
            const { error } = await supabase
                .storage
                .from('avatars')
                .upload(fileName, decode(image.base64), {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase
                .storage
                .from('avatars')
                .getPublicUrl(fileName);

            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setAvatarUrl(publicUrl);
            Alert.alert("Success", "Profile photo updated successfully!");

        } catch (error: any) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user session');

            const updates = {
                full_name: fullName,
                username: username,
                phone: phone,
                address: address,
                gender: gender,
                dob: dob,
                state: state,
                next_of_kin_name: nextOfKinName,
                next_of_kin_phone: nextOfKinPhone,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert("Profile Updated 🎉", "Your profile information has been saved successfully.");
            router.back();

        } catch (error: any) {
            console.error('Update error:', error);
            let errorMessage = "Failed to update profile details.";
            if (error.message?.includes('profiles_username_key')) {
                errorMessage = "This Username is already taken.";
            }
            Alert.alert("Update Failed", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: L.bg }}>
                <ActivityIndicator size="small" color={L.goldDk} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: L.bg, alignItems: 'center' }}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="light" />

            {/* Container Wrapper (Max Width 600px for Web, 100% for Mobile) */}
            <View style={{ flex: 1, width: '100%', maxWidth: 600, backgroundColor: L.bg }}>
                
                {/* Royal Navy Header */}
                <LinearGradient
                    colors={['#0F172A', '#1C2541', '#0B132B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderBottomWidth: 1.5, borderColor: L.goldDk }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="arrow-back" size={16} color={L.gold} />
                        </TouchableOpacity>

                        <Text style={{ fontSize: 13, fontWeight: '900', color: L.gold, letterSpacing: -0.2 }}>EDIT PROFILE DETAILS</Text>

                        <View style={{ width: 32 }} />
                    </View>
                </LinearGradient>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        
                        {/* Avatar Section */}
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ position: 'relative' }}>
                                <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2, backgroundColor: L.gold, alignItems: 'center', justifyContent: 'center' }}>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: L.navyHeader }}>
                                        {avatarUrl ? (
                                            <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                                        ) : (
                                            <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: L.navyMid }}>
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: L.gold }}>{fullName?.charAt(0).toUpperCase() || 'U'}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <TouchableOpacity onPress={pickImage} style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: L.gold, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: L.navyHeader }}>
                                    <Ionicons name="camera" size={11} color={L.navyHeader} />
                                </TouchableOpacity>
                            </View>

                            <View style={{ backgroundColor: L.goldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: L.goldDk, marginTop: 6 }}>
                                <Text style={{ color: L.goldAmber, fontSize: 8.5, fontWeight: '900' }}>ID: {customId}</Text>
                            </View>
                        </View>

                        {/* Form Card 1: Basic Information */}
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10, elevation: 1 }}>
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Basic Profile Information</Text>

                            {/* Username Input */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Username:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="at" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="Enter username..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>

                            {/* Full Name Input */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Full Name:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="person-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={fullName}
                                        onChangeText={setFullName}
                                        placeholder="Enter full name..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>

                            {/* Gender & DOB Dual Inputs */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Gender:</Text>
                                    <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="male-female-outline" size={13} color={L.navyHeader} />
                                        <TextInput
                                            value={gender}
                                            onChangeText={setGender}
                                            placeholder="Male / Female"
                                            placeholderTextColor="#94A3B8"
                                            style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                        />
                                    </View>
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Date of Birth:</Text>
                                    <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Ionicons name="calendar-outline" size={13} color={L.navyHeader} />
                                        <TextInput
                                            value={dob}
                                            onChangeText={setDob}
                                            placeholder="DD/MM/YYYY"
                                            placeholderTextColor="#94A3B8"
                                            style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Form Card 2: Contact Details */}
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 10, elevation: 1 }}>
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Contact & Address Details</Text>

                            {/* Home Address Input */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Home Address:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="location-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={address}
                                        onChangeText={setAddress}
                                        placeholder="Enter residential address..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>

                            {/* State / LGA Input */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>State / LGA:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="map-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={state}
                                        onChangeText={setState}
                                        placeholder="e.g. Kano, Kano State"
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>

                            {/* Phone Input */}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Phone Number:</Text>
                                <View style={{ height: 38, backgroundColor: isPhoneLocked ? L.bg : L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="call-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={phone}
                                        onChangeText={setPhone}
                                        editable={!isPhoneLocked}
                                        placeholder="Enter phone number..."
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="phone-pad"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                    {isPhoneLocked && <Ionicons name="lock-closed" size={14} color={L.textMuted} />}
                                </View>
                            </View>

                            {/* Email Address (Locked) */}
                            <View>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Email Address (Verified):</Text>
                                <View style={{ height: 38, backgroundColor: L.bg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="mail-outline" size={14} color={L.textMuted} />
                                    <Text style={{ flex: 1, color: L.textMuted, fontSize: 10, fontWeight: '600' }}>{email}</Text>
                                    <Ionicons name="checkmark-circle" size={14} color={L.emerald} />
                                </View>
                            </View>
                        </View>

                        {/* Form Card 3: Next of Kin */}
                        <View style={{ backgroundColor: L.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: L.inputBorder, marginBottom: 12, elevation: 1 }}>
                            <Text style={{ color: L.navyHeader, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Next of Kin Information</Text>

                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Next of Kin Full Name:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="people-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={nextOfKinName}
                                        onChangeText={setNextOfKinName}
                                        placeholder="Enter next of kin name..."
                                        placeholderTextColor="#94A3B8"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>

                            <View>
                                <Text style={{ color: L.textSecondary, fontSize: 8.5, fontWeight: 'bold', marginBottom: 3 }}>Next of Kin Phone Number:</Text>
                                <View style={{ height: 38, backgroundColor: L.inputBg, borderRadius: 8, borderWidth: 1, borderColor: L.inputBorder, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="call-outline" size={14} color={L.navyHeader} />
                                    <TextInput
                                        value={nextOfKinPhone}
                                        onChangeText={setNextOfKinPhone}
                                        placeholder="Enter next of kin phone..."
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="phone-pad"
                                        style={{ flex: 1, color: L.textPrimary, fontSize: 10, fontWeight: '600' }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Save Changes Button */}
                        <TouchableOpacity 
                            onPress={handleSave}
                            disabled={saving}
                            style={{ height: 40, backgroundColor: L.navyHeader, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: L.gold }}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={L.gold} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={16} color={L.gold} />
                                    <Text style={{ color: L.gold, fontWeight: '900', fontSize: 10, textTransform: 'uppercase' }}>Save Profile Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>

                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}
