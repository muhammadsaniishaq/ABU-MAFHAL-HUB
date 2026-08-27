import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  Platform, 
  StyleSheet,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@abu_mafhal_reviews_v1';
const DELETED_KEY = '@abu_mafhal_deleted_reviews_v1';

const COLORS = {
  navy: '#0d1b3e',
  navyMid: '#142258',
  gold: '#f5a623',
  goldDark: '#d4890e',
  bg: '#f4f6fb',
  white: '#FFFFFF',
  textMain: '#0d1b3e',
  textSub: '#5a6890',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
};

import { reviewsService, Review } from '../../services/reviews';

export default function AdminReviewsManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Add/Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [ratingInput, setRatingInput] = useState(5);
  const [categoryInput, setCategoryInput] = useState('CAC Services');
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    fetchReviews();

    // Supabase Realtime Channel for instant live updates across devices
    const channel = supabase
      .channel('public:reviews:admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        fetchReviews(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReviews = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const data = await reviewsService.getAll(true);
      setReviews(data);
    } catch (e) {
      console.error('Fetch reviews error:', e);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleDeleteReview = (id: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to permanently delete this review? It will be removed globally for all users.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setReviews(prev => prev.filter(r => r.id !== id));
            try {
              await reviewsService.delete(id);
              Alert.alert('Deleted', 'Review was permanently deleted from database.');
            } catch (e: any) {
              Alert.alert('Delete Error', e.message || 'Could not delete review from database.');
              fetchReviews(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleHide = async (id: string, currentHidden: boolean) => {
    try {
      const nextHidden = !currentHidden;
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_hidden: nextHidden } : r));
      await reviewsService.toggleHide(id, currentHidden);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not toggle visibility.');
      fetchReviews(false);
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      const nextFeatured = !currentFeatured;
      setReviews(prev => prev.map(r => r.id === id ? { ...r, is_featured: nextFeatured } : r));
      await reviewsService.toggleFeatured(id, currentFeatured);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not toggle featured status.');
      fetchReviews(false);
    }
  };

  const handleAddCustomReview = async () => {
    if (!nameInput.trim()) return Alert.alert('Error', 'Enter customer name');
    if (!commentInput.trim()) return Alert.alert('Error', 'Enter review comment');

    try {
      setSubmitting(true);

      const newRev = await reviewsService.create({
        user_name: nameInput.trim(),
        avatar_url: avatarInput.trim() || undefined,
        rating: ratingInput,
        category: categoryInput,
        comment: commentInput.trim(),
        is_hidden: false,
        is_featured: true,
        verified: true,
      });

      setReviews(prev => [newRev, ...prev.filter(r => r.id !== newRev.id)]);
      setModalVisible(false);
      setNameInput('');
      setAvatarInput('');
      setCommentInput('');
      Alert.alert('Success', 'Custom review created and saved live for all users!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = r.user_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.comment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Reviews Control Center</Text>
          <Text style={s.headerSubTitle}>Moderate, hide, or delete user reviews & testimonials</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={s.addBtnTxt}>Add Testimonial</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={s.filterCard}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textSub} style={{ marginRight: 8 }} />
          <TextInput 
            style={s.searchInput}
            placeholder="Search reviews by name or keyword..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {['All', 'CAC Services', 'Social Boost', 'Data Bundles', 'Airtime & Cable', 'General Support'].map(cat => (
            <TouchableOpacity 
              key={cat}
              onPress={() => setCategoryFilter(cat)}
              style={[s.chip, categoryFilter === cat && s.chipActive]}
            >
              <Text style={[s.chipTxt, categoryFilter === cat && s.chipTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Review List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {loading ? (
          <ActivityIndicator color={COLORS.navy} size="large" style={{ marginTop: 40 }} />
        ) : filteredReviews.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="chatbox-outline" size={40} color={COLORS.textSub} />
            <Text style={s.emptyTxt}>No reviews matching criteria</Text>
          </View>
        ) : (
          filteredReviews.map(r => (
            <View key={r.id} style={[s.card, r.is_hidden && s.cardHidden]}>
              <View style={s.cardTop}>
                {r.avatar_url ? (
                  <Image source={{ uri: r.avatar_url }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarBox}>
                    <Text style={s.avatarTxt}>{r.user_name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.userName}>{r.user_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', marginRight: 6 }}>
                      {[1, 2, 3, 4, 5].map(st => (
                        <Ionicons key={st} name={st <= r.rating ? "star" : "star-outline"} size={12} color={COLORS.gold} />
                      ))}
                    </View>
                    <Text style={s.catTxt}>• {r.category}</Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  {r.is_hidden ? (
                    <View style={s.badgeHidden}><Text style={s.badgeHiddenTxt}>HIDDEN</Text></View>
                  ) : (
                    <View style={s.badgeActive}><Text style={s.badgeActiveTxt}>PUBLISHED</Text></View>
                  )}
                  <Text style={s.dateTxt}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
              </View>

              <Text style={s.commentTxt}>{r.comment}</Text>

              {/* Action Buttons Row */}
              <View style={s.actionRow}>
                <TouchableOpacity 
                  style={[s.actionBtn, r.is_featured && s.actionBtnFeatured]}
                  onPress={() => handleToggleFeatured(r.id, Boolean(r.is_featured))}
                >
                  <Ionicons name={r.is_featured ? "star" : "star-outline"} size={14} color={r.is_featured ? COLORS.goldDark : COLORS.textSub} />
                  <Text style={[s.actionBtnTxt, r.is_featured && { color: COLORS.goldDark }]}>{r.is_featured ? 'Featured ⭐' : 'Feature'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={s.actionBtn}
                  onPress={() => handleToggleHide(r.id, Boolean(r.is_hidden))}
                >
                  <Ionicons name={r.is_hidden ? "eye-outline" : "eye-off-outline"} size={14} color={COLORS.navy} />
                  <Text style={s.actionBtnTxt}>{r.is_hidden ? 'Unhide' : 'Hide'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[s.actionBtn, s.actionBtnDelete]}
                  onPress={() => handleDeleteReview(r.id)}
                >
                  <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                  <Text style={[s.actionBtnTxt, { color: COLORS.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Custom Testimonial Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Customer Testimonial</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={s.label}>Customer Name *</Text>
              <TextInput style={s.input} placeholder="e.g. Hajiya Bilkisu Sani" value={nameInput} onChangeText={setNameInput} />

              <Text style={s.label}>Avatar Image URL (Optional)</Text>
              <TextInput style={s.input} placeholder="https://..." value={avatarInput} onChangeText={setAvatarInput} />

              <Text style={s.label}>Rating Stars (1 to 5)</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {[1, 2, 3, 4, 5].map(st => (
                  <TouchableOpacity key={st} onPress={() => setRatingInput(st)}>
                    <Ionicons name={st <= ratingInput ? "star" : "star-outline"} size={28} color={COLORS.gold} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['CAC Services', 'Social Boost', 'Data Bundles', 'Airtime & Cable', 'General Support'].map(c => (
                  <TouchableOpacity 
                    key={c}
                    onPress={() => setCategoryInput(c)}
                    style={[s.modalChip, categoryInput === c && s.modalChipActive]}
                  >
                    <Text style={[s.modalChipTxt, categoryInput === c && s.modalChipTxtActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Review Comment *</Text>
              <TextInput 
                style={[s.input, { height: 90, textAlignVertical: 'top' }]} 
                placeholder="Enter customer feedback text..."
                multiline
                value={commentInput}
                onChangeText={setCommentInput}
              />

              <TouchableOpacity style={s.saveModalBtn} onPress={handleAddCustomReview} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={s.saveModalBtnTxt}>Save Testimonial</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 56 : 40, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy },
  headerSubTitle: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  addBtnTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.white },

  filterCard: { backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 12, color: COLORS.textMain },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', marginRight: 6 },
  chipActive: { backgroundColor: COLORS.navy },
  chipTxt: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  chipTxtActive: { color: COLORS.white, fontWeight: 'bold' },

  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHidden: { opacity: 0.6, backgroundColor: '#f8fafc' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0' },
  avatarBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold },
  userName: { fontSize: 13, fontWeight: 'bold', color: COLORS.navy },
  catTxt: { fontSize: 12, color: COLORS.textSub },
  dateTxt: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  badgeActive: { backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeActiveTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.success },
  badgeHidden: { backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeHiddenTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.error },

  commentTxt: { fontSize: 12, color: COLORS.textMain, lineHeight: 18, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  actionBtnFeatured: { backgroundColor: '#fffbeb', borderColor: COLORS.gold },
  actionBtnDelete: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  actionBtnTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy },

  emptyBox: { alignItems: 'center', padding: 40 },
  emptyTxt: { fontSize: 13, color: COLORS.textSub, marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(13,27,62,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.navy },
  label: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, height: 38, paddingHorizontal: 10, fontSize: 12, color: COLORS.textMain, backgroundColor: '#f8fafc', marginBottom: 8 },
  modalChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#f1f5f9' },
  modalChipActive: { backgroundColor: COLORS.navy },
  modalChipTxt: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  modalChipTxtActive: { color: COLORS.white, fontWeight: 'bold' },
  saveModalBtn: { backgroundColor: COLORS.navy, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14, marginBottom: 20 },
  saveModalBtnTxt: { fontSize: 13, fontWeight: 'bold', color: COLORS.white }
});
