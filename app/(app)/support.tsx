import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Linking, TextInput,
  StyleSheet, Dimensions, StatusBar
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../hooks/useAppSettings';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

export default function SupportScreen() {
  const { settings } = useAppSettings();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleContact = (type: 'whatsapp' | 'email' | 'phone' | 'facebook' | 'twitter' | 'instagram' | 'telegram') => {
    let url = '';
    const whatsappNumber = settings.support_whatsapp || '2348145853539';
    const emailAddress = settings.support_email || 'admin@abumafhal.com.ng';
    
    switch (type) {
      case 'whatsapp': url = `whatsapp://send?phone=${whatsappNumber}`; break;
      case 'email': url = `mailto:${emailAddress}`; break;
      case 'phone': url = `tel:+${whatsappNumber}`; break;
      case 'facebook': url = `https://facebook.com/abumafhal`; break;
      case 'twitter': url = `https://twitter.com/abumafhal0`; break;
      case 'instagram': url = `https://instagram.com/abumafhal`; break;
      case 'telegram': url = `https://t.me/abumafhal`; break;
    }
    Linking.openURL(url).catch(() => {});
  };

  const FAQs = [
    { q: "How do I fund my wallet?", a: "You can fund your wallet via Bank Transfer or Card Payment in the 'Fund Wallet' section." },
    { q: "What if my transaction fails?", a: "If a transaction fails but you are debited, the amount will be refunded to your wallet automatically within 24 hours." },
    { q: "Is my card information safe?", a: "Yes, we use Paystack for payment processing. We do not store your card details." },
    { q: "How do I upgrade my account?", a: "Navigate to the settings menu and provide your KYC details to upgrade your account limit." },
  ];

  const filteredFAQs = searchQuery.trim()
    ? FAQs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQs;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* HEADER HERO BANNER */}
      <LinearGradient colors={['#06112b', '#0d1f4a', '#112660']} style={s.headerHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.headerBackBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={18} color="#ffffff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Help & Support Center</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* SEARCH BAR */}
          <View style={s.searchBarWrapper}>
            <Ionicons name="search" size={16} color="#f5a623" />
            <TextInput 
              style={s.searchInput}
              placeholder="Search help topics or questions..."
              placeholderTextColor="rgba(255, 255, 255, 0.55)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              selectionColor="#f5a623"
            />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={s.scrollView} 
        contentContainerStyle={s.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* COTEX AI ASSISTANT CARD */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/ai-chat')} style={s.aiCardWrapper}>
          <LinearGradient
            colors={['#09132e', '#11224d']}
            style={s.aiCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.aiCardLeft}>
              <View style={s.aiBadgeRow}>
                <View style={s.aiBadgeDot} />
                <Text style={s.aiBadgeText}>SMART AI ASSISTANT</Text>
              </View>
              <Text style={s.aiCardTitle}>Chat with Cotex AI</Text>
              <Text style={s.aiCardDesc}>Get instant, intelligent answers to your transactions & queries in Hausa or English.</Text>
            </View>

            <View style={s.aiIconCircle}>
              <Ionicons name="sparkles" size={22} color="#060d21" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* SUPPORT TICKETS & TELEGRAM GRID */}
        <View style={s.twoGridRow}>
          <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(app)/tickets')} activeOpacity={0.75}>
            <View style={[s.gridIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Ionicons name="ticket" size={18} color="#ef4444" />
            </View>
            <Text style={s.gridCardTitle}>My Tickets</Text>
            <Text style={s.gridCardSub}>Live Support Chats</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => handleContact('telegram')} activeOpacity={0.75}>
            <View style={[s.gridIconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.12)', borderColor: 'rgba(14, 165, 233, 0.3)' }]}>
              <Ionicons name="paper-plane" size={18} color="#0ea5e9" />
            </View>
            <Text style={s.gridCardTitle}>Community</Text>
            <Text style={s.gridCardSub}>Join Telegram Group</Text>
          </TouchableOpacity>
        </View>

        {/* LIVE CONTACT CHANNELS */}
        <View style={s.sectionBox}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionHeading}>Direct Live Channels</Text>
            <View style={s.humanBadge}>
              <Text style={s.humanBadgeText}>HUMAN SUPPORT</Text>
            </View>
          </View>

          <View style={s.channelsCard}>
            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('whatsapp')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(37, 211, 102, 0.12)' }]}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </View>
              <Text style={s.channelBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('email')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(245, 166, 35, 0.12)' }]}>
                <Ionicons name="mail" size={20} color="#f5a623" />
              </View>
              <Text style={s.channelBtnText}>Email</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('phone')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="call" size={20} color="#3b82f6" />
              </View>
              <Text style={s.channelBtnText}>Phone Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <View style={s.sectionBox}>
          <Text style={s.sectionHeading}>Frequently Asked Questions</Text>
          <View style={s.faqContainer}>
            {filteredFAQs.map((faq, index) => (
              <View key={index} style={[s.faqItem, index !== filteredFAQs.length - 1 && s.faqItemBorder]}>
                <View style={s.faqRow}>
                  <View style={s.faqQBadge}>
                    <Text style={s.faqQText}>Q</Text>
                  </View>
                  <View style={s.faqContent}>
                    <Text style={s.faqQuestion}>{faq.q}</Text>
                    <Text style={s.faqAnswer}>{faq.a}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* HEAD OFFICE LOCATION BANNER */}
        <View style={s.sectionBox}>
          <LinearGradient colors={['#060d21', '#0b1638']} style={s.officeCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={s.officeIconCircle}>
              <Ionicons name="location" size={20} color="#060d21" />
            </View>
            <View style={s.officeTextBox}>
              <Text style={s.officeTitle}>HEAD OFFICE</Text>
              <Text style={s.officeAddress}>No 1. Abu Mafhal Ltd, Goni Aji Street,{"\n"}Gashua, Yobe State, Nigeria.</Text>
            </View>
          </LinearGradient>
        </View>

        {/* SOCIAL MEDIA CHANNELS */}
        <View style={s.socialSection}>
          <Text style={s.socialTitle}>CONNECT WITH US</Text>
          <View style={s.socialRow}>
            <TouchableOpacity onPress={() => handleContact('facebook')} style={[s.socialCircle, { backgroundColor: 'rgba(24, 119, 242, 0.12)' }]}>
              <Ionicons name="logo-facebook" size={16} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('twitter')} style={[s.socialCircle, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <Ionicons name="logo-twitter" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('instagram')} style={[s.socialCircle, { backgroundColor: 'rgba(228, 64, 95, 0.12)' }]}>
              <Ionicons name="logo-instagram" size={16} color="#E4405F" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040814',
  },
  headerHero: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 6,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  searchBarWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12.5,
    marginLeft: 8,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  aiCardWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  aiCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiCardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  aiBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#f5a623',
    marginRight: 5,
  },
  aiBadgeText: {
    color: '#f5a623',
    fontWeight: '900',
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  aiCardTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 4,
  },
  aiCardDesc: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  aiIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5a623',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  twoGridRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 18,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#09132e',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridCardTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 2,
  },
  gridCardSub: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  sectionBox: {
    marginHorizontal: 16,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    color: '#cbd5e1',
    fontWeight: '900',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  humanBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  humanBadgeText: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  channelsCard: {
    flexDirection: 'row',
    backgroundColor: '#09132e',
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  channelIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  channelBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 11,
  },
  channelDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#1e293b',
  },
  faqContainer: {
    backgroundColor: '#09132e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  faqItem: {
    padding: 14,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faqQBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  faqQText: {
    color: '#f5a623',
    fontWeight: '900',
    fontSize: 11,
  },
  faqContent: {
    flex: 1,
  },
  faqQuestion: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12.5,
    marginBottom: 4,
    lineHeight: 17,
  },
  faqAnswer: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  officeCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  officeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5a623',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  officeTextBox: {
    flex: 1,
  },
  officeTitle: {
    color: '#f5a623',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  officeAddress: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  socialSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  socialTitle: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
});
