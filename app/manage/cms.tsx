import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Switch, ActivityIndicator, Modal, TextInput, Alert, StyleSheet, ScrollView } from 'react-native';
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

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newTargetUrl, setNewTargetUrl] = useState('');
    const [newPlacements, setNewPlacements] = useState<string[]>(['dashboard']);
    const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

    // Partner Modal state
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [partnerUploading, setPartnerUploading] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [selectedPartnerLogo, setSelectedPartnerLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
    const [existingPartnerLogoUrl, setExistingPartnerLogoUrl] = useState<string | null>(null);

    // Announcement state
    const [activeTab, setActiveTab] = useState<'banners' | 'partners' | 'announcements' | 'settings'>('banners');
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementActive, setAnnouncementActive] = useState(false);
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);

    // Settings state
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
            const { data, error } = await supabase
                .from('banners')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setBanners(data);
        } finally {
            setLoading(false);
        }
    };

    const toggleSwitch = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('banners')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) {
            setBanners(prev => prev.map(b =>
                b.id === id ? { ...b, is_active: !currentStatus } : b
            ));
        }
    };

    const deleteBanner = async (id: string) => {
        Alert.alert("Confirm Delete", "Are you sure you want to delete this banner?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive",
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (!error) {
                        setBanners(prev => prev.filter(b => b.id !== id));
                    } else {
                        Alert.alert("Error", error.message);
                    }
                }
            }
        ]);
    };

    const togglePartnerStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase.from('partners').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) setPartners(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    };

    const deletePartner = async (id: string) => {
        Alert.alert("Confirm Delete", "Delete this partner?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive",
                onPress: async () => {
                    const { error } = await supabase.from('partners').delete().eq('id', id);
                    if (!error) setPartners(prev => prev.filter(p => p.id !== id));
                }
            }
        ]);
    };

    const openPartnerModal = (partner?: any) => {
        if (partner) {
            setEditingPartnerId(partner.id);
            setNewPartnerName(partner.name || '');
            setExistingPartnerLogoUrl(partner.logo_url);
        } else {
            setEditingPartnerId(null);
            setNewPartnerName('');
            setExistingPartnerLogoUrl(null);
        }
        setSelectedPartnerLogo(null);
        setShowPartnerModal(true);
    };

    const closePartnerModal = () => {
        setShowPartnerModal(false);
    };

    const pickPartnerLogo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setSelectedPartnerLogo(result.assets[0]);
            setExistingPartnerLogoUrl(null);
        }
    };

    const savePartner = async () => {
        if (!newPartnerName.trim()) return Alert.alert("Error", "Enter a name");
        if (!selectedPartnerLogo && !existingPartnerLogoUrl) return Alert.alert("Error", "Select a logo");
        setPartnerUploading(true);
        try {
            let finalLogoUrl = existingPartnerLogoUrl;
            if (selectedPartnerLogo && selectedPartnerLogo.base64) {
                const ext = selectedPartnerLogo.uri.split('.').pop() || 'png';
                const fileName = `partner_${Date.now()}.${ext}`;
                const filePath = `${fileName}`; 
                const { error: uploadError } = await supabase.storage.from('partners').upload(filePath, decode(selectedPartnerLogo.base64), { contentType: `image/${ext}` });
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('partners').getPublicUrl(filePath);
                finalLogoUrl = publicUrl;
            }

            const payload = { name: newPartnerName, logo_url: finalLogoUrl, is_active: true };

            if (editingPartnerId) {
                const { data, error } = await supabase.from('partners').update(payload).eq('id', editingPartnerId).select().single();
                if (error) throw error;
                if (data) setPartners(prev => prev.map(p => p.id === editingPartnerId ? data : p));
            } else {
                const { data, error } = await supabase.from('partners').insert(payload).select().single();
                if (error) throw error;
                if (data) setPartners([...partners, data]);
            }
            closePartnerModal();
        } catch (e: any) {
            Alert.alert("Failed", e.message);
        } finally {
            setPartnerUploading(false);
        }
    };

    const openEditModal = (banner: any) => {
        setEditingBannerId(banner.id);
        setNewTitle(banner.title || '');
        setNewTargetUrl(banner.target_url || '');
        setExistingImageUrl(banner.image_url);
        setSelectedImage(null);
        
        if (banner.placement) {
            setNewPlacements(banner.placement.split(',').map((p: string) => p.trim()));
        } else {
            setNewPlacements(['dashboard']);
        }
        setShowModal(true);
    };

    const togglePlacement = (place: string) => {
        setNewPlacements(prev => {
            if (prev.includes(place)) {
                if (prev.length === 1) return prev; // prevent empty selection
                return prev.filter(p => p !== place);
            }
            return [...prev, place];
        });
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            setSelectedImage(result.assets[0]);
            setExistingImageUrl(null); // User picked a new image
        }
    };

    const saveBanner = async () => {
        if (!newTitle.trim()) return Alert.alert("Error", "Please enter a title");
        if (!selectedImage && !existingImageUrl) return Alert.alert("Error", "Please select an image");

        setUploading(true);
        try {
            let finalImageUrl = existingImageUrl;

            // Only upload a new image if the user selected one
            if (selectedImage && selectedImage.base64) {
                const ext = selectedImage.uri.split('.').pop() || 'jpg';
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                const filePath = `uploads/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('banners')
                    .upload(filePath, decode(selectedImage.base64), {
                        contentType: `image/${ext}`
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
                finalImageUrl = publicUrl;
            }

            const payload = {
                title: newTitle,
                image_url: finalImageUrl,
                target_url: newTargetUrl || null,
                placement: newPlacements.join(','),
                is_active: true
            };

            if (editingBannerId) {
                // Update existing
                const { data, error } = await supabase.from('banners').update(payload).eq('id', editingBannerId).select().single();
                if (error) throw error;
                if (data) {
                    setBanners(prev => prev.map(b => b.id === editingBannerId ? data : b));
                }
                Alert.alert("Success", "Banner updated!");
            } else {
                // Insert new
                const { data, error } = await supabase.from('banners').insert(payload).select().single();
                if (error) throw error;
                if (data) {
                    setBanners([data, ...banners]);
                }
                Alert.alert("Success", "Banner added!");
            }
            
            closeModal();
        } catch (err: any) {
            console.error("Save error:", err);
            Alert.alert("Failed", err.message || "Failed to save banner");
        } finally {
            setUploading(false);
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

    const saveAnnouncement = async () => {
        if (!announcementText.trim() && announcementActive) {
            return Alert.alert("Error", "Please enter announcement text before activating.");
        }
        setSavingAnnouncement(true);
        try {
            const payload = {
                text: announcementText,
                mediaUrl: '',
                mediaType: 'image',
                isActive: announcementActive
            };
            const { error } = await supabase.from('app_settings').upsert({
                key: 'global_announcement',
                value: payload,
                description: 'Global Popup Announcement'
            });
            if (error) throw error;
            Alert.alert("Success", "Announcement updated successfully!");
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to save");
        } finally {
            setSavingAnnouncement(false);
        }
    };

    const toggleMaintenanceMode = async (value: boolean) => {
        setMaintenanceMode(value);
        setSavingSettings(true);
        try {
            await supabase.from('app_settings').upsert({
                key: 'maintenance_mode',
                value: String(value),
                description: 'Put app in maintenance mode'
            });
        } catch(e) {
            console.error(e);
        } finally {
            setSavingSettings(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50 p-2">
            <Stack.Screen options={{ title: 'Content Manager', headerStyle: { backgroundColor: '#f8fafc' }, headerShadowVisible: false }} />

            <LinearGradient 
                colors={['#0f172a', '#1e3a8a', '#312e81']} 
                start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                className="rounded-xl px-4 py-3 mb-3 border border-white/10 overflow-hidden"
                style={{ shadowColor: '#1e3a8a', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}
            >
                {/* Decorative background elements */}
                <View className="absolute -top-12 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                <View className="absolute -bottom-6 right-12 w-20 h-20 bg-white/5 rounded-full" />

                <View className="flex-row justify-between items-start mb-2">
                    <View className="w-8 h-8 bg-white/10 rounded-lg items-center justify-center border border-white/20">
                        <Ionicons name={activeTab === 'banners' ? "images" : activeTab === 'partners' ? "people" : activeTab === 'announcements' ? "megaphone" : "settings"} size={16} color="#f5a623" />
                    </View>
                    {activeTab === 'banners' ? (
                        <TouchableOpacity 
                            onPress={() => setShowModal(true)}
                            className="bg-gradient-to-r from-[#f5a623] to-[#fbbf24] bg-[#f5a623] px-3 py-1.5 rounded-lg flex-row items-center border border-yellow-300/50"
                            style={{ shadowColor: '#f5a623', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}>
                            <Ionicons name="add-circle" size={14} color="#0d1b3e" />
                            <Text className="text-[#0d1b3e] font-black ml-1.5 text-xs">New Banner</Text>
                        </TouchableOpacity>
                    ) : activeTab === 'partners' ? (
                        <TouchableOpacity 
                            onPress={() => openPartnerModal()}
                            className="bg-gradient-to-r from-[#f5a623] to-[#fbbf24] bg-[#f5a623] px-3 py-1.5 rounded-lg flex-row items-center border border-yellow-300/50"
                            style={{ shadowColor: '#f5a623', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}>
                            <Ionicons name="add-circle" size={14} color="#0d1b3e" />
                            <Text className="text-[#0d1b3e] font-black ml-1.5 text-xs">Add Partner</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
                <Text className="text-white text-xl font-black mb-0.5 tracking-tight">
                    {activeTab === 'banners' ? 'Marketing' : activeTab === 'partners' ? 'Partners' : activeTab === 'announcements' ? 'Announcements' : 'Settings'}
                </Text>
                <Text className="text-indigo-200 font-medium text-xs opacity-80 mb-3">
                    {activeTab === 'banners' ? 'Manage home screen promotions' : activeTab === 'partners' ? 'Manage brand partners logos' : activeTab === 'announcements' ? 'Manage global popups & alerts' : 'App Configuration & Maintenance'}
                </Text>
                
                <View className="flex-row justify-between pt-3 border-t border-white/10">
                    <View>
                        <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider mb-0.5">Active</Text>
                        <Text className="text-white font-black text-lg">{activeTab === 'partners' ? partners.filter(p => p.is_active).length : banners.filter(b => b.is_active).length}</Text>
                    </View>
                    <View>
                        <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider mb-0.5">Total</Text>
                        <Text className="text-white font-black text-lg">{activeTab === 'partners' ? partners.length : banners.length}</Text>
                    </View>
                    <View>
                        <Text className="text-indigo-200 text-[9px] font-bold uppercase tracking-wider mb-0.5">System Status</Text>
                        <View className="flex-row items-center mt-1">
                            <View className={`w-2 h-2 rounded-full mr-1.5 ${maintenanceMode ? 'bg-red-500' : 'bg-green-400'}`} />
                            <Text className="text-white font-black text-xs">{maintenanceMode ? 'Maintenance' : 'Online'}</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View className="flex-row bg-white p-1 rounded-2xl mb-4 border border-slate-200 shadow-sm">
                <TouchableOpacity 
                    onPress={() => setActiveTab('banners')}
                    className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'banners' ? 'bg-[#0f172a]' : 'bg-transparent'}`}
                >
                    <Ionicons name="images" size={14} color={activeTab === 'banners' ? '#f5a623' : '#64748b'} style={{ marginRight: 6 }} />
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'banners' ? 'text-white' : 'text-slate-500'}`}>Banners</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('partners')}
                    className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'partners' ? 'bg-[#0f172a]' : 'bg-transparent'}`}
                >
                    <Ionicons name="people" size={14} color={activeTab === 'partners' ? '#f5a623' : '#64748b'} style={{ marginRight: 6 }} />
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'partners' ? 'text-white' : 'text-slate-500'}`}>Partners</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('announcements')}
                    className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'announcements' ? 'bg-[#0f172a]' : 'bg-transparent'}`}
                >
                    <Ionicons name="megaphone" size={14} color={activeTab === 'announcements' ? '#f5a623' : '#64748b'} style={{ marginRight: 6 }} />
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'announcements' ? 'text-white' : 'text-slate-500'}`}>Popups</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => setActiveTab('settings')}
                    className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'settings' ? 'bg-[#0f172a]' : 'bg-transparent'}`}
                >
                    <Ionicons name="settings" size={14} color={activeTab === 'settings' ? '#f5a623' : '#64748b'} style={{ marginRight: 6 }} />
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`}>Settings</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'banners' ? (
                <View className="flex-1">
                    <Text className="text-slate-400 font-black uppercase text-xs tracking-widest mb-3 ml-2">Current Campaigns</Text>

            <FlatList
                data={banners}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <View className="bg-white px-3 py-3 rounded-2xl mb-3 border border-slate-100 shadow-sm">
                        <View className="flex-row">
                            <View className="w-20 h-14 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-100 mr-3 shadow-sm">
                                {item.image_url ? (
                                    <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                                ) : (
                                    <View className="absolute inset-0 items-center justify-center">
                                        <Ionicons name="image-outline" size={20} color="#CBD5E1" />
                                    </View>
                                )}
                                <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-md flex-row items-center">
                                    <Ionicons name="bar-chart-outline" size={8} color="#f5a623" style={{ marginRight: 3 }} />
                                    <Text className="text-white text-[9px] font-bold">{item.clicks || 0}</Text>
                                </View>
                            </View>

                            <View className="flex-1 justify-center">
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 mr-2">
                                        <Text className="font-black text-slate-800 text-xs tracking-tight mb-1" numberOfLines={1}>{item.title}</Text>
                                        
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1" contentContainerStyle={{ gap: 4 }}>
                                            <View className={`px-1.5 py-0.5 rounded-md ${item.is_active ? 'bg-green-100' : 'bg-slate-100'}`}>
                                                <Text className={`text-[8px] font-black uppercase tracking-wider ${item.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {item.is_active ? 'LIVE' : 'PAUSED'}
                                                </Text>
                                            </View>
                                            {(item.placement ? item.placement.split(',') : ['dashboard']).slice(0,2).map((p: string, idx: number) => (
                                                <View key={idx} className="bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
                                                    <Text className="text-[8px] font-bold uppercase text-indigo-700 tracking-wider">
                                                        {p.trim()}
                                                    </Text>
                                                </View>
                                            ))}
                                            {(item.placement ? item.placement.split(',') : []).length > 2 && (
                                                <View className="bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200">
                                                    <Text className="text-[8px] font-bold uppercase text-slate-500 tracking-wider">
                                                        +{(item.placement.split(',').length - 2)} more
                                                    </Text>
                                                </View>
                                            )}
                                        </ScrollView>
                                        
                                        {item.target_url ? (
                                            <Text className="text-slate-400 text-[9px] mt-0.5" numberOfLines={1}>{item.target_url}</Text>
                                        ) : null}
                                    </View>

                                    <Switch
                                        value={item.is_active}
                                        onValueChange={() => toggleSwitch(item.id, item.is_active)}
                                        trackColor={{ false: '#cbd5e1', true: '#0d1b3e' }}
                                        thumbColor={'white'}
                                        style={{ transform: [{ scale: 0.8 }], marginRight: -5, marginTop: -5 }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View className="flex-row justify-end mt-3 pt-3 border-t border-slate-50 gap-2">
                            <TouchableOpacity
                                onPress={() => openEditModal(item)}
                                className="bg-indigo-50 px-3 py-1.5 rounded-lg flex-row items-center border border-indigo-100"
                            >
                                <Ionicons name="pencil" size={12} color="#4F46E5" />
                                <Text className="text-indigo-600 font-bold text-[10px] ml-1.5 uppercase tracking-wider">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => deleteBanner(item.id)}
                                className="bg-red-50 px-3 py-1.5 rounded-lg flex-row items-center border border-red-100"
                            >
                                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                                <Text className="text-red-500 font-bold text-[10px] ml-1.5 uppercase tracking-wider">Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View className="items-center justify-center py-10 opacity-50 bg-white rounded-2xl border border-slate-100">
                        <Ionicons name="images-outline" size={48} color="#64748b" />
                        <Text className="text-slate-500 font-black mt-3">No campaigns running</Text>
                        <Text className="text-slate-400 text-xs mt-1 text-center px-8">Create your first marketing banner to engage your users.</Text>
                    </View>
                )}
            />
                </View>
            ) : activeTab === 'partners' ? (
                <View className="flex-1">
                    <Text className="text-slate-400 font-black uppercase text-xs tracking-widest mb-3 ml-2">Our Partners</Text>
                    <FlatList
                        data={partners}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View className="bg-white px-3 py-3 rounded-2xl mb-3 border border-slate-100 shadow-sm">
                                <View className="flex-row">
                                    <View className="w-20 h-14 bg-slate-50 rounded-xl overflow-hidden relative border border-slate-200 mr-3 shadow-sm items-center justify-center p-1">
                                        {item.logo_url ? (
                                            <Image source={{ uri: item.logo_url }} className="w-full h-full" resizeMode="contain" />
                                        ) : (
                                            <Ionicons name="business" size={24} color="#CBD5E1" />
                                        )}
                                    </View>
                                    <View className="flex-1 justify-center">
                                        <View className="flex-row items-start justify-between">
                                            <View className="flex-1 mr-2">
                                                <Text className="font-black text-slate-800 text-sm tracking-tight mb-1">{item.name}</Text>
                                                <View className={`px-1.5 py-0.5 rounded-md self-start ${item.is_active ? 'bg-green-100' : 'bg-slate-100'}`}>
                                                    <Text className={`text-[8px] font-black uppercase tracking-wider ${item.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                                                        {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Switch
                                                value={item.is_active}
                                                onValueChange={() => togglePartnerStatus(item.id, item.is_active)}
                                                trackColor={{ false: '#cbd5e1', true: '#0d1b3e' }}
                                                thumbColor={'white'}
                                                style={{ transform: [{ scale: 0.8 }], marginRight: -5, marginTop: -5 }}
                                            />
                                        </View>
                                    </View>
                                </View>
                                <View className="flex-row justify-end mt-3 pt-3 border-t border-slate-50 gap-2">
                                    <TouchableOpacity
                                        onPress={() => openPartnerModal(item)}
                                        className="bg-indigo-50 px-3 py-1.5 rounded-lg flex-row items-center border border-indigo-100"
                                    >
                                        <Ionicons name="pencil" size={12} color="#4F46E5" />
                                        <Text className="text-indigo-600 font-bold text-[10px] ml-1.5 uppercase tracking-wider">Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => deletePartner(item.id)}
                                        className="bg-red-50 px-3 py-1.5 rounded-lg flex-row items-center border border-red-100"
                                    >
                                        <Ionicons name="trash-outline" size={12} color="#ef4444" />
                                        <Text className="text-red-500 font-bold text-[10px] ml-1.5 uppercase tracking-wider">Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={() => (
                            <View className="items-center justify-center py-10 opacity-50 bg-white rounded-2xl border border-slate-100">
                                <Ionicons name="people-outline" size={48} color="#64748b" />
                                <Text className="text-slate-500 font-black mt-3">No partners added</Text>
                            </View>
                        )}
                    />
                </View>
            ) : activeTab === 'announcements' ? (
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-slate-50">
                            <View className="flex-1 pr-4">
                                <Text className="font-black text-slate-800 text-sm">Global Popup Alerts</Text>
                                <Text className="text-slate-500 text-xs mt-1">Force an alert to appear for every user when they open the app.</Text>
                            </View>
                            <Switch
                                value={announcementActive}
                                onValueChange={setAnnouncementActive}
                                trackColor={{ false: '#cbd5e1', true: '#0d1b3e' }}
                                thumbColor={'white'}
                            />
                        </View>

                        <Text className="text-slate-700 font-black mb-2 ml-1 text-xs">Announcement Message</Text>
                        <View className="bg-slate-50 rounded-xl border border-slate-200 p-3 mb-4">
                            <TextInput
                                placeholder="Write your important announcement here..."
                                placeholderTextColor="#94a3b8"
                                value={announcementText}
                                onChangeText={setAnnouncementText}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                className="text-sm font-medium text-slate-800 min-h-[80px]"
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={saveAnnouncement}
                            disabled={savingAnnouncement}
                            className="bg-[#0d1b3e] h-12 rounded-xl items-center justify-center shadow-md flex-row"
                        >
                            {savingAnnouncement ? (
                                <ActivityIndicator size="small" color="#f5a623" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={18} color="#f5a623" style={{ marginRight: 6 }} />
                                    <Text className="text-[#f5a623] font-black text-sm uppercase tracking-widest">Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-4">
                                <Text className="font-black text-slate-800 text-sm">Maintenance Mode</Text>
                                <Text className="text-slate-500 text-xs mt-1 leading-relaxed">Lock the app and display a maintenance screen to all users immediately.</Text>
                            </View>
                            <Switch
                                value={maintenanceMode}
                                onValueChange={toggleMaintenanceMode}
                                trackColor={{ false: '#cbd5e1', true: '#ef4444' }}
                                thumbColor={'white'}
                                disabled={savingSettings}
                            />
                        </View>
                        {savingSettings ? <ActivityIndicator size="small" color="#ef4444" style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
                    </View>

                    <View className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 opacity-60">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-4">
                                <Text className="font-black text-slate-800 text-sm">Force App Update</Text>
                                <Text className="text-slate-500 text-xs mt-1 leading-relaxed">Require users to visit the app store to download the latest version.</Text>
                            </View>
                            <View className="bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300">
                                <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Coming Soon</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            )}

            <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-slate-50">
                    <View className="px-5 py-4 bg-white border-b border-slate-100 flex-row items-center justify-between shadow-sm z-10">
                        <TouchableOpacity onPress={closeModal} className="px-2 py-2">
                            <Text className="text-slate-500 font-bold text-base">Cancel</Text>
                        </TouchableOpacity>
                        <Text className="text-lg font-black text-[#0d1b3e]">{editingBannerId ? 'Edit Campaign' : 'New Campaign'}</Text>
                        <TouchableOpacity onPress={saveBanner} disabled={uploading} className="bg-[#0d1b3e] px-4 py-2 rounded-full shadow-sm">
                            {uploading ? (
                                <ActivityIndicator size="small" color="#f5a623" />
                            ) : (
                                <Text className="text-[#f5a623] font-black">{editingBannerId ? 'Update' : 'Publish'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        <TouchableOpacity 
                            onPress={pickImage}
                            className={`h-32 rounded-3xl border-2 border-dashed ${selectedImage || existingImageUrl ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 bg-white'} items-center justify-center mb-6 overflow-hidden relative shadow-sm`}
                        >
                            {selectedImage ? (
                                <Image source={{ uri: selectedImage.uri }} className="w-full h-full" resizeMode="cover" />
                            ) : existingImageUrl ? (
                                <Image source={{ uri: existingImageUrl }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <View className="bg-slate-100 w-14 h-14 rounded-full items-center justify-center mb-2">
                                        <Ionicons name="images" size={24} color="#94a3b8" />
                                    </View>
                                    <Text className="text-slate-600 font-black text-sm">Upload Graphic</Text>
                                    <Text className="text-slate-400 text-xs mt-1">Recommended: 1000x200px</Text>
                                </View>
                            )}
                            {(selectedImage || existingImageUrl) ? (
                                <View className="absolute bottom-3 right-3 bg-black/70 px-3 py-1.5 rounded-full backdrop-blur-md flex-row items-center">
                                    <Ionicons name="camera" size={14} color="white" />
                                    <Text className="text-white font-bold text-[10px] ml-1.5 uppercase tracking-widest">Change</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <Text className="text-slate-700 font-black mb-2 ml-1 text-sm">Campaign Title</Text>
                        <View className="bg-white rounded-2xl border border-slate-200 px-4 py-4 mb-6 shadow-sm">
                            <TextInput
                                placeholder="e.g. 50% Off Sallah Promo"
                                placeholderTextColor="#94a3b8"
                                value={newTitle}
                                onChangeText={setNewTitle}
                                className="text-base font-medium text-slate-800"
                            />
                        </View>

                        <View className="flex-row justify-between items-end mb-2 ml-1">
                            <Text className="text-slate-700 font-black text-sm">Target Link</Text>
                            <Text className="text-slate-400 font-medium text-[10px] uppercase tracking-widest">Optional</Text>
                        </View>
                        <View className="bg-white rounded-2xl border border-slate-200 px-4 py-4 shadow-sm">
                            <TextInput
                                placeholder="https://..."
                                placeholderTextColor="#94a3b8"
                                value={newTargetUrl}
                                onChangeText={setNewTargetUrl}
                                keyboardType="url"
                                autoCapitalize="none"
                                className="text-base font-medium text-slate-800"
                            />
                        </View>
                        <Text className="text-xs text-slate-500 mt-2 ml-2 font-medium mb-6">
                            Where should users be redirected when they tap the banner?
                        </Text>
                        
                        <View className="flex-row justify-between items-end mb-3 ml-1 mt-2">
                            <Text className="text-slate-700 font-black text-sm">Display Locations</Text>
                            <Text className="text-[#4F46E5] font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">{newPlacements.length} Selected</Text>
                        </View>
                        <View className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <Text className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
                                Select all the screens where this banner should appear. Tap to toggle.
                            </Text>
                            <View className="flex-row flex-wrap">
                                {AVAILABLE_PLACEMENTS.map((place) => {
                                    const isSelected = newPlacements.includes(place);
                                    return (
                                        <TouchableOpacity 
                                            key={place}
                                            onPress={() => togglePlacement(place)}
                                            className={`mr-2 mb-2 px-3 py-2 rounded-xl border flex-row items-center ${isSelected ? 'bg-[#0d1b3e] border-[#0d1b3e]' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <Ionicons 
                                                name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                                                size={14} 
                                                color={isSelected ? "#f5a623" : "#cbd5e1"} 
                                            />
                                            <Text className={`font-black uppercase text-[10px] tracking-wider ml-1.5 ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                                {place.replace('_', ' ')}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
            <Modal visible={showPartnerModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-slate-50">
                    <View className="px-5 py-4 bg-white border-b border-slate-100 flex-row items-center justify-between shadow-sm z-10">
                        <TouchableOpacity onPress={closePartnerModal} className="px-2 py-2">
                            <Text className="text-slate-500 font-bold text-base">Cancel</Text>
                        </TouchableOpacity>
                        <Text className="text-lg font-black text-[#0d1b3e]">{editingPartnerId ? 'Edit Partner' : 'New Partner'}</Text>
                        <TouchableOpacity onPress={savePartner} disabled={partnerUploading} className="bg-[#0d1b3e] px-4 py-2 rounded-full shadow-sm">
                            {partnerUploading ? (
                                <ActivityIndicator size="small" color="#f5a623" />
                            ) : (
                                <Text className="text-[#f5a623] font-black">{editingPartnerId ? 'Update' : 'Save'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                        <TouchableOpacity 
                            onPress={pickPartnerLogo}
                            className={`h-32 rounded-3xl border-2 border-dashed ${selectedPartnerLogo || existingPartnerLogoUrl ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300 bg-white'} items-center justify-center mb-6 overflow-hidden relative shadow-sm`}
                        >
                            {selectedPartnerLogo ? (
                                <Image source={{ uri: selectedPartnerLogo.uri }} className="w-full h-full" resizeMode="contain" />
                            ) : existingPartnerLogoUrl ? (
                                <Image source={{ uri: existingPartnerLogoUrl }} className="w-full h-full" resizeMode="contain" />
                            ) : (
                                <View className="items-center">
                                    <View className="bg-slate-100 w-14 h-14 rounded-full items-center justify-center mb-2">
                                        <Ionicons name="images" size={24} color="#94a3b8" />
                                    </View>
                                    <Text className="text-slate-600 font-black text-sm">Upload Logo</Text>
                                    <Text className="text-slate-400 text-xs mt-1">Recommended: 400x200px PNG</Text>
                                </View>
                            )}
                            {(selectedPartnerLogo || existingPartnerLogoUrl) ? (
                                <View className="absolute bottom-3 right-3 bg-black/70 px-3 py-1.5 rounded-full backdrop-blur-md flex-row items-center">
                                    <Ionicons name="camera" size={14} color="white" />
                                    <Text className="text-white font-bold text-[10px] ml-1.5 uppercase tracking-widest">Change</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <Text className="text-slate-700 font-black mb-2 ml-1 text-sm">Partner Name</Text>
                        <View className="bg-white rounded-2xl border border-slate-200 px-4 py-4 mb-6 shadow-sm">
                            <TextInput
                                placeholder="e.g. MTN Nigeria"
                                placeholderTextColor="#94a3b8"
                                value={newPartnerName}
                                onChangeText={setNewPartnerName}
                                className="text-base font-medium text-slate-800"
                            />
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}
