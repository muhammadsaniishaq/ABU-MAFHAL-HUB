import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

export default function VirtualCardsScreen() {
    const [hasCard, setHasCard] = useState(false);

    return (
        <View className="flex-1 bg-gray-900">
            <Stack.Screen options={{ title: 'Virtual Cards', headerTintColor: '#fff', headerStyle: { backgroundColor: '#111827' }, headerTitleStyle: { color: 'white' } }} />
            <StatusBar style="light" />

            {hasCard ? (
                <ScrollView className="p-6">
                    {/* Card Visual */}
                    <View className="w-full aspect-[1.586] bg-black rounded-3xl p-8 relative overflow-hidden mb-10 shadow-2xl shadow-indigo-500/30 border border-white/10">
                        <Image
                            source={require('../assets/images/logo-icon.png')}
                            className="absolute right-0 bottom-0 w-64 h-64 opacity-10 -mr-10 -mb-10"
                            resizeMode="contain"
                        />
                        {/* Mesh Gradient Simulation */}
                        <View className="absolute top-0 left-0 right-0 h-full bg-gradient-to-br from-indigo-600/80 to-purple-800/80" />

                        <View className="flex-row justify-between items-start mb-8 z-10">
                            <View className="bg-white/20 px-3 py-1 rounded-md backdrop-blur-md border border-white/10">
                                <Text className="text-white text-xs font-bold tracking-widest">PREMIUM</Text>
                            </View>
                            <Text className="text-white font-bold text-2xl italic">VISA</Text>
                        </View>

                        <View className="flex-row items-center mb-6 z-10">
                            <View className="w-12 h-9 bg-yellow-400/20 rounded-md border border-yellow-400/40 mr-4" />
                            <Ionicons name="wifi" size={24} color="white" className="opacity-50" />
                        </View>

                        <Text className="text-white text-2xl font-mono tracking-widest mb-8 z-10 shadow-black/50" style={{ textShadowRadius: 2, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 } }}>
                            4242  ****  ****  9012
                        </Text>

                        <View className="flex-row justify-between z-10">
                            <View>
                                <Text className="text-white/60 text-[10px] uppercase font-bold mb-1">Card Holder</Text>
                                <Text className="text-white font-bold text-lg tracking-wide">ABU MAFHAL</Text>
                            </View>
                            <View>
                                <Text className="text-white/60 text-[10px] uppercase font-bold mb-1">Expires</Text>
                                <Text className="text-white font-bold text-lg tracking-wide">12/28</Text>
                            </View>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between mb-8">
                        <View>
                            <Text className="text-gray-400 text-sm">Card Balance</Text>
                            <Text className="text-white text-3xl font-bold">$124.50</Text>
                        </View>
                        <TouchableOpacity className="bg-white/20 px-6 py-2 rounded-full">
                            <Text className="text-white font-bold">+ Fund</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-white font-bold text-lg mb-4">Recent Transactions</Text>
                    <View className="bg-gray-800 rounded-xl p-4">
                        <View className="flex-row justify-between items-center mb-4">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center mr-3">
                                    <Ionicons name={"logo-netflix" as any} size={20} color="#EF4444" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold">Netflix Subscription</Text>
                                    <Text className="text-gray-400 text-xs">Jan 15, 2026</Text>
                                </View>
                            </View>
                            <Text className="text-white font-bold">-$15.99</Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                                    <Ionicons name={"logo-amazon" as any} size={20} color="#3B82F6" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold">Amazon Web Svcs</Text>
                                    <Text className="text-gray-400 text-xs">Jan 14, 2026</Text>
                                </View>
                            </View>
                            <Text className="text-white font-bold">-$45.00</Text>
                        </View>
                    </View>
                </ScrollView>
            ) : (
                <View className="flex-1 items-center justify-center p-6">
                    <View className="w-24 h-24 bg-gray-800 rounded-full items-center justify-center mb-6">
                        <Ionicons name="card" size={48} color="#60A5FA" />
                    </View>
                    <Text className="text-white text-2xl font-bold mb-2 text-center">Get a Virtual Dollar Card</Text>
                    <Text className="text-gray-400 text-center mb-10 leading-6">
                        Create a virtual dollar card instantly for your international payments. Works for Netflix, Amazon, Spotify, and more.
                    </Text>

                    <View className="w-full gap-4">
                        <TouchableOpacity
                            className="w-full h-14 bg-primary rounded-full items-center justify-center"
                            onPress={() => setHasCard(true)}
                        >
                            <Text className="text-white font-bold text-lg">Create Card ($3 Fee)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
