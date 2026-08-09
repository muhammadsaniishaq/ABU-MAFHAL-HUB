import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Switch, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { supabase } from '../../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';

const AVAILABLE_PLACEMENTS = ['dashboard', 'airtime', 'data', 'bills', 'transfer', 'education', 'smile', 'cac', 'nin_bvn', 'social_boost', 'crypto', 'qr_pay', 'wallet', 'services'];

export default function ContentManager() {
    const [banners, setBanners] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newTargetUrl, setNewTargetUrl] = useState('');
    const [newPlacements, setNewPlacements] = useState<string[]>(['dashboard']);
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [newPartnerLogo, setNewPartnerLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
    const [existingPartnerLogoUrl, setExistingPartnerLogoUrl] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'banners' | 'partners' | 'announcements' | 'settings'>('banners');
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementUrl, setAnnouncementUrl] = useState('');
    const [announcementType, setAnnouncementType] = useState<'image' | 'video'>('image');
    const [announcementActive, setAnnouncementActive] = useState(false);
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);
    const [uploadingAnnouncement, setUploadingAnnouncement] = useState(false);

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        fetchBanners();
        fetchPartners();
        fetchAnnouncement();
    }, []);

    const fetchPartners = async () => {
        try {
            const { data } = await supabase.from('partners').select('*').order('sort_order', { ascending: true });
            if (data) setPartners(data);
        } catch (e) {}
    };

    const fetchAnnouncement = async () => {
        const { data } = await supabase.from('app_settings').select('key, value').in('key', ['global_announcement', 'maintenance_mode']);
        if (data) {
            data.forEach(setting => {
                if (setting.key === 'global_announcement' && setting.value) {
                    try {
                        const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
                        setAnnouncementText(parsed.text || '');
                        setAnnouncementUrl(parsed.mediaUrl || '');
                        setAnnouncementType(parsed.mediaType || 'image');
                        setAnnouncementActive(!!parsed.isActive);
                    } catch (e) {
                        console.log(e);
                    }
                }
                if (setting.key === 'maintenance_mode') {
                    setMaintenanceMode(setting.value === 'true' || setting.value === true);
                }
            });
        }
    };

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
            if (data) setBanners(data);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const pickPartnerLogo = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            setNewPartnerLogo(result.assets[0]);
        }
    };

    const pickAnnouncementMedia = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                return Alert.alert("Permission Required", "Please allow gallery access to upload banner media.");
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                quality: 0.85,
                base64: true,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                setUploadingAnnouncement(true);

                const isVideo = asset.type === 'video';
                const fileExt = asset.uri.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
                const fileName = `announcement_${Date.now()}.${fileExt}`;

                let blob: Blob;
                if (asset.base64) {
                    blob = new Blob([decode(asset.base64)], { type: isVideo ? 'video/mp4' : 'image/jpeg' });
                } else {
                    const r = await fetch(asset.uri);
                    blob = await r.blob();
                }

                const { error: uploadErr } = await supabase.storage
                    .from('public-assets')
                    .upload(`announcements/${fileName}`, blob, {
                        contentType: isVideo ? 'video/mp4' : 'image/jpeg',
                        upsert: true
                    });

                if (uploadErr) {
                    setUploadingAnnouncement(false);
                    return Alert.alert("Upload Failed", uploadErr.message);
                }

                const { data: publicUrlData } = supabase.storage
                    .from('public-assets')
                    .getPublicUrl(`announcements/${fileName}`);

                if (publicUrlData?.publicUrl) {
                    setAnnouncementType(isVideo ? 'video' : 'image');
                    setAnnouncementUrl(publicUrlData.publicUrl);
                    Alert.alert("Uploaded 🎉", "Banner media uploaded successfully!");
                }
            }
        } catch (err: any) {
            Alert.alert("Media Error", err.message || "Failed to select media");
        } finally {
            setUploadingAnnouncement(false);
        }
    };

    const savePartner = async () => {
        if (!newPartnerName.trim()) return Alert.alert("Required", "Please enter partner name");
        if (!newPartnerLogo && !existingPartnerLogoUrl) return Alert.alert("Required", "Please select a partner logo");

        setUploading(true);
        try {
            let logoUrl = existingPartnerLogoUrl;

            if (newPartnerLogo) {
                const fileExt = newPartnerLogo.uri.split('.').pop() || 'png';
                const fileName = `partner_${Date.now()}.${fileExt}`;
                
                let blob: Blob;
                if (newPartnerLogo.base64) {
                    blob = new Blob([decode(newPartnerLogo.base64)], { type: 'image/png' });
                } else {
                    const res = await fetch(newPartnerLogo.uri);
                    blob = await res.blob();
                }

                const { error: uploadError } = await supabase.storage
                    .from('public-assets')
                    .upload(`partners/${fileName}`, blob, { contentType: 'image/png', upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('public-assets')
                    .getPublicUrl(`partners/${fileName}`);

                logoUrl = publicUrlData.publicUrl;
            }

            if (editingPartnerId) {
                const { error } = await supabase
                    .from('partners')
                    .update({
                        name: newPartnerName.trim(),
                        logo_url: logoUrl,
                    })
                    .eq('id', editingPartnerId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('partners')
                    .insert({
                        name: newPartnerName.trim(),
                        logo_url: logoUrl,
                        sort_order: partners.length + 1,
                        is_active: true
                    });
                if (error) throw error;
            }

            fetchPartners();
            closePartnerModal();
        } catch (err: any) {
            Alert.alert("Failed", err.message);
        } finally {
            setUploading(false);
        }
    };

    const deletePartner = async (id: string) => {
        Alert.alert("Delete Partner", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await supabase.from('partners').delete().eq('id', id);
                    fetchPartners();
                }
            }
        ]);
    };

    const saveBanner = async () => {
        if (!selectedImage && !existingImageUrl) return Alert.alert("Error", "Please select an image");

        setUploading(true);
        try {
            let publicUrl = existingImageUrl;

            if (selectedImage) {
                const fileExt = selectedImage.uri.split('.').pop() || 'jpg';
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `banners/${fileName}`;

                let blob: Blob;
                if (selectedImage.base64) {
                    blob = new Blob([decode(selectedImage.base64)], { type: `image/${fileExt}` });
                } else {
                    const response = await fetch(selectedImage.uri);
                    blob = await response.blob();
                }

                const { error: uploadError } = await supabase.storage
                    .from('public-assets')
                    .upload(filePath, blob, { contentType: `image/${fileExt}`, upsert: true });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('public-assets')
                    .getPublicUrl(filePath);

                publicUrl = urlData.publicUrl;
            }

            if (editingBannerId) {
                const { error } = await supabase
                    .from('banners')
                    .update({
                        title: newTitle,
                        image_url: publicUrl,
                        target_url: newTargetUrl,
                        placement: newPlacements.join(',')
                    })
                    .eq('id', editingBannerId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('banners')
                    .insert({
                        title: newTitle,
                        image_url: publicUrl,
                        target_url: newTargetUrl,
                        placement: newPlacements.join(','),
                        is_active: true
                    });
                if (error) throw error;
            }

            fetchBanners();
            closeModal();
        } catch (err: any) { Alert.alert("Failed", err.message); } 
        finally { setUploading(false); }
    };

    const openEditPartnerModal = (partner: any) => {
        setEditingPartnerId(partner.id);
        setNewPartnerName(partner.name);
        setExistingPartnerLogoUrl(partner.logo_url);
        setNewPartnerLogo(null);
        setShowPartnerModal(true);
    };

    const closePartnerModal = () => {
        setShowPartnerModal(false);
        setEditingPartnerId(null);
        setNewPartnerName('');
        setNewPartnerLogo(null);
        setExistingPartnerLogoUrl(null);
    };

    const openEditModal = (banner: any) => {
        setEditingBannerId(banner.id);
        setNewTitle(banner.title || '');
        setNewTargetUrl(banner.target_url || '');
        setNewPlacements(banner.placement ? banner.placement.split(',') : ['dashboard']);
        setExistingImageUrl(banner.image_url);
        setSelectedImage(null);
        setShowModal(true);
    };

    const togglePlacement = (placement: string) => {
        if (newPlacements.includes(placement)) {
            if (newPlacements.length > 1) {
                setNewPlacements(newPlacements.filter(p => p !== placement));
            } else {
                Alert.alert("Notice", "Banner must have at least one placement destination.");
            }
        } else {
            setNewPlacements([...newPlacements, placement]);
        }
    };

    const toggleSelectAllPlacements = () => {
        if (newPlacements.length === AVAILABLE_PLACEMENTS.length) {
            setNewPlacements(['dashboard']);
        } else {
            setNewPlacements([...AVAILABLE_PLACEMENTS]);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBannerId(null);
        setNewTitle('');
        setNewTargetUrl('');
        setNewPlacements(['dashboard']);
        setSelectedImage(null);
        setExistingImageUrl(null);
    };

    const toggleBanner = async (id: string, currentStatus: boolean) => {
        try {
            await supabase.from('banners').update({ is_active: !currentStatus }).eq('id', id);
            fetchBanners();
        } catch (e) {}
    };

    const deleteBanner = async (id: string) => {
        Alert.alert("Delete Banner", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await supabase.from('banners').delete().eq('id', id);
                    fetchBanners();
                }
            }
        ]);
    };

    const saveAnnouncement = async () => {
        setSavingAnnouncement(true);
        try {
            await supabase.from('app_settings').upsert({
                key: 'global_announcement',
                value: { 
                    text: announcementText, 
                    mediaUrl: announcementUrl,
                    mediaType: announcementType,
                    isActive: announcementActive 
                },
                description: 'Global Popup Announcement'
            });
            Alert.alert("Success 🎉", "Global Announcement saved successfully!");
        } catch (e: any) { Alert.alert("Error", e.message); } 
        finally { setSavingAnnouncement(false); }
    };

    const toggleMaintenanceMode = async (value: boolean) => {
        setMaintenanceMode(value);
        setSavingSettings(true);
        try {
            await supabase.from('app_settings').upsert({ key: 'maintenance_mode', value: String(value), description: 'Put app in maintenance mode' });
        } catch(e) {} 
        finally { setSavingSettings(false); }
    };

    if (loading) return (
        <View className="flex-1 items-center justify-center bg-slate-100">
            <ActivityIndicator size="large" color="#0D1B3E" />
        </View>
    );

    return (
        <View className="flex-1 bg-slate-100">
            <Stack.Screen options={{ 
                title: 'Content Manager', 
                headerStyle: { backgroundColor: '#0D1B3E' },
                headerTintColor: '#F5A623',
                headerTitleStyle: { fontWeight: 'bold' }
            }} />

            {/* Custom Tab Bar */}
            <View className="flex-row bg-[#0D1B3E] p-1.5 border-b border-slate-800">
                <TouchableOpacity 
                    onPress={() => setActiveTab('banners')}
                    className={`flex-1 py-2.5 items-center justify-center rounded-xl flex-row gap-1.5 ${activeTab === 'banners' ? 'bg-[#F5A623]' : 'bg-transparent'}`}
                >
                    <Ionicons name="images" size={14} color={activeTab === 'banners' ? '#0D1B3E' : '#94A3B8'} />
                    <Text className={`text-xs font-bold ${activeTab === 'banners' ? 'text-[#0D1B3E]' : 'text-slate-400'}`}>Banners</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('partners')}
                    className={`flex-1 py-2.5 items-center justify-center rounded-xl flex-row gap-1.5 ${activeTab === 'partners' ? 'bg-[#F5A623]' : 'bg-transparent'}`}
                >
                    <Ionicons name="briefcase" size={14} color={activeTab === 'partners' ? '#0D1B3E' : '#94A3B8'} />
                    <Text className={`text-xs font-bold ${activeTab === 'partners' ? 'text-[#0D1B3E]' : 'text-slate-400'}`}>Partners</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('announcements')}
                    className={`flex-1 py-2.5 items-center justify-center rounded-xl flex-row gap-1.5 ${activeTab === 'announcements' ? 'bg-[#F5A623]' : 'bg-transparent'}`}
                >
                    <Ionicons name="megaphone" size={14} color={activeTab === 'announcements' ? '#0D1B3E' : '#94A3B8'} />
                    <Text className={`text-xs font-bold ${activeTab === 'announcements' ? 'text-[#0D1B3E]' : 'text-slate-400'}`}>Alerts</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('settings')}
                    className={`flex-1 py-2.5 items-center justify-center rounded-xl flex-row gap-1.5 ${activeTab === 'settings' ? 'bg-[#F5A623]' : 'bg-transparent'}`}
                >
                    <Ionicons name="settings" size={14} color={activeTab === 'settings' ? '#0D1B3E' : '#94A3B8'} />
                    <Text className={`text-xs font-bold ${activeTab === 'settings' ? 'text-[#0D1B3E]' : 'text-slate-400'}`}>Config</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* --- BANNERS TAB --- */}
                {activeTab === 'banners' && (
                    <View>
                        <TouchableOpacity 
                            onPress={() => setShowModal(true)} 
                            className="bg-[#0D1B3E] p-4 rounded-2xl flex-row items-center justify-center mb-4 shadow-sm border border-slate-800"
                        >
                            <Ionicons name="add-circle" size={20} color="#F5A623" />
                            <Text className="text-white font-bold text-sm ml-2">Add New Banner</Text>
                        </TouchableOpacity>

                        {banners.map((b) => (
                            <View key={b.id} className="bg-white rounded-2xl mb-4 overflow-hidden border border-slate-200 shadow-sm">
                                <Image source={{ uri: b.image_url }} className="w-full h-36 bg-slate-200" resizeMode="cover" />
                                <View className="p-4 flex-row items-center justify-between bg-white">
                                    <View className="flex-1 mr-2">
                                        <Text className="font-bold text-sm text-[#0D1B3E]" numberOfLines={1}>{b.title || 'Untitled Banner'}</Text>
                                        <Text className="text-xs text-[#2563EB] font-bold mt-0.5">Destinations: {b.placement || 'dashboard'}</Text>
                                        {b.target_url ? <Text className="text-xs text-slate-500 font-mono mt-0.5" numberOfLines={1}>Link: {b.target_url}</Text> : null}
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity onPress={() => openEditModal(b)} className="p-2 bg-slate-100 rounded-lg">
                                            <Ionicons name="pencil" size={16} color="#2563EB" />
                                        </TouchableOpacity>
                                        <Switch value={b.is_active} onValueChange={() => toggleBanner(b.id, b.is_active)} />
                                        <TouchableOpacity onPress={() => deleteBanner(b.id)} className="p-2 bg-red-50 rounded-lg">
                                            <Ionicons name="trash" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* --- PARTNERS TAB --- */}
                {activeTab === 'partners' && (
                    <View>
                        <TouchableOpacity 
                            onPress={() => setShowPartnerModal(true)} 
                            className="bg-[#0D1B3E] p-4 rounded-2xl flex-row items-center justify-center mb-4 shadow-sm border border-slate-800"
                        >
                            <Ionicons name="add-circle" size={20} color="#F5A623" />
                            <Text className="text-white font-bold text-sm ml-2">Add New Partner Logo</Text>
                        </TouchableOpacity>

                        <View className="flex-row flex-wrap justify-between">
                            {partners.map((p) => (
                                <View key={p.id} className="w-[48%] bg-white rounded-2xl p-4 mb-4 border border-slate-200 shadow-sm items-center relative">
                                    <View className="w-16 h-16 bg-slate-50 rounded-xl items-center justify-center mb-2 border border-slate-100 p-2">
                                        <Image source={{ uri: p.logo_url }} className="w-full h-full" resizeMode="contain" />
                                    </View>
                                    <Text className="font-bold text-xs text-[#0D1B3E] text-center mb-3" numberOfLines={1}>{p.name}</Text>

                                    <View className="flex-row items-center gap-2">
                                        <TouchableOpacity onPress={() => openEditPartnerModal(p)} className="p-2 bg-slate-100 rounded-lg flex-row items-center gap-1">
                                            <Ionicons name="pencil" size={14} color="#2563EB" />
                                            <Text className="text-xs text-[#2563EB] font-bold">Edit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => deletePartner(p.id)} className="p-2 bg-red-50 rounded-lg">
                                            <Ionicons name="trash" size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* --- ANNOUNCEMENTS TAB --- */}
                {activeTab === 'announcements' && (
                    <View className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200">
                        <View className="flex-row items-center justify-between mb-5 border-b border-slate-100 pb-4">
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3 border border-blue-200">
                                    <Ionicons name="megaphone" size={18} color="#2563EB" />
                                </View>
                                <View>
                                    <Text className="font-bold text-base text-[#0D1B3E]">Global Announcement</Text>
                                    <Text className="text-xs text-slate-500 font-medium">Show banner popup to all users on app launch</Text>
                                </View>
                            </View>
                            <Switch value={announcementActive} onValueChange={setAnnouncementActive} />
                        </View>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Announcement Message Text</Text>
                        <TextInput
                            placeholder="Type your announcement message here..."
                            placeholderTextColor="#94A3B8"
                            value={announcementText}
                            onChangeText={setAnnouncementText}
                            multiline
                            className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm min-h-[100px] mb-4 text-[#0D1B3E] font-medium"
                            textAlignVertical="top"
                        />

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Banner Media (Image / Video URL or Upload)</Text>
                        <View className="flex-row items-center gap-2 mb-4">
                            <TextInput
                                placeholder="https://... or tap upload button ->"
                                placeholderTextColor="#94A3B8"
                                value={announcementUrl}
                                onChangeText={setAnnouncementUrl}
                                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-mono text-[#0D1B3E]"
                            />
                            <TouchableOpacity 
                                onPress={pickAnnouncementMedia}
                                disabled={uploadingAnnouncement}
                                className="bg-indigo-600 px-4 py-3 rounded-xl flex-row items-center justify-center shadow-sm"
                            >
                                {uploadingAnnouncement ? (
                                    <ActivityIndicator size="small" color="#F5A623" />
                                ) : (
                                    <Ionicons name="cloud-upload" size={18} color="#ffffff" />
                                )}
                            </TouchableOpacity>
                        </View>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Media Type</Text>
                        <View className="flex-row gap-3 mb-4">
                            <TouchableOpacity 
                                onPress={() => setAnnouncementType('image')} 
                                className={`flex-1 py-2.5 rounded-xl border flex-row items-center justify-center gap-2 ${announcementType === 'image' ? 'bg-[#0D1B3E] border-[#0D1B3E]' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Ionicons name="image" size={16} color={announcementType === 'image' ? '#ffffff' : '#64748b'} />
                                <Text className={`font-bold text-xs ${announcementType === 'image' ? 'text-white' : 'text-slate-600'}`}>Image Banner</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setAnnouncementType('video')} 
                                className={`flex-1 py-2.5 rounded-xl border flex-row items-center justify-center gap-2 ${announcementType === 'video' ? 'bg-[#0D1B3E] border-[#0D1B3E]' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Ionicons name="videocam" size={16} color={announcementType === 'video' ? '#ffffff' : '#64748b'} />
                                <Text className={`font-bold text-xs ${announcementType === 'video' ? 'text-white' : 'text-slate-600'}`}>Video Banner</Text>
                            </TouchableOpacity>
                        </View>

                        {/* RECOMMENDED SPECIFICATIONS GUIDE */}
                        <View className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl mb-4">
                            <View className="flex-row items-center gap-1.5 mb-1">
                                <Ionicons name="information-circle" size={16} color="#d97706" />
                                <Text className="font-bold text-xs text-amber-800 uppercase tracking-wide">Recommended Sleek Banner Dimensions</Text>
                            </View>
                            <Text className="text-xs text-amber-900 leading-4 font-medium">
                                • <Text className="font-bold">Recommended Resolution:</Text> 1200 x 480 px (or 1080 x 430 px){'\n'}
                                • <Text className="font-bold">Aspect Ratio:</Text> 2.5 : 1 (Sleek Wide Landscape Banner){'\n'}
                                • <Text className="font-bold">Format:</Text> High quality JPG, PNG, or WEBP (Under 2 MB)
                            </Text>
                        </View>

                        {/* LIVE CROPPED BANNER PREVIEW */}
                        {announcementUrl ? (
                            <View className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 mb-5">
                                <View className="h-32 bg-slate-800 overflow-hidden">
                                    <Image 
                                        source={{ uri: announcementUrl }} 
                                        className="w-full h-full" 
                                        resizeMode="cover" 
                                    />
                                </View>
                                <View className="p-3 items-center">
                                    <Text className="text-amber-400 font-extrabold text-xs uppercase tracking-wider">Sleek Cropped Banner Preview (180px Display) ✨</Text>
                                    {announcementText ? (
                                        <Text className="text-white font-medium text-xs mt-1 text-center" numberOfLines={2}>
                                            {announcementText}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ) : null}

                        <TouchableOpacity onPress={saveAnnouncement} className="bg-[#0D1B3E] py-3.5 rounded-xl items-center flex-row justify-center shadow-sm">
                            {savingAnnouncement ? <ActivityIndicator size="small" color="#F5A623" /> : (
                                <>
                                    <Ionicons name="save" size={16} color="#F5A623" />
                                    <Text className="text-white font-bold text-sm ml-2">Save Announcement</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* --- SETTINGS --- */}
                {activeTab === 'settings' && (
                    <View className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200">
                        <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3 border border-red-200">
                                    <Ionicons name="build" size={18} color="#DC2626" />
                                </View>
                                <View>
                                    <Text className="font-bold text-base text-[#0D1B3E]">Maintenance Mode</Text>
                                    <Text className="text-xs text-slate-500 font-medium">Lock down the entire app</Text>
                                </View>
                            </View>
                            <Switch value={maintenanceMode} onValueChange={toggleMaintenanceMode} trackColor={{ true: '#EF4444' }} />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* BANNERS MODAL */}
            <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-slate-50">
                    <View className="flex-row items-center justify-between p-5 border-b border-slate-200 bg-white z-10 shadow-sm">
                        <TouchableOpacity onPress={closeModal} className="p-1"><Text className="text-slate-500 font-bold text-sm">Cancel</Text></TouchableOpacity>
                        <Text className="font-black text-[#0D1B3E] text-lg">{editingBannerId ? 'Edit Banner' : 'New Banner'}</Text>
                        <TouchableOpacity onPress={saveBanner} className="bg-[#0D1B3E] px-4 py-2 rounded-full">
                            {uploading ? <ActivityIndicator size="small" color="#F5A623" /> : <Text className="text-white font-bold text-xs uppercase tracking-wider">Save</Text>}
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                        <TouchableOpacity onPress={pickImage} className="h-32 bg-white rounded-2xl border-2 border-slate-300 items-center justify-center mb-6 border-dashed overflow-hidden">
                            {selectedImage ? (
                                <Image source={{ uri: selectedImage.uri }} className="w-full h-full" resizeMode="cover" />
                            ) : existingImageUrl ? (
                                <Image source={{ uri: existingImageUrl }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Ionicons name="cloud-upload" size={28} color="#94A3B8" />
                                    <Text className="text-slate-500 font-bold text-xs mt-1">Tap to select banner image</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Banner Title</Text>
                        <TextInput
                            placeholder="e.g. Special Discount Offer"
                            placeholderTextColor="#94A3B8"
                            value={newTitle}
                            onChangeText={setNewTitle}
                            className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm mb-4 text-[#0D1B3E]"
                        />

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Target Route / URL (Optional)</Text>
                        <TextInput
                            placeholder="e.g. /data or https://example.com"
                            placeholderTextColor="#94A3B8"
                            value={newTargetUrl}
                            onChangeText={setNewTargetUrl}
                            className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm mb-4 text-[#0D1B3E]"
                        />

                        <View className="flex-row items-center justify-between mb-2 ml-1">
                            <Text className="font-bold text-xs text-[#0D1B3E]">Display Placements</Text>
                            <TouchableOpacity onPress={toggleSelectAllPlacements}>
                                <Text className="text-xs font-bold text-[#2563EB]">
                                    {newPlacements.length === AVAILABLE_PLACEMENTS.length ? 'Deselect All' : 'Select All'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {AVAILABLE_PLACEMENTS.map((p) => {
                                const isSelected = newPlacements.includes(p);
                                return (
                                    <TouchableOpacity 
                                        key={p} 
                                        onPress={() => togglePlacement(p)}
                                        className={`px-3 py-2 rounded-xl border ${isSelected ? 'bg-[#0D1B3E] border-[#0D1B3E]' : 'bg-white border-slate-300'}`}
                                    >
                                        <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-600'}`}>{p}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* PARTNER MODAL */}
            <Modal visible={showPartnerModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-slate-50">
                    <View className="flex-row items-center justify-between p-5 border-b border-slate-200 bg-white z-10 shadow-sm">
                        <TouchableOpacity onPress={closePartnerModal} className="p-1"><Text className="text-slate-500 font-bold text-sm">Cancel</Text></TouchableOpacity>
                        <Text className="font-black text-[#0D1B3E] text-lg">{editingPartnerId ? 'Edit Partner' : 'New Partner'}</Text>
                        <TouchableOpacity onPress={savePartner} className="bg-[#0D1B3E] px-4 py-2 rounded-full">
                            {uploading ? <ActivityIndicator size="small" color="#F5A623" /> : <Text className="text-white font-bold text-xs uppercase tracking-wider">Save</Text>}
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="p-5">
                        <TouchableOpacity onPress={pickPartnerLogo} className="h-32 bg-white rounded-2xl border-2 border-slate-300 items-center justify-center mb-6 border-dashed overflow-hidden">
                            {newPartnerLogo ? (
                                <Image source={{ uri: newPartnerLogo.uri }} className="w-20 h-20" resizeMode="contain" />
                            ) : existingPartnerLogoUrl ? (
                                <Image source={{ uri: existingPartnerLogoUrl }} className="w-20 h-20" resizeMode="contain" />
                            ) : (
                                <View className="items-center">
                                    <Ionicons name="cloud-upload" size={28} color="#94A3B8" />
                                    <Text className="text-slate-500 font-bold text-xs mt-1">Tap to select partner logo (1:1)</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Partner Name</Text>
                        <TextInput
                            placeholder="e.g. MTN Nigeria"
                            placeholderTextColor="#94A3B8"
                            value={newPartnerName}
                            onChangeText={setNewPartnerName}
                            className="bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm mb-4 text-[#0D1B3E]"
                        />
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}
