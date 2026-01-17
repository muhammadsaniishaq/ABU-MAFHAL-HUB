import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Mock Transaction Data
const transactions = [
    {
        title: 'Today',
        data: [
            { id: 'TXN-001', type: 'Credit', amount: '₦50,000.00', status: 'Success', sender: 'GTBank Transfer', time: '10:45 AM' },
            { id: 'TXN-002', type: 'Debit', amount: '₦2,500.00', status: 'Failed', sender: 'Airtime Purchase', time: '09:30 AM' },
            { id: 'TXN-003', type: 'Credit', amount: '₦120,000.00', status: 'Success', sender: 'Card Deposit', time: '08:15 AM' },
        ]
    },
    {
        title: 'Yesterday',
        data: [
            { id: 'TXN-004', type: 'Debit', amount: '₦15,000.00', status: 'Success', sender: 'Bill Payment', time: '04:20 PM' },
            { id: 'TXN-005', type: 'Credit', amount: '₦30,000.00', status: 'Pending', sender: 'Bank Transfer', time: '01:10 PM' },
        ]
    }
];

export default function TransactionHistory() {
    return (
        <View className="flex-1 bg-gray-50">
            {/* Stats Header */}
            <View className="flex-row p-4 gap-4">
                <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Total Vol (24h)</Text>
                    <Text className="text-xl font-black text-slate-800">₦1.2M</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Success Rate</Text>
                    <Text className="text-xl font-black text-green-600">98.5%</Text>
                </View>
            </View>

            <SectionList
                sections={transactions}
                keyExtractor={(item, index) => item.id + index}
                renderSectionHeader={({ section: { title } }) => (
                    <Text className="px-6 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">{title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity className="bg-white mx-4 mb-3 p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center">
                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${item.type === 'Credit' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            <Ionicons
                                name={item.type === 'Credit' ? 'arrow-down' : 'arrow-up'}
                                size={20}
                                color={item.type === 'Credit' ? '#10B981' : '#EF4444'}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-slate-800">{item.sender}</Text>
                            <View className="flex-row items-center mt-1">
                                <Text className="text-xs text-gray-300 font-medium mr-2">{item.id}</Text>
                                <Text className="text-xs text-gray-400">{item.time}</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className={`font-black text-base ${item.type === 'Credit' ? 'text-green-600' : 'text-slate-800'
                                }`}>
                                {item.type === 'Credit' ? '+' : '-'}{item.amount}
                            </Text>
                            <Text className={`text-[10px] font-bold mt-1 ${item.status === 'Success' ? 'text-green-500' :
                                    item.status === 'Pending' ? 'text-orange-500' : 'text-red-500'
                                }`}>{item.status}</Text>
                        </View>
                    </TouchableOpacity>
                )}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            />
        </View>
    );
}
