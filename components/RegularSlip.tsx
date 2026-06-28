import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const RegularSlip = ({ data }: { data: any }) => {
    const getVal = (keys: string[], fallback: string = 'N/A'): string => {
        for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
                return String(data[k]);
            }
        }
        return fallback;
    };
    
    const firstName = getVal(['first_name', 'firstName', 'firstname', 'first'], '');
    const lastName = getVal(['last_name', 'lastName', 'lastname', 'surname', 'last'], '');
    const middleName = getVal(['middle_name', 'middleName', 'middlename', 'middle'], '');
    const dob = getVal(['dob', 'dateOfBirth', 'date_of_birth', 'birthdate'], '01 OCT 1960');
    
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

    const nin = getVal(['nin', 'number', 'nin_number', 'national_id', 'identity_number'], '00000000000');
    const formattedNinNoSpace = nin.replace(/\D/g, '');
    const photo = getVal(['photo', 'image', 'picture', 'avatar', 'face_image'], '') || null;
    const trackingId = getVal(['tracking_id', 'trackingId', 'tracking'], 'H6Y0NYFH00373');
    const genderVal = getVal(['gender', 'sex', 'gender_id'], 'M') || 'M';
    const gender = genderVal.toUpperCase().startsWith('M') ? 'M' : 'F';
    const address = getVal(['residence_address', 'address'], '47, Harmony Avenue\nKETU ALAPERE\nLagos');
    const issueDate = getVal(['issue_date', 'issueDate', 'issued'], '09/09/2018');

    return (
        <View className="w-full bg-[#FAF9F5] aspect-[2.15] border border-black shadow-sm flex-col justify-between overflow-hidden">
            {/* Header Section */}
            <View className="flex-row items-center justify-between p-2 pb-1">
                {/* Coat of arms */}
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/1024px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    className="w-[45px] h-[45px]" 
                    resizeMode="contain" 
                />
                
                {/* Center Texts */}
                <View className="items-center flex-1 mx-2">
                    <Text className="text-black text-[14px] font-black tracking-tight text-center uppercase" style={{ fontFamily: 'System' }}>
                        National Identity Management System
                    </Text>
                    <Text className="text-black text-[10px] font-bold text-center mt-0.5">
                        Federal Republic of Nigeria
                    </Text>
                    <Text className="text-[#1a1a1a] text-[9.5px] font-extrabold text-center mt-0.5">
                        National Identification Number Slip (NINS)
                    </Text>
                </View>

                {/* NIMC Logo */}
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Logo_for_NIMC.png" }} 
                    className="w-[50px] h-[35px]" 
                    resizeMode="contain" 
                />
            </View>

            {/* Main Table Grid */}
            <View className="flex-row flex-1 border-t border-b border-black">
                {/* Column 1 */}
                <View className="w-[28%] border-r border-black flex-col">
                    {/* Row 1: Tracking ID */}
                    <View className="flex-1 border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">Tracking ID</Text>
                        <Text className="text-[7.5px] font-bold text-slate-700 font-mono">{trackingId}</Text>
                    </View>
                    {/* Row 2: NIN with Red Oval */}
                    <View className="flex-[1.2] border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[8px] font-black text-slate-800">NIN</Text>
                        <View className="border border-red-500 rounded-full px-1.5 py-0.5">
                            <Text className="text-[8px] font-black text-slate-900 font-mono tracking-tight">{formattedNinNoSpace}</Text>
                        </View>
                    </View>
                    {/* Row 3: Issue Date */}
                    <View className="flex-1 border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">Issue Date</Text>
                        <Text className="text-[7.5px] font-bold text-slate-700 font-mono">{issueDate}</Text>
                    </View>
                    {/* Row 4: Empty cell */}
                    <View className="flex-1 bg-[#FAF9F5]" />
                </View>

                {/* Column 2 */}
                <View className="w-[39%] border-r border-black flex-col">
                    {/* Row 1: Surname */}
                    <View className="flex-1 border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">Surname</Text>
                        <Text className="text-[7.5px] font-black text-slate-900 uppercase flex-1 text-right ml-1" numberOfLines={1}>{lastName || 'N/A'}</Text>
                    </View>
                    {/* Row 2: First Name */}
                    <View className="flex-1 border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">First Name</Text>
                        <Text className="text-[7.5px] font-black text-slate-900 uppercase flex-1 text-right ml-1" numberOfLines={1}>{firstName || 'N/A'}</Text>
                    </View>
                    {/* Row 3: Middle Name */}
                    <View className="flex-1 border-b border-black flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">Middle Name</Text>
                        <Text className="text-[7.5px] font-bold text-slate-900 uppercase flex-1 text-right ml-1" numberOfLines={1}>{middleName || 'N/A'}</Text>
                    </View>
                    {/* Row 4: Gender */}
                    <View className="flex-1 flex-row items-center justify-between px-1.5 bg-[#FAF9F5]">
                        <Text className="text-[7.5px] font-black text-slate-800">Gender</Text>
                        <Text className="text-[7.5px] font-black text-slate-900 font-mono">{gender}</Text>
                    </View>
                </View>

                {/* Column 3 */}
                <View className="w-[33%] flex-row bg-[#FAF9F5]">
                    {/* Left: Address label & value */}
                    <View className="flex-1 p-1.5 justify-start">
                        <Text className="text-[7.5px] font-black text-slate-800 mb-0.5">Address:</Text>
                        <Text className="text-[6.5px] text-slate-800 font-semibold leading-[9px] uppercase">{address}</Text>
                    </View>
                    {/* Right: Rectangular photo */}
                    <View className="w-[65px] h-full bg-[#FAF9F5] border-l border-black items-center justify-center p-0.5">
                        {photo && photo.startsWith('http') ? (
                            <Image source={{ uri: photo }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <View className="w-full h-full bg-[#e5e5e5] items-center justify-center">
                                <Ionicons name="person" size={30} color="#b5b5b5" />
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Note Section */}
            <View className="px-2 py-0.5 items-center justify-center">
                <Text className="text-[6px] text-slate-800 font-bold text-center">
                    Note: <Text className="font-normal">This transaction slip does not confer the right to the </Text>General Multipurpose Card<Text className="font-normal"> (For any enquiry please contact)</Text>
                </Text>
            </View>

            {/* Footer Section */}
            <View className="flex-row border-t border-black h-8 bg-[#FAF9F5]">
                {/* Footer Col 1: Email */}
                <View className="flex-[0.9] border-r border-black items-center justify-center px-0.5 flex-row">
                    <Ionicons name="mail" size={10} color="#666" className="mr-0.5" />
                    <Text className="text-[6px] font-bold text-slate-900 font-mono">helpdesk@nimc.gov.ng</Text>
                </View>
                {/* Footer Col 2: Web */}
                <View className="flex-[0.8] border-r border-black items-center justify-center px-0.5 flex-row">
                    <Ionicons name="globe-outline" size={10} color="#2b6cb0" className="mr-0.5" />
                    <Text className="text-[6px] font-bold text-slate-900 font-mono">www.nimc.gov.ng</Text>
                </View>
                {/* Footer Col 3: Phone */}
                <View className="flex-[1.2] border-r border-black items-center justify-center px-0.5 flex-row">
                    <View className="w-3 h-3 rounded-full bg-green-600 items-center justify-center mr-0.5">
                        <Ionicons name="call" size={6} color="white" />
                    </View>
                    <Text className="text-[5.5px] font-bold text-slate-900 text-center leading-none font-mono">
                        07040144452,07040144453,{"\n"}07040144453
                    </Text>
                </View>
                {/* Footer Col 4: NIMC Address */}
                <View className="flex-[1.4] items-center justify-center px-1 flex-row">
                    <Ionicons name="save" size={10} color="#008240" className="mr-0.5" />
                    <View className="flex-1 justify-center">
                        <Text className="text-[5.5px] font-bold text-slate-900 leading-none">National Identity Management Commission</Text>
                        <Text className="text-[4.5px] text-slate-600 leading-none mt-0.5">11 Sokode Crescent, Off Dalaba Street Zone 5, Wuse Abuja Nigeria</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};
