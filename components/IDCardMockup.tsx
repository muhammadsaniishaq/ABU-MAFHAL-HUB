import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const IDCardMockup = ({ data }: { data: any }) => {
    const getVal = (keys: string[], fallback: string | null = 'N/A') => {
        for (const k of keys) {
            if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
                return String(data[k]);
            }
        }
        return fallback;
    };
    const firstName = getVal(['first_name', 'firstName', 'firstname', 'first']);
    const lastName = getVal(['last_name', 'lastName', 'lastname', 'surname', 'last']);
    const middleName = getVal(['middle_name', 'middleName', 'middlename', 'middle'], '');
    const dob = getVal(['dob', 'dateOfBirth', 'date_of_birth', 'birthdate']);
    const genderVal = getVal(['gender', 'sex', 'gender_id'], 'f') || 'f';
    const gender = genderVal.toUpperCase() === 'M' || genderVal.toLowerCase().startsWith('m') ? 'MALE' : 'FEMALE';
    const nin = getVal(['nin', 'number', 'nin_number', 'national_id', 'identity_number']);
    const state = getVal(['state', 'state_of_origin', 'stateOfOrigin'], 'Yobe');
    const lga = getVal(['lga', 'lga_of_origin', 'lgaOfOrigin'], 'Gashua');
    const photo = getVal(['photo', 'image', 'picture', 'avatar', 'face_image'], null);

    return (
        <View className="w-full aspect-[1.586] rounded-3xl overflow-hidden border border-emerald-600/30 shadow-xl mb-6 relative bg-emerald-950">
            <LinearGradient colors={['#064e3b', '#022c22']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
            <View className="absolute inset-0 flex-row opacity-[0.04]">
                <View className="flex-1 bg-green-500" /><View className="flex-1 bg-white" /><View className="flex-1 bg-green-500" />
            </View>
            <View className="px-5 pt-4 pb-2 border-b border-white/10 flex-row justify-between items-center bg-black/20">
                <View className="flex-row items-center">
                    <Ionicons name="shield" size={18} color="#C5A059" />
                    <View className="ml-2">
                        <Text className="text-white text-[9px] font-black uppercase tracking-widest leading-3">Federal Republic of Nigeria</Text>
                        <Text className="text-emerald-400 text-[8px] font-bold uppercase tracking-wider leading-3">National Identity Management Commission</Text>
                    </View>
                </View>
            </View>
            <View className="flex-1 flex-row p-4 items-center">
                <View className="mr-4 items-center justify-center">
                    <View className="p-0.5 bg-emerald-600/30 rounded-2xl border border-white/25">
                        {photo && photo.startsWith('http') ? (
                            <Image source={{ uri: photo }} className="w-[76px] h-[95px] rounded-[14px]" resizeMode="cover" />
                        ) : (
                            <View className="w-[76px] h-[95px] bg-emerald-900/60 rounded-[14px] items-center justify-center border border-white/5">
                                <Ionicons name="person" size={40} color="rgba(255,255,255,0.15)" />
                            </View>
                        )}
                    </View>
                </View>
                <View className="flex-1 justify-between h-full py-0.5">
                    <View>
                        <View className="flex-row items-center mb-0.5">
                            <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">Surname:</Text>
                            <Text className="text-white text-[11px] font-black uppercase tracking-tight flex-1">{lastName}</Text>
                        </View>
                        <View className="flex-row items-center mb-0.5">
                            <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">First Name:</Text>
                            <Text className="text-white text-[11px] font-black uppercase tracking-tight flex-1">{firstName} {middleName}</Text>
                        </View>
                        <View className="flex-row justify-between mb-0.5 mr-2">
                            <View className="flex-row items-center">
                                <Text className="text-emerald-500 text-[7px] font-bold uppercase w-12">D.O.B:</Text>
                                <Text className="text-white text-[9px] font-extrabold uppercase tracking-tight">{dob}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-emerald-500 text-[7px] font-bold uppercase mr-1">Sex:</Text>
                                <Text className="text-white text-[9px] font-extrabold uppercase tracking-tight">{gender}</Text>
                            </View>
                        </View>
                    </View>
                    <View className="bg-emerald-900/40 border border-emerald-500/20 px-3 py-1 rounded-xl flex-row justify-between items-center mr-2 mt-1">
                        <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-wider">NIN:</Text>
                        <Text className="text-[#C5A059] text-[12px] font-black uppercase tracking-[2.5px]">{nin}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};
