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
import { LinearGradient } from 'expo-linear-gradient';
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

const CATEGORIES = [
  'All',
  'CAC Services',
  'Social Boost',
  'Data Bundles',
  'Airtime & Cable',
  'General Support'
];

export type ReviewItem = Review;

export default function ReviewsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);
  
  // Write Review Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newCategory, setNewCategory] = useState('General Support');
  const [newComment, setNewComment] = useState('');
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [likedReviews, setLikedReviews] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchReviews();
    fetchUserProfile();

    // Supabase Realtime Subscription for instant live updates across devices
    const channel = supabase
      .channel('public:reviews:user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        fetchReviews(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, role').eq('id', user.id).single();
        if (profile) {
          if (profile.full_name) setUserName(profile.full_name);
          if (profile.avatar_url) setUserAvatar(profile.avatar_url);
          if (profile.role === 'admin' || profile.role === 'super_admin') setIsAdmin(true);
        }
      }
    } catch (e) {
      console.log('Error fetching user profile:', e);
    }
  };

  const fetchReviews = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const data = await reviewsService.getAll(false);
      setReviews(data);
    } catch (e) {
      console.log('Error in fetchReviews:', e);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    setLikedReviews(prev => {
      const isAlreadyLiked = prev[id];
      const newStatus = !isAlreadyLiked;
      
      setReviews(current => current.map(item => {
        if (item.id === id) {
          const newLikes = (item.likes_count || 0) + (newStatus ? 1 : -1);
          reviewsService.like(id, Math.max(0, newLikes)).catch(console.warn);
          return {
            ...item,
            likes_count: Math.max(0, newLikes)
          };
        }
        return item;
      }));

      return { ...prev, [id]: newStatus };
    });
  };

  const handlePostReview = async () => {
    if (!newComment.trim()) {
      return Alert.alert('Error', 'Please write your review comment');
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();

      const createdReview = await reviewsService.create({
        user_id: user?.id || null,
        user_name: userName.trim() || 'Valued Customer',
        avatar_url: userAvatar || undefined,
        rating: newRating,
        category: newCategory,
        comment: newComment.trim(),
        likes_count: 0,
        verified: true,
        is_hidden: false,
        is_featured: false,
      });

      setReviews(prev => [createdReview, ...prev.filter(r => r.id !== createdReview.id)]);
      setModalVisible(false);
      setNewComment('');
      setNewRating(5);

      Alert.alert('Thank You! 🎉', 'Your review has been submitted successfully and is live for everyone!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List
  const filteredReviews = reviews.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesStar = selectedStarFilter === null || item.rating === selectedStarFilter;
    return matchesCategory && matchesStar;
  });

  // Calculate Rating Metrics
  const totalCount = reviews.length;
  const avgRating = totalCount > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(1)
    : '5.0';

  const fiveStarCount = reviews.filter(r => r.rating === 5).length;
  const fourStarCount = reviews.filter(r => r.rating === 4).length;

  const handleDeleteReview = (id: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setReviews(prev => prev.filter(r => r.id !== id));
            try {
              await reviewsService.delete(id);
            } catch (e: any) {
              Alert.alert('Delete Failed', e.message || 'Could not delete review.');
              fetchReviews(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={s.container}>
        {/* Header */}
      <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Customer Reviews & Ratings</Text>
          <Text style={s.headerSubTitle}>See what our users say about Abu Mafhal Sub</Text>
        </View>

        {isAdmin && (
          <TouchableOpacity style={[s.writeBtnHeader, { backgroundColor: '#f1f5f9', marginRight: 8 }]} onPress={() => router.push('/manage/reviews')}>
            <Ionicons name="settings-outline" size={15} color={COLORS.navy} />
            <Text style={[s.writeBtnHeaderTxt, { color: COLORS.navy }]}>Admin</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.writeBtnHeader} onPress={() => setModalVisible(true)}>
          <Ionicons name="create-outline" size={16} color={COLORS.navy} />
          <Text style={s.writeBtnHeaderTxt}>Review</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        
        {/* Rating Summary Card */}
        <View style={s.summaryCard}>
          <View style={s.scoreBox}>
            <Text style={s.scoreBig}>{avgRating}</Text>
            <View style={{ flexDirection: 'row', gap: 2, marginVertical: 4 }}>
              {[1, 2, 3, 4, 5].map((st) => (
                <Ionicons key={st} name="star" size={16} color={COLORS.gold} />
              ))}
            </View>
            <Text style={s.scoreSub}>{totalCount} Verified Reviews</Text>
          </View>

          <View style={s.breakdownBox}>
            <View style={s.barRow}>
              <Text style={s.starLabel}>5 ★</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${totalCount ? (fiveStarCount / totalCount) * 100 : 90}%` }]} />
              </View>
              <Text style={s.barPercent}>{fiveStarCount}</Text>
            </View>

            <View style={s.barRow}>
              <Text style={s.starLabel}>4 ★</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${totalCount ? (fourStarCount / totalCount) * 100 : 10}%` }]} />
              </View>
              <Text style={s.barPercent}>{fourStarCount}</Text>
            </View>

            <View style={s.barRow}>
              <Text style={s.starLabel}>3 ★</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: '2%' }]} />
              </View>
              <Text style={s.barPercent}>0</Text>
            </View>
          </View>
        </View>

        {/* Action Button Banner */}
        <TouchableOpacity style={s.addReviewCard} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <View style={s.addReviewIcon}>
            <Ionicons name="chatbox-ellipses" size={22} color={COLORS.goldDark} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.addReviewTitle}>Share Your Experience</Text>
            <Text style={s.addReviewSub}>Have you used our CAC, Social Boost, or VTU services? Rate us now!</Text>
          </View>
          <View style={s.addReviewBtn}>
            <Text style={s.addReviewBtnTxt}>+ Rate Us</Text>
          </View>
        </TouchableOpacity>

        {/* Filter Categories Horizontal Scroll */}
        <Text style={s.sectionHeader}>FILTER BY CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity 
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[s.catChip, selectedCategory === cat && s.catChipActive]}
            >
              <Text style={[s.catChipTxt, selectedCategory === cat && s.catChipTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Star Rating Filter Chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity 
            onPress={() => setSelectedStarFilter(null)}
            style={[s.starChip, selectedStarFilter === null && s.starChipActive]}
          >
            <Text style={[s.starChipTxt, selectedStarFilter === null && s.starChipTxtActive]}>All Ratings</Text>
          </TouchableOpacity>
          {[5, 4, 3].map((star) => (
            <TouchableOpacity 
              key={star}
              onPress={() => setSelectedStarFilter(selectedStarFilter === star ? null : star)}
              style={[s.starChip, selectedStarFilter === star && s.starChipActive]}
            >
              <Ionicons name="star" size={12} color={selectedStarFilter === star ? COLORS.white : COLORS.gold} style={{ marginRight: 3 }} />
              <Text style={[s.starChipTxt, selectedStarFilter === star && s.starChipTxtActive]}>{star} Stars</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reviews List Feed */}
        <Text style={s.sectionHeader}>CUSTOMER FEEDBACK ({filteredReviews.length})</Text>
        {filteredReviews.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSub} />
            <Text style={s.emptyTitle}>No reviews found</Text>
            <Text style={s.emptySub}>Be the first to leave a review in this category!</Text>
          </View>
        ) : (
          filteredReviews.map((item) => (
            <View key={item.id} style={s.reviewCard}>
              <View style={s.cardHeader}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarBox}>
                    <Text style={s.avatarTxt}>{item.user_name ? item.user_name.charAt(0).toUpperCase() : 'U'}</Text>
                  </View>
                )}
                
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.userName}>{item.user_name}</Text>
                    {item.verified && (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                        <Text style={s.verifiedTxt}>Verified</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <View style={{ flexDirection: 'row', marginRight: 8 }}>
                      {[1, 2, 3, 4, 5].map((st) => (
                        <Ionicons 
                          key={st} 
                          name={st <= item.rating ? "star" : "star-outline"} 
                          size={12} 
                          color={COLORS.gold} 
                        />
                      ))}
                    </View>
                    <Text style={s.catBadgeTxt}>• {item.category}</Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.dateTxt}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => handleDeleteReview(item.id)} style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#fef2f2', borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.error }}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={s.commentTxt}>{item.comment}</Text>

              <View style={s.cardFooter}>
                <TouchableOpacity 
                  style={[s.likeBtn, likedReviews[item.id] && s.likeBtnActive]} 
                  onPress={() => handleLike(item.id)}
                >
                  <Ionicons 
                    name={likedReviews[item.id] ? "thumbs-up" : "thumbs-up-outline"} 
                    size={14} 
                    color={likedReviews[item.id] ? COLORS.goldDark : COLORS.textSub} 
                  />
                  <Text style={[s.likeBtnTxt, likedReviews[item.id] && s.likeBtnTxtActive]}>
                    Helpful ({item.likes_count || 0})
                  </Text>
                </TouchableOpacity>

                <Text style={s.footerAppTag}>Abu Mafhal Hub</Text>
              </View>
            </View>
          ))
        )}

      </ScrollView>

      {/* Write Review Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Write a Review</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Star Rating Picker */}
              <Text style={s.fieldLabel}>Rate Your Experience *</Text>
              <View style={s.starPickerRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setNewRating(star)} style={{ padding: 6 }}>
                    <Ionicons 
                      name={star <= newRating ? "star" : "star-outline"} 
                      size={32} 
                      color={COLORS.gold} 
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Service Category Picker */}
              <Text style={s.fieldLabel}>Service Category *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                  <TouchableOpacity 
                    key={cat}
                    onPress={() => setNewCategory(cat)}
                    style={[s.modalCatChip, newCategory === cat && s.modalCatChipActive]}
                  >
                    <Text style={[s.modalCatChipTxt, newCategory === cat && s.modalCatChipTxtActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Name */}
              <Text style={s.fieldLabel}>Your Name</Text>
              <TextInput 
                style={s.textInput}
                placeholder="Enter your name"
                value={userName}
                onChangeText={setUserName}
              />

              {/* Comment */}
              <Text style={s.fieldLabel}>Your Feedback / Review *</Text>
              <TextInput 
                style={[s.textInput, { height: 110, textAlignVertical: 'top' }]}
                placeholder="Tell us what you loved about our services or how we can improve..."
                multiline
                value={newComment}
                onChangeText={setNewComment}
              />

              <TouchableOpacity 
                style={s.submitModalBtn} 
                onPress={handlePostReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.navy} />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color={COLORS.navy} style={{ marginRight: 6 }} />
                    <Text style={s.submitModalBtnTxt}>Submit Review</Text>
                  </>
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
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: COLORS.navy,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  headerSubTitle: { fontSize: 11, color: COLORS.gold, marginTop: 2 },
  writeBtnHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  writeBtnHeaderTxt: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy },

  summaryCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  scoreBox: { alignItems: 'center', justifyContent: 'center', paddingRight: 16, borderRightWidth: 1, borderRightColor: COLORS.border },
  scoreBig: { fontSize: 32, fontWeight: '900', color: COLORS.navy },
  scoreSub: { fontSize: 10, fontWeight: '600', color: COLORS.textSub, marginTop: 2 },

  breakdownBox: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  starLabel: { fontSize: 11, fontWeight: 'bold', color: COLORS.navy, width: 26 },
  barTrack: { flex: 1, height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  barPercent: { fontSize: 10, color: COLORS.textSub, width: 24, textAlign: 'right' },

  addReviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gold, marginBottom: 16 },
  addReviewIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.2)', alignItems: 'center', justifyContent: 'center' },
  addReviewTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.navy },
  addReviewSub: { fontSize: 10, color: COLORS.textSub, marginTop: 2 },
  addReviewBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addReviewBtnTxt: { fontSize: 11, fontWeight: 'bold', color: COLORS.navy },

  sectionHeader: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy, marginBottom: 10, letterSpacing: 0.5 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  catChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  catChipTxtActive: { color: COLORS.white, fontWeight: 'bold' },

  starChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  starChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  starChipTxt: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  starChipTxtActive: { color: COLORS.navy, fontWeight: 'bold' },

  emptyBox: { alignItems: 'center', padding: 40, backgroundColor: COLORS.white, borderRadius: 16, marginVertical: 10 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.navy, marginTop: 10 },
  emptySub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },

  reviewCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0' },
  avatarBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold },
  userName: { fontSize: 13, fontWeight: 'bold', color: COLORS.navy },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6, gap: 2 },
  verifiedTxt: { fontSize: 9, fontWeight: 'bold', color: COLORS.success },
  catBadgeTxt: { fontSize: 10, color: COLORS.textSub, fontWeight: '500' },
  dateTxt: { fontSize: 10, color: COLORS.textSub },

  commentTxt: { fontSize: 13, color: COLORS.textMain, lineHeight: 19, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4 },
  likeBtnActive: { backgroundColor: '#fffbeb' },
  likeBtnTxt: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  likeBtnTxtActive: { color: COLORS.goldDark, fontWeight: 'bold' },
  footerAppTag: { fontSize: 10, fontWeight: '600', color: COLORS.textSub },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(13,27,62,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.navy },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.navy, marginBottom: 6, marginTop: 12 },
  starPickerRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  modalCatChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: COLORS.border },
  modalCatChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  modalCatChipTxt: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  modalCatChipTxtActive: { color: COLORS.white, fontWeight: 'bold' },
  textInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.textMain, backgroundColor: '#f8fafc', marginBottom: 10 },
  submitModalBtn: { flexDirection: 'row', backgroundColor: COLORS.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 30 },
  submitModalBtnTxt: { fontSize: 14, fontWeight: 'bold', color: COLORS.navy },
});
