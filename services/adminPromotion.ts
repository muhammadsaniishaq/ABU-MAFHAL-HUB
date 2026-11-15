import { supabase } from './supabase';

export interface AdminPromotionRequest {
    id: string;
    target_user_id: string;
    target_role: 'admin' | 'super_admin';
    requested_by: string;
    requested_by_email?: string;
    requested_at: string;
    effective_after: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approved_by?: string;
    approved_by_email?: string;
    approved_at?: string;
    cancelled_by?: string;
    cancelled_by_email?: string;
    cancelled_at?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    remaining_ms?: number;
    remaining_seconds?: number;
    is_ready_for_approval?: boolean;
    target?: {
        id: string;
        full_name?: string;
        email: string;
        phone?: string;
        role: string;
        avatar_url?: string;
        status?: string;
    };
    requester?: {
        id: string;
        full_name?: string;
        email: string;
    };
}

export const AdminPromotionService = {
    /**
     * Initiates the 24-hour security timelock countdown to promote a user to admin/super_admin.
     */
    async requestPromotion(targetUserId: string, targetRole: 'admin' | 'super_admin', notes?: string) {
        const { data, error } = await supabase.functions.invoke('admin-promotion', {
            body: {
                action: 'request_promotion',
                targetUserId,
                targetRole,
                notes,
            }
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to initiate promotion timelock.');
        return data;
    },

    /**
     * Lists active and recent promotion requests with countdown remaining seconds.
     */
    async listPending(): Promise<AdminPromotionRequest[]> {
        const { data, error } = await supabase.functions.invoke('admin-promotion', {
            body: { action: 'list' }
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to fetch promotion requests.');
        return data.requests || [];
    },

    /**
     * Approves the promotion request once the 24-hour timelock countdown has elapsed.
     */
    async approvePromotion(requestId: string) {
        const { data, error } = await supabase.functions.invoke('admin-promotion', {
            body: {
                action: 'approve_promotion',
                requestId,
            }
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to approve promotion.');
        return data;
    },

    /**
     * Cancels/rejects an unauthorized or mistaken promotion request at any time.
     */
    async cancelPromotion(requestId: string, reason?: string) {
        const { data, error } = await supabase.functions.invoke('admin-promotion', {
            body: {
                action: 'cancel_promotion',
                requestId,
                reason,
            }
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to cancel promotion.');
        return data;
    },

    /**
     * Immediately revokes admin privileges (instant demotion to user for emergencies).
     */
    async demoteUser(targetUserId: string, reason?: string) {
        const { data, error } = await supabase.functions.invoke('admin-promotion', {
            body: {
                action: 'demote_user',
                targetUserId,
                reason,
            }
        });
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to demote user.');
        return data;
    }
};
