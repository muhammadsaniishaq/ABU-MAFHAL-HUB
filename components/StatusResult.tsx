import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export const StatusResult = ({ result, title = 'Action Response' }: { result: any, title?: string }) => {
    const isSuccess = result?.isValid;

    return (
        <View className="w-full">
            <View className="mb-6 items-center">
                <Text className="text-slate-900 font-black text-2xl">{title}</Text>
            </View>

            <View className={`${isSuccess ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} p-6 rounded-3xl mb-6 border items-center`}>
                <Ionicons name={isSuccess ? "checkmark-circle" : "alert-circle"} size={44} color={isSuccess ? "#10B981" : "#EF4444"} className="mb-3" />
                <Text className={`${isSuccess ? 'text-emerald-800' : 'text-red-800'} text-lg font-bold mb-1 text-center`}>
                    {isSuccess ? 'Request Successful' : 'Request Failed'}
                </Text>
                <Text className={`${isSuccess ? 'text-emerald-600' : 'text-red-600'} text-sm text-center`}>
                    {result?.message || 'Processed the request.'}
                </Text>
            </View>

            {isSuccess && result?.data && (
                <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-6">
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Response Data</Text>
                    {Object.entries(result.data).map(([k, v]) => (
                        <View key={k} className="flex-row justify-between py-3 border-b border-slate-50 last:border-0">
                            <Text className="text-slate-500 text-xs capitalize">{k.replace(/_/g, ' ')}</Text>
                            <Text className="text-slate-800 font-bold text-xs max-w-[65%] text-right">{String(v)}</Text>
                        </View>
                    ))}
                </View>
            )}

            <TouchableOpacity onPress={() => router.back()} className="bg-slate-800 h-16 rounded-2xl items-center justify-center flex-row">
                <Ionicons name="arrow-back" size={20} color="white" />
                <Text className="text-white font-bold ml-2 text-base">Back</Text>
            </TouchableOpacity>
        </View>
    );
};
