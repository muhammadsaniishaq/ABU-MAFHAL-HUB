import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UpdateScreen() {
    const handleUpdate = () => {
        // You can change these links to your actual store links
        if (Platform.OS === 'ios') {
            Linking.openURL('https://apps.apple.com/app/idYOUR_APP_ID');
        } else {
            Linking.openURL('https://play.google.com/store/apps/details?id=YOUR_APP_ID');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <MaterialCommunityIcons name="cellphone-arrow-down" size={100} color="#005B96" />
                <Text style={styles.title}>Update Required</Text>
                <Text style={styles.description}>
                    A new version of the app is available. Please update to continue using our services.
                </Text>
                <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                    <Text style={styles.buttonText}>Update Now</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 24,
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    button: {
        backgroundColor: '#005B96',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        width: '100%',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    }
});
