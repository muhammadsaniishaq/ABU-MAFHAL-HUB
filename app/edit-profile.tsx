import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function EditProfileScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Profile Data
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [customId, setCustomId] = useState(''); 
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // Logic States
    const [isPhoneLocked, setIsPhoneLocked] = useState(false);
    
    // New Fields
    const [address, setAddress] = useState('');
    const [gender, setGender] = useState('');
    const [dob, setDob] = useState(''); // YYYY-MM-DD
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
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (data) {
                    setFullName(data.full_name || '');
                    setUsername(data.username || '');
                    setEmail(data.email || user.email || '');
                    setPhone(data.phone || '');
                     // Lock phone if it exists
                    if (data.phone && data.phone.length > 5) {
                        setIsPhoneLocked(true);
                    } else {
                        setIsPhoneLocked(false);
                    }

                    setCustomId(data.custom_id || 'ID-PENDING');
                    setAvatarUrl(data.avatar_url || null);
                    
                    // Load new fields if they exist
                    setAddress(data.address || '');
                    setGender(data.gender || '');
                    setDob(data.dob || '');
                    setState(data.state || '');
                    setNextOfKinName(data.next_of_kin_name || '');
                    setNextOfKinPhone(data.next_of_kin_phone || '');
                }
            }
        } catch (error) {
            console.log('Error fetching', error);
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

        if (!result.canceled) {
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
            const { data, error } = await supabase
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

            // Update profile with new avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            setAvatarUrl(publicUrl);
            Alert.alert("Success", "Profile photo updated!");

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
            if (!user) throw new Error('No user');

            // Note: Ensure these columns exist in your Supabase 'profiles' table
            const updates = {
                full_name: fullName,
                username: username,
                phone: phone, // Save phone (if it was editable)
                address: address,
                gender: gender,
                dob: dob,
                state: state,
                next_of_kin_name: nextOfKinName,
                next_of_kin_phone: nextOfKinPhone,
                updated_at: new Date(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert("Success", "Profile details updated!");
            
            // If phone was empty and now set, lock it
            if (!isPhoneLocked && phone.length > 5) {
                setIsPhoneLocked(true);
            }

            // router.back(); // Optional: Stay on page to see changes
        } catch (error: any) {
            let errorMessage = error.message;

            // Handle duplicate unique constraints (Postgres error 23505)
            if (error.message.includes('profiles_username_key') || error.message.includes('username')) {
                errorMessage = "This Username is already taken. Please choose another one.";
            } else if (error.message.includes('profiles_phone_key') || error.message.includes('phone')) {
                errorMessage = "This Phone Number is already linked to another account.";
            } else if (error.message.includes('profiles_email_key') || error.message.includes('email')) {
                errorMessage = "This Email is already in use.";
            }

            Alert.alert("Update Failed", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator size="large" color="#4f46e5" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar style="dark" />

            {/* HEADER */}
            <View className="bg-[#0d1b3e] pt-12 pb-5 px-6 border-b border-[#0d1b3e] shadow-sm flex-row items-center justify-between">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full border border-white/20">
                    <Ionicons name="arrow-back" size={20} color="#ffffff" />
                </TouchableOpacity>
                <Text className="text-lg font-black text-white tracking-wide">Edit Profile</Text>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                
                {/* AVATAR SECTION */}
                <View className="items-center mb-8">
                    <View className="relative">
                        {avatarUrl ? (
                            <Image 
                                source={{ uri: avatarUrl }} 
                                className="w-24 h-24 rounded-full border-2 border-[#f5a623]"
                            />
                        ) : (
                            <LinearGradient
                                colors={['#f5a623', '#d97706']}
                                className="w-24 h-24 rounded-full items-center justify-center"
                            >
                                <Text className="text-3xl font-black text-[#0d1b3e]">{fullName.charAt(0) || 'U'}</Text>
                            </LinearGradient>
                        )}
                        
                        <TouchableOpacity 
                            onPress={pickImage}
                            className="absolute bottom-0 right-0 bg-[#f5a623] p-1.5 rounded-full border-2 border-white shadow-sm"
                        >
                            <Ionicons name="camera" size={16} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                    <Text className="mt-3 text-slate-400 font-semibold text-[9px] uppercase tracking-widest bg-[#0d1b3e]/5 px-3 py-1 rounded-full border border-[#0d1b3e]/10">ID: {customId}</Text>
                </View>

                {/* FORM FIELDS */}
                <View className="gap-y-4">
                    
                    {/* Basic Info */}
                    <View>
                        <Text className="text-[#0d1b3e] font-black tracking-widest text-[9px] uppercase mb-3 ml-1">Basic Information</Text>
                        
                        <View className="gap-y-2.5">
                            <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Username</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="at" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="Set a username"
                                    />
                                </View>
                            </View>

                            <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Full Name</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="person-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={fullName}
                                        onChangeText={setFullName}
                                        placeholder="Your Name"
                                    />
                                </View>
                            </View>

                             <View className="flex-row gap-x-4">
                                <View className="flex-1">
                                    <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Gender</Text>
                                    <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                        <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="male-female-outline" size={14} color="#0d1b3e" /></View>
                                        <TextInput
                                            className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                            value={gender}
                                            onChangeText={setGender}
                                            placeholder="M/F"
                                        />
                                    </View>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Date of Birth</Text>
                                    <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                        <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="calendar-outline" size={14} color="#0d1b3e" /></View>
                                        <TextInput
                                            className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                            value={dob}
                                            onChangeText={setDob}
                                            placeholder="DD/MM/YYYY"
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Contact Info */}
                    <View>
                        <Text className="text-[#0d1b3e] font-black tracking-widest text-[9px] uppercase mb-3 ml-1 mt-4">Contact Details</Text>
                        
                        <View className="gap-y-2.5">
                             <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Home Address</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="location-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={address}
                                        onChangeText={setAddress}
                                        placeholder="Enter your address"
                                    />
                                </View>
                            </View>

                             <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">State / LGA</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="map-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={state}
                                        onChangeText={setState}
                                        placeholder="e.g. Gshua, Yobe State"
                                    />
                                </View>
                            </View>
                            
                            {/* SMART PHONE INPUT */}
                            <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Phone Number</Text>
                                <View className={`flex-row items-center border rounded-xl px-3 h-11 ${isPhoneLocked ? 'bg-slate-100 border-slate-200 opacity-80' : 'bg-white border-slate-200 shadow-sm'}`}>
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="call-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className={`flex-1 ml-3 font-medium text-xs ${isPhoneLocked ? 'text-slate-500' : 'text-slate-800'}`}
                                        value={phone}
                                        onChangeText={setPhone}
                                        editable={!isPhoneLocked}
                                        placeholder="Enter Phone Number"
                                        keyboardType="phone-pad"
                                    />
                                    {isPhoneLocked ? (
                                        <Ionicons name="lock-closed" size={16} color="#cbd5e1" />
                                    ) : (
                                        <Ionicons name="pencil" size={16} color="#64748b" />
                                    )}
                                </View>
                                {!isPhoneLocked && (
                                    <Text className="text-xs text-indigo-500 mt-1 ml-1">Enter your phone number to lock it to your account.</Text>
                                )}
                            </View>

                            <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Email (Linked)</Text>
                                <View className="flex-row items-center bg-slate-100 border border-[#0d1b3e]/10 rounded-xl px-3 h-11 opacity-70">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="mail-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-slate-500 font-medium text-xs"
                                        value={email}
                                        editable={false}
                                    />
                                    <Ionicons name="lock-closed" size={16} color="#cbd5e1" />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Next of Kin */}
                    <View>
                        <Text className="text-[#0d1b3e] font-black tracking-widest text-[9px] uppercase mb-3 ml-1 mt-4">Next of Kin</Text>
                        
                        <View className="gap-y-2.5">
                             <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Full Name</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="people-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={nextOfKinName}
                                        onChangeText={setNextOfKinName}
                                        placeholder="Next of Kin Name"
                                    />
                                </View>
                            </View>

                             <View>
                                <Text className="text-[#0d1b3e] font-bold text-[9px] uppercase mb-1 tracking-wider ml-2">Phone Number</Text>
                                <View className="flex-row items-center bg-white border border-[#0d1b3e]/10 rounded-xl px-3 h-11 shadow-sm">
                                    <View className="w-7 h-7 rounded-md bg-[#0d1b3e]/5 items-center justify-center"><Ionicons name="call-outline" size={14} color="#0d1b3e" /></View>
                                    <TextInput
                                        className="flex-1 ml-3 text-[#0d1b3e] font-bold text-xs"
                                        value={nextOfKinPhone}
                                        onChangeText={setNextOfKinPhone}
                                        placeholder="Next of Kin Phone"
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>

                </View>

                {/* SAVE BUTTON */}
                <View className="items-center mt-6 mb-8">
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        className="w-[90%]"
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#0d1b3e', '#1a2951']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="h-12 rounded-xl flex-row items-center justify-center shadow-lg shadow-[#0d1b3e]/30"
                        >
                             {saving ? (
                                <ActivityIndicator color="#f5a623" size="small" />
                            ) : (
                                <>
                                    <View className="w-6 h-6 rounded-full bg-[#f5a623]/15 items-center justify-center mr-2">
                                        <Ionicons name="save-outline" size={14} color="#f5a623" />
                                    </View>
                                    <Text className="text-[#f5a623] font-black text-xs tracking-widest uppercase">Save Updates</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}




