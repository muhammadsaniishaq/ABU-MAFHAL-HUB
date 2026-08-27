import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Linking, TextInput,
  StyleSheet, Dimensions, StatusBar, Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../hooks/useAppSettings';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

// Light Luxury Executive Design Tokens
const L = {
  bg: '#F4F6FB',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  navyHeader: '#0F172A',
  navyMid: '#1E293B',
  gold: '#FFD700',
  goldDk: '#DAA520',
  goldAmber: '#D97706',
  goldLight: '#FEF3C7',
  goldBg: 'rgba(254, 243, 199, 0.7)',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  emerald: '#10B981',
  emeraldBg: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  sky: '#0EA5E9',
  skyBg: '#F0F9FF',
  coral: '#EF4444',
};

export default function SupportScreen() {
  const { settings } = useAppSettings();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);

  const handleContact = (type: 'whatsapp' | 'email' | 'phone' | 'facebook' | 'twitter' | 'instagram' | 'telegram') => {
    let url = '';
    const whatsappNumber = settings.support_whatsapp || '2348145853539';
    const emailAddress = settings.support_email || 'admin@abumafhal.com.ng';
    
    switch (type) {
      case 'whatsapp': url = `whatsapp://send?phone=${whatsappNumber}&text=Hello%20Abu%20Mafhal%20Support,%20I%20need%20assistance`; break;
      case 'email': url = `mailto:${emailAddress}?subject=Support%20Request%20-%20Abu%20Mafhal%20Hub`; break;
      case 'phone': url = `tel:+${whatsappNumber}`; break;
      case 'facebook': url = `https://facebook.com/abumafhal`; break;
      case 'twitter': url = `https://twitter.com/abumafhal0`; break;
      case 'instagram': url = `https://instagram.com/abumafhal`; break;
      case 'telegram': url = `https://t.me/abumafhal`; break;
    }
    Linking.openURL(url).catch(() => {});
  };

  const FAQs = [
    { 
      q: "How do I fund my wallet?", 
      a: "Navigate to the 'Wallet' tab and copy your dedicated virtual account number (Monnify / Payvessel). Any bank transfer to that account credits your wallet in under 15 seconds." 
    },
    { 
      q: "What if my airtime or data purchase delays?", 
      a: "Data and airtime are delivered instantly. If a network delay occurs, your transaction status will update automatically. You can also tap 'My Tickets' to report with your transaction reference." 
    },
    { 
      q: "How do I print NIN or BVN verification slips?", 
      a: "Go to Services -> Identity -> NIN/BVN Verification. After verifying, tap 'Generate Premium Slip' to download a print-ready, high-resolution PDF slip." 
    },
    { 
      q: "How do I upgrade my account KYC limit?", 
      a: "Go to Profile -> KYC Verification. Upload your valid National Identity Number (NIN) or Voter's Card to increase your daily funding and transfer limits." 
    },
    { 
      q: "Are my card and account details safe?", 
      a: "Yes. All sensitive operations use end-to-end 256-bit encryption. We never store full card CVVs or banking passwords on client devices." 
    },
  ];

  const filteredFAQs = searchQuery.trim()
    ? FAQs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQs;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* COMPACT ROYAL NAVY HEADER */}
      <LinearGradient 
        colors={['#0F172A', '#1E293B', '#0F172A']} 
        style={s.headerHero} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={s.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={s.headerBackBtn} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={16} color={L.gold} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.headerTitle}>Help & Support Desk</Text>
              <View style={s.liveStatusBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveStatusText}>Support Agents Online • 24/7</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/tickets')} style={s.headerTicketBtn} activeOpacity={0.8}>
              <Ionicons name="ticket-outline" size={15} color={L.gold} />
            </TouchableOpacity>
          </View>

          {/* COMPACT SEARCH BAR */}
          <View style={s.searchBarWrapper}>
            <Ionicons name="search" size={14} color={L.goldDk} />
            <TextInput 
              style={s.searchInput}
              placeholder="Search questions, wallet, data, NIN..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              selectionColor={L.goldDk}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={s.scrollView} 
        contentContainerStyle={s.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* SYSTEM STATUS PILL */}
        <View style={s.statusBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={s.greenStatusDot} />
            <Text style={s.statusBannerText}>All Services Operational</Text>
          </View>
          <Text style={s.statusUptimeText}>99.9% Core Uptime</Text>
        </View>

        {/* CORTEX AI INTELLIGENT ASSISTANT CARD */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/ai-chat')} style={s.aiCardWrapper}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC']}
            style={s.aiCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.aiCardLeft}>
              <View style={s.aiBadgeRow}>
                <View style={s.aiBadgeDot} />
                <Text style={s.aiBadgeText}>AI SPEED SUPPORT</Text>
              </View>
              <Text style={s.aiCardTitle}>Chat with Cortex AI</Text>
              <Text style={s.aiCardDesc}>Instant resolution for transactions, airtime, data, and service questions.</Text>
            </View>

            <View style={s.aiIconCircle}>
              <Ionicons name="sparkles" size={16} color={L.goldDk} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* 2-COLUMN ACTION CARDS: TICKETS & TELEGRAM */}
        <View style={s.twoGridRow}>
          <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(app)/tickets')} activeOpacity={0.75}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={[s.gridIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="ticket-outline" size={15} color={L.coral} />
              </View>
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeText}>LIVE</Text>
              </View>
            </View>
            <Text style={s.gridCardTitle}>My Support Tickets</Text>
            <Text style={s.gridCardSub}>View active chats & track status</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => handleContact('telegram')} activeOpacity={0.75}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={[s.gridIconCircle, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                <Ionicons name="paper-plane-outline" size={15} color={L.sky} />
              </View>
              <Ionicons name="open-outline" size={12} color="#94A3B8" />
            </View>
            <Text style={s.gridCardTitle}>Telegram Hub</Text>
            <Text style={s.gridCardSub}>Join official user community</Text>
          </TouchableOpacity>
        </View>

        {/* DIRECT LIVE CONTACT CHANNELS */}
        <View style={s.sectionBox}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionHeading}>Direct Live Channels</Text>
            <View style={s.humanBadge}>
              <Text style={s.humanBadgeText}>HUMAN SPECIALISTS</Text>
            </View>
          </View>

          <View style={s.channelsCard}>
            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('whatsapp')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(37, 211, 102, 0.12)' }]}>
                <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
              </View>
              <Text style={s.channelBtnText}>WhatsApp</Text>
              <Text style={s.channelSubText}>Instant Chat</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('email')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(218, 165, 32, 0.15)' }]}>
                <Ionicons name="mail" size={17} color={L.goldAmber} />
              </View>
              <Text style={s.channelBtnText}>Email Desk</Text>
              <Text style={s.channelSubText}>Official Mail</Text>
            </TouchableOpacity>

            <View style={s.channelDivider} />

            <TouchableOpacity style={s.channelBtn} onPress={() => handleContact('phone')} activeOpacity={0.75}>
              <View style={[s.channelIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="call" size={17} color="#2563EB" />
              </View>
              <Text style={s.channelBtnText}>Helpline</Text>
              <Text style={s.channelSubText}>Direct Line</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FREQUENTLY ASKED QUESTIONS (EXPANDABLE) */}
        <View style={s.sectionBox}>
          <Text style={s.sectionHeading}>Frequently Asked Questions</Text>
          
          <View style={s.faqContainer}>
            {filteredFAQs.map((faq, index) => {
              const isExpanded = expandedFAQ === index;
              return (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => setExpandedFAQ(isExpanded ? null : index)}
                  style={[s.faqItem, index !== filteredFAQs.length - 1 && s.faqItemBorder]}
                  activeOpacity={0.75}
                >
                  <View style={s.faqHeaderRow}>
                    <View style={s.faqQBadge}>
                      <Text style={s.faqQText}>Q</Text>
                    </View>
                    <Text style={s.faqQuestion}>{faq.q}</Text>
                    <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
                  </View>
                  {isExpanded && (
                    <View style={s.faqAnswerWrap}>
                      <Text style={s.faqAnswer}>{faq.a}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SOCIAL CHANNELS */}
        <View style={s.socialSection}>
          <Text style={s.socialTitle}>CONNECT WITH ABU MAFHAL HUB</Text>
          <View style={s.socialRow}>
            <TouchableOpacity onPress={() => handleContact('facebook')} style={[s.socialCircle, { backgroundColor: 'rgba(24, 119, 242, 0.08)' }]}>
              <Ionicons name="logo-facebook" size={15} color="#1877F2" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('twitter')} style={[s.socialCircle, { backgroundColor: 'rgba(29, 155, 240, 0.08)' }]}>
              <Ionicons name="logo-twitter" size={15} color="#1D9BF0" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleContact('instagram')} style={[s.socialCircle, { backgroundColor: 'rgba(225, 48, 108, 0.08)' }]}>
              <Ionicons name="logo-instagram" size={15} color="#E1306C" />
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
    backgroundColor: L.bg,
  },
  headerHero: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomWidth: 1.5,
    borderColor: L.goldDk,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headerBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTicketBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: L.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: L.emerald,
  },
  liveStatusText: {
    color: L.goldLight,
    fontSize: 9,
    fontWeight: '700',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060B19',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 36,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(218, 165, 32, 0.35)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: L.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  greenStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: L.emerald,
  },
  statusBannerText: {
    color: L.textPrimary,
    fontWeight: '800',
    fontSize: 10.5,
  },
  statusUptimeText: {
    color: L.emerald,
    fontWeight: '800',
    fontSize: 9.5,
  },
  aiCardWrapper: {
    marginBottom: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
  aiCardLeft: {
    flex: 1,
    marginRight: 8,
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  aiBadgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: L.emerald,
  },
  aiBadgeText: {
    color: L.emerald,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  aiCardTitle: {
    color: L.navyHeader,
    fontWeight: '900',
    fontSize: 12.5,
    marginBottom: 1,
  },
  aiCardDesc: {
    color: L.textMuted,
    fontSize: 9.5,
    lineHeight: 13,
  },
  aiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: L.goldLight,
    borderWidth: 1,
    borderColor: L.goldDk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    backgroundColor: L.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: L.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  gridIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  activeBadgeText: {
    color: L.coral,
    fontSize: 7.5,
    fontWeight: '900',
  },
  gridCardTitle: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 11,
    marginTop: 2,
  },
  gridCardSub: {
    color: L.textMuted,
    fontSize: 8.5,
    marginTop: 1,
  },
  sectionBox: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    color: L.navyHeader,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
    marginLeft: 2,
  },
  humanBadge: {
    backgroundColor: L.goldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  humanBadgeText: {
    color: L.goldAmber,
    fontSize: 7.5,
    fontWeight: '900',
  },
  channelsCard: {
    flexDirection: 'row',
    backgroundColor: L.card,
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: L.cardBorder,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  channelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  channelIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  channelBtnText: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10,
  },
  channelSubText: {
    color: L.textMuted,
    fontSize: 8,
    marginTop: 1,
  },
  channelDivider: {
    width: 1,
    height: 26,
    backgroundColor: L.cardBorder,
  },
  faqContainer: {
    backgroundColor: L.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  faqItem: {
    padding: 10,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: L.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: L.goldDk,
  },
  faqQText: {
    color: L.goldAmber,
    fontWeight: '900',
    fontSize: 8.5,
  },
  faqQuestion: {
    color: L.navyHeader,
    fontWeight: '800',
    fontSize: 10.5,
    flex: 1,
    marginRight: 6,
  },
  faqAnswerWrap: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingLeft: 24,
  },
  faqAnswer: {
    color: L.textSecondary,
    fontSize: 9.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  socialSection: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  socialTitle: {
    color: L.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.cardBorder,
  },
});

