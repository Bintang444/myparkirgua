import { supabase } from '/config/supabase.js'

// AUTH MODEL

// Handle semua operasi authentication & user profile
export class AuthModel {
    
    // Login user
    static async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Logout user
    static async logout() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get current user
    static async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error) throw error
            return { success: true, user }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get user profile with role
    static async getUserProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, nama, email')
                .eq('id', userId)
                .single()
            
            if (error) throw error
            return { success: true, profile: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    } 
    
    // Check if user has specific role
    static async checkRole(userId, requiredRole) {
        try {
            const result = await this.getUserProfile(userId)
            if (!result.success) throw new Error(result.error)
            
            const hasRole = result.profile.role === requiredRole
            return { success: true, hasRole, profile: result.profile }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}