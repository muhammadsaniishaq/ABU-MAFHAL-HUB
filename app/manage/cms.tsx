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
    const [partnerUploading, setPartnerUploading] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState('');
    const [selectedPartnerLogo, setSelectedPartnerLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
    const [existingPartnerLogoUrl, setExistingPartnerLogoUrl] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'banners' | 'partners' | 'announcements' | 'settings'>('banners');
    const [announcementText, setAnnouncementText] = useState('');
    const [announcementActive, setAnnouncementActive] = useState(false);
    const [savingAnnouncement, setSavingAnnouncement] = useState(false);

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
            const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
            if (data) setBanners(data);
        } finally {
            setLoading(false);
        }
    };

    const toggleSwitch = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase.from('banners').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
    };

    const deleteBanner = async (id: string) => {
        Alert.alert("Confirm Delete", "Delete this banner?", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive",
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (!error) setBanners(prev => prev.filter(b => b.id !== id));
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
        setEditingPartnerId(null);
        setNewPartnerName('');
        setExistingPartnerLogoUrl(null);
        setSelectedPartnerLogo(null);
    };

    const pickPartnerLogo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, quality: 0.8, base64: true,
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
                const filePath = `partner_${Date.now()}.${ext}`; 
                const { error: uploadError } = await supabase.storage.from('partners').upload(filePath, decode(selectedPartnerLogo.base64), { contentType: `image/${ext}` });
                if (uploadError) throw new Error("Upload failed: " + uploadError.message);
                const { data: { publicUrl } } = supabase.storage.from('partners').getPublicUrl(filePath);
                finalLogoUrl = publicUrl;
            }
            const payload = { name: newPartnerName, logo_url: finalLogoUrl, is_active: true };
            if (editingPartnerId) {
                const { data, error: updateError } = await supabase.from('partners').update(payload).eq('id', editingPartnerId).select().single();
                if (updateError) throw new Error("Update failed: " + updateError.message);
                if (data) setPartners(prev => prev.map(p => p.id === editingPartnerId ? data : p));
            } else {
                const { data, error: insertError } = await supabase.from('partners').insert(payload).select().single();
                if (insertError) throw new Error("Insert failed: " + insertError.message);
                if (data) setPartners([...partners, data]);
            }
            closePartnerModal();
        } catch (e: any) { Alert.alert("Failed", e.message); } 
        finally { setPartnerUploading(false); }
    };

    const openEditModal = (banner: any) => {
        setEditingBannerId(banner.id);
        setNewTitle(banner.title || '');
        setNewTargetUrl(banner.target_url || '');
        setExistingImageUrl(banner.image_url);
        setSelectedImage(null);
        setNewPlacements(banner.placement ? banner.placement.split(',').map((p: string) => p.trim()) : ['dashboard']);
        setShowModal(true);
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

    const togglePlacement = (place: string) => {
        setNewPlacements(prev => {
            if (prev.includes(place)) {
                if (prev.length === 1) return prev;
                return prev.filter(p => p !== place);
            }
            return [...prev, place];
        });
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, quality: 0.8, base64: true,
        });
        if (!result.canceled && result.assets[0]) {
            setSelectedImage(result.assets[0]);
            setExistingImageUrl(null);
        }
    };

    const saveBanner = async () => {
        if (!newTitle.trim()) return Alert.alert("Error", "Please enter a title");
        if (!selectedImage && !existingImageUrl) return Alert.alert("Error", "Please select an image");
        setUploading(true);
        try {
            let finalImageUrl = existingImageUrl;
            if (selectedImage && selectedImage.base64) {
                const ext = selectedImage.uri.split('.').pop() || 'jpg';
                const filePath = `uploads/${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage.from('banners').upload(filePath, decode(selectedImage.base64), { contentType: `image/${ext}` });
                if (uploadError) throw new Error("Upload failed: " + uploadError.message);
                const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
                finalImageUrl = publicUrl;
            }
            const payload = { title: newTitle, image_url: finalImageUrl, target_url: newTargetUrl || null, placement: newPlacements.join(','), is_active: true };
            if (editingBannerId) {
                const { data, error: updateError } = await supabase.from('banners').update(payload).eq('id', editingBannerId).select().single();
                if (updateError) throw new Error("Update failed: " + updateError.message);
                if (data) setBanners(prev => prev.map(b => b.id === editingBannerId ? data : b));
            } else {
                const { data, error: insertError } = await supabase.from('banners').insert(payload).select().single();
                if (insertError) throw new Error("Insert failed: " + insertError.message);
                if (data) setBanners([data, ...banners]);
            }
            closeModal();
        } catch (err: any) { Alert.alert("Failed", err.message); } 
        finally { setUploading(false); }
    };

    const saveAnnouncement = async () => {
        setSavingAnnouncement(true);
        try {
            await supabase.from('app_settings').upsert({
                key: 'global_announcement',
                value: { text: announcementText, isActive: announcementActive },
                description: 'Global Popup Announcement'
            });
            Alert.alert("Success", "Announcement saved");
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

    // Use bg-slate-200 to give dark enough contrast against white elements
    if (loading) return (
        <View className="flex-1 items-center justify-center bg-slate-100">
            <ActivityIndicator size="small" color="#0D1B3E" />
            <Text className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Content...</Text>
        </View>
    );

    return (
        <View className="flex-1 bg-slate-100">
            {/* Header matches the background */}
            <Stack.Screen options={{ title: 'CMS Manager', headerStyle: { backgroundColor: '#F1F5F9' }, headerShadowVisible: false, headerTintColor: '#0D1B3E' }} />

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                
                {/* 
                    BEAUTIFUL DECORATIVE HEADER 
                */}
                <LinearGradient 
                    colors={['#0D1B3E', '#16254E', '#1A2A5E']} 
                    start={{x: 0, y: 0}} end={{x: 1, y: 1}}
                    className="rounded-[24px] p-5 mb-5 shadow-md relative overflow-hidden"
                >
                    {/* Decorative Elements */}
                    <View className="absolute -top-12 -right-6 w-32 h-32 bg-[#F5A623] opacity-10 rounded-full" />
                    <View className="absolute top-10 -left-10 w-24 h-24 bg-white opacity-5 rounded-full" />
                    <View className="absolute bottom-0 right-10 w-16 h-16 bg-[#F5A623] opacity-10 rounded-full" />

                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mr-3 border border-white/5">
                                <Ionicons name="color-wand" size={18} color="#F5A623" />
                            </View>
                            <View>
                                <Text className="text-white font-black text-xl tracking-tight">App Content</Text>
                                <Text className="text-slate-300 font-medium text-xs">Manage your app display</Text>
                            </View>
                        </View>
                        
                        {activeTab === 'banners' ? (
                            <TouchableOpacity onPress={() => {
                                setEditingBannerId(null); setNewTitle(''); setNewTargetUrl(''); setNewPlacements(['dashboard']); setSelectedImage(null); setExistingImageUrl(null); setShowModal(true);
                            }} className="bg-[#F5A623] px-3.5 py-2 rounded-xl flex-row items-center shadow-sm">
                                <Ionicons name="add" size={16} color="#0D1B3E" />
                                <Text className="text-[#0D1B3E] font-bold text-xs ml-1">Banner</Text>
                            </TouchableOpacity>
                        ) : activeTab === 'partners' ? (
                            <TouchableOpacity onPress={() => openPartnerModal()} className="bg-[#F5A623] px-3.5 py-2 rounded-xl flex-row items-center shadow-sm">
                                <Ionicons name="add" size={16} color="#0D1B3E" />
                                <Text className="text-[#0D1B3E] font-bold text-xs ml-1">Partner</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View className="flex-row justify-between bg-black/20 rounded-xl p-3 border border-white/5">
                        <View className="flex-1 items-center">
                            <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-widest mb-1">Active</Text>
                            <Text className="text-[#F5A623] font-black text-base">{activeTab === 'partners' ? partners.filter(p => p.is_active).length : banners.filter(b => b.is_active).length}</Text>
                        </View>
                        <View className="w-[1px] bg-white/10 mx-2" />
                        <View className="flex-1 items-center">
                            <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-widest mb-1">Total</Text>
                            <Text className="text-white font-black text-base">{activeTab === 'partners' ? partners.length : banners.length}</Text>
                        </View>
                        <View className="w-[1px] bg-white/10 mx-2" />
                        <View className="flex-1 items-center">
                            <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-widest mb-1">Status</Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${maintenanceMode ? 'bg-red-400' : 'bg-[#10B981]'}`} />
                                <Text className={`font-bold text-xs ${maintenanceMode ? 'text-red-400' : 'text-[#10B981]'}`}>{maintenanceMode ? 'Locked' : 'Online'}</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>

                {/* PREMIUM TABS - Stronger Contrast */}
                <View className="flex-row bg-slate-300/50 p-1.5 rounded-2xl mb-6 border border-slate-300">
                    {[
                        { id: 'banners', icon: 'images', label: 'Banners' },
                        { id: 'partners', icon: 'people', label: 'Partners' },
                        { id: 'announcements', icon: 'megaphone', label: 'Alerts' },
                        { id: 'settings', icon: 'settings', label: 'Settings' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity 
                                key={tab.id} onPress={() => setActiveTab(tab.id as any)}
                                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${isActive ? 'bg-white shadow-sm border border-slate-200' : ''}`}
                            >
                                <Ionicons name={tab.icon as any} size={14} color={isActive ? '#0D1B3E' : '#64748B'} style={{ marginRight: 4 }} />
                                <Text className={`font-bold text-[10px] uppercase tracking-wider ${isActive ? 'text-[#0D1B3E]' : 'text-slate-600'}`}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* --- BANNERS CONTENT --- */}
                {activeTab === 'banners' && (
                    <View>
                        {banners.map((item) => (
                            <View key={item.id} className="bg-white p-3.5 rounded-2xl mb-4 shadow-sm border border-slate-200 flex-row items-center">
                                {/* Image Container */}
                                <View className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 mr-4">
                                    <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
                                </View>
                                
                                {/* Info Container */}
                                <View className="flex-1 justify-center pr-2">
                                    <Text className="font-bold text-base text-[#0D1B3E] mb-0.5" numberOfLines={1}>{item.title}</Text>
                                    <View className="flex-row items-center mb-1.5">
                                        <Ionicons name="location" size={10} color="#94A3B8" />
                                        <Text className="text-[10px] text-slate-500 ml-1 font-medium" numberOfLines={1}>
                                            {item.placement ? item.placement.replace(/,/g, ', ') : 'Dashboard'}
                                        </Text>
                                    </View>
                                    <View className={`px-2 py-0.5 rounded-md self-start ${item.is_active ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100 border border-slate-300'}`}>
                                        <Text className={`text-[9px] font-bold uppercase tracking-widest ${item.is_active ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {item.is_active ? 'Live' : 'Paused'}
                                        </Text>
                                    </View>
                                </View>
                                
                                {/* Actions Container */}
                                <View className="items-center justify-between h-16 pl-3 border-l border-slate-100">
                                    <Switch value={item.is_active} onValueChange={() => toggleSwitch(item.id, item.is_active)} style={{ transform: [{ scale: 0.75 }], marginTop: -8 }} />
                                    <View className="flex-row gap-2 mt-auto">
                                        <TouchableOpacity onPress={() => openEditModal(item)} className="w-8 h-8 bg-slate-100 rounded-lg border border-slate-200 items-center justify-center">
                                            <Ionicons name="pencil" size={12} color="#0D1B3E" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => deleteBanner(item.id)} className="w-8 h-8 bg-red-100 rounded-lg border border-red-200 items-center justify-center">
                                            <Ionicons name="trash" size={12} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* --- PARTNERS CONTENT --- */}
                {activeTab === 'partners' && (
                    <View>
                        {partners.map((item) => (
                            <View key={item.id} className="bg-white p-3.5 rounded-2xl mb-4 shadow-sm border border-slate-200 flex-row items-center">
                                {/* Image Container */}
                                <View className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 mr-4 p-2 items-center justify-center">
                                    <Image source={{ uri: item.logo_url }} className="w-full h-full" resizeMode="contain" />
                                </View>
                                
                                {/* Info Container */}
                                <View className="flex-1 justify-center pr-2">
                                    <Text className="font-bold text-lg text-[#0D1B3E] mb-1.5" numberOfLines={1}>{item.name}</Text>
                                    <View className={`px-2 py-1 rounded-md self-start ${item.is_active ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100 border border-slate-300'}`}>
                                        <Text className={`text-[10px] font-bold uppercase tracking-widest ${item.is_active ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                        </Text>
                                    </View>
                                </View>
                                
                                {/* Actions Container */}
                                <View className="items-center justify-between h-20 pl-3 border-l border-slate-100">
                                    <Switch value={item.is_active} onValueChange={() => togglePartnerStatus(item.id, item.is_active)} style={{ transform: [{ scale: 0.8 }], marginTop: -8 }} />
                                    <View className="flex-row gap-2 mt-auto pb-1">
                                        <TouchableOpacity onPress={() => openPartnerModal(item)} className="w-8 h-8 bg-slate-100 rounded-lg border border-slate-200 items-center justify-center">
                                            <Ionicons name="pencil" size={14} color="#0D1B3E" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => deletePartner(item.id)} className="w-8 h-8 bg-red-100 rounded-lg border border-red-200 items-center justify-center">
                                            <Ionicons name="trash" size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* --- ANNOUNCEMENTS --- */}
                {activeTab === 'announcements' && (
                    <View className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-200">
                        <View className="flex-row items-center justify-between mb-5 border-b border-slate-100 pb-4">
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3 border border-blue-200">
                                    <Ionicons name="megaphone" size={18} color="#2563EB" />
                                </View>
                                <View>
                                    <Text className="font-bold text-base text-[#0D1B3E]">Global Alert</Text>
                                    <Text className="text-[10px] text-slate-500 font-medium">Show popup to all users</Text>
                                </View>
                            </View>
                            <Switch value={announcementActive} onValueChange={setAnnouncementActive} />
                        </View>
                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Alert Message</Text>
                        <TextInput
                            placeholder="Type your important message here..."
                            placeholderTextColor="#94A3B8"
                            value={announcementText}
                            onChangeText={setAnnouncementText}
                            multiline
                            className="bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm min-h-[100px] mb-5 text-[#0D1B3E] font-medium"
                            textAlignVertical="top"
                        />
                        <TouchableOpacity onPress={saveAnnouncement} className="bg-[#0D1B3E] py-3.5 rounded-xl items-center flex-row justify-center shadow-sm">
                            {savingAnnouncement ? <ActivityIndicator size="small" color="#F5A623" /> : (
                                <>
                                    <Ionicons name="save" size={16} color="#F5A623" />
                                    <Text className="text-white font-bold text-sm ml-2">Save Alert</Text>
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
                                    <Text className="text-[10px] text-slate-500 font-medium">Lock down the entire app</Text>
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
                            {selectedImage || existingImageUrl ? (
                                <Image source={{ uri: selectedImage ? selectedImage.uri : existingImageUrl! }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Ionicons name="cloud-upload" size={24} color="#94A3B8" className="mb-2" />
                                    <Text className="text-slate-500 font-bold text-xs">Tap to upload graphic</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Campaign Title</Text>
                        <TextInput placeholder="e.g. Flash Sale" placeholderTextColor="#94A3B8" value={newTitle} onChangeText={setNewTitle} className="bg-white border border-slate-300 rounded-xl p-4 text-base font-semibold text-[#0D1B3E] mb-5 shadow-sm" />
                        
                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Target URL (Optional)</Text>
                        <TextInput placeholder="https://" placeholderTextColor="#94A3B8" value={newTargetUrl} onChangeText={setNewTargetUrl} className="bg-white border border-slate-300 rounded-xl p-4 text-base font-semibold text-[#0D1B3E] mb-5 shadow-sm" autoCapitalize="none" keyboardType="url" />
                        
                        <Text className="font-bold text-xs text-[#0D1B3E] mb-3 ml-1">Where should this appear?</Text>
                        <View className="flex-row flex-wrap">
                            {AVAILABLE_PLACEMENTS.map(p => {
                                const isSelected = newPlacements.includes(p);
                                return (
                                    <TouchableOpacity key={p} onPress={() => togglePlacement(p)} className={`mr-2 mb-2 px-3 py-2 rounded-xl border flex-row items-center shadow-sm ${isSelected ? 'bg-[#0D1B3E] border-[#0D1B3E]' : 'bg-white border-slate-300'}`}>
                                        <Text className={`text-[11px] uppercase font-bold tracking-widest ${isSelected ? 'text-white' : 'text-slate-600'}`}>{p.replace('_', ' ')}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* PARTNERS MODAL */}
            <Modal visible={showPartnerModal} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-slate-50">
                    <View className="flex-row items-center justify-between p-5 border-b border-slate-200 bg-white z-10 shadow-sm">
                        <TouchableOpacity onPress={closePartnerModal} className="p-1"><Text className="text-slate-500 font-bold text-sm">Cancel</Text></TouchableOpacity>
                        <Text className="font-black text-[#0D1B3E] text-lg">{editingPartnerId ? 'Edit Partner' : 'New Partner'}</Text>
                        <TouchableOpacity onPress={savePartner} className="bg-[#0D1B3E] px-4 py-2 rounded-full">
                            {partnerUploading ? <ActivityIndicator size="small" color="#F5A623" /> : <Text className="text-white font-bold text-xs uppercase tracking-wider">Save</Text>}
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 100 }}>
                        <TouchableOpacity onPress={pickPartnerLogo} className="h-32 bg-white rounded-2xl border-2 border-slate-300 items-center justify-center mb-6 border-dashed overflow-hidden">
                            {selectedPartnerLogo || existingPartnerLogoUrl ? (
                                <Image source={{ uri: selectedPartnerLogo ? selectedPartnerLogo.uri : existingPartnerLogoUrl! }} className="w-full h-full p-4" resizeMode="contain" />
                            ) : (
                                <View className="items-center">
                                    <Ionicons name="business" size={24} color="#94A3B8" className="mb-2" />
                                    <Text className="text-slate-500 font-bold text-xs">Tap to upload brand logo</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text className="font-bold text-xs text-[#0D1B3E] mb-2 ml-1">Brand/Partner Name</Text>
                        <TextInput placeholder="e.g. MTN Nigeria" placeholderTextColor="#94A3B8" value={newPartnerName} onChangeText={setNewPartnerName} className="bg-white border border-slate-300 rounded-xl p-4 text-base font-semibold text-[#0D1B3E] mb-5 shadow-sm" />
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}
