import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function ReportGenerator() {
    const [generating, setGenerating] = useState<'pdf' | 'csv' | null>(null);
    const [selectedType, setSelectedType] = useState('transactions');
    const [range, setRange] = useState('7d');

    const handleGenerate = (type: 'pdf' | 'csv') => {
        setGenerating(type);
        setTimeout(() => setGenerating(null), 2000);
    };

    const ReportTypeCard = ({ id, icon, label, color }: any) => (
        <TouchableOpacity
            onPress={() => setSelectedType(id)}
            className={`w-[31%] p-3 rounded-2xl border ${selectedType === id ? 'bg-slate-800 border-indigo-500' : 'bg-white border-gray-100'} items-center justify-center h-28 gap-2`}
        >
            <View className={`w-10 h-10 rounded-full items-center justify-center ${selectedType === id ? 'bg-indigo-500/20' : 'bg-gray-100'}`}>
                <Ionicons name={icon} size={20} color={selectedType === id ? '#818CF8' : color} />
            </View>
            <Text className={`text-xs font-bold text-center ${selectedType === id ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
            {selectedType === id && <View className="w-1.5 h-1.5 rounded-full bg-indigo-500 absolute top-2 right-2" />}
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-slate-50">
            <Stack.Screen options={{ title: 'Report Generator' }} />

            <View className="p-6">
                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Select Report Type</Text>
                <View className="flex-row justify-between mb-8">
                    <ReportTypeCard id="transactions" icon="receipt" label="Financials" color="#10B981" />
                    <ReportTypeCard id="users" icon="people" label="User Growth" color="#3B82F6" />
                    <ReportTypeCard id="security" icon="shield" label="Security" color="#EF4444" />
                </View>

                <Text className="text-slate-400 font-bold uppercase text-[10px] mb-4">Date Range</Text>
                <View className="bg-white p-2 rounded-xl border border-gray-100 flex-row mb-8">
                    {['24h', '7d', '30d', 'Custom'].map(r => (
                        <TouchableOpacity
                            key={r}
                            onPress={() => setRange(r)}
                            className={`flex-1 py-3 rounded-lg items-center ${range === r ? 'bg-slate-900' : 'bg-transparent'}`}
                        >
                            <Text className={`font-bold text-xs ${range === r ? 'text-white' : 'text-slate-400'}`}>{r.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View className="flex-1 bg-white rounded-t-[40px] shadow-2xl p-8 items-center pt-12">
                <View className="w-16 h-1 bg-gray-100 rounded-full mb-8" />

                <Text className="text-slate-800 text-xl font-bold mb-2">Ready to Export</Text>
                <Text className="text-gray-400 text-center text-sm mb-8 px-8">
                    Generating <Text className="text-indigo-600 font-bold">{selectedType.toUpperCase()}</Text> report for the last <Text className="text-indigo-600 font-bold">{range.toUpperCase()}</Text>.
                </Text>

                <View className="w-full gap-4">
                    <TouchableOpacity
                        onPress={() => handleGenerate('pdf')}
                        disabled={!!generating}
                        className="w-full h-14 bg-red-50 rounded-2xl flex-row items-center justify-center border border-red-100 active:bg-red-100"
                    >
                        {generating === 'pdf' ? (
                            <ActivityIndicator color="#EF4444" />
                        ) : (
                            <>
                                <Ionicons name="document-text" size={20} color="#EF4444" />
                                <Text className="text-red-600 font-bold ml-2">Download PDF Document</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleGenerate('csv')}
                        disabled={!!generating}
                        className="w-full h-14 bg-green-50 rounded-2xl flex-row items-center justify-center border border-green-100 active:bg-green-100"
                    >
                        {generating === 'csv' ? (
                            <ActivityIndicator color="#10B981" />
                        ) : (
                            <>
                                <Ionicons name="grid" size={20} color="#10B981" />
                                <Text className="text-green-600 font-bold ml-2">Export as CSV / Excel</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
