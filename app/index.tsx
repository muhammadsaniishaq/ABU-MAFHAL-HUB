import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, ActivityIndicator, Linking, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const { width } = Dimensions.get('window');

export default function LandingPage() {
    const router = useRouter();
    const [userCount, setUserCount] = useState<number | null>(null);
    const [totalProcessed, setTotalProcessed] = useState<string>('50B+'); // Fallback to marketing stat
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

    const heroFeatures = [
        { text: "Financial Freedom", image: require('../assets/images/hero_finance.png') },
        { text: "Data & Airtime", image: require('../assets/images/hero_data.png') },
        { text: "Crypto Trading", image: require('../assets/images/hero_crypto.png') },
        { text: "Bill Payments", image: require('../assets/images/hero_bills.png') },
        { text: "Secure Savings", image: require('../assets/images/hero_savings.png') }
    ];

    useEffect(() => {
        // Auto-login check
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) router.replace('/(app)/dashboard');
        });

        fetchRealStats();

        const interval = setInterval(() => {
            setCurrentFeatureIndex((prev) => (prev + 1) % heroFeatures.length);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    const fetchRealStats = async () => {
        try {
            // Fetch real user count
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (count !== null) {
                setUserCount(count);
            }

            // Fetch total volume (sum of transaction amounts)
            const { data: txData } = await supabase
                .from('transactions')
                .select('amount')
                .eq('status', 'success');

            if (txData) {
                const total = txData.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
                if (total > 0) {
                    if (total >= 1000000) {
                        setTotalProcessed(`${(total / 1000000).toFixed(1)}M+`);
                    } else if (total >= 1000) {
                        setTotalProcessed(`${(total / 1000).toFixed(1)}K+`);
                    } else {
                        setTotalProcessed(`${total.toFixed(0)}+`);
                    }
                }
            }
        } catch (e) {
            console.log('Error fetching stats:', e);
        }
    };

    const features = [
        { title: 'Core Payments', desc: 'Data, Airtime, Bills, Transfers', icon: 'flash', color: '#0056D2' },
        { title: 'Wealth Suite', desc: 'Savings, Loans, Crypto & Stocks', icon: 'trending-up', color: '#107C10' },
        { title: 'Identity Hub', desc: 'BVN & NIN Advanced Services', icon: 'finger-print', color: '#F37021' },
        { title: 'Pro Finance', desc: 'Virtual Cards & Global Access', icon: 'card', color: '#8B5CF6' },
        { title: 'Global Transfers', desc: 'Send Money Internationally', icon: 'globe', color: '#0EA5E9' },
        { title: 'Education', desc: 'School Fees & Exam PINs', icon: 'school', color: '#D97706' },
        { title: 'Utility Bills', desc: 'Electricity & Cable TV', icon: 'bulb', color: '#EAB308' },
        { title: 'Crypto Exchange', desc: 'Trade Bitcoin & USDT', icon: 'logo-bitcoin', color: '#F59E0B' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar style="dark" />
            {/* Fixed Modern Navbar */}
            <View className="absolute top-0 left-0 right-0 z-50 px-6 pt-12 pb-4 flex-row justify-between items-center bg-white/90 backdrop-blur-md border-b border-gray-100/50 shadow-sm/5">
                <View className="flex-row items-center">
                    <Image
                        source={require('../assets/images/logo-icon.png')}
                        style={{ width: 32, height: 32 }}
                        className="rounded-full mr-2"
                        resizeMode="contain"
                    />
                    <Text className="text-sm font-extrabold text-slate-900 tracking-tight">ABU MAFHAL HUB</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/(auth)/login')}
                    className="bg-primary px-5 py-2.5 rounded-full shadow-sm shadow-primary/20"
                >
                    <Text className="text-white font-bold text-xs">Sign In</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 90 }}>

                {/* Header Spacer */}

                <View className="px-6 pt-10 pb-10 items-center">
                    <View className="bg-primary/10 px-3 py-1 rounded-full mb-6 border border-primary/20">
                        <Text className="text-primary text-[10px] font-bold uppercase tracking-[2px]">Build v1.0.12 - Secure</Text>
                    </View>
                    <Text className="text-3xl font-black text-slate-900 text-center leading-[36px] mb-4">
                        The Super App for your <Text className="text-primary">{heroFeatures[currentFeatureIndex].text}</Text>
                    </Text>
                    <Text className="text-slate-500 text-center text-lg leading-7 mb-10 px-4 font-medium">
                        Experience the next level of banking, investing, and identity services all in one place.
                    </Text>

                    <TouchableOpacity
                        onPress={() => router.push('/onboarding')}
                        className="bg-primary w-full h-16 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/40 mb-10"
                    >
                        <Text className="text-white font-bold text-xl tracking-wide">Get Started Now</Text>
                    </TouchableOpacity>

                    <View className="w-full items-center">
                         {/* Optional soft glow behind image if desired, but kept simple for white bg consistency */}
                        <Image
                            source={heroFeatures[currentFeatureIndex].image}
                            style={{ width: width * 0.9, height: width * 0.9 }}
                            className="rounded-xl"
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Why Choose Us */}
                <View className="px-6 py-20 bg-gray-50 mt-10">
                    <Text className="text-3xl font-bold text-slate mb-2">Why Abu Mafhal Hub?</Text>
                    <Text className="text-gray-500 mb-10">We provide a secure and efficient way to manage all your financial needs.</Text>

                    <View className="flex-row flex-wrap justify-between gap-y-6">
                        {features.map((f, i) => (
                            <View key={i} className="w-[48%] bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <View className="w-12 h-12 rounded-xl items-center justify-center mb-4" style={{ backgroundColor: f.color + '15' }}>
                                    <Ionicons name={f.icon as any} size={24} color={f.color} />
                                </View>
                                <Text className="font-bold text-slate text-lg mb-1">{f.title}</Text>
                                <Text className="text-gray-400 text-xs leading-4">{f.desc}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Our Partners */}
                <View className="py-12 bg-gray-50/50">
                    <Text className="text-xs font-black text-gray-400 uppercase tracking-[4px] text-center mb-10 opacity-60">Strategic Partners</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 30, alignItems: 'center', gap: 30 }}>

                        {/* Mastercard */}
                        <View className="flex-row items-center opacity-40 grayscale scale-[0.6]">
                            <View className="w-8 h-8 rounded-full bg-[#EB001B] z-10" />
                            <View className="w-8 h-8 rounded-full bg-[#FF5F00] -ml-5 z-0" />
                        </View>

                        {/* Visa */}
                        <View className="opacity-40 grayscale scale-75">
                            <Text className="font-black text-[#1434CB] text-xl italic tracking-tighter">VISA</Text>
                        </View>

                        {/* Verve */}
                        <View className="opacity-40 grayscale scale-75">
                            <Text className="font-bold text-slate-800 text-lg tracking-tight">Verve</Text>
                        </View>

                        {/* Interswitch */}
                        <View className="flex-row items-center opacity-40 grayscale scale-75">
                            <View className="w-5 h-5 bg-slate-800 rounded-sm mx-1" />
                            <Text className="font-bold text-slate-800 text-base tracking-tight">Interswitch</Text>
                        </View>

                        {/* NIBSS */}
                        <View className="opacity-40 grayscale scale-75">
                            <Text className="font-black text-slate-700 text-xl">NIBSS</Text>
                        </View>

                        {/* Remita */}
                        <View className="flex-row items-center opacity-40 grayscale scale-75">
                            <View className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-1" />
                            <View className="w-2.5 h-2.5 rounded-full bg-slate-700 mr-2" />
                            <Text className="font-bold text-slate-700 text-lg">Remita</Text>
                        </View>

                    </ScrollView>
                </View>

                {/* How It Works */}
                <View className="px-6 py-20 bg-slate-900">
                    <Text className="text-3xl font-bold text-white text-center mb-4">How it Works</Text>
                    <Text className="text-gray-400 text-center mb-12">Get started in minutes. No paperwork, just results.</Text>

                    {[
                        { title: 'Create Account', desc: 'Sign up in 2 minutes with just your phone number and NIN.', icon: 'person-add', color: '#60A5FA' },
                        { title: 'Fund Wallet', desc: 'Add money via bank transfer or card instantly.', icon: 'wallet', color: '#A78BFA' },
                        { title: 'Enjoy Freedom', desc: 'Pay bills, invest, and transfer money with zero stress.', icon: 'happy', color: '#34D399' },
                    ].map((step, i) => (
                        <View key={i} className="flex-row items-start mb-8 last:mb-0">
                            <View className="items-center mr-4">
                                <View className="w-12 h-12 rounded-full items-center justify-center bg-gray-800 border border-gray-700">
                                    <Ionicons name={step.icon as any} size={24} color={step.color} />
                                </View>
                                {i < 2 && <View className="w-0.5 h-12 bg-gray-800 my-2" />}
                            </View>
                            <View className="flex-1 pt-1">
                                <Text className="text-white font-bold text-lg mb-1">{step.title}</Text>
                                <Text className="text-gray-400 leading-5">{step.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Testimonials */}
                <View className="px-6 pb-20 pt-10">
                    <Text className="text-3xl font-bold text-slate mb-8">User Stories</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible">
                        {[
                            { name: 'Musa Ibrahim', role: 'Business Owner', text: 'This app changed how I manage my shop. Transfers are instant and the daily savings help me plan ahead.' },
                            { name: 'Amina Yusuf', role: 'Student', text: 'Buying data and paying school fees has never been easier. I love the student discounts on airtime!' },
                            { name: 'Chinedu Okeke', role: 'Freelancer', text: 'The dollar virtual card works perfectly for my online subscriptions. Best fintech app in Nigeria.' },
                        ].map((t, i) => (
                            <View key={i} className="w-80 bg-white p-6 rounded-3xl border border-gray-100 mr-4 shadow-sm">
                                <View className="flex-row mb-4">
                                    {[1, 2, 3, 4, 5].map(s => <Ionicons key={s} name="star" size={16} color="#F59E0B" />)}
                                </View>
                                <Text className="text-gray-600 leading-6 mb-6">"{t.text}"</Text>
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3">
                                        <Text className="font-bold text-gray-500">{t.name[0]}</Text>
                                    </View>
                                    <View>
                                        <Text className="font-bold text-slate">{t.name}</Text>
                                        <Text className="text-gray-400 text-xs">{t.role}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Trust & Stats */}
                <View className="px-6 py-10 bg-white">
                    <Text className="text-3xl font-bold text-slate text-center mb-10">Trusted by Millions</Text>
                    <View className="flex-row justify-between mb-10">
                        <View className="items-center w-1/3">
                            <Text className="text-3xl font-extrabold text-primary">{userCount !== null ? `${userCount}+` : '2M+'}</Text>
                            <Text className="text-gray-500 text-xs text-center font-bold mt-1">Active Users</Text>
                        </View>
                        <View className="items-center w-1/3 border-l border-r border-gray-100">
                            <Text className="text-3xl font-extrabold text-primary">₦{totalProcessed}</Text>
                            <Text className="text-gray-500 text-xs text-center font-bold mt-1">Processed</Text>
                        </View>
                        <View className="items-center w-1/3">
                            <Text className="text-3xl font-extrabold text-primary">99.9%</Text>
                            <Text className="text-gray-500 text-xs text-center font-bold mt-1">Uptime</Text>
                        </View>
                    </View>
                </View>

                {/* Trust & Security */}
                <View className="px-6 py-20 items-center">
                    <View className="bg-success/10 w-20 h-20 rounded-full items-center justify-center mb-6">
                        <Ionicons name="shield-checkmark" size={40} color="#107C10" />
                    </View>
                    <Text className="text-3xl font-bold text-slate text-center mb-4">Bank-Grade Security</Text>
                    <Text className="text-gray-500 text-center leading-6 px-4">
                        Your data and funds are protected with industry-leading encryption and 2FA security protocols.
                    </Text>
                </View>

                {/* Download CTA */}
                <View className="relative overflow-hidden bg-primary py-32 px-6 items-center">
                    {/* Decorative Gradients */}
                    <View className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[80px] -mr-20 -mt-20" />
                    <View className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/20 rounded-full blur-[80px] -ml-20 -mb-20" />

                    <View className="relative z-10 items-center max-w-2xl">
                        <Text className="text-6xl font-black text-white text-center mb-8 tracking-tighter leading-tight shadow-sm">
                            Ready to <Text className="text-blue-100">Launch?</Text>
                        </Text>
                        <Text className="text-blue-100 text-center text-xl mb-12 leading-8 font-medium">
                            Join 2 million+ users building wealth with Abu Mafhal Hub.
                        </Text>

                        <View className="w-full gap-5">
                            {/* App Store */}
                            <TouchableOpacity className="bg-white h-16 rounded-2xl flex-row items-center justify-center shadow-2xl shadow-blue-900/40">
                                <Ionicons name="logo-apple" size={28} color="black" />
                                <View className="ml-3 justify-center">
                                    <Text className="text-gray-900 text-[10px] font-black uppercase tracking-widest opacity-60 leading-3">Download on the</Text>
                                    <Text className="text-black font-black text-xl leading-5 tracking-tight">App Store</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Google Play */}
                            <TouchableOpacity className="bg-blue-600/50 h-16 rounded-2xl flex-row items-center justify-center border border-white/20 shadow-lg backdrop-blur-md">
                                <Ionicons name="logo-google-playstore" size={26} color="white" />
                                <View className="ml-3 justify-center">
                                    <Text className="text-blue-100 text-[10px] font-black uppercase tracking-widest opacity-80 leading-3">Get it on</Text>
                                    <Text className="text-white font-black text-xl leading-5 tracking-tight">Google Play</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View className="bg-slate-900 px-6 py-16 border-t border-slate-800">
                    <View className="items-center mb-10">
                        <Text className="text-white text-2xl font-bold mb-6">ABU MAFHAL HUB</Text>
                        
                        {/* Contact Info */}
                        <View className="items-center gap-2 mb-8">
                            <Text className="text-slate-400 text-sm text-center">123 Goni Aji street Gashua, Yobe State</Text>
                            <Text className="text-slate-400 text-sm text-center">admin@abumafhal.com.ng</Text>
                        </View>

                        {/* Social Media Icons */}
                        <View className="flex-row flex-wrap justify-center gap-4 mb-6 max-w-sm">
                            <TouchableOpacity onPress={() => Linking.openURL('https://facebook.com/abumafhal')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="logo-facebook" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.tiktok.com/@abumafhal0')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="logo-tiktok" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://x.com/abumafhal0')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="logo-twitter" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/abumafhal')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="logo-linkedin" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://instagram.com/abumafhal')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="logo-instagram" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://www.threads.net/@abumafhal')} className="w-10 h-10 bg-slate-800 rounded-full items-center justify-center">
                                <Ionicons name="at" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/2348145853539')} className="w-10 h-10 bg-green-900/50 rounded-full items-center justify-center border border-green-800">
                                <Ionicons name="logo-whatsapp" size={20} color="#4ADE80" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text className="text-slate-400 text-sm mb-2 text-center">© 2026 Abu Mafhal Hub. All rights reserved.</Text>
                    <Text className="text-slate-500 text-xs text-center border-t border-slate-800 pt-4 w-full">Licensed by RC: 8979939</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
