import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function EducationScreen() {
    const [exam, setExam] = useState('');
    const [quantity, setQuantity] = useState(1);
    const router = useRouter();

    const exams = [
        { id: 'waec', name: 'WAEC', price: 3500, color: '#F37021' },
        { id: 'neco', name: 'NECO', price: 1200, color: '#107C10' },
        { id: 'jamb', name: 'JAMB', price: 4700, color: '#0056D2' },
        { id: 'nabteb', name: 'NABTEB', price: 1000, color: '#D97706' },
    ];

    const selectedExam = exams.find(e => e.id === exam);
    const total = selectedExam ? selectedExam.price * quantity : 0;

    const handlePurchase = () => {
        if (!exam) return;

        Alert.alert(
            "Confirm Purchase",
            `Buy ${quantity} ${selectedExam?.name} PIN(s) for ₦${total}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm", onPress: () => {
                        Alert.alert("Success", "PIN generated successfully!");
                        router.back();
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ title: 'Education', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <ScrollView className="p-6">
                <Text className="text-slate font-bold mb-4">Select Exam</Text>
                <View className="flex-row flex-wrap gap-4 mb-8">
                    {exams.map((e) => (
                        <TouchableOpacity
                            key={e.id}
                            className={`w-[48%] h-36 rounded-2xl items-center justify-center border ${exam === e.id ? 'border-primary bg-blue-50/50' : 'border-gray-100 bg-white shadow-sm'
                                }`}
                            onPress={() => setExam(e.id)}
                        >
                            <View className="w-14 h-14 rounded-full items-center justify-center mb-3" style={{ backgroundColor: e.color + '15' }}>
                                <Text className="font-bold text-2xl" style={{ color: e.color }}>{e.name[0]}</Text>
                            </View>
                            <Text className={`font-bold text-lg ${exam === e.id ? 'text-primary' : 'text-slate'}`}>{e.name}</Text>
                            <Text className="text-xs text-gray-400 font-medium mt-1">₦{e.price}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {exam && (
                    <View className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <Text className="text-slate font-bold mb-4">Quantity</Text>
                        <View className="flex-row items-center justify-between mb-6">
                            <TouchableOpacity
                                className="w-12 h-12 bg-white border border-gray-300 rounded-lg items-center justify-center"
                                onPress={() => quantity > 1 && setQuantity(q => q - 1)}
                            >
                                <Text className="text-2xl font-bold text-gray-600">-</Text>
                            </TouchableOpacity>
                            <Text className="text-2xl font-bold text-slate">{quantity}</Text>
                            <TouchableOpacity
                                className="w-12 h-12 bg-white border border-gray-300 rounded-lg items-center justify-center"
                                onPress={() => setQuantity(q => q + 1)}
                            >
                                <Text className="text-2xl font-bold text-gray-600">+</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-between items-center pt-4 border-t border-gray-200">
                            <Text className="text-gray-500 font-medium">Total Amount</Text>
                            <Text className="text-2xl font-bold text-primary">₦{total.toLocaleString()}</Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    className={`h-14 rounded-full items-center justify-center ${exam ? 'bg-primary' : 'bg-gray-300'
                        }`}
                    onPress={handlePurchase}
                    disabled={!exam}
                >
                    <Text className="text-white font-bold text-lg">Purchase PINs</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
