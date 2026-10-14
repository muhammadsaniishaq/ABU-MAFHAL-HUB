import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  Switch,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import { payvesselCardService, VirtualCard, CardTransaction } from '../../services/payvesselCards';

const { width: W } = Dimensions.get('window');

// Merchant icons & colors for transaction ledger
const MERCHANT_META: Record<string, { icon: any; color: string; bg: string }> = {
  'Amazon Purchase': { icon: 'logo-amazon', color: '#FF9900', bg: '#FFF7ED' },
  'Netflix Subscription': { icon: 'film', color: '#E50914', bg: '#FEF2F2' },
  'Google Play': { icon: 'logo-google-playstore', color: '#01875F', bg: '#ECFDF5' },
  'Spotify': { icon: 'musical-notes', color: '#1DB954', bg: '#F0FDF4' },
  'ChatGPT Plus': { icon: 'sparkles', color: '#10A37F', bg: '#ECFDF5' },
  'Facebook Ads': { icon: 'logo-facebook', color: '#1877F2', bg: '#EFF6FF' },
  'AliExpress': { icon: 'cart', color: '#FF4747', bg: '#FFF1F2' },
  'Apple': { icon: 'logo-apple', color: '#000000', bg: '#F8FAFC' },
};

export default function VirtualCardsScreen() {
  const { settings } = useAppSettings();
  const router = useRouter();

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<VirtualCard | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [userName, setUserName] = useState('MUHAMMAD SANI ISYAKU');
  const [pvConfig, setPvConfig] = useState<any>(null);

  // Security Toggles
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic USD Rate
  const usdRate = Number(settings?.usd_exchange_rate) || 1600;

  // Modals Flow
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMyCardsModal, setShowMyCardsModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Filter Tabs
  const [myCardsTab, setMyCardsTab] = useState<'all' | 'USD' | 'NGN'>('all');
  const [txFilterTab, setTxFilterTab] = useState<'All' | 'Successful' | 'Pending' | 'Failed'>('All');
  const [limitTab, setLimitTab] = useState<'monthly' | 'transaction'>('monthly');

  // Form Inputs
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'NGN'>('USD');
  const [cardNameInput, setCardNameInput] = useState('ABU MAFHAL USD Card');
  const [initialFundInput, setInitialFundInput] = useState('50');
  const [topUpAmountInput, setTopUpAmountInput] = useState('50');
  const [limitInput, setLimitInput] = useState('500');
  const [renameInput, setRenameInput] = useState('');

  // Newly Created Card Holder
  const [recentlyCreatedCard, setRecentlyCreatedCard] = useState<VirtualCard | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (Platform.OS !== 'web') {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    }
    setTimeout(() => setToastMessage(null), 2500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const config = await payvesselCardService.getConfig();
      setPvConfig(config);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setWalletBalance(Number(profile.balance) || 0);
          if (profile.full_name) {
            setUserName(profile.full_name.toUpperCase());
            setCardNameInput(`${profile.full_name.split(' ')[0]} USD Card`);
          }
        }

        const userCards = await payvesselCardService.getUserCards(user.id);
        setCards(userCards);

        if (userCards.length > 0) {
          const current = selectedCard ? (userCards.find(c => c.id === selectedCard.id) || userCards[0]) : userCards[0];
          setSelectedCard(current);
          loadCardTransactions(current.id, user.id);
        } else {
          setSelectedCard(null);
        }
      }
    } catch (e: any) {
      console.error('Error loading virtual cards:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCardTransactions = async (cardId: string, userId: string) => {
    try {
      const txs = await payvesselCardService.getCardTransactions(cardId, userId);
      setTransactions(txs);
    } catch (e) {
      console.warn('Error loading card transactions:', e);
    }
  };

  // ── Actions ──
  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    triggerToast(`${label} copied to clipboard! 📋`);
  };

  const handleToggleFreeze = async (cardToToggle?: VirtualCard) => {
    const target = cardToToggle || selectedCard;
    if (!target) return;

    try {
      setActionLoading(true);
      const newStatus = await payvesselCardService.toggleFreezeCard(target.id, target.status);
      const updatedCard = { ...target, status: newStatus as any };

      setCards(prev => prev.map(c => c.id === target.id ? updatedCard : c));
      if (selectedCard?.id === target.id) setSelectedCard(updatedCard);

      triggerToast(newStatus === 'frozen' ? 'Card Frozen ❄️' : 'Card Unfrozen & Active 🟢');
    } catch (e: any) {
      triggerToast(e.message || 'Error updating freeze status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateVirtualCard = async () => {
    const fundAmount = Number(initialFundInput) || 0;
    if (selectedCurrency === 'USD' && fundAmount < 10) {
      triggerToast('Minimum initial funding for USD Card is $10');
      return;
    }

    try {
      setActionLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      const newCard = await payvesselCardService.createVirtualCard({
        userId: user.id,
        cardName: cardNameInput.trim() || `ABU MAFHAL ${selectedCurrency} Card`,
        cardHolderName: userName,
        currency: selectedCurrency,
        initialFundingAmount: fundAmount,
      });

      setRecentlyCreatedCard(newCard);
      setCards(prev => [newCard, ...prev]);
      setSelectedCard(newCard);
      setCreateStep(3); // Go to celebration step!

      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }

      // Refresh balance in background
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).maybeSingle();
      if (profile) setWalletBalance(Number(profile.balance) || 0);
    } catch (e: any) {
      triggerToast(e.message || 'Card creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTopUp = async () => {
    const amount = Number(topUpAmountInput);
    if (!amount || amount <= 0) {
      triggerToast('Please enter a valid amount');
      return;
    }
    if (!selectedCard) return;

    try {
      setActionLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const res = await payvesselCardService.fundCard({
        cardDbId: selectedCard.id,
        userId: user.id,
        amount,
        currency: selectedCard.currency,
      });

      const updated = { ...selectedCard, balance: res.newCardBalance };
      setSelectedCard(updated);
      setCards(prev => prev.map(c => c.id === selectedCard.id ? updated : c));
      setWalletBalance(res.newWalletBalance);

      setShowTopUpModal(false);
      setTopUpAmountInput('50');
      triggerToast(`Card funded with ${selectedCard.currency === 'USD' ? '$' : '₦'}${amount} 🎉`);

      // Refresh transactions
      loadCardTransactions(selectedCard.id, user.id);
    } catch (e: any) {
      triggerToast(e.message || 'Top-up failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (!selectedCard) return;
    const num = Number(limitInput);
    if (!num || num <= 0) return;

    try {
      setActionLoading(true);
      const updates = limitTab === 'monthly'
        ? { spending_limit_monthly: num }
        : { spending_limit_transaction: num };

      await payvesselCardService.updateCardSettings(selectedCard.id, updates);
      const updated = { ...selectedCard, ...updates };
      setSelectedCard(updated);
      setCards(prev => prev.map(c => c.id === selectedCard.id ? updated : c));

      setShowLimitModal(false);
      triggerToast(`${limitTab === 'monthly' ? 'Monthly' : 'Transaction'} limit updated to $${num} 🎯`);
    } catch (e: any) {
      triggerToast(e.message || 'Failed to update limit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRename = async () => {
    if (!selectedCard || !renameInput.trim()) return;

    try {
      setActionLoading(true);
      await payvesselCardService.updateCardName(selectedCard.id, renameInput.trim());
      const updated = { ...selectedCard, card_name: renameInput.trim() };
      setSelectedCard(updated);
      setCards(prev => prev.map(c => c.id === selectedCard.id ? updated : c));

      setShowRenameModal(false);
      triggerToast('Card name updated! 🏷️');
    } catch (e: any) {
      triggerToast(e.message || 'Failed to rename card');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSetting = async (key: 'online_payments_enabled' | 'international_payments_enabled' | 'contactless_payments_enabled', val: boolean) => {
    if (!selectedCard) return;
    const updated = { ...selectedCard, [key]: val };
    setSelectedCard(updated);
    setCards(prev => prev.map(c => c.id === selectedCard.id ? updated : c));

    try {
      await payvesselCardService.updateCardSettings(selectedCard.id, { [key]: val });
      triggerToast('Setting saved');
    } catch (e) {
      console.warn('Setting update warning:', e);
    }
  };

  // Calculation for Creation
  const calcCreationSummary = () => {
    const initialFund = Number(initialFundInput) || 0;
    const creationFeeUSD = pvConfig?.cardFeeUSD || 3.0;
    const creationFeeNGN = pvConfig?.cardFeeNGN || 1000;

    let feeNGN = 0;
    let fundNGN = 0;

    if (selectedCurrency === 'USD') {
      feeNGN = creationFeeUSD * usdRate;
      fundNGN = initialFund * usdRate;
    } else {
      feeNGN = creationFeeNGN;
      fundNGN = initialFund;
    }

    const totalNGN = feeNGN + fundNGN;
    return { feeNGN, fundNGN, totalNGN, creationFeeUSD };
  };

  // Filtered Cards for My Cards Modal
  const filteredCards = cards.filter(c => {
    if (myCardsTab === 'all') return true;
    return c.currency === myCardsTab;
  });

  // Filtered Transactions
  const filteredTxs = transactions.filter(t => {
    if (txFilterTab === 'All') return true;
    if (txFilterTab === 'Successful') return t.status === 'COMPLETED';
    if (txFilterTab === 'Pending') return t.status === 'PENDING';
    if (txFilterTab === 'Failed') return t.status === 'DECLINED';
    return true;
  });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070D1E" />

      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <View style={s.toast}>
          <Text style={s.toastTxt}>{toastMessage}</Text>
        </View>
      )}

      {/* ── TOP HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Virtual Card</Text>
        <TouchableOpacity
          onPress={() => setShowMyCardsModal(true)}
          style={s.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scrollArea}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loaderBox}>
            <ActivityIndicator size="large" color="#D97706" />
            <Text style={s.loaderTxt}>Accessing Payvessel Virtual Cards...</Text>
          </View>
        ) : selectedCard ? (
          <>
            {/* ══════════════════════════════════════════════════════════
                 1. 3D CARD STACK DISPLAY (EXACT TO MOCKUP)
                 ══════════════════════════════════════════════════════════ */}
            <View style={s.cardStackWrapper}>
              {/* Back layered card in stack */}
              <View style={s.cardStackBack} />
              <View style={s.cardStackMiddle} />

              {/* Front Primary Active Card */}
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => setShowDetailsModal(true)}
                style={s.cardFront}
              >
                <LinearGradient
                  colors={selectedCard.status === 'frozen' ? ['#1E293B', '#0F172A'] : ['#0A1329', '#0D1B3E', '#142552']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.cardGradient}
                >
                  {/* Card Header: AM Brand & Currency Flag */}
                  <View style={s.cardTopRow}>
                    <View style={s.cardBrandGroup}>
                      <Image
                        source={require('../../assets/images/am_luxury_logo.png')}
                        style={s.cardLogoImg}
                        resizeMode="contain"
                      />
                      <View style={{ marginLeft: 6 }}>
                        <Text style={s.cardBrandTxt}>ABU MAFHAL</Text>
                        <Text style={s.cardSubBrandTxt}>S U B</Text>
                      </View>
                    </View>

                    <View style={s.cardFlagBadge}>
                      <Text style={s.flagEmoji}>{selectedCard.currency === 'USD' ? '🇺🇸' : '🇳🇬'}</Text>
                      <Text style={s.currencyCodeTxt}>{selectedCard.currency}</Text>
                    </View>
                  </View>

                  {/* Chip & Contactless Row */}
                  <View style={s.chipRow}>
                    {/* Realistic Gold EMV Microchip */}
                    <View style={s.emvChip}>
                      <View style={s.chipLineV} />
                      <View style={s.chipLineH} />
                      <View style={s.chipInner} />
                    </View>
                    <Ionicons name="wifi" size={20} color="#D97706" style={{ transform: [{ rotate: '90deg' }] }} />
                  </View>

                  {/* Card Number */}
                  <Text style={s.cardNumberTxt}>
                    {showFullDetails
                      ? (selectedCard.card_number_full || selectedCard.card_number_masked)
                      : selectedCard.card_number_masked}
                  </Text>

                  {/* Bottom Row: Expiry, Name & VISA Logo */}
                  <View style={s.cardBottomRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.cardLabelSmall}>VALID{'\n'}THRU</Text>
                        <Text style={s.cardValText}>{selectedCard.expiry_month}/{selectedCard.expiry_year}</Text>
                        {showFullDetails && (
                          <View style={{ marginLeft: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={s.cardLabelSmall}>CVV</Text>
                            <Text style={s.cardValText}>{selectedCard.cvv || '•••'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.cardHolderNameTxt} numberOfLines={1}>
                        {selectedCard.card_holder_name || userName}
                      </Text>
                    </View>

                    {/* VISA White Metallic Wordmark */}
                    <View style={s.visaLogoBox}>
                      <Text style={s.visaTxt}>VISA</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════════════════════
                 2. CARD BALANCE & TOP UP CARD
                 ══════════════════════════════════════════════════════════ */}
            <View style={s.balanceCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.balanceLabel}>Card Balance</Text>
                  <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={hideBalance ? 'eye-off-outline' : 'eye-outline'} size={15} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <Text style={s.balanceAmount}>
                  {hideBalance
                    ? '••••••'
                    : `${selectedCard.currency === 'USD' ? '$' : '₦'}${Number(selectedCard.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Text>

                <Text style={s.balanceSub}>
                  {hideBalance
                    ? '••••••••••'
                    : selectedCard.currency === 'USD'
                      ? `≈ ₦${Math.round((selectedCard.balance || 0) * usdRate).toLocaleString()}`
                      : `≈ $${((selectedCard.balance || 0) / usdRate).toFixed(2)}`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowTopUpModal(true)}
                style={s.topUpBtn}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={17} color="#0D1B3E" />
                <Text style={s.topUpBtnTxt}>Top Up</Text>
              </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════════════════════
                 3. QUICK ACTION 4-ICON GRID
                 ══════════════════════════════════════════════════════════ */}
            <View style={s.actionsGrid}>
              {/* Show Details */}
              <TouchableOpacity
                onPress={() => setShowDetailsModal(true)}
                style={s.actionTile}
                activeOpacity={0.75}
              >
                <View style={s.actionTileIconBox}>
                  <Ionicons name="eye-outline" size={20} color="#0D1B3E" />
                </View>
                <Text style={s.actionTileTxt}>Show Details</Text>
              </TouchableOpacity>

              {/* Freeze Card */}
              <TouchableOpacity
                onPress={() => handleToggleFreeze()}
                style={s.actionTile}
                activeOpacity={0.75}
              >
                <View style={[s.actionTileIconBox, selectedCard.status === 'frozen' && { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons
                    name={selectedCard.status === 'frozen' ? 'lock-open-outline' : 'snow-outline'}
                    size={20}
                    color={selectedCard.status === 'frozen' ? '#2563EB' : '#0D1B3E'}
                  />
                </View>
                <Text style={s.actionTileTxt}>
                  {selectedCard.status === 'frozen' ? 'Unfreeze' : 'Freeze Card'}
                </Text>
              </TouchableOpacity>

              {/* Card Settings */}
              <TouchableOpacity
                onPress={() => setShowSettingsModal(true)}
                style={s.actionTile}
                activeOpacity={0.75}
              >
                <View style={s.actionTileIconBox}>
                  <Ionicons name="settings-outline" size={20} color="#0D1B3E" />
                </View>
                <Text style={s.actionTileTxt}>Card Settings</Text>
              </TouchableOpacity>

              {/* Transactions */}
              <TouchableOpacity
                onPress={() => setShowTransactionsModal(true)}
                style={s.actionTile}
                activeOpacity={0.75}
              >
                <View style={s.actionTileIconBox}>
                  <Ionicons name="receipt-outline" size={20} color="#0D1B3E" />
                </View>
                <Text style={s.actionTileTxt}>Transactions</Text>
              </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════════════════════
                 4. "GET A NEW CARD" CROWN CTA BANNER
                 ══════════════════════════════════════════════════════════ */}
            <TouchableOpacity
              onPress={() => {
                setCreateStep(1);
                setShowCreateModal(true);
              }}
              style={s.getNewCardBanner}
              activeOpacity={0.88}
            >
              <View style={s.crownIconBox}>
                <Ionicons name="ribbon" size={24} color="#F59E0B" />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.getNewCardTitle}>Get a New Card</Text>
                <Text style={s.getNewCardSubtitle}>
                  Create another virtual card in seconds for your online payments.
                </Text>
              </View>

              <View style={s.arrowCircleBtn}>
                <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
              </View>
            </TouchableOpacity>

            {/* My Cards Switcher Bar (if more than 1 card) */}
            {cards.length > 1 && (
              <View style={s.myCardsBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={s.myCardsBarTitle}>My Virtual Cards ({cards.length})</Text>
                  <TouchableOpacity onPress={() => setShowMyCardsModal(true)}>
                    <Text style={s.viewAllTxt}>View All</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {cards.map(c => {
                    const isSelected = c.id === selectedCard.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setSelectedCard(c);
                          loadCardTransactions(c.id, c.user_id);
                        }}
                        style={[s.miniCardPill, isSelected && s.miniCardPillActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 13 }}>{c.currency === 'USD' ? '🇺🇸' : '🇳🇬'}</Text>
                        <Text style={[s.miniCardPillTxt, isSelected && { color: '#0D1B3E', fontWeight: '800' }]}>
                          {c.card_name || c.currency} (•••• {c.card_number_masked.slice(-4)})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          /* Empty State: No Cards Yet */
          <View style={s.emptyStateBox}>
            <View style={s.emptyStateCardStack}>
              <View style={s.cardStackBack} />
              <View style={s.cardStackMiddle} />
              <View style={[s.cardFront, { height: 180, justifyContent: 'center', alignItems: 'center' }]}>
                <LinearGradient colors={['#0A1329', '#0D1B3E']} style={[s.cardGradient, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Image source={require('../../assets/images/am_luxury_logo.png')} style={{ width: 56, height: 56, marginBottom: 8 }} resizeMode="contain" />
                  <Text style={{ color: '#F59E0B', fontWeight: '800', letterSpacing: 2 }}>ABU MAFHAL SUB</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4 }}>Visa & Mastercard Virtual Cards</Text>
                </LinearGradient>
              </View>
            </View>

            <Text style={s.emptyStateTitle}>Instant Virtual Dollar & Naira Cards</Text>
            <Text style={s.emptyStateSubtitle}>
              Shop on Amazon, pay for Netflix, Spotify, ChatGPT Plus, and run Facebook Ads globally with 100% verified Payvessel rails.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setCreateStep(1);
                setShowCreateModal(true);
              }}
              style={s.createFirstCardBtn}
              activeOpacity={0.88}
            >
              <Text style={s.createFirstCardBtnTxt}>Create Virtual Card Now</Text>
              <Ionicons name="arrow-forward" size={18} color="#0D1B3E" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 1: CREATE VIRTUAL CARD WIZARD (STEPS 1, 2 & 3)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            {/* Sheet Handle */}
            <View style={s.sheetHandle} />

            {/* STEP 1: CHOOSE CARD TYPE */}
            {createStep === 1 && (
              <>
                <View style={s.modalHeaderRow}>
                  <TouchableOpacity onPress={() => setShowCreateModal(false)} style={s.modalBackBtn}>
                    <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
                  </TouchableOpacity>
                  <Text style={s.modalHeading}>Create Virtual Card</Text>
                  <View style={{ width: 32 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.stepSectionTitle}>Choose Card Type</Text>
                  <Text style={s.stepSectionSubtitle}>Select the virtual card that suits your needs.</Text>

                  {/* Option 1: USD Virtual Card */}
                  <TouchableOpacity
                    onPress={() => setSelectedCurrency('USD')}
                    style={[s.cardTypeOptionCard, selectedCurrency === 'USD' && s.cardTypeOptionCardActive]}
                    activeOpacity={0.85}
                  >
                    <View style={s.cardTypeTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 22 }}>🇺🇸</Text>
                        <Text style={s.cardTypeTitle}>USD Virtual Card</Text>
                      </View>
                      <View style={[s.radioCircle, selectedCurrency === 'USD' && s.radioCircleActive]}>
                        {selectedCurrency === 'USD' && <Ionicons name="checkmark" size={14} color="#0D1B3E" />}
                      </View>
                    </View>

                    <View style={s.cardTypeBullets}>
                      <Text style={s.bulletItem}>›  For international payments</Text>
                      <Text style={s.bulletItem}>›  Shop on global websites</Text>
                      <Text style={s.bulletItem}>›  Pay for subscriptions (Netflix, Spotify, Apple)</Text>
                      <Text style={s.bulletItem}>›  Supports USD transactions</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: NGN Virtual Card */}
                  <TouchableOpacity
                    onPress={() => setSelectedCurrency('NGN')}
                    style={[s.cardTypeOptionCard, selectedCurrency === 'NGN' && s.cardTypeOptionCardActive]}
                    activeOpacity={0.85}
                  >
                    <View style={s.cardTypeTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 22 }}>🇳🇬</Text>
                        <Text style={s.cardTypeTitle}>NGN Virtual Card</Text>
                      </View>
                      <View style={[s.radioCircle, selectedCurrency === 'NGN' && s.radioCircleActive]}>
                        {selectedCurrency === 'NGN' && <Ionicons name="checkmark" size={14} color="#0D1B3E" />}
                      </View>
                    </View>

                    <View style={s.cardTypeBullets}>
                      <Text style={s.bulletItem}>›  For local online payments</Text>
                      <Text style={s.bulletItem}>›  Pay on Nigerian websites</Text>
                      <Text style={s.bulletItem}>›  Naira transactions only</Text>
                      <Text style={s.bulletItem}>›  Secure and instant</Text>
                    </View>
                  </TouchableOpacity>
                </ScrollView>

                <TouchableOpacity
                  onPress={() => setCreateStep(2)}
                  style={s.goldContinueBtn}
                  activeOpacity={0.88}
                >
                  <Text style={s.goldContinueBtnTxt}>Continue</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: SET CARD DETAILS */}
            {createStep === 2 && (
              <>
                <View style={s.modalHeaderRow}>
                  <TouchableOpacity onPress={() => setCreateStep(1)} style={s.modalBackBtn}>
                    <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
                  </TouchableOpacity>
                  <Text style={s.modalHeading}>Set Card Details</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#D97706' }}>2 of 3</Text>
                </View>

                {/* Progress Line */}
                <View style={s.stepperProgressTrack}>
                  <View style={[s.stepperProgressFill, { width: '66%' }]} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={s.stepSectionSubtitle}>Provide a name and choose card currency.</Text>

                  {/* Card Name Input */}
                  <Text style={s.inputLabel}>Card Name</Text>
                  <View style={s.inputBox}>
                    <TextInput
                      value={cardNameInput}
                      onChangeText={setCardNameInput}
                      placeholder="e.g. ABU MAFHAL USD Card"
                      placeholderTextColor="#94A3B8"
                      style={s.textInput}
                    />
                    <Ionicons name="pencil" size={16} color="#94A3B8" />
                  </View>

                  {/* Currency Picker */}
                  <Text style={s.inputLabel}>Card Currency</Text>
                  <View style={s.currencyPillSelector}>
                    <Text style={{ fontSize: 14 }}>{selectedCurrency === 'USD' ? '🇺🇸  USD - US Dollar' : '🇳🇬  NGN - Nigerian Naira'}</Text>
                    <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                  </View>

                  {/* Initial Funding Amount */}
                  <Text style={s.inputLabel}>Initial Funding Amount</Text>
                  <View style={s.inputBox}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0D1B3E', marginRight: 4 }}>
                      {selectedCurrency === 'USD' ? '$' : '₦'}
                    </Text>
                    <TextInput
                      value={initialFundInput}
                      onChangeText={setInitialFundInput}
                      keyboardType="numeric"
                      placeholder="50.00"
                      placeholderTextColor="#94A3B8"
                      style={[s.textInput, { fontSize: 18, fontWeight: '800' }]}
                    />
                  </View>

                  {/* Quick Pills */}
                  <View style={s.quickAmountsRow}>
                    {(selectedCurrency === 'USD' ? ['10', '50', '100', '200'] : ['5000', '10000', '25000', '50000']).map(amt => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setInitialFundInput(amt)}
                        style={[s.quickAmountPill, initialFundInput === amt && s.quickAmountPillActive]}
                      >
                        <Text style={[s.quickAmountPillTxt, initialFundInput === amt && s.quickAmountPillTxtActive]}>
                          {selectedCurrency === 'USD' ? `$${amt}` : `₦${Number(amt).toLocaleString()}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Info Notice */}
                  <View style={s.infoNoticeBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                    <Text style={s.infoNoticeTxt}>
                      You can top up more funds anytime after creation.
                    </Text>
                  </View>

                  {/* Wallet Cost Breakdown */}
                  {(() => {
                    const sm = calcCreationSummary();
                    return (
                      <View style={s.costSummaryCard}>
                        <View style={s.costRow}>
                          <Text style={s.costLbl}>Card Creation Fee:</Text>
                          <Text style={s.costVal}>₦{Math.round(sm.feeNGN).toLocaleString()}</Text>
                        </View>
                        <View style={s.costRow}>
                          <Text style={s.costLbl}>Initial Funding ({selectedCurrency === 'USD' ? `$${initialFundInput}` : `₦${initialFundInput}`}):</Text>
                          <Text style={s.costVal}>₦{Math.round(sm.fundNGN).toLocaleString()}</Text>
                        </View>
                        <View style={[s.costRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 6, marginTop: 4 }]}>
                          <Text style={[s.costLbl, { fontWeight: '800', color: '#0D1B3E' }]}>Total Wallet Charge:</Text>
                          <Text style={[s.costVal, { fontWeight: '900', color: '#D97706', fontSize: 14 }]}>
                            ₦{Math.round(sm.totalNGN).toLocaleString()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
                          Your Wallet Balance: ₦{Math.floor(walletBalance).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })()}
                </ScrollView>

                <TouchableOpacity
                  onPress={handleCreateVirtualCard}
                  disabled={actionLoading}
                  style={[s.goldContinueBtn, actionLoading && { opacity: 0.6 }]}
                  activeOpacity={0.88}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#0D1B3E" size="small" />
                  ) : (
                    <>
                      <Text style={s.goldContinueBtnTxt}>Create Card</Text>
                      <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* STEP 3: VIRTUAL CARD CREATED! (CELEBRATION) */}
            {createStep === 3 && (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                {/* Big Golden Checkmark */}
                <View style={s.celebrateCheckRing}>
                  <Ionicons name="checkmark" size={38} color="#FFFFFF" />
                </View>

                <Text style={s.celebrateTitle}>Virtual Card Created!</Text>
                <Text style={s.celebrateSub}>Your virtual card has been created successfully.</Text>

                {/* Card Preview */}
                {recentlyCreatedCard && (
                  <View style={[s.cardFront, { height: 165, width: '100%', marginVertical: 16 }]}>
                    <LinearGradient colors={['#0A1329', '#0D1B3E', '#142552']} style={s.cardGradient}>
                      <View style={s.cardTopRow}>
                        <Text style={s.cardBrandTxt}>ABU MAFHAL SUB</Text>
                        <Text style={s.currencyCodeTxt}>{recentlyCreatedCard.currency}</Text>
                      </View>
                      <Text style={[s.cardNumberTxt, { fontSize: 16, marginVertical: 12 }]}>
                        {recentlyCreatedCard.card_number_masked}
                      </Text>
                      <View style={s.cardBottomRow}>
                        <Text style={s.cardHolderNameTxt}>{recentlyCreatedCard.card_holder_name}</Text>
                        <Text style={s.visaTxt}>VISA</Text>
                      </View>
                    </LinearGradient>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setShowCreateModal(false);
                    setShowDetailsModal(true);
                  }}
                  style={s.goldContinueBtn}
                  activeOpacity={0.88}
                >
                  <Text style={s.goldContinueBtnTxt}>View Card Details</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowCreateModal(false);
                    setShowMyCardsModal(true);
                  }}
                  style={s.secondaryModalBtn}
                  activeOpacity={0.8}
                >
                  <Text style={s.secondaryModalBtnTxt}>Go to My Cards</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 2: CARD DETAILS (EXACT TO MOCKUP)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showDetailsModal} animationType="slide" transparent onRequestClose={() => setShowDetailsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>Card Details</Text>
              <View style={{ width: 32 }} />
            </View>

            {selectedCard && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Front Card Preview */}
                <View style={[s.cardFront, { height: 180, width: '100%', marginBottom: 16 }]}>
                  <LinearGradient colors={['#0A1329', '#0D1B3E', '#142552']} style={s.cardGradient}>
                    <View style={s.cardTopRow}>
                      <View style={s.cardBrandGroup}>
                        <Image source={require('../../assets/images/am_luxury_logo.png')} style={s.cardLogoImg} resizeMode="contain" />
                        <Text style={[s.cardBrandTxt, { marginLeft: 6 }]}>ABU MAFHAL SUB</Text>
                      </View>
                      <View style={s.cardFlagBadge}>
                        <Text>{selectedCard.currency === 'USD' ? '🇺🇸' : '🇳🇬'}</Text>
                        <Text style={s.currencyCodeTxt}>{selectedCard.currency}</Text>
                      </View>
                    </View>

                    <Text style={[s.cardNumberTxt, { marginVertical: 14 }]}>
                      {showFullDetails ? (selectedCard.card_number_full || selectedCard.card_number_masked) : selectedCard.card_number_masked}
                    </Text>

                    <View style={s.cardBottomRow}>
                      <View>
                        <Text style={s.cardValText}>EXP: {selectedCard.expiry_month}/{selectedCard.expiry_year}   CVV: {showFullDetails ? selectedCard.cvv : '•••'}</Text>
                        <Text style={s.cardHolderNameTxt}>{selectedCard.card_holder_name}</Text>
                      </View>
                      <Text style={s.visaTxt}>VISA</Text>
                    </View>
                  </LinearGradient>
                </View>

                {/* 4 Quick Card Action Icons */}
                <View style={s.cardDetailsActionRow}>
                  <TouchableOpacity
                    onPress={() => setShowFullDetails(!showFullDetails)}
                    style={s.cardDetailActionBtn}
                  >
                    <Ionicons name={showFullDetails ? 'eye-off' : 'eye'} size={20} color="#0D1B3E" />
                    <Text style={s.cardDetailActionTxt}>{showFullDetails ? 'Hide' : 'Show Details'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleCopy(selectedCard.card_number_full || selectedCard.card_number_masked.replace(/\s/g, ''), 'Card Number')}
                    style={s.cardDetailActionBtn}
                  >
                    <Ionicons name="copy-outline" size={20} color="#0D1B3E" />
                    <Text style={s.cardDetailActionTxt}>Copy Number</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleCopy(selectedCard.cvv || '123', 'CVV')}
                    style={s.cardDetailActionBtn}
                  >
                    <Ionicons name="lock-closed-outline" size={20} color="#0D1B3E" />
                    <Text style={s.cardDetailActionTxt}>Copy CVV</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleToggleFreeze()}
                    style={s.cardDetailActionBtn}
                  >
                    <Ionicons
                      name={selectedCard.status === 'frozen' ? 'lock-open' : 'snow'}
                      size={20}
                      color={selectedCard.status === 'frozen' ? '#2563EB' : '#DC2626'}
                    />
                    <Text style={[s.cardDetailActionTxt, { color: selectedCard.status === 'frozen' ? '#2563EB' : '#DC2626' }]}>
                      {selectedCard.status === 'frozen' ? 'Unfreeze' : 'Freeze Card'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Detail Information List */}
                <View style={s.infoListCard}>
                  <View style={s.infoListItem}>
                    <Text style={s.infoListLbl}>Card Name</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setRenameInput(selectedCard.card_name || '');
                        setShowRenameModal(true);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Text style={s.infoListVal}>{selectedCard.card_name || 'ABU MAFHAL USD Card'}</Text>
                      <Ionicons name="pencil" size={13} color="#D97706" />
                    </TouchableOpacity>
                  </View>

                  <View style={s.infoListItem}>
                    <Text style={s.infoListLbl}>Card Currency</Text>
                    <Text style={s.infoListVal}>{selectedCard.currency === 'USD' ? '🇺🇸  USD - US Dollar' : '🇳🇬  NGN - Nigerian Naira'}</Text>
                  </View>

                  <View style={s.infoListItem}>
                    <Text style={s.infoListLbl}>Status</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: selectedCard.status === 'active' ? '#16A34A' : '#2563EB' }} />
                      <Text style={[s.infoListVal, { textTransform: 'capitalize' }]}>{selectedCard.status}</Text>
                    </View>
                  </View>

                  <View style={s.infoListItem}>
                    <Text style={s.infoListLbl}>Created</Text>
                    <Text style={s.infoListVal}>
                      {new Date(selectedCard.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>

                  {/* Billing Address */}
                  <View style={[s.infoListItem, { flexDirection: 'column', alignItems: 'flex-start', borderBottomWidth: 0 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                      <Text style={s.infoListLbl}>Billing Address</Text>
                      <TouchableOpacity
                        onPress={() => handleCopy(`${selectedCard.billing_address?.street || '350 Fifth Ave'}, ${selectedCard.billing_address?.city || 'New York'}, ${selectedCard.billing_address?.state || 'NY'} ${selectedCard.billing_address?.zip || '10118'}, United States`, 'Billing Address')}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706' }}>Copy Address</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12, color: '#0D1B3E', lineHeight: 18 }}>
                      {selectedCard.billing_address?.street || '350 Fifth Avenue, Suite 4100'}{'\n'}
                      {selectedCard.billing_address?.city || 'New York'}, {selectedCard.billing_address?.state || 'NY'} {selectedCard.billing_address?.zip || '10118'}{'\n'}
                      {selectedCard.billing_address?.country || 'United States'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 3: MY CARDS (CARD SWITCHER & MANAGEMENT)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showMyCardsModal} animationType="slide" transparent onRequestClose={() => setShowMyCardsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '85%' }]}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowMyCardsModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>My Cards</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMyCardsModal(false);
                  setCreateStep(1);
                  setShowCreateModal(true);
                }}
                style={s.roundAddBtn}
              >
                <Ionicons name="add" size={20} color="#0D1B3E" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={s.filterTabsRow}>
              {(['all', 'USD', 'NGN'] as const).map(tabKey => (
                <TouchableOpacity
                  key={tabKey}
                  onPress={() => setMyCardsTab(tabKey)}
                  style={[s.filterTabPill, myCardsTab === tabKey && s.filterTabPillActive]}
                >
                  <Text style={[s.filterTabPillTxt, myCardsTab === tabKey && s.filterTabPillTxtActive]}>
                    {tabKey === 'all' ? 'All Cards' : `${tabKey} Cards`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredCards.map(c => {
                const isSelected = c.id === selectedCard?.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setSelectedCard(c);
                      loadCardTransactions(c.id, c.user_id);
                      setShowMyCardsModal(false);
                      triggerToast(`Switched to ${c.card_name || c.currency + ' Card'}`);
                    }}
                    style={[s.myCardRowCard, isSelected && s.myCardRowCardSelected]}
                    activeOpacity={0.8}
                  >
                    {/* Mini Card Thumbnail */}
                    <View style={s.myCardMiniThumb}>
                      <LinearGradient colors={['#0A1329', '#0D1B3E']} style={s.myCardMiniThumbGrad}>
                        <Text style={{ fontSize: 9, color: '#F59E0B', fontWeight: '900' }}>AM</Text>
                        <Text style={{ fontSize: 8, color: '#FFFFFF' }}>VISA</Text>
                      </LinearGradient>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.myCardNameTxt}>{c.card_name || `ABU MAFHAL ${c.currency} Card`}</Text>
                      <Text style={s.myCardNumberTxt}>{c.currency} •••• {c.card_number_masked.slice(-4)}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[s.cardStatusBadge, c.status === 'frozen' && { backgroundColor: '#EFF6FF' }]}>
                        <Text style={[s.cardStatusBadgeTxt, c.status === 'frozen' && { color: '#2563EB' }]}>
                          {c.status === 'active' ? 'Active' : 'Frozen'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0D1B3E' }}>
                        {c.currency === 'USD' ? '$' : '₦'}{Number(c.balance || 0).toFixed(2)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 4: TOP UP CARD (EXACT TO MOCKUP)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showTopUpModal} animationType="slide" transparent onRequestClose={() => setShowTopUpModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>Top Up Card</Text>
              <View style={{ width: 32 }} />
            </View>

            {selectedCard && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Mini card summary */}
                <View style={s.topUpCardBanner}>
                  <View>
                    <Text style={s.topUpCardBannerName}>{selectedCard.card_name || 'ABU MAFHAL Card'}</Text>
                    <Text style={s.topUpCardBannerNumber}>{selectedCard.currency} •••• {selectedCard.card_number_masked.slice(-4)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>Current Balance</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0D1B3E' }}>
                      {selectedCard.currency === 'USD' ? '$' : '₦'}{Number(selectedCard.balance || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Quick Amount Pills */}
                <Text style={s.inputLabel}>Top Up Amount</Text>
                <View style={s.quickAmountsRow}>
                  {['10', '50', '100', '200'].map(amt => (
                    <TouchableOpacity
                      key={amt}
                      onPress={() => setTopUpAmountInput(amt)}
                      style={[s.quickAmountPill, topUpAmountInput === amt && s.quickAmountPillActive]}
                    >
                      <Text style={[s.quickAmountPillTxt, topUpAmountInput === amt && s.quickAmountPillTxtActive]}>
                        ${amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Amount Input */}
                <Text style={s.inputLabel}>Custom Amount</Text>
                <View style={s.inputBox}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#0D1B3E', marginRight: 4 }}>
                    {selectedCard.currency === 'USD' ? '$' : '₦'}
                  </Text>
                  <TextInput
                    value={topUpAmountInput}
                    onChangeText={setTopUpAmountInput}
                    keyboardType="numeric"
                    placeholder="100.00"
                    placeholderTextColor="#94A3B8"
                    style={[s.textInput, { fontSize: 18, fontWeight: '800' }]}
                  />
                </View>

                {/* Conversion Summary */}
                {selectedCard.currency === 'USD' && (
                  <View style={s.topUpSummaryBox}>
                    <View style={s.costRow}>
                      <Text style={s.costLbl}>Exchange Rate:</Text>
                      <Text style={s.costVal}>$1 = ₦{usdRate.toLocaleString()}</Text>
                    </View>
                    <View style={s.costRow}>
                      <Text style={s.costLbl}>Wallet Deduction:</Text>
                      <Text style={[s.costVal, { fontWeight: '900', color: '#D97706' }]}>
                        ₦{Math.round((Number(topUpAmountInput) || 0) * usdRate).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                      Your Wallet Balance: ₦{Math.floor(walletBalance).toLocaleString()}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={handleTopUp}
              disabled={actionLoading}
              style={[s.goldContinueBtn, actionLoading && { opacity: 0.6 }]}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <ActivityIndicator color="#0D1B3E" size="small" />
              ) : (
                <>
                  <Text style={s.goldContinueBtnTxt}>Continue to Payment</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 5: CARD SETTINGS (EXACT TO MOCKUP)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showSettingsModal} animationType="slide" transparent onRequestClose={() => setShowSettingsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>Card Settings</Text>
              <View style={{ width: 32 }} />
            </View>

            {selectedCard && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Setting 1: Card Status */}
                <View style={s.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Card Status</Text>
                    <Text style={s.settingSubtitle}>
                      {selectedCard.status === 'active' ? 'Active' : 'Frozen'}
                    </Text>
                  </View>
                  <Switch
                    value={selectedCard.status === 'active'}
                    onValueChange={() => handleToggleFreeze()}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Setting 2: Freeze Card */}
                <View style={s.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Freeze Card</Text>
                    <Text style={s.settingSubtitle}>Temporarily disable this card</Text>
                  </View>
                  <Switch
                    value={selectedCard.status === 'frozen'}
                    onValueChange={() => handleToggleFreeze()}
                    trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Setting 3: Online Payments */}
                <View style={s.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Online Payments</Text>
                    <Text style={s.settingSubtitle}>Allow online transactions</Text>
                  </View>
                  <Switch
                    value={selectedCard.online_payments_enabled ?? true}
                    onValueChange={(val) => handleToggleSetting('online_payments_enabled', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Setting 4: International Payments */}
                <View style={s.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>International Payments</Text>
                    <Text style={s.settingSubtitle}>Allow international transactions</Text>
                  </View>
                  <Switch
                    value={selectedCard.international_payments_enabled ?? true}
                    onValueChange={(val) => handleToggleSetting('international_payments_enabled', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Setting 5: Contactless Payments */}
                <View style={s.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Contactless Payments</Text>
                    <Text style={s.settingSubtitle}>Allow contactless transactions</Text>
                  </View>
                  <Switch
                    value={selectedCard.contactless_payments_enabled ?? false}
                    onValueChange={(val) => handleToggleSetting('contactless_payments_enabled', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Setting 6: Set Spending Limit */}
                <TouchableOpacity
                  onPress={() => {
                    setShowSettingsModal(false);
                    setShowLimitModal(true);
                  }}
                  style={s.settingLinkRow}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Set Spending Limit</Text>
                    <Text style={s.settingSubtitle}>
                      Manage your card limit (${selectedCard.spending_limit_monthly || 1000}/mo)
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* Setting 7: Change Card Name */}
                <TouchableOpacity
                  onPress={() => {
                    setRenameInput(selectedCard.card_name || '');
                    setShowSettingsModal(false);
                    setShowRenameModal(true);
                  }}
                  style={s.settingLinkRow}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.settingTitle}>Change Card Name</Text>
                    <Text style={s.settingSubtitle}>Update your card name</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 6: TRANSACTIONS (EXACT TO MOCKUP)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showTransactionsModal} animationType="slide" transparent onRequestClose={() => setShowTransactionsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowTransactionsModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>Transactions</Text>
              <TouchableOpacity style={s.modalBackBtn}>
                <Ionicons name="filter" size={18} color="#0D1B3E" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={s.filterTabsRow}>
              {(['All', 'Successful', 'Pending', 'Failed'] as const).map(tabKey => (
                <TouchableOpacity
                  key={tabKey}
                  onPress={() => setTxFilterTab(tabKey)}
                  style={[s.filterTabPill, txFilterTab === tabKey && s.filterTabPillActive]}
                >
                  <Text style={[s.filterTabPillTxt, txFilterTab === tabKey && s.filterTabPillTxtActive]}>
                    {tabKey}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.txSectionHeader}>Today, 14 Oct 2026</Text>

              {filteredTxs.map(tx => {
                const meta = MERCHANT_META[tx.merchant_name] || { icon: 'card', color: '#0D1B3E', bg: '#F1F5F9' };
                const isDebit = tx.type === 'DEBIT';

                return (
                  <View key={tx.id} style={s.txRowItem}>
                    <View style={[s.txIconBox, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.txMerchantTitle}>{tx.merchant_name}</Text>
                      <Text style={s.txTimeTxt}>
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.txAmountTxt, { color: isDebit ? '#DC2626' : '#16A34A' }]}>
                        {isDebit ? '-' : '+'}${Number(tx.amount).toFixed(2)}
                      </Text>
                      <Text style={[s.txStatusTxt, { color: tx.status === 'COMPLETED' ? '#16A34A' : '#F59E0B' }]}>
                        {tx.status === 'COMPLETED' ? 'Successful' : tx.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 7: CARD LIMIT (EXACT TO MOCKUP)
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showLimitModal} animationType="slide" transparent onRequestClose={() => setShowLimitModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />

            <View style={s.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowLimitModal(false)} style={s.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#0D1B3E" />
              </TouchableOpacity>
              <Text style={s.modalHeading}>Card Limit</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Limit Tabs */}
            <View style={s.limitTabsRow}>
              <TouchableOpacity
                onPress={() => setLimitTab('monthly')}
                style={[s.limitTabPill, limitTab === 'monthly' && s.limitTabPillActive]}
              >
                <Text style={[s.limitTabPillTxt, limitTab === 'monthly' && s.limitTabPillTxtActive]}>
                  Monthly Limit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLimitTab('transaction')}
                style={[s.limitTabPill, limitTab === 'transaction' && s.limitTabPillActive]}
              >
                <Text style={[s.limitTabPillTxt, limitTab === 'transaction' && s.limitTabPillTxtActive]}>
                  Transaction Limit
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.stepSectionTitle}>
                {limitTab === 'monthly' ? 'Set Monthly Limit' : 'Set Transaction Limit'}
              </Text>
              <Text style={s.stepSectionSubtitle}>
                {limitTab === 'monthly'
                  ? 'Set a spending limit for this card.'
                  : 'Maximum amount that can be charged in a single transaction.'}
              </Text>

              {/* Input Box */}
              <View style={[s.inputBox, { marginTop: 12 }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0D1B3E', marginRight: 4 }}>$</Text>
                <TextInput
                  value={limitInput}
                  onChangeText={setLimitInput}
                  keyboardType="numeric"
                  placeholder="500.00"
                  placeholderTextColor="#94A3B8"
                  style={[s.textInput, { fontSize: 18, fontWeight: '800' }]}
                />
              </View>

              {/* Quick Pills */}
              <View style={s.quickAmountsRow}>
                {['100', '500', '1000', '2000'].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setLimitInput(amt)}
                    style={[s.quickAmountPill, limitInput === amt && s.quickAmountPillActive]}
                  >
                    <Text style={[s.quickAmountPillTxt, limitInput === amt && s.quickAmountPillTxtActive]}>
                      ${Number(amt).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notice */}
              <View style={s.infoNoticeBox}>
                <Ionicons name="information-circle-outline" size={16} color="#2563EB" />
                <Text style={s.infoNoticeTxt}>
                  Once you reach this limit, the card will be declined until the next billing cycle.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleUpdateLimit}
              disabled={actionLoading}
              style={[s.goldContinueBtn, actionLoading && { opacity: 0.6 }]}
              activeOpacity={0.88}
            >
              {actionLoading ? (
                <ActivityIndicator color="#0D1B3E" size="small" />
              ) : (
                <>
                  <Text style={s.goldContinueBtnTxt}>Update Limit</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0D1B3E" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL 8: RENAME CARD
           ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showRenameModal} animationType="fade" transparent onRequestClose={() => setShowRenameModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { maxHeight: 300 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.modalHeading}>Rename Card</Text>
            <Text style={s.stepSectionSubtitle}>Give this card a recognizable nickname.</Text>

            <View style={[s.inputBox, { marginVertical: 16 }]}>
              <TextInput
                value={renameInput}
                onChangeText={setRenameInput}
                placeholder="e.g. Shopping Card, Netflix Card"
                placeholderTextColor="#94A3B8"
                style={s.textInput}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowRenameModal(false)}
                style={[s.goldContinueBtn, { flex: 1, backgroundColor: '#E2E8F0' }]}
              >
                <Text style={[s.goldContinueBtnTxt, { color: '#475569' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveRename}
                disabled={actionLoading}
                style={[s.goldContinueBtn, { flex: 1 }, actionLoading && { opacity: 0.6 }]}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#0D1B3E" size="small" />
                ) : (
                  <Text style={s.goldContinueBtnTxt}>Save Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── STYLES (MATCHING USER MOCKUP EXACTLY) ──────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  toast: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  toastTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: '#070D1E',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  scrollArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },

  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loaderTxt: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  // ── 3D Card Stack Effect ──
  cardStackWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    position: 'relative',
  },
  cardStackBack: {
    position: 'absolute',
    top: -12,
    width: '84%',
    height: 195,
    borderRadius: 20,
    backgroundColor: '#D97706',
    opacity: 0.35,
    transform: [{ rotate: '4deg' }],
  },
  cardStackMiddle: {
    position: 'absolute',
    top: -6,
    width: '90%',
    height: 195,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    opacity: 0.6,
    transform: [{ rotate: '-2deg' }],
  },
  cardFront: {
    width: '100%',
    height: 205,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#070D1E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  cardGradient: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cardBrandTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  cardSubBrandTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 2,
  },
  cardFlagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  flagEmoji: {
    fontSize: 13,
  },
  currencyCodeTxt: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Chip
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  emvChip: {
    width: 36,
    height: 27,
    borderRadius: 5,
    backgroundColor: '#E5A93C',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  chipLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '48%',
    width: 1,
    backgroundColor: '#B45309',
  },
  chipLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '48%',
    height: 1,
    backgroundColor: '#B45309',
  },
  chipInner: {
    position: 'absolute',
    top: 6,
    left: 9,
    width: 18,
    height: 15,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#B45309',
  },

  cardNumberTxt: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2.8,
    marginVertical: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardLabelSmall: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#94A3B8',
    lineHeight: 9,
  },
  cardValText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  cardHolderNameTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  visaLogoBox: {
    alignItems: 'flex-end',
  },
  visaTxt: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
    letterSpacing: 1.5,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1B3E',
    marginTop: 2,
  },
  balanceSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 4,
  },
  topUpBtnTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1B3E',
  },

  // 4 Action Tiles Grid
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  actionTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionTileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTileTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D1B3E',
    textAlign: 'center',
  },

  // "Get a New Card" Crown Banner
  getNewCardBanner: {
    backgroundColor: '#0D1B3E',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  crownIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getNewCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  getNewCardSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
  arrowCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // My Cards Bar
  myCardsBar: {
    marginTop: 4,
    marginBottom: 20,
  },
  myCardsBarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  viewAllTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  miniCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniCardPillActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  miniCardPillTxt: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },

  // Empty State
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyStateCardStack: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1B3E',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  createFirstCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 26,
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  createFirstCardBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B3E',
  },

  // ── Modals Structure ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeading: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  stepSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B3E',
    marginTop: 6,
    marginBottom: 4,
  },
  stepSectionSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginBottom: 16,
  },

  // Step 1: Card Type Cards
  cardTypeOptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardTypeOptionCardActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  cardTypeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTypeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#D97706',
    backgroundColor: '#F59E0B',
  },
  cardTypeBullets: {
    gap: 4,
  },
  bulletItem: {
    fontSize: 12,
    color: '#475569',
  },

  // Step 2: Form Inputs
  stepperProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
  },
  stepperProgressFill: {
    height: '100%',
    backgroundColor: '#D97706',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B3E',
  },
  currencyPillSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickAmountPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  quickAmountPillActive: {
    backgroundColor: '#0D1B3E',
  },
  quickAmountPillTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  quickAmountPillTxtActive: {
    color: '#F59E0B',
  },
  infoNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 12,
    marginVertical: 12,
  },
  infoNoticeTxt: {
    fontSize: 11.5,
    color: '#1E40AF',
    flex: 1,
  },
  costSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 6,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  costLbl: {
    fontSize: 12,
    color: '#64748B',
  },
  costVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // Buttons
  goldContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 50,
    borderRadius: 25,
    marginTop: 14,
    gap: 6,
  },
  goldContinueBtnTxt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  secondaryModalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 23,
    marginTop: 8,
    width: '100%',
  },
  secondaryModalBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },

  // Celebration Step
  celebrateCheckRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  celebrateTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D1B3E',
    marginTop: 6,
  },
  celebrateSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },

  // Card Details Modal Actions
  cardDetailsActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  cardDetailActionBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDetailActionTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D1B3E',
    marginTop: 4,
    textAlign: 'center',
  },
  infoListCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  infoListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoListLbl: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  infoListVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0D1B3E',
  },

  // My Cards Modal List
  roundAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  filterTabPillActive: {
    backgroundColor: '#0D1B3E',
  },
  filterTabPillTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTabPillTxtActive: {
    color: '#FFFFFF',
  },
  myCardRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  myCardRowCardSelected: {
    borderColor: '#D97706',
    backgroundColor: '#FFFBEB',
  },
  myCardMiniThumb: {
    width: 48,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
  },
  myCardMiniThumbGrad: {
    flex: 1,
    padding: 4,
    justifyContent: 'space-between',
  },
  myCardNameTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  myCardNumberTxt: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardStatusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  cardStatusBadgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },

  // Top Up Modal
  topUpCardBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  topUpCardBannerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0D1B3E',
  },
  topUpCardBannerNumber: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  topUpSummaryBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 12,
  },

  // Settings Modal Rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B3E',
  },
  settingSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },

  // Transactions Modal
  txSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginVertical: 10,
  },
  txRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMerchantTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0D1B3E',
  },
  txTimeTxt: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmountTxt: {
    fontSize: 14,
    fontWeight: '800',
  },
  txStatusTxt: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },

  // Card Limit Modal
  limitTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    padding: 4,
    marginBottom: 16,
  },
  limitTabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  limitTabPillActive: {
    backgroundColor: '#0D1B3E',
  },
  limitTabPillTxt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  limitTabPillTxtActive: {
    color: '#FFFFFF',
  },
});
