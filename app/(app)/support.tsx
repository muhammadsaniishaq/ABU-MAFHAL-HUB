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
    { q: "How do I fund my wallet?", a: "You can fund your wallet via Dedicated Virtual Bank Transfer (Monnify / Payvessel) in the 'Wallet' tab." },
    { q: "What if my transaction fails or delays?", a: "If a transaction is delayed or fails while you are debited, simply open a Support Ticket or chat with Cotex AI to resolve it instantly." },
    { q: "Is my card and NIN/BVN information safe?", a: "Yes, we use bank-grade end-to-end encryption. Your sensitive financial data is completely secure." },
    { q: "How do I upgrade my account or limits?", a: "Navigate to KYC Verification in your Profile to upgrade your daily transaction limits." },
  ];

  const filteredFAQs = searchQuery.trim()
    ? FAQs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQs;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* HEADER HERO BANNER */}
      <LinearGradient colors={['#0d1b3e', '#142258']} style={s.headerHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={s.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.headerBackBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={16} color="#ffffff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Help & Support Desk</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* COMPACT SEARCH BAR */}
          <View style={s.searchBarWrapper}>
            <Ionicons name="search" size={14} color="#f5a623" />
            <TextInput 
              style={s.searchInput}
              placeholder="Search help topics or questions..."
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
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
            colors={['#ffffff', '#f8fafc']}
            style={s.aiCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.aiCardLeft}>
              <View style={s.aiBadgeRow}>
                <View style={s.aiBadgeDot} />
                <Text style={s.aiBadgeText}>24/7 VIRTUAL ASSISTANT</Text>
              </View>
              <Text style={s.aiCardTitle}>Chat with Cotex AI</Text>
              <Text style={s.aiCardDesc}>Get instant, intelligent answers in Hausa, English or Pidgin.</Text>
            </View>

            <View style={s.aiIconCircle}>
              <Ionicons name="sparkles" size={18} color="#0d1b3e" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* SUPPORT TICKETS & TELEGRAM GRID */}
        <View style={s.twoGridRow}>
          <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(app)/tickets')} activeOpacity={0.75}>
            <View style={[s.gridIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Ionicons name="ticket-outline" size={16} color="#ef4444" />
            </View>
            <Text style={s.gridCardTitle}>My Tickets</Text>
            <Text style={s.gridCardSub}>Live Support Chats</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => handleContact('telegram')} activeOpacity={0.75}>
            <View style={[s.gridIconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
              <Ionicons name="paper-plane-outline" size={16} color="#0ea5e9" />
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
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              </View>
              <Text style={s.channelBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('email')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(245, 166, 35, 0.12)' }]}>
                <Ionicons name="mail" size={18} color="#d97706" />
              </View>
              <Text style={s.channelBtnText}>Email</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('phone')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="call" size={18} color="#2563eb" />
              </View>
              <Text style={s.channelBtnText}>Call Us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ ACCORDION */}
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

        {/* SOCIAL LINKS */}
        <View style={s.socialSection}>
          <Text style={s.socialTitle}>CONNECT WITH US</Text>
          <View style={s.socialRow}>
            <TouchableOpacity onPress={() => handleContact('facebook')} style={[s.socialCircle, { backgroundColor: 'rgba(24, 119, 242, 0.08)' }]}>
              <Ionicons name="logo-facebook" size={16} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('twitter')} style={[s.socialCircle, { backgroundColor: 'rgba(29, 155, 240, 0.08)' }]}>
              <Ionicons name="logo-twitter" size={16} color="#1D9BF0" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('instagram')} style={[s.socialCircle, { backgroundColor: 'rgba(225, 48, 108, 0.08)' }]}>
              <Ionicons name="logo-instagram" size={16} color="#E1306C" />
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
    backgroundColor: '#f8fafc',
  },
  headerHero: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headerBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14.5,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 36,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  aiCardWrapper: {
    marginBottom: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  aiBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  aiBadgeText: {
    color: '#059669',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  aiCardTitle: {
    color: '#0d1b3e',
    fontWeight: '900',
    fontSize: 13.5,
    marginBottom: 2,
  },
  aiCardDesc: {
    color: '#64748b',
    fontSize: 10.5,
    lineHeight: 15,
  },
  aiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 166, 35, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  gridIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridCardTitle: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 12,
  },
  gridCardSub: {
    color: '#64748b',
    fontSize: 9.5,
    marginTop: 1,
  },
  sectionBox: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  humanBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  humanBadgeText: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
  },
  channelsCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  channelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  channelIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  channelBtnText: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 10.5,
  },
  channelDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  faqContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  faqItem: {
    padding: 10,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faqQBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  faqQText: {
    color: '#d97706',
    fontWeight: '900',
    fontSize: 9.5,
  },
  faqContent: {
    flex: 1,
  },
  faqQuestion: {
    color: '#0d1b3e',
    fontWeight: '800',
    fontSize: 11.5,
    marginBottom: 2,
    lineHeight: 16,
  },
  faqAnswer: {
    color: '#64748b',
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  socialSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  socialTitle: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
