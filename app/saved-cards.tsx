import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function SavedCardsScreen() {

    const mockCards = [
        { id: '1', type: 'Mastercard', last4: '4242', expiry: '12/26' },
        { id: '2', type: 'Visa', last4: '1234', expiry: '09/25' },
    ];

    const handleDelete = (id: string) => {
        Alert.alert("Remove Card", "Are you sure you want to remove this card?", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: 'destructive' }
        ]);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Saved Cards', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <FlatList
                data={mockCards}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 24 }}
                renderItem={({ item }) => (
                    <View className="bg-primary p-6 rounded-2xl mb-4 shadow-sm relative overflow-hidden">
                        {/* decorative shapes */}
                        <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                        <View className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

                        <View className="flex-row justify-between items-start mb-8">
                            <Text className="text-white font-bold text-lg italic">{item.type}</Text>
                            <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                <Ionicons name="trash-outline" size={20} color="white" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-white text-2xl font-bold tracking-widest mb-4">
                            **** **** **** {item.last4}
                        </Text>

                        <View className="flex-row justify-between">
                            <Text className="text-blue-200 text-xs">Card Holder</Text>
                            <Text className="text-blue-200 text-xs">Expires</Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-white font-bold">Abu Mafhal</Text>
                            <Text className="text-white font-bold">{item.expiry}</Text>
                        </View>
                    </View>
                )}
                ListFooterComponent={
                    <TouchableOpacity className="flex-row items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-xl mt-4">
                        <Ionicons name="add" size={24} color="#6B7280" />
                        <Text className="text-gray-500 font-bold ml-2">Add New Card</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}
