import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const InformationSlip = ({ data }: { data: any }) => {
    const getVal = (keys: string[], fallback: string = 'N/A'): string => {
        for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
                return String(data[k]);
            }
        }
        return fallback;
    };
    
    const firstName = getVal(['firstname', 'first_name', 'firstName', 'first'], '');
    const lastName = getVal(['surname', 'last_name', 'lastName', 'lastname', 'last'], '');
    const middleName = getVal(['middlename', 'middle_name', 'middleName', 'middle'], '');
    const dob = getVal(['birthdate', 'dob', 'dateOfBirth', 'date_of_birth'], '01 OCT 1960');
    
    let formattedDob = dob;
    try {
        const parts = dob.split(/[-/]/);
        if (parts.length === 3) {
            let y, m, d;
            if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
            else { d = parts[0]; m = parts[1]; y = parts[2]; }
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            const mIndex = parseInt(m) - 1;
            if (mIndex >= 0 && mIndex < 12) {
                formattedDob = `${d.padStart(2, '0')} ${months[mIndex]} ${y}`;
            }
        }
    } catch(e) {}

    const genderVal = getVal(['gender', 'sex', 'gender_id'], 'M') || 'M';
    const gender = genderVal.toUpperCase().startsWith('M') ? 'M' : 'F';
    const nin = getVal(['nin', 'number', 'nin_number', 'national_id', 'identity_number'], '00000000000');
    const photo = getVal(['photo', 'image', 'picture', 'avatar', 'face_image'], '') || null;
    const trackingId = getVal(['tracking_id', 'trackingId', 'tracking'], 'H6Y0NYFH00373');
    const phone = getVal(['telephoneno', 'phoneNumber', 'phone', 'telephone'], 'N/A');
    const residenceState = getVal(['residence_state', 'residenceState', 'state'], 'N/A');
    const residenceLga = getVal(['residence_lga', 'residenceLga', 'lga'], 'N/A');
    const birthState = getVal(['birthstate', 'birthState'], 'N/A');
    const birthLga = getVal(['birthlga', 'birthLga'], 'N/A');
    const address = getVal(['residence_address', 'address'], 'N/A');

    return (
        <View className="bg-white border border-slate-300 rounded-sm w-full p-3 shadow-sm relative overflow-hidden" style={{ aspectRatio: 1.8 }}>
            
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-2 mb-2">
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/1024px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    className="w-[35px] h-[35px]" 
                    resizeMode="contain" 
                />
                
                <View className="items-center flex-1 mx-2">
                    <Text className="text-sm font-bold text-[#1b3b6f]">Federal Republic of Nigeria</Text>
                    <Text className="text-[#1b3b6f] font-black text-[15px] mt-0.5">Verified NIN Details</Text>
                </View>
                
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" }} 
                    className="w-[45px] h-[30px]" 
                    resizeMode="contain" 
                />
            </View>

            {/* Main Content Area */}
            <View className="flex-row flex-1">
                
                {/* Left Column (Details + Photo + Lower Details) */}
                <View className="flex-[1.6] flex-col pr-3">
                    
                    {/* Top Section: First 5 fields + Circular Photo */}
                    <View className="flex-row items-center justify-between">
                        {/* Fields */}
                        <View className="flex-[1.3] justify-center">
                            <View className="flex-row mb-1">
                                <Text className="text-[8.5px] font-bold text-[#1b3b6f] w-[75px]">First Name:</Text>
                                <Text className="text-[8.5px] text-slate-800 font-bold uppercase flex-1" numberOfLines={1}>{firstName}</Text>
                            </View>
                            <View className="flex-row mb-1">
                                <Text className="text-[8.5px] font-bold text-[#1b3b6f] w-[75px]">Middle Name:</Text>
                                <Text className="text-[8.5px] text-slate-800 font-bold uppercase flex-1" numberOfLines={1}>{middleName}</Text>
                            </View>
                            <View className="flex-row mb-1">
                                <Text className="text-[8.5px] font-bold text-[#1b3b6f] w-[75px]">Last Name:</Text>
                                <Text className="text-[8.5px] text-slate-800 font-bold uppercase flex-1" numberOfLines={1}>{lastName}</Text>
                            </View>
                            <View className="flex-row mb-1">
                                <Text className="text-[8.5px] font-bold text-[#1b3b6f] w-[75px]">Date of birth:</Text>
                                <Text className="text-[8.5px] text-slate-800 font-mono uppercase flex-1" numberOfLines={1}>{formattedDob}</Text>
                            </View>
                            <View className="flex-row">
                                <Text className="text-[8.5px] font-bold text-[#1b3b6f] w-[75px]">Gender:</Text>
                                <Text className="text-[8.5px] text-slate-800 font-mono uppercase flex-1" numberOfLines={1}>{gender}</Text>
                            </View>
                        </View>

                        {/* Circular Photo */}
                        <View className="w-16 h-16 rounded-full bg-[#ebf3fc] border border-[#aed0ee] overflow-hidden items-center justify-center ml-2">
                            {photo && photo.startsWith('http') ? (
                                <Image source={{ uri: photo }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Ionicons name="person" size={32} color="#90cdf4" />
                            )}
                        </View>
                    </View>

                    {/* NIN Number spanning row */}
                    <View className="flex-row items-center border-t border-b border-gray-100 py-1.5 my-1.5">
                        <Text className="text-[10px] font-bold text-[#1b3b6f] mr-2">NIN Number:</Text>
                        <Text className="text-[10px] text-slate-900 font-black font-mono tracking-wider">{nin}</Text>
                    </View>

                    {/* Lower Details */}
                    <View className="flex-col">
                        <View className="flex-row justify-between mb-0.5">
                            <View className="flex-row flex-1">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Tracking ID:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-mono flex-1 uppercase" numberOfLines={1}>{trackingId}</Text>
                            </View>
                            <View className="flex-row flex-1 ml-2">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Phone Number:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-mono flex-1 uppercase" numberOfLines={1}>{phone}</Text>
                            </View>
                        </View>

                        <View className="flex-row justify-between mb-0.5">
                            <View className="flex-row flex-1">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Residence State:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-bold flex-1 uppercase" numberOfLines={1}>{residenceState}</Text>
                            </View>
                            <View className="flex-row flex-1 ml-2">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Residence LGA:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-bold flex-1 uppercase" numberOfLines={1}>{residenceLga}</Text>
                            </View>
                        </View>

                        <View className="flex-row justify-between mb-0.5">
                            <View className="flex-row flex-1">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Birth State:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-bold flex-1 uppercase" numberOfLines={1}>{birthState}</Text>
                            </View>
                            <View className="flex-row flex-1 ml-2">
                                <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Birth LGA:</Text>
                                <Text className="text-[7.5px] text-slate-700 font-bold flex-1 uppercase" numberOfLines={1}>{birthLga}</Text>
                            </View>
                        </View>

                        <View className="flex-row">
                            <Text className="text-[7.5px] font-bold text-[#1b3b6f] w-[70px]">Address:</Text>
                            <Text className="text-[7.5px] text-slate-700 font-bold flex-1 uppercase" numberOfLines={1}>{address}</Text>
                        </View>
                    </View>

                </View>

                {/* Right Column (Verified, Warning, Terms) */}
                <View className="flex-[0.9] border-l border-gray-100 pl-3 flex-col justify-between">
                    
                    {/* Top: Verified & Warning */}
                    <View className="items-center">
                        <Text className="text-[18px] font-black text-green-600 tracking-tight uppercase">Verified</Text>
                        <Text className="text-[5.5px] text-center text-slate-500 mt-1 leading-[7.5px]">
                            This is a property of National Identity Management Commission (NIMC), Nigeria.
                            If found, please return to the nearest NIMC's office or contact +234 815 769 1214, +234 815 769 1071
                        </Text>
                    </View>
                    
                    {/* Bottom: Bullet terms */}
                    <View className="w-full mt-2">
                        <View className="flex-row mb-1">
                            <Text className="text-[5.5px] font-bold text-slate-800 mr-0.5">1.</Text>
                            <Text className="text-[5.5px] text-slate-600 leading-[7.5px] flex-1">This NIN slip remains the property of the Federal Republic of Nigeria, and MUST be surrendered on demand;</Text>
                        </View>
                        <View className="flex-row mb-1">
                            <Text className="text-[5.5px] font-bold text-slate-800 mr-0.5">2.</Text>
                            <Text className="text-[5.5px] text-slate-600 leading-[7.5px] flex-1">This NIN slip does not imply nor confer citizenship of the Federal Republic of Nigeria on the individual the document is issued to;</Text>
                        </View>
                        <View className="flex-row">
                            <Text className="text-[5.5px] font-bold text-slate-800 mr-0.5">3.</Text>
                            <Text className="text-[5.5px] text-slate-600 leading-[7.5px] flex-1">This NIN slip is valid for the lifetime of the holder and <Text className="text-red-500 font-bold">DOES NOT EXPIRE.</Text></Text>
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
};
