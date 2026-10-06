import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

const GLOBAL_STORAGE_KEY = '@abu_mafhal_app_rating_v1';
export const PLAY_STORE_PACKAGE = 'com.muhammmadsaniishaq.abumafhalsub';
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
export const PLAY_STORE_MARKET_URI = `market://details?id=${PLAY_STORE_PACKAGE}`;

export interface RatingState {
    has_rated: boolean;
    dont_ask_again: boolean;
    last_prompt_timestamp: number;
    successful_actions_count: number;
    rated_stars?: number;
    feedback_notes?: string;
    userId?: string;
}

const DEFAULT_STATE: RatingState = {
    has_rated: false,
    dont_ask_again: false,
    last_prompt_timestamp: 0,
    successful_actions_count: 0,
};

// Cooldown between prompts if user clicked "Remind Me Later" (3 days)
const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export type RatingPromptHandler = (options?: { force?: boolean; actionName?: string }) => void;

let activeRatingPromptHandler: RatingPromptHandler | null = null;

export const ratingService = {
    /**
     * Register global UI handler (attached to AppRatingModal)
     */
    registerHandler(handler: RatingPromptHandler) {
        activeRatingPromptHandler = handler;
    },

    /**
     * Unregister global UI handler
     */
    unregisterHandler() {
        activeRatingPromptHandler = null;
    },

    /**
     * Helper to get user-specific storage key
     */
    async getUserStorageKey(): Promise<{ key: string; userId: string | null; metaHasRated: boolean }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
                const metaHasRated = Boolean(
                    user.user_metadata?.has_rated_app || 
                    user.user_metadata?.rated_stars || 
                    user.user_metadata?.rating_dont_ask_again
                );
                return {
                    key: `@abu_mafhal_app_rating_user_${user.id}`,
                    userId: user.id,
                    metaHasRated
                };
            }
        } catch (_) {}
        return { key: GLOBAL_STORAGE_KEY, userId: null, metaHasRated: false };
    },

    /**
     * Get persisted rating state (checks Device Storage + User-Specific Storage + Supabase Cloud Metadata)
     */
    async getState(): Promise<RatingState> {
        try {
            const { key, userId, metaHasRated } = await this.getUserStorageKey();

            // 1. If Supabase cloud metadata already shows user has rated, permanently remember!
            if (metaHasRated) {
                return {
                    ...DEFAULT_STATE,
                    has_rated: true,
                    dont_ask_again: true,
                    userId: userId || undefined
                };
            }

            // 2. Check user-specific local storage
            if (userId) {
                const userRaw = await AsyncStorage.getItem(key);
                if (userRaw) {
                    const parsed = JSON.parse(userRaw);
                    if (parsed.has_rated || parsed.dont_ask_again) {
                        return { ...DEFAULT_STATE, ...parsed, userId };
                    }
                }
            }

            // 3. Check global device storage
            const raw = await AsyncStorage.getItem(GLOBAL_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_STATE, ...parsed, userId: userId || undefined };
            }

            return { ...DEFAULT_STATE, userId: userId || undefined };
        } catch (e) {
            console.warn('[ratingService] Failed to read state:', e);
            return { ...DEFAULT_STATE };
        }
    },

    /**
     * Save rating state permanently (Device + User Storage + Supabase Cloud Sync)
     */
    async saveState(patch: Partial<RatingState>): Promise<RatingState> {
        try {
            const current = await this.getState();
            const updated: RatingState = { ...current, ...patch };

            const { key, userId } = await this.getUserStorageKey();

            // 1. Save to Device Storage
            await AsyncStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updated));

            // 2. Save to User-specific Storage if logged in
            if (userId) {
                await AsyncStorage.setItem(key, JSON.stringify(updated));

                // 3. Cloud Sync: If rated or opted out, permanently stamp Supabase user metadata
                if (patch.has_rated || patch.dont_ask_again) {
                    supabase.auth.updateUser({
                        data: {
                            has_rated_app: Boolean(updated.has_rated),
                            rating_dont_ask_again: Boolean(updated.dont_ask_again),
                            rated_stars: updated.rated_stars || 5,
                            rated_at: new Date().toISOString()
                        }
                    }).catch(err => console.warn('[ratingService] Cloud metadata sync error:', err));
                }
            }

            return updated;
        } catch (e) {
            console.warn('[ratingService] Failed to save state:', e);
            return { ...DEFAULT_STATE, ...patch };
        }
    },

    /**
     * Record a successful user action (transaction, payment, exchange, etc.)
     * Automatically triggers rating prompt at the optimal psychological moment.
     */
    async recordSuccessfulAction(actionName?: string): Promise<boolean> {
        try {
            const state = await this.getState();

            // PERMANENT CHECK: If user has already rated or chose never to be asked, STOP immediately!
            if (state.has_rated || state.dont_ask_again) {
                return false;
            }

            const newCount = (state.successful_actions_count || 0) + 1;
            const now = Date.now();
            const timeSinceLastPrompt = now - (state.last_prompt_timestamp || 0);

            // Milestone conditions:
            // - 1st successful action (first impression)
            // - 3rd successful action
            // - every 4th action thereafter IF cooldown has elapsed
            const isMilestone = newCount === 1 || newCount === 3 || newCount % 4 === 0;
            const cooldownPassed = timeSinceLastPrompt >= REMINDER_COOLDOWN_MS;

            await this.saveState({
                successful_actions_count: newCount,
            });

            if (isMilestone && cooldownPassed) {
                // Trigger prompt after a smooth 1.2s delay for maximum natural feel
                setTimeout(() => {
                    this.triggerPrompt({ force: false, actionName });
                }, 1200);
                return true;
            }

            return false;
        } catch (err) {
            console.warn('[ratingService] recordSuccessfulAction error:', err);
            return false;
        }
    },

    /**
     * Directly trigger the rating prompt modal
     */
    async triggerPrompt(options?: { force?: boolean; actionName?: string }) {
        if (!options?.force) {
            const state = await this.getState();
            if (state.has_rated || state.dont_ask_again) {
                return;
            }
        }

        if (activeRatingPromptHandler) {
            activeRatingPromptHandler(options);
        } else {
            console.log('[ratingService] No active modal handler registered');
        }
    },

    /**
     * Open Google Play Store for rating & permanently mark as rated!
     */
    async openPlayStore(customUrl?: string, stars = 5): Promise<boolean> {
        try {
            // PERMANENTLY remember user has rated!
            await this.saveState({
                has_rated: true,
                dont_ask_again: true,
                rated_stars: stars,
                last_prompt_timestamp: Date.now(),
            });

            const targetUrl = customUrl || PLAY_STORE_MARKET_URI;
            const canOpen = await Linking.canOpenURL(targetUrl);

            if (canOpen) {
                await Linking.openURL(targetUrl);
                return true;
            } else {
                await Linking.openURL(customUrl || PLAY_STORE_WEB_URL);
                return true;
            }
        } catch (err) {
            console.warn('[ratingService] Error opening Play Store:', err);
            try {
                await Linking.openURL(customUrl || PLAY_STORE_WEB_URL);
                return true;
            } catch (_) {
                return false;
            }
        }
    },

    /**
     * Open direct WhatsApp or Help Desk for feedback (for 1-3 stars rating)
     */
    async openSupportFeedback(supportPhone = '2348145853539', rating?: number) {
        try {
            await this.saveState({
                last_prompt_timestamp: Date.now(),
                rated_stars: rating,
            });

            const msg = encodeURIComponent(
                `Hello ABU MAFHAL SUB Support, I would like to share feedback/report an issue regarding the app (Rating: ${rating || 3} Stars).`
            );
            const waUrl = `whatsapp://send?phone=${supportPhone}&text=${msg}`;
            const canWa = await Linking.canOpenURL(waUrl);

            if (canWa) {
                await Linking.openURL(waUrl);
            } else {
                await Linking.openURL(`https://wa.me/${supportPhone}?text=${msg}`);
            }
        } catch (e) {
            console.warn('[ratingService] openSupportFeedback error:', e);
        }
    },

    /**
     * Remind user later (cooldown)
     */
    async remindLater(days = 3) {
        await this.saveState({
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Permanently opt-out: Never show prompt again for this user & device
     */
    async neverAskAgain() {
        await this.saveState({
            dont_ask_again: true,
            has_rated: false,
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Mark app as rated
     */
    async markAsRated(stars = 5) {
        await this.saveState({
            has_rated: true,
            dont_ask_again: true,
            rated_stars: stars,
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Reset for testing
     */
    async resetState() {
        await AsyncStorage.removeItem(GLOBAL_STORAGE_KEY);
        const { key } = await this.getUserStorageKey();
        if (key) await AsyncStorage.removeItem(key);
    }
};

export default ratingService;
