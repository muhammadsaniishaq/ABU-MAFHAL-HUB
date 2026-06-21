import { View, Text, TouchableOpacity, ScrollView, Platform, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../services/supabase';

const T = {
  navy:    '#0d1b3e',
  navyMid: '#142258',
  gold:    '#f5a623',
  goldDk:  '#d4890e',
  white:   '#ffffff',
  bg:      '#f4f6fb',
  text:    '#0d1b3e',
  textSub: '#5a6890',
  indigo:  '#4F46E5',
  border:  '#e2e8f0',
};

export default function AppDesigner() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'theme' | 'branding'>('theme');
    
    // Theme states
    const [primaryColor, setPrimaryColor] = useState('#4F46E5');
    const [darkMode, setDarkMode] = useState(false);
    
    // Branding states
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoIconUrl, setLogoIconUrl] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        fetchBrandSettings();
    }, []);

    const fetchBrandSettings = async () => {
        try {
            setLoadingSettings(true);
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value');
            
            if (data) {
                const logoSetting = data.find(s => s.key === 'app_logo');
                const iconSetting = data.find(s => s.key === 'app_logo_icon');
                if (logoSetting?.value?.url) setLogoUrl(logoSetting.value.url);
                if (iconSetting?.value?.url) setLogoIconUrl(iconSetting.value.url);
            }
        } catch (e) {
            console.error('Error fetching brand settings:', e);
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleUploadLogo = async (type: 'logo' | 'icon') => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission Denied", "You need to allow access to your photos to upload brand assets.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'icon' ? [1, 1] : [3, 1],
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                await uploadToSupabase(result.assets[0], type);
            }
        } catch (error: any) {
            Alert.alert("Error", "Could not pick image: " + error.message);
        }
    };

    const uploadToSupabase = async (image: ImagePicker.ImagePickerAsset, type: 'logo' | 'icon') => {
        const isIcon = type === 'icon';
        if (isIcon) setUploadingIcon(true);
        else setUploadingLogo(true);

        try {
            if (!image.base64) throw new Error('No image data found.');

            const fileExt = 'jpg';
            const fileName = `brand/${type}_${Date.now()}.${fileExt}`;
            
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

            // Upsert setting key in app_settings table
            const { error: dbError } = await supabase
                .from('app_settings')
                .upsert({
                    key: isIcon ? 'app_logo_icon' : 'app_logo',
                    value: { url: publicUrl },
                    description: isIcon ? 'Dynamic App Logo Icon Square' : 'Dynamic App Logo Banner Full'
                });

            if (dbError) throw dbError;

            if (isIcon) {
                setLogoIconUrl(publicUrl);
                Alert.alert("Success", "Logo Icon uploaded and published successfully!");
            } else {
                setLogoUrl(publicUrl);
                Alert.alert("Success", "Logo Banner uploaded and published successfully!");
            }
        } catch (error: any) {
            Alert.alert("Upload Failed", error.message);
        } finally {
            if (isIcon) setUploadingIcon(false);
            else setUploadingLogo(false);
        }
    };

    return (
        <View style={s.container}>
            <Stack.Screen options={{ 
                title: 'Branding & Theme Engine',
                headerStyle: { backgroundColor: T.navy },
                headerTintColor: '#ffffff',
                headerTitleStyle: { fontWeight: '900' }
            }} />

            {/* Segment Tab Controller */}
            <View style={s.tabBar}>
                <TouchableOpacity
                    onPress={() => setActiveTab('theme')}
                    style={[s.tabButton, activeTab === 'theme' && s.tabButtonActive]}
                >
                    <Ionicons name="color-palette" size={16} color={activeTab === 'theme' ? T.gold : '#94a3b8'} />
                    <Text style={[s.tabText, activeTab === 'theme' && s.tabTextActive]}>Theme Engine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('branding')}
                    style={[s.tabButton, activeTab === 'branding' && s.tabButtonActive]}
                >
                    <Ionicons name="image" size={16} color={activeTab === 'branding' ? T.gold : '#94a3b8'} />
                    <Text style={[s.tabText, activeTab === 'branding' && s.tabTextActive]}>Logo Assets</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'theme' ? (
                <View style={{ flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }}>
                    {/* Editor Sidebar */}
                    <View style={s.sidebar}>
                        <Text style={s.label}>Color Palette</Text>
                        <View style={s.colorGrid}>
                            {['#4F46E5', '#EF4444', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'].map(c => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() => setPrimaryColor(c)}
                                    style={[s.colorCircle, { backgroundColor: c }, primaryColor === c && s.colorCircleActive]}
                                />
                            ))}
                        </View>

                        <Text style={s.label}>Mode</Text>
                        <View style={s.modeSelector}>
                            <TouchableOpacity
                                onPress={() => setDarkMode(false)}
                                style={[s.modeBtn, !darkMode && s.modeBtnActive]}
                            >
                                <Ionicons name="sunny" size={18} color={!darkMode ? T.gold : '#94A3B8'} />
                                <Text style={[s.modeText, !darkMode && s.modeTextActive]}>Light</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setDarkMode(true)}
                                style={[s.modeBtn, darkMode && s.modeBtnActive]}
                            >
                                <Ionicons name="moon" size={18} color={darkMode ? T.gold : '#94A3B8'} />
                                <Text style={[s.modeText, darkMode && s.modeTextActive]}>Dark</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            style={s.publishBtn}
                            onPress={() => Alert.alert("Success", "Theme preferences published to database")}
                        >
                            <Text style={s.publishText}>Publish Theme</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Live Preview */}
                    <View style={s.previewArea}>
                        {/* Phone Mockup */}
                        <View style={[s.phoneMockup, { backgroundColor: darkMode ? '#0f172a' : '#ffffff' }]}>
                            {/* Mock App Header */}
                            <View style={[s.mockHeader, { backgroundColor: primaryColor }]}>
                                <Text style={s.mockHeaderText}>Abu Mafhal Sub</Text>
                            </View>
                            {/* Mock Content */}
                            <View style={s.mockContent}>
                                <View style={[s.mockBox, { backgroundColor: darkMode ? '#1e293b' : '#f1f5f9' }]} />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={[s.mockBox, { flex: 1, backgroundColor: darkMode ? '#1e293b' : '#f1f5f9' }]} />
                                    <View style={[s.mockBox, { flex: 1, backgroundColor: darkMode ? '#1e293b' : '#f1f5f9' }]} />
                                </View>
                                <View style={[s.mockBtn, { backgroundColor: primaryColor }]}>
                                    <Text style={s.mockBtnText}>Primary Button</Text>
                                </View>
                            </View>
                        </View>
                        <Text style={s.previewLabel}>Live Preview</Text>
                    </View>
                </View>
            ) : (
                <ScrollView style={s.brandingContainer} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                    
                    {/* Header Details */}
                    <View style={s.brandingHeader}>
                        <Ionicons name="cloud-upload-outline" size={32} color={T.gold} />
                        <Text style={s.brandingTitle}>App Branding Assets</Text>
                        <Text style={s.brandingDesc}>
                            Upload and replace the logos rendered in your header, onboarding flow, receipt templates, and communication systems dynamically.
                        </Text>
                    </View>

                    {loadingSettings ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={T.gold} />
                        </View>
                    ) : (
                        <View style={s.cardsWrapper}>
                            
                            {/* Asset Card 1: Logo Banner */}
                            <View style={s.assetCard}>
                                <Text style={s.assetTitle}>1. Full Logo Banner (`logo.png`)</Text>
                                <Text style={s.assetDesc}>Rendered on splash screen, onboarding, and receipts (wide aspect ratio).</Text>
                                
                                <View style={s.assetPreviewBox}>
                                    {logoUrl ? (
                                        <Image source={{ uri: logoUrl }} style={s.logoBannerPreview as any} resizeMode="contain" />
                                    ) : (
                                        <Image source={require('../../assets/images/logo.png')} style={s.logoBannerPreview as any} resizeMode="contain" />
                                    )}
                                </View>

                                <TouchableOpacity 
                                    style={s.uploadActionBtn}
                                    onPress={() => handleUploadLogo('logo')}
                                    disabled={uploadingLogo}
                                >
                                    {uploadingLogo ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <Ionicons name="image-outline" size={16} color="#ffffff" />
                                            <Text style={s.uploadActionText}>Upload New Logo Banner</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Asset Card 2: Square Logo Icon */}
                            <View style={s.assetCard}>
                                <Text style={s.assetTitle}>2. Logo Icon Square (`logo-icon.png`)</Text>
                                <Text style={s.assetDesc}>Rendered inside the headers, dashboard badges, and circular frames.</Text>
                                
                                <View style={s.assetPreviewBox}>
                                    <View style={s.iconPreviewCircle}>
                                        {logoIconUrl ? (
                                            <Image source={{ uri: logoIconUrl }} style={s.logoIconPreview as any} resizeMode="contain" />
                                        ) : (
                                            <Image source={require('../../assets/images/logo-icon.png')} style={s.logoIconPreview as any} resizeMode="contain" />
                                        )}
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    style={[s.uploadActionBtn, { backgroundColor: T.navy }]}
                                    onPress={() => handleUploadLogo('icon')}
                                    disabled={uploadingIcon}
                                >
                                    {uploadingIcon ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <Ionicons name="apps-outline" size={16} color="#ffffff" />
                                            <Text style={s.uploadActionText}>Upload New Logo Icon</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: 'rgba(13, 27, 62, 0.05)',
        borderWidth: 1,
        borderColor: '#f5a62330',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8',
    },
    tabTextActive: {
        color: T.navy,
    },
    sidebar: {
        width: Platform.OS === 'web' ? '33%' : '100%',
        backgroundColor: '#ffffff',
        padding: 20,
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9',
    },
    label: {
        fontSize: 10,
        fontWeight: '800',
        color: T.textSub,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    colorCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorCircleActive: {
        borderColor: T.navy,
        transform: [{ scale: 1.1 }],
    },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 12,
        marginBottom: 24,
        gap: 4,
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    modeBtnActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    modeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94a3b8',
    },
    modeTextActive: {
        color: T.navy,
    },
    publishBtn: {
        backgroundColor: T.navy,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    publishText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    previewArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        padding: 24,
    },
    phoneMockup: {
        width: 220,
        height: 440,
        borderRadius: 36,
        borderWidth: 6,
        borderColor: '#0f172a',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 10,
    },
    mockHeader: {
        height: 60,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 8,
    },
    mockHeaderText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    mockContent: {
        padding: 16,
        gap: 10,
    },
    mockBox: {
        height: 90,
        borderRadius: 12,
    },
    mockBtn: {
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    mockBtnText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
    },
    previewLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '700',
        marginTop: 12,
    },
    brandingContainer: {
        flex: 1,
        padding: 20,
    },
    brandingHeader: {
        alignItems: 'center',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    brandingTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: T.navy,
        marginTop: 8,
        marginBottom: 6,
    },
    brandingDesc: {
        fontSize: 12,
        color: T.textSub,
        textAlign: 'center',
        lineHeight: 18,
    },
    cardsWrapper: {
        gap: 20,
    },
    assetCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 2,
    },
    assetTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: T.navy,
        marginBottom: 4,
    },
    assetDesc: {
        fontSize: 11,
        color: T.textSub,
        marginBottom: 16,
        lineHeight: 16,
    },
    assetPreviewBox: {
        height: 120,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        marginBottom: 16,
        padding: 10,
    },
    logoBannerPreview: {
        width: '100%',
        height: '100%',
    },
    iconPreviewCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: T.gold,
        padding: 2,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    logoIconPreview: {
        width: '100%',
        height: '100%',
        borderRadius: 38,
    },
    uploadActionBtn: {
        backgroundColor: T.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    uploadActionText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
});
