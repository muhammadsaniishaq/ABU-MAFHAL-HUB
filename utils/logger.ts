import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const logAdminAction = async (action: string, targetResource?: string, details?: any) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Verify the user is an admin
        const cachedRole = await AsyncStorage.getItem(`user_role_${user.id}`);
        let role = cachedRole;

        if (!role) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            role = data?.role;
        }

        if (role !== 'admin' && role !== 'super_admin') return false;

        const { error } = await supabase.from('audit_logs').insert({
            admin_id: user.id,
            action,
            target_resource: targetResource || 'System',
            details: details || {}
        });

        if (error) {
            console.error('Failed to log admin action:', error);
            return false;
        }

        return true;
    } catch (e) {
        console.error('Exception in logAdminAction:', e);
        return false;
    }
};
