import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Image } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function EditProfileScreen() {
    const [name, setName] = useState('Abu Mafhal');
    const [email, setEmail] = useState('abumafhal@example.com');
    const [phone, setPhone] = useState('08030000000');
    const router = useRouter();

    const handleSave = () => {
        Alert.alert("Success", "Profile updated successfully!");
        router.back();
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Edit Profile', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 bg-gray-200 rounded-full items-center justify-center mb-2">
                        <Text className="text-3xl font-bold text-gray-400">AM</Text>
                    </View>
                    <TouchableOpacity>
                        <Text className="text-primary font-bold">Change Photo</Text>
                    </TouchableOpacity>
                </View>

                <View className="mb-4">
                    <Text className="text-slate font-bold mb-2">Full Name</Text>
                    <TextInput
                        className="border border-gray-300 rounded-xl px-4 h-12 bg-gray-50 text-slate"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-slate font-bold mb-2">Email Address</Text>
                    <TextInput
                        className="border border-gray-300 rounded-xl px-4 h-12 bg-gray-50 text-slate"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-slate font-bold mb-2">Phone Number</Text>
                    <TextInput
                        className="border border-gray-300 rounded-xl px-4 h-12 bg-gray-100 text-gray-500"
                        value={phone}
                        editable={false}
                    />
                    <Text className="text-xs text-gray-400 mt-1">Phone number cannot be changed.</Text>
                </View>

                <TouchableOpacity
                    className="h-14 rounded-full bg-primary items-center justify-center"
                    onPress={handleSave}
                >
                    <Text className="text-white font-bold text-lg">Save Changes</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
