import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { CryptoRate } from '../services/partners';
import { supabase } from '../services/supabase';

export default function CryptoScreen() {
    const [assets, setAssets] = useState<CryptoRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<CryptoRate | null>(null);
    const [amount, setAmount] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchRates();
        const interval = setInterval(fetchRates, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const fetchRates = async () => {
        // Don't show full loading spinner on refresh, just update
        try {
            const rates = await api.crypto.getRates(['bitcoin', 'ethereum', 'tether', 'solana']);
            setAssets(rates);
            setLoading(false);
        } catch (error) {
            console.error(error);
            // Keep old data if refresh fails
            if (assets.length === 0) setLoading(false);
        }
    };

    const handleTradeInit = (asset: CryptoRate) => {
        setSelectedAsset(asset);
        setModalVisible(true);
    };

    const executeTrade = async () => {
        if (!selectedAsset || !amount) return;
        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const result = await api.crypto.trade(user.id, {
                type: 'buy',
                asset: selectedAsset.symbol,
                amount: Number(amount),
                price: selectedAsset.price_usd
            });

            if (result.success) {
                setModalVisible(false);
                setAmount('');
                Alert.alert("Success", `Bought ${amount} ${selectedAsset.symbol}`);
                // In real app, we would refresh portfolio balance here
            } else {
                Alert.alert("Failed", result.message);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setProcessing(false);
        }
    };

    const getColors = (symbol: string) => {
        switch (symbol) {
            case 'BTC': return '#F7931A';
            case 'ETH': return '#627EEA';
            case 'USDT': return '#26A17B';
            case 'SOL': return '#14F195';
            default: return '#CBD5E1';
        }
    };

    return (
        <View className="flex-1 bg-slate-900">
            <Stack.Screen options={{ title: 'Crypto Exchange', headerTintColor: '#fff', headerStyle: { backgroundColor: '#0F172A' }, headerTitleStyle: { color: 'white' } }} />
            <StatusBar style="light" />

            <ScrollView className="p-6">
                {/* Portfolio Balance */}
                <View className="items-center mb-8 relative">
                    <View className="absolute top-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mt-20" />
                    <Text className="text-gray-400 mb-2 font-medium">Total Portfolio Value</Text>
                    <Text className="text-white text-5xl font-black tracking-tighter">$1,240.50</Text>
                    <View className="bg-green-500/10 px-4 py-1.5 rounded-full mt-3 border border-green-500/20 flex-row items-center">
                        <Ionicons name="caret-up" size={12} color="#4ADE80" />
                        <Text className="text-green-400 font-bold text-sm ml-1">+$45.20 (2.4%)</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-4 mb-10">
                    <TouchableOpacity className="flex-1 bg-primary h-14 rounded-2xl flex-row items-center justify-center shadow-lg shadow-blue-500/20">
                        <Ionicons name="arrow-up" size={22} color="white" />
                        <Text className="text-white font-bold ml-2 text-base">Buy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-1 bg-gray-800 h-14 rounded-2xl flex-row items-center justify-center border border-gray-700">
                        <Ionicons name="arrow-down" size={22} color="white" />
                        <Text className="text-white font-bold ml-2 text-base">Sell</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-1 bg-gray-800 h-14 rounded-2xl flex-row items-center justify-center border border-gray-700">
                        <Ionicons name="swap-horizontal" size={22} color="white" />
                        <Text className="text-white font-bold ml-2 text-base">Swap</Text>
                    </TouchableOpacity>
                </View>

                {/* Market List */}
                <View className="flex-row justify-between items-end mb-4">
                    <Text className="text-white font-bold text-xl">Live Market</Text>
                    <Text className="text-primary font-bold">See All</Text>
                </View>

                {loading ? (
                    <ActivityIndicator color="#4F46E5" size="large" />
                ) : (
                    assets.map((asset) => (
                        <TouchableOpacity
                            key={asset.id}
                            className="flex-row items-center justify-between bg-gray-800/50 p-4 rounded-2xl mb-3 border border-gray-800"
                            onPress={() => handleTradeInit(asset)}
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-full items-center justify-center mr-4" style={{ backgroundColor: getColors(asset.symbol) + '15' }}>
                                    <Ionicons name={asset.symbol === 'BTC' ? 'logo-bitcoin' : 'cube'} size={24} color={getColors(asset.symbol)} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">{asset.name}</Text>
                                    <Text className="text-gray-500 text-sm font-medium">{asset.symbol}</Text>
                                </View>
                            </View>
                            <View className="items-end">
                                <Text className="text-white font-bold text-lg">${asset.price_usd.toLocaleString()}</Text>
                                <View className={`px-2 py-0.5 rounded-md ${asset.percent_change_24h >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                    <Text className={`text-xs font-bold ${asset.percent_change_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {asset.percent_change_24h.toFixed(2)}%
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Trade Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/80">
                    <View className="bg-slate-900 rounded-t-3xl p-6 border-t border-gray-800">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold">Buy {selectedAsset?.symbol}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="gray" />
                            </TouchableOpacity>
                        </View>

                        <View className="mb-6">
                            <Text className="text-gray-400 mb-2">Amount (Units)</Text>
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl text-lg font-bold"
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor="#64748B"
                                value={amount}
                                onChangeText={setAmount}
                            />
                            <Text className="text-gray-500 mt-2 text-right">
                                Est: ${(Number(amount) * (selectedAsset?.price_usd || 0)).toLocaleString()}
                            </Text>
                        </View>

                        <TouchableOpacity
                            className="bg-primary h-14 rounded-xl items-center justify-center mb-4"
                            onPress={executeTrade}
                            disabled={processing}
                        >
                            {processing ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Confirm Buy</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
