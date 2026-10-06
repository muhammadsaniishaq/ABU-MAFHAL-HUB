import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const STORAGE_KEY = '@abu_mafhal_app_rating_v1';
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
}

const DEFAULT_STATE: RatingState = {
    has_rated: false,
    dont_ask_again: false,
    last_prompt_timestamp: 0,
    successful_actions_count: 0,
};

// Cooldown between prompts if user clicked "Remind Me Later" (3 days)
const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

// Type for prompt trigger handler
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
     * Get persisted rating state
     */
    async getState(): Promise<RatingState> {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULT_STATE };
            return { ...DEFAULT_STATE, ...JSON.parse(raw) };
        } catch (e) {
            console.warn('[ratingService] Failed to read state:', e);
            return { ...DEFAULT_STATE };
        }
    },

    /**
     * Save rating state
     */
    async saveState(patch: Partial<RatingState>): Promise<RatingState> {
        try {
            const current = await this.getState();
            const updated = { ...current, ...patch };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.warn('[ratingService] Failed to save state:', e);
            return { ...DEFAULT_STATE, ...patch };
        }
    },

    /**
     * Record a successful user action (transaction, service purchase, payment, etc.)
     * Automatically triggers rating prompt at the optimal psychological moment.
     */
    async recordSuccessfulAction(actionName?: string): Promise<boolean> {
        try {
            const state = await this.getState();

            // If user has already rated or chose never to be asked again, do nothing
            if (state.has_rated || state.dont_ask_again) {
                return false;
            }

            const newCount = (state.successful_actions_count || 0) + 1;
            const now = Date.now();
            const timeSinceLastPrompt = now - (state.last_prompt_timestamp || 0);

            // Milestone conditions:
            // 1. First trigger at 1st or 2nd successful action
            // 2. Subsequent triggers every 3 successful actions IF cooldown has elapsed
            const isMilestone = newCount === 1 || newCount === 3 || newCount % 4 === 0;
            const cooldownPassed = timeSinceLastPrompt >= REMINDER_COOLDOWN_MS;

            await this.saveState({
                successful_actions_count: newCount,
            });

            if (isMilestone && cooldownPassed) {
                // Trigger prompt after a brief 1.2s delay for maximum impact
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
    triggerPrompt(options?: { force?: boolean; actionName?: string }) {
        if (activeRatingPromptHandler) {
            activeRatingPromptHandler(options);
        } else {
            console.log('[ratingService] No active modal handler registered');
        }
    },

    /**
     * Open Google Play Store for rating
     */
    async openPlayStore(customUrl?: string): Promise<boolean> {
        try {
            await this.saveState({
                has_rated: true,
                last_prompt_timestamp: Date.now(),
            });

            const targetUrl = customUrl || PLAY_STORE_MARKET_URI;
            const canOpen = await Linking.canOpenURL(targetUrl);

            if (canOpen) {
                await Linking.openURL(targetUrl);
                return true;
            } else {
                // Fallback to browser URL
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
                `Sannu ABU MAFHAL SUB Support, ina son bada shawara / korafi dangane da manhajar (Rating: ${rating || 3} Stars).`
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
     * Remind user later
     */
    async remindLater(days = 3) {
        await this.saveState({
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Never show prompt again
     */
    async neverAskAgain() {
        await this.saveState({
            dont_ask_again: true,
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Mark app as rated
     */
    async markAsRated(stars = 5) {
        await this.saveState({
            has_rated: true,
            rated_stars: stars,
            last_prompt_timestamp: Date.now(),
        });
    },

    /**
     * Reset for testing
     */
    async resetState() {
        await AsyncStorage.removeItem(STORAGE_KEY);
    }
};

export default ratingService;
