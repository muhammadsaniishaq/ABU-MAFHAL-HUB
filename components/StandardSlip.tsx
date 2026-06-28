import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

export const StandardSlip = ({ data }: { data: any }) => {
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
    
    // Format NIN as 4-3-4 (e.g., 0000 000 0000)
    const formattedNin = formattedNinNoSpace.length === 11
        ? `${formattedNinNoSpace.slice(0, 4)} ${formattedNinNoSpace.slice(4, 7)} ${formattedNinNoSpace.slice(7)}`
        : formattedNinNoSpace.replace(/(.{4})/g, '$1 ').trim();

    const photo = getVal(['photo', 'image', 'picture', 'avatar', 'face_image'], '') || null;

    return (
        <View className="w-full bg-white aspect-[1.586] rounded-xl overflow-hidden border border-gray-300 shadow-sm relative">
            {/* Background Watermarks - Central large faint Coat of Arms */}
            <View className="absolute inset-0 opacity-[0.04] items-center justify-center">
                <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/1024px-Coat_of_arms_of_Nigeria.svg.png" }} 
                    className="w-[185px] h-[185px]" 
                    resizeMode="contain" 
                />
            </View>
            
            {/* Main Content Container */}
            <View className="flex-1 p-3 flex-col justify-between">
                
                {/* Header Section */}
                <View className="flex-row justify-center items-center h-12 relative">
                    {/* Center Coat of Arms */}
                    <View className="items-center justify-center z-10">
                        <Image 
                            source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Coat_of_arms_of_Nigeria.svg/1024px-Coat_of_arms_of_Nigeria.svg.png" }} 
                            className="w-[50px] h-[50px]" 
                            resizeMode="contain" 
                        />
                    </View>
                </View>

                {/* Middle Section */}
                <View className="flex-row flex-1 mt-2 items-center z-10">
                    
                    {/* Photo Placeholder */}
                    <View className="w-[85px] h-[105px] bg-[#bfbfbf] border border-gray-400 rounded-tl-[40px] rounded-tr-[30px] rounded-bl-[10px] rounded-br-[15px] overflow-hidden items-center justify-center mr-3">
                        {photo && photo.startsWith('http') ? (
                            <Image source={{ uri: photo }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <Ionicons name="person" size={50} color="#e5e5e5" />
                        )}
                    </View>

                    {/* Details Column */}
                    <View className="flex-1 justify-center pb-2">
                        <View className="mb-2">
                            <Text className="text-[#7a8c99] text-[9px] font-bold tracking-tight">Surname/Nom</Text>
                            <Text className="text-black text-[11px] font-normal uppercase tracking-wider">{lastName}</Text>
                        </View>
                        
                        <View className="mb-2">
                            <Text className="text-[#7a8c99] text-[9px] font-bold tracking-tight">Given Names/Prénoms</Text>
                            <Text className="text-black text-[11px] font-normal uppercase tracking-wider">{firstName} {middleName}</Text>
                        </View>

                        <View>
                            <Text className="text-[#7a8c99] text-[9px] font-bold tracking-tight">Date of Birth</Text>
                            <Text className="text-black text-[11px] font-normal uppercase tracking-wider">{formattedDob}</Text>
                        </View>
                    </View>

                    {/* Right column: NGA, QR Code & Issue Date */}
                    <View className="w-16 items-center justify-between h-full pt-1">
                        <View className="items-center">
                            <Text className="text-black text-[22px] font-black tracking-wider" style={{ lineHeight: 22 }}>NGA</Text>
                            <Text className="text-[#a1a1a1] text-[9px] font-bold tracking-widest mt-0.5">{formattedNinNoSpace}</Text>
                        </View>
                        
                        <View className="w-16 h-16 bg-white border border-black p-0.5 items-center justify-center">
                            <QRCode value={nin || "UNKNOWN"} size={58} backgroundColor="transparent" />
                        </View>
                        
                        <View className="items-center">
                            <Text className="text-black text-[8px] font-bold tracking-tight">ISSUE DATE</Text>
                            <Text className="text-black text-[9px] font-normal">01 JAN 2021</Text>
                        </View>
                    </View>

                </View>

                {/* Bottom Section */}
                <View className="mt-1 pb-1 z-10">
                    <Text className="text-black text-[11px] font-bold text-center mb-0.5">
                        National Identification Number (NIN)
                    </Text>
                    <Text className="text-black text-[28px] font-normal tracking-[4px] text-center" style={{ fontFamily: 'monospace' }}>
                        {formattedNin}
                    </Text>
                </View>

            </View>
        </View>
    );
};
