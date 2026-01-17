import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function BeneficiariesScreen() {

    // Mock data
    const beneficiaries = [
        { id: '1', name: 'Musa Ibrahim', bank: 'GTBank', account: '0123456789' },
        { id: '2', name: 'Chioma Okeke', bank: 'Zenith Bank', account: '2003004005' },
        { id: '3', name: 'Suleiman Dauda', bank: 'Kuda Bank', account: '2023034045' },
    ];

    const handleDelete = (name: string) => {
        Alert.alert("Delete Beneficiary", `Are you sure you want to remove ${name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive' }
        ]);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: 'Beneficiaries', headerTintColor: '#0056D2' }} />
            <StatusBar style="dark" />

            <FlatList
                data={beneficiaries}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-4">
                                <Text className="text-primary font-bold text-lg">{item.name.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text className="font-bold text-slate text-base">{item.name}</Text>
                                <Text className="text-gray-500 text-sm">{item.bank} - {item.account}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(item.name)} className="p-2">
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                )}
                ListFooterComponent={
                    <TouchableOpacity className="flex-row items-center justify-center p-4 bg-white border border-dashed border-gray-300 rounded-xl mt-4">
                        <Ionicons name="add" size={24} color="#6B7280" />
                        <Text className="text-gray-500 font-bold ml-2">Add New Beneficiary</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}
