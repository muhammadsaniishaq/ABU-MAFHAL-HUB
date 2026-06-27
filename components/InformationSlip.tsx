import React from 'react';
import { View, Text, Image } from 'react-native';

export const InformationSlip = ({ data }: { data: any }) => {
    return (
        <View className="bg-white border border-slate-200 rounded-sm w-full p-4 shadow-sm relative overflow-hidden" style={{ aspectRatio: 1.8 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="w-10 h-10 bg-slate-200 rounded-full" />
                <View className="items-center">
                    <Text className="text-sm font-bold text-[#1a2f4c]">Federal Republic of Nigeria</Text>
                    <Text className="text-[#3b4c68] font-bold text-lg mt-1">Verified NIN Details</Text>
                </View>
                <View className="items-center">
                    <Text className="text-green-600 font-black italic tracking-tighter">NIMC</Text>
                </View>
            </View>

            {/* Main Content Area */}
            <View className="flex-row flex-1">
                {/* Left Data Column */}
                <View className="flex-[1.5]">
                    <View className="flex-row mb-1">
                        <Text className="text-[10px] font-bold text-slate-800 w-24">First Name:</Text>
                        <Text className="text-[10px] text-slate-600 font-mono">{data.firstname}</Text>
                    </View>
                    <View className="flex-row mb-1">
                        <Text className="text-[10px] font-bold text-slate-800 w-24">Middle Name:</Text>
                        <Text className="text-[10px] text-slate-600 font-mono">{data.middlename}</Text>
                    </View>
                    <View className="flex-row mb-1">
                        <Text className="text-[10px] font-bold text-slate-800 w-24">Last Name:</Text>
                        <Text className="text-[10px] text-slate-600 font-mono">{data.surname || 'N/A'}</Text>
                    </View>
                    <View className="flex-row mb-1">
                        <Text className="text-[10px] font-bold text-slate-800 w-24">Date of birth:</Text>
                        <Text className="text-[10px] text-slate-600 font-mono">{data.birthdate}</Text>
                    </View>
                    <View className="flex-row mb-2">
                        <Text className="text-[10px] font-bold text-slate-800 w-24">Gender:</Text>
                        <Text className="text-[10px] text-slate-600 font-mono">{data.gender}</Text>
                    </View>

                    <View className="flex-row mb-2 items-center">
                        <Text className="text-xs font-normal text-slate-600 mr-2">NIN Number:</Text>
                        <Text className="text-xs text-slate-800 font-mono">{data.nin}</Text>
                    </View>
                    
                    <View className="flex-row justify-between mb-1">
                        <Text className="text-[9px] font-bold text-slate-800 w-20">Tracking ID:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">H6Y0NYFH00373</Text>
                        <Text className="text-[9px] font-bold text-slate-800 w-20 ml-2">Phone Number:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.telephoneno || 'N/A'}</Text>
                    </View>
                    <View className="flex-row justify-between mb-1">
                        <Text className="text-[9px] font-bold text-slate-800 w-20">Residence State:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.residence_state || 'N/A'}</Text>
                        <Text className="text-[9px] font-bold text-slate-800 w-20 ml-2">Residence LGA/Town:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.residence_lga || 'N/A'}</Text>
                    </View>
                    <View className="flex-row justify-between mb-1">
                        <Text className="text-[9px] font-bold text-slate-800 w-20">Birth State:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.birthstate || 'N/A'}</Text>
                        <Text className="text-[9px] font-bold text-slate-800 w-20 ml-2">Birth LGA:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.birthlga || 'N/A'}</Text>
                    </View>
                    <View className="flex-row mb-1">
                        <Text className="text-[9px] font-bold text-slate-800 w-20">Address:</Text>
                        <Text className="text-[9px] text-slate-600 font-mono flex-1">{data.residence_address || 'N/A'}</Text>
                    </View>
                </View>

                {/* Right Photo & Terms Column */}
                <View className="flex-1 pl-4 items-center">
                    <View className="w-16 h-16 rounded-full bg-[#4a90e2] overflow-hidden mb-4 border-2 border-white shadow-sm">
                        {data.photo ? (
                            <Image source={{ uri: data.photo }} className="w-full h-full" resizeMode="cover" />
                        ) : null}
                    </View>
                    <Text className="text-xl text-green-700 font-normal mb-2">Verified</Text>
                    
                    <Text className="text-[6px] text-center text-slate-600 mb-2 leading-tight">
                        This is a property of National Identity Management Commission (NIMC), Nigeria.{'\n'}
                        If found, please return to the nearest NIMC's office or contact +234 815 769 1214, +234 815 769 1071
                    </Text>
                    
                    <View className="w-full mt-2">
                        <View className="flex-row mb-1">
                            <Text className="text-[6px] font-bold text-slate-800 mr-1">1.</Text>
                            <Text className="text-[6px] text-slate-800 leading-[8px] flex-1">This NIN slip remains the property of the Federal Republic of Nigeria, and MUST be surrendered on demand;</Text>
                        </View>
                        <View className="flex-row mb-1">
                            <Text className="text-[6px] font-bold text-slate-800 mr-1">2.</Text>
                            <Text className="text-[6px] text-slate-800 leading-[8px] flex-1">This NIN slip does not imply nor confer citizenship of the Federal Republic of Nigeria on the individual the document is issued to;</Text>
                        </View>
                        <View className="flex-row">
                            <Text className="text-[6px] font-bold text-slate-800 mr-1">3.</Text>
                            <Text className="text-[6px] text-slate-800 leading-[8px] flex-1">This NIN slip is valid for the lifetime of the holder and <Text className="text-red-500 font-bold">DOES NOT EXPIRE.</Text></Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};
