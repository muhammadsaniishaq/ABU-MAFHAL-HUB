import { View, Text, TouchableOpacity, ScrollView, Alert, Clipboard, Share } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ReferralsScreen() {
    const referralCode = "ABU123";

    const handleCopy = () => {
        Clipboard.setString(referralCode);
        Alert.alert("Copied", "Referral code copied to clipboard");
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join me on Abu Mafhal Hub using my referral code ${referralCode} and get instant bonuses on your airtime purchases! Download app at: https://abumafhalhub.com`,
            });
        } catch (error) { }
    };

    return (
        <View className="flex-1 bg-primary">
            <Stack.Screen options={{ title: 'Refer & Earn', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0056D2' }, headerTitleStyle: { color: 'white' } }} />
            <StatusBar style="light" />

            <ScrollView className="flex-1">
                <View className="items-center py-10 px-6">
                    <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-6">
                        <Ionicons name="gift" size={40} color="white" />
                    </View>
                    <Text className="text-white text-3xl font-bold mb-2">Invite Friends</Text>
                    <Text className="text-blue-100 text-center text-base mb-8">
                        Share your code with friends and earn ₦500 wallet bonus when they fund their wallet with at least ₦2,000.
                    </Text>

                    <View className="bg-white rounded-xl p-4 flex-row items-center justify-between w-full mb-6">
                        <View>
                            <Text className="text-xs text-gray-500 mb-1">Your Referral Code</Text>
                            <Text className="text-2xl font-bold text-slate tracking-widest">{referralCode}</Text>
                        </View>
                        <TouchableOpacity onPress={handleCopy} className="bg-gray-100 p-2 rounded-lg">
                            <Ionicons name="copy-outline" size={24} color="#0056D2" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        className="bg-white w-full py-4 rounded-full items-center mb-8"
                        onPress={handleShare}
                    >
                        <Text className="text-primary font-bold text-lg">Share Code</Text>
                    </TouchableOpacity>
                </View>

                <View className="bg-gray-50 flex-1 rounded-t-3xl min-h-[400px] p-6">
                    <Text className="text-slate font-bold text-lg mb-4">Referred Users (0)</Text>
                    <View className="items-center justify-center py-10">
                        <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                        <Text className="text-gray-400 mt-2">You haven't invited anyone yet.</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
