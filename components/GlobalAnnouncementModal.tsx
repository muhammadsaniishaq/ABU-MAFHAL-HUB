import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Image, Dimensions, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '../services/supabase';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface AnnouncementConfig {
    text: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    isActive: boolean;
}

export default function GlobalAnnouncementModal() {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AnnouncementConfig | null>(null);

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
                // Ensure isActive is boolean
                parsed.isActive = !!parsed.isActive;
            } else if (typeof data.value === 'string' && data.value.trim().startsWith('{')) {
                try {
                    parsed = JSON.parse(data.value);
                } catch (e) {
                    parsed = {
                        text: data.value,
                        mediaUrl: '',
                        mediaType: 'image',
                        isActive: data.value.trim().length > 0
                    };
                }
            } else {
                parsed = {
                    text: typeof data.value === 'string' ? data.value : JSON.stringify(data.value),
                    mediaUrl: '',
                    mediaType: 'image',
                    isActive: data.value ? true : false
                };
            }
            
            if (!parsed.isActive) return;

            // Removed AsyncStorage last_seen check as per request
            setConfig(parsed);
            setVisible(true);
        } catch (error) {
            console.log('Error fetching global announcement:', error);
        }
    };

    const handleClose = async () => {
        setVisible(false);
    };

    if (!config) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.8)' }]} />
                )}
                
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>

                    {config.mediaUrl ? (
                        <View style={styles.mediaContainer}>
                            {config.mediaType === 'video' ? (
                                <Video
                                    source={{ uri: config.mediaUrl }}
                                    style={styles.media}
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay
                                    isLooping
                                    isMuted={false}
                                />
                            ) : (
                                <Image source={{ uri: config.mediaUrl }} style={styles.media} resizeMode="contain" />
                            )}
                        </View>
                    ) : null}

                    <View style={styles.textContainer}>
                        <View style={styles.badge}>
                            <Ionicons name="megaphone" size={14} color="#fff" />
                            <Text style={styles.badgeText}>Announcement</Text>
                        </View>
                        <Text style={styles.announcementText}>{config.text}</Text>

                        <TouchableOpacity style={styles.gotItBtn} onPress={handleClose}>
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
        backgroundColor: 'rgba(0,0,0,0.6)', // fallback for android if BlurView not supported well
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
        top: 16,
        right: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center'
    },
    mediaContainer: {
        width: '100%',
        height: width * 0.6,
        backgroundColor: '#f1f5f9'
    },
    media: {
        width: '100%',
        height: '100%'
    },
    textContainer: {
        padding: 24,
        alignItems: 'center'
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
        letterSpacing: 0.5
    },
    announcementText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24
    },
    gotItBtn: {
        backgroundColor: '#060d21',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center'
    },
    gotItText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.5
    }
});
