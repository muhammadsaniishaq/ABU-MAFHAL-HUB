import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Review = {
    id: string;
    user_id?: string | null;
    user_name: string;
    avatar_url?: string | null;
    rating: number;
    category: string;
    comment: string;
    likes_count?: number;
    verified?: boolean;
    is_hidden?: boolean;
    is_featured?: boolean;
    created_at: string;
};

const STORAGE_CACHE_KEY = '@abu_mafhal_reviews_cache_v2';
const PENDING_REVIEWS_KEY = '@abu_mafhal_pending_reviews_v2';

const SEED_DEFAULT_REVIEWS: Review[] = [
    {
        id: 'rev-seed-1',
        user_name: 'Usman Garba',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        rating: 5,
        category: 'CAC Services',
        comment: 'CAC Business Name registration was processed and issued in under 3 days! Exceptional service and speed.',
        likes_count: 34,
        verified: true,
        is_featured: true,
        is_hidden: false,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
        id: 'rev-seed-2',
        user_name: 'Amina Bello',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        rating: 5,
        category: 'Social Boost',
        comment: 'Social boost service worked 100%! Instagram followers and engagement arrived within 5 minutes.',
        likes_count: 21,
        verified: true,
        is_featured: true,
        is_hidden: false,
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    {
        id: 'rev-seed-3',
        user_name: 'Ibrahim Sani',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
        rating: 5,
        category: 'Data Bundles',
        comment: 'Fast and reliable data vending even late at night. Instant automated top-ups without delays.',
        likes_count: 18,
        verified: true,
        is_featured: false,
        is_hidden: false,
        created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
    {
        id: 'rev-seed-4',
        user_name: 'Fatima Zubairu',
        avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        rating: 5,
        category: 'CAC Services',
        comment: 'Registered a Limited Liability Company with Tax Identification Number (TIN). Official certificate delivered seamlessly.',
        likes_count: 42,
        verified: true,
        is_featured: true,
        is_hidden: false,
        created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
    },
    {
        id: 'rev-seed-5',
        user_name: 'Kabiru Lawal',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        rating: 4,
        category: 'Airtime & Cable',
        comment: 'Cable TV subscription (DSTV/GOTV) was activated immediately. Very smooth system.',
        likes_count: 9,
        verified: true,
        is_featured: false,
        is_hidden: false,
        created_at: new Date(Date.now() - 3600000 * 120).toISOString(),
    }
];

export const reviewsService = {
    /**
     * Fetch all reviews from Supabase.
     * If isAdmin = false, returns only non-hidden reviews.
     */
    async getAll(isAdmin = false): Promise<Review[]> {
        try {
            // 1. Sync any pending offline submissions first
            await this.syncPendingReviews();

            // 2. Fetch from Supabase
            let query = supabase
                .from('reviews')
                .select('*')
                .order('created_at', { ascending: false });

            if (!isAdmin) {
                query = query.or('is_hidden.is.null,is_hidden.eq.false');
            }

            const { data, error } = await query;

            if (error) {
                console.warn('Error fetching reviews from Supabase:', error.message);
                // Fallback to local cache if network/table error
                const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
                if (cached) {
                    const parsed: Review[] = JSON.parse(cached);
                    return isAdmin ? parsed : parsed.filter(r => !r.is_hidden);
                }
                return SEED_DEFAULT_REVIEWS;
            }

            // 3. If DB is empty, auto-seed defaults into Supabase once so they exist globally
            if (!data || data.length === 0) {
                try {
                    const { data: countCheck } = await supabase.from('reviews').select('id', { count: 'exact', head: true });
                    // Only seed if table is completely empty (no hidden or existing reviews)
                    if (!countCheck || countCheck.length === 0) {
                        for (const seedItem of SEED_DEFAULT_REVIEWS) {
                            await supabase.from('reviews').insert(seedItem);
                        }
                        return SEED_DEFAULT_REVIEWS;
                    }
                } catch (seedErr) {
                    console.warn('Auto-seed check error:', seedErr);
                }
                return [];
            }

            // 4. Update local cache
            await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
            return data;
        } catch (e: any) {
            console.error('Failed to get reviews:', e);
            const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
            return cached ? JSON.parse(cached) : SEED_DEFAULT_REVIEWS;
        }
    },

    /**
     * Submit a new review to Supabase globally.
     */
    async create(review: Omit<Review, 'id' | 'created_at'>): Promise<Review> {
        const id = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created_at = new Date().toISOString();

        const fullReview: Review = {
            ...review,
            id,
            created_at,
            likes_count: review.likes_count ?? 0,
            verified: review.verified ?? true,
            is_hidden: review.is_hidden ?? false,
            is_featured: review.is_featured ?? false,
        };

        try {
            const { error } = await supabase.from('reviews').insert({
                id: fullReview.id,
                user_id: fullReview.user_id || null,
                user_name: fullReview.user_name,
                avatar_url: fullReview.avatar_url || null,
                rating: fullReview.rating,
                category: fullReview.category,
                comment: fullReview.comment,
                likes_count: fullReview.likes_count,
                verified: fullReview.verified,
                is_hidden: fullReview.is_hidden,
                is_featured: fullReview.is_featured,
                created_at: fullReview.created_at,
            });

            if (error) {
                console.warn('Direct insert failed, queueing pending review:', error.message);
                await this.queuePendingReview(fullReview);
            }
        } catch (e) {
            console.warn('Network error on review post, queueing pending review:', e);
            await this.queuePendingReview(fullReview);
        }

        // Update local cache
        try {
            const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
            const list: Review[] = cached ? JSON.parse(cached) : [];
            const updated = [fullReview, ...list.filter(r => r.id !== fullReview.id)];
            await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated));
        } catch (_) {}

        return fullReview;
    },

    /**
     * Delete review permanently from Supabase.
     */
    async delete(id: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Failed to delete review from Supabase:', error.message);
                throw error;
            }

            // Remove from local cache
            const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
            if (cached) {
                const list: Review[] = JSON.parse(cached);
                const updated = list.filter(r => r.id !== id);
                await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated));
            }

            return true;
        } catch (e: any) {
            console.error('Delete review error:', e);
            throw e;
        }
    },

    /**
     * Toggle visibility (Hide/Unhide) of a review in Supabase.
     */
    async toggleHide(id: string, currentHidden: boolean): Promise<boolean> {
        const nextHidden = !currentHidden;
        const { error } = await supabase
            .from('reviews')
            .update({ is_hidden: nextHidden })
            .eq('id', id);

        if (error) throw error;

        // Update cache
        const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
        if (cached) {
            const list: Review[] = JSON.parse(cached);
            const updated = list.map(r => r.id === id ? { ...r, is_hidden: nextHidden } : r);
            await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated));
        }

        return nextHidden;
    },

    /**
     * Toggle Featured status of a review in Supabase.
     */
    async toggleFeatured(id: string, currentFeatured: boolean): Promise<boolean> {
        const nextFeatured = !currentFeatured;
        const { error } = await supabase
            .from('reviews')
            .update({ is_featured: nextFeatured })
            .eq('id', id);

        if (error) throw error;

        // Update cache
        const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
        if (cached) {
            const list: Review[] = JSON.parse(cached);
            const updated = list.map(r => r.id === id ? { ...r, is_featured: nextFeatured } : r);
            await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated));
        }

        return nextFeatured;
    },

    /**
     * Like / Increment likes count for a review.
     */
    async like(id: string, newLikesCount: number): Promise<void> {
        await supabase
            .from('reviews')
            .update({ likes_count: newLikesCount })
            .eq('id', id);

        // Update cache
        const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
        if (cached) {
            const list: Review[] = JSON.parse(cached);
            const updated = list.map(r => r.id === id ? { ...r, likes_count: newLikesCount } : r);
            await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated));
        }
    },

    /**
     * Offline Queue Helper.
     */
    async queuePendingReview(review: Review): Promise<void> {
        try {
            const pendingStr = await AsyncStorage.getItem(PENDING_REVIEWS_KEY);
            const pendingList: Review[] = pendingStr ? JSON.parse(pendingStr) : [];
            pendingList.push(review);
            await AsyncStorage.setItem(PENDING_REVIEWS_KEY, JSON.stringify(pendingList));
        } catch (e) {
            console.error('Failed to queue pending review:', e);
        }
    },

    /**
     * Sync any pending reviews to Supabase.
     */
    async syncPendingReviews(): Promise<void> {
        try {
            const pendingStr = await AsyncStorage.getItem(PENDING_REVIEWS_KEY);
            if (!pendingStr) return;

            const pendingList: Review[] = JSON.parse(pendingStr);
            if (!Array.isArray(pendingList) || pendingList.length === 0) return;

            const remaining: Review[] = [];

            for (const item of pendingList) {
                const { error } = await supabase.from('reviews').upsert(item);
                if (error) {
                    remaining.push(item);
                }
            }

            if (remaining.length > 0) {
                await AsyncStorage.setItem(PENDING_REVIEWS_KEY, JSON.stringify(remaining));
            } else {
                await AsyncStorage.removeItem(PENDING_REVIEWS_KEY);
            }
        } catch (e) {
            console.warn('Sync pending reviews error:', e);
        }
    }
};
