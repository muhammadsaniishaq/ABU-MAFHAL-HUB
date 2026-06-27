import React from 'react';
import { View, Text, Image } from 'react-native';

export const StandardSlip = ({ data }: { data: any }) => {
    return (
        <View className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" style={{ aspectRatio: 1.586 }}>
            {/* Background Coat of Arms Watermark */}
            <View className="absolute inset-0 items-center justify-center opacity-5">
                <Text className="font-black text-6xl text-slate-400">NIMC</Text>
            </View>

            <View className="flex-row justify-between p-3 flex-1">
                {/* Left side: Photo & details */}
                <View className="flex-1 mr-2 relative">
                    <View className="flex-row justify-between">
                        {/* Profile Image */}
                        <View className="w-[60px] h-[75px] bg-slate-200 rounded border border-slate-300">
                            {data.photo ? (
                                <Image source={{ uri: data.photo }} className="w-full h-full rounded" resizeMode="cover" />
                            ) : null}
                        </View>
                        
                        {/* Details */}
                        <View className="flex-1 ml-3 pt-1">
                            <View className="mb-2">
                                <Text className="text-[7px] text-slate-500 font-bold">Surname/Nom</Text>
                                <Text className="text-[10px] font-black uppercase text-slate-800">{data.surname || 'N/A'}</Text>
                            </View>
                            <View className="mb-2">
                                <Text className="text-[7px] text-slate-500 font-bold">Given Names/Prenoms</Text>
                                <Text className="text-[10px] font-black uppercase text-slate-800">{data.firstname} {data.middlename}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <View>
                                    <Text className="text-[7px] text-slate-500 font-bold">Date of Birth</Text>
                                    <Text className="text-[9px] font-black uppercase text-slate-800">{data.birthdate}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Right side: QR Code & Country */}
                <View className="w-[70px] items-end justify-between">
                    <View className="items-center">
                        <Text className="text-sm font-black tracking-widest text-slate-800">NGA</Text>
                        <Text className="text-[6px] text-slate-400">00000000000</Text>
                    </View>
                    {/* Dummy QR Code */}
                    <View className="w-14 h-14 bg-slate-800 mt-2 p-1 relative">
                        <View className="absolute inset-1 border-2 border-white" />
                        <View className="absolute inset-3 bg-white" />
                        <View className="absolute inset-4 bg-slate-800" />
                    </View>
                    <View className="items-center mt-2">
                        <Text className="text-[6px] font-bold text-slate-800">ISSUE DATE</Text>
                        <Text className="text-[7px] font-bold text-slate-600">01 JAN 2021</Text>
                    </View>
                </View>
            </View>

            {/* Bottom NIN Number */}
            <View className="pb-3 items-center">
                <Text className="text-[8px] font-bold text-slate-800 mb-1">National Identification Number (NIN)</Text>
                <Text className="text-xl font-black tracking-[4px] text-slate-900">{data.nin}</Text>
            </View>
        </View>
    );
};
