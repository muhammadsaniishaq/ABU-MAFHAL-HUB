import React, { useEffect, useState, useRef } from 'react';
import { 
    View, 
    Text, 
    Modal, 
    StyleSheet, 
    TouchableOpacity, 
    Image, 
    Dimensions, 
    Platform, 
    AppState,
    ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '../services/supabase';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect, usePathname } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface AnnouncementConfig {
    text: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    isActive: boolean;
    fitMode?: 'contain' | 'cover';
}

export default function GlobalAnnouncementModal() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AnnouncementConfig | null>(null);
    const [mediaRatio, setMediaRatio] = useState<number | null>(null);
    const pathname = usePathname();

    // Auto-measure image dimensions for 100% full uncropped display
    useEffect(() => {
        if (config?.mediaUrl && config.mediaType === 'image') {
            Image.getSize(
                config.mediaUrl,
                (w, h) => {
                    if (w > 0 && h > 0) {
                        setMediaRatio(w / h);
                    }
                },
                () => {
                    setMediaRatio(16 / 9);
                }
            );
        } else {
            setMediaRatio(null);
        }
    }, [config?.mediaUrl, config?.mediaType]);

    // Auto-Scroll Up Refs & State for long announcement text
    const scrollViewRef = useRef<ScrollView>(null);
    const scrollY = useRef(0);
    const contentHeight = useRef(0);
    const isInteracting = useRef(false);

    useEffect(() => {
        // Check when app comes to foreground safely
        let appStateSub: any;
        try {
            if (AppState && AppState.addEventListener) {
                appStateSub = AppState.addEventListener('change', (nextAppState) => {
                    if (nextAppState === 'active') {
                        checkAnnouncement();
                    }
                });
            }
        } catch (err) {
            console.log('AppState not available', err);
        }

        // Check when auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            checkAnnouncement();
        });

        return () => {
            if (appStateSub && appStateSub.remove) appStateSub.remove();
            subscription.unsubscribe();
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            checkAnnouncement();
        }, [])
    );

    // Auto-Scroll Up Effect when text is long
    useEffect(() => {
        if (!visible || !config?.text) return;
        
        scrollY.current = 0;
        const interval = setInterval(() => {
            if (isInteracting.current || !scrollViewRef.current) return;
            
            // Only auto-scroll if text height exceeds visible area (130px)
            if (contentHeight.current > 130) {
                scrollY.current += 0.8;
                if (scrollY.current >= contentHeight.current - 120) {
                    // Reached end of text: pause 2s then loop back to top
                    setTimeout(() => {
                        scrollY.current = 0;
                        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                    }, 2000);
                } else {
                    scrollViewRef.current?.scrollTo({ y: scrollY.current, animated: false });
                }
            }
        }, 40);

        return () => clearInterval(interval);
    }, [visible, config?.text]);

    const checkAnnouncement = async () => {
        try {
            const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'global_announcement').maybeSingle();
            if (error) {
                console.log('Error fetching global announcement:', error.message || error);
                return;
            }
            if (!data || !data.value) return;

            let parsed: AnnouncementConfig;
            
            if (typeof data.value === 'object' && data.value !== null) {
                parsed = data.value as AnnouncementConfig;
                parsed.isActive = !!parsed.isActive;
                parsed.fitMode = parsed.fitMode || 'contain';
            } else if (typeof data.value === 'string' && data.value.trim().startsWith('{')) {
                try {
                    parsed = JSON.parse(data.value);
                    parsed.fitMode = parsed.fitMode || 'contain';
                } catch (e) {
                    parsed = {
                        text: data.value,
                        mediaUrl: '',
                        mediaType: 'image',
                        isActive: data.value.trim().length > 0,
                        fitMode: 'contain',
                    };
                }
            } else {
                parsed = {
                    text: typeof data.value === 'string' ? data.value : JSON.stringify(data.value),
                    mediaUrl: '',
                    mediaType: 'image',
                    isActive: data.value ? true : false,
                    fitMode: 'contain',
                };
            }
            
            if (!parsed.isActive) return;

            setConfig(parsed);
            setVisible(true);
        } catch (error) {
            console.log('Error fetching global announcement:', error);
        }
    };

    const handleClose = async () => {
        setVisible(false);
    };

    if (!config || !visible) return null;
    
    // Only render the Modal if we are currently on the dashboard
    if (pathname !== '/dashboard' && pathname !== '/') return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.8)' }]} />
                )}
                
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>

                    {/* Banner Image / Video Container (Auto-Fitting & 100% Uncropped) */}
                    {config.mediaUrl ? (
                        <View style={[
                            styles.mediaContainer,
                            mediaRatio && config.fitMode !== 'cover' ? {
                                aspectRatio: Math.max(1.1, Math.min(mediaRatio, 2.8)),
                                height: undefined,
                            } : null
                        ]}>
                            {config.mediaType === 'video' ? (
                                <Video
                                    source={{ uri: config.mediaUrl }}
                                    style={styles.media}
                                    resizeMode={config.fitMode === 'cover' ? ResizeMode.COVER : ResizeMode.CONTAIN}
                                    shouldPlay
                                    isLooping
                                    isMuted={false}
                                />
                            ) : (
                                <Image 
                                    source={{ uri: config.mediaUrl }} 
                                    style={styles.media} 
                                    resizeMode={config.fitMode === 'cover' ? "cover" : "contain"} 
                                />
                            )}
                        </View>
                    ) : null}

                    <View style={styles.textContainer}>
                        <View style={styles.badge}>
                            <Ionicons name="megaphone" size={14} color="#fff" />
                            <Text style={styles.badgeText}>Public Announcement</Text>
                        </View>

                        {/* Scroll Container with Auto-Scroll Up for Long Text */}
                        <View style={styles.scrollWrapper}>
                            <ScrollView 
                                ref={scrollViewRef}
                                style={{ maxHeight: 150 }}
                                contentContainerStyle={{ paddingVertical: 4 }}
                                showsVerticalScrollIndicator={false}
                                onContentSizeChange={(_, h) => { contentHeight.current = h; }}
                                onTouchStart={() => { isInteracting.current = true; }}
                                onTouchEnd={() => { setTimeout(() => { isInteracting.current = false; }, 3000); }}
                            >
                                <Text style={styles.announcementText}>{config.text}</Text>
                            </ScrollView>
                        </View>

                        <TouchableOpacity style={styles.gotItBtn} onPress={handleClose} activeOpacity={0.85}>
                            <Text style={styles.gotItText}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        padding: 20
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 10
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 10,
        width: 32,
        height: 32,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    mediaContainer: {
        width: '100%',
        minHeight: 140,
        maxHeight: 280,
        backgroundColor: '#070D1E',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    media: {
        width: '100%',
        height: '100%'
    },
    textContainer: {
        padding: 20,
        alignItems: 'center'
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 12
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
        marginLeft: 4,
        letterSpacing: 0.5
    },
    scrollWrapper: {
        width: '100%',
        maxHeight: 150,
        marginBottom: 20
    },
    announcementText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0F172A',
        textAlign: 'center',
        lineHeight: 23
    },
    gotItBtn: {
        backgroundColor: '#060d21',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center'
    },
    gotItText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5
    }
});
