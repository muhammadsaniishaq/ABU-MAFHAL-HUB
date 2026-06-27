import React from 'react';
import { View, Text, Image } from 'react-native';

export const RegularSlip = ({ data }: { data: any }) => {
    return (
        <View className="bg-[#FAF9F5] border border-slate-300 rounded-sm w-full shadow-sm" style={{ aspectRatio: 2.1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-2 border-b-2 border-black">
                <View className="w-10 h-10 bg-slate-200 rounded-full items-center justify-center">
                    <Text className="text-[6px] font-bold text-center">NIGERIA</Text>
                </View>
                <View className="flex-1 items-center">
                    <Text className="text-sm font-black text-slate-800 tracking-tight">National Identity Management System</Text>
                    <Text className="text-[10px] font-bold text-slate-700">Federal Republic of Nigeria</Text>
                    <Text className="text-[9px] font-bold text-slate-600 mt-1">National Identification Number Slip (NINS)</Text>
                </View>
                <View className="w-10 h-10 items-center justify-center">
                    <Text className="text-green-600 font-black text-sm italic tracking-tighter">NIMC</Text>
                </View>
            </View>

            {/* Content Table */}
            <View className="flex-row border-b border-black flex-1">
                {/* Column 1 */}
                <View className="flex-1 border-r border-black p-2 justify-between">
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-[8px] font-bold text-slate-700">Tracking ID</Text>
                        <Text className="text-[8px] text-slate-800">H6Y0NYFH00373</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-[10px] font-black text-slate-900">NIN</Text>
                        <View className="border border-red-500 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] font-black text-slate-900">{data.nin}</Text>
                        </View>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-[8px] font-bold text-slate-700">Issue Date</Text>
                        <Text className="text-[8px] text-slate-800">09/09/2018</Text>
                    </View>
                </View>

                {/* Column 2 */}
                <View className="flex-1 border-r border-black p-2 justify-between">
                    <View className="flex-row mb-2">
                        <Text className="text-[8px] font-bold text-slate-700 w-16">Surname</Text>
                        <Text className="text-[8px] font-bold uppercase text-slate-800 flex-1">{data.surname || 'N/A'}</Text>
                    </View>
                    <View className="flex-row mb-2">
                        <Text className="text-[8px] font-bold text-slate-700 w-16">First Name</Text>
                        <Text className="text-[8px] uppercase text-slate-800 flex-1">{data.firstname}</Text>
                    </View>
                    <View className="flex-row mb-2">
                        <Text className="text-[8px] font-bold text-slate-700 w-16">Middle Name</Text>
                        <Text className="text-[8px] uppercase text-slate-800 flex-1">{data.middlename}</Text>
                    </View>
                    <View className="flex-row">
                        <Text className="text-[8px] font-bold text-slate-700 w-16">Gender</Text>
                        <Text className="text-[8px] uppercase text-slate-800 flex-1">{data.gender}</Text>
                    </View>
                </View>

                {/* Column 3 */}
                <View className="flex-1 p-2 flex-row">
                    <View className="flex-1 mr-2">
                        <Text className="text-[8px] font-bold text-slate-700 mb-1">Address:</Text>
                        <Text className="text-[7px] text-slate-800 leading-3">{data.residence_address || '47, Harmony Avenue\nKETU ALAPERE\nLagos'}</Text>
                    </View>
                    <View className="w-[60px] h-full bg-slate-200">
                        {data.photo ? (
                            <Image source={{ uri: data.photo }} className="w-full h-full" resizeMode="cover" />
                        ) : null}
                    </View>
                </View>
            </View>

            {/* Note */}
            <View className="px-2 py-1 border-b border-black">
                <Text className="text-[6px] text-slate-800">
                    <Text className="font-bold">Note:</Text> This transaction slip does not confer the right to the <Text className="font-bold">General Multipurpose Card</Text> (For any enquiry please contact)
                </Text>
            </View>

            {/* Footer */}
            <View className="flex-row h-8 bg-[#FAF9F5]">
                <View className="flex-1 border-r border-black items-center justify-center">
                    <Text className="text-[6px] font-bold">helpdesk@nimc.gov.ng</Text>
                </View>
                <View className="flex-1 border-r border-black items-center justify-center">
                    <Text className="text-[6px] font-bold">www.nimc.gov.ng</Text>
                </View>
                <View className="flex-1 border-r border-black items-center justify-center">
                    <Text className="text-[5px] text-center font-bold">07040144452,07040144453</Text>
                </View>
                <View className="flex-1 items-center justify-center px-1">
                    <Text className="text-[5px] font-bold text-center mb-0.5">National Identity Management Commission</Text>
                    <Text className="text-[4px] text-center">11 Sokode Crescent, Wuse Abuja Nigeria</Text>
                </View>
            </View>
        </View>
    );
};
