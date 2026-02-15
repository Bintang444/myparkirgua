import { AuthModel } from '../models/auth-model.js'
import { showError } from '../utils/notification.js'

// AUTH CONTROLLER

// Handle authentication logic
export class AuthController {
    
    // Handle login
    static async handleLogin(email, password) {
        // Validasi input
        if (!email || !password) {
            return { success: false, error: 'Email dan password harus diisi!' }
        }
        
        // Login via model
        const loginResult = await AuthModel.login(email, password)
        if (!loginResult.success) {
            return loginResult
        }
        
        // Get user profile
        const profileResult = await AuthModel.getUserProfile(loginResult.data.user.id)
        if (!profileResult.success) {
            return profileResult
        }
        
        // Save to localStorage
        localStorage.setItem('userRole', profileResult.profile.role)
        localStorage.setItem('userName', profileResult.profile.nama)
        
        return { 
            success: true, 
            user: loginResult.data.user,
            profile: profileResult.profile 
        }
    }
    
    // Handle logout
    static async handleLogout() {
        const result = await AuthModel.logout()
        
        if (result.success) {
            localStorage.removeItem('userRole')
            localStorage.removeItem('userName')
        }
        
        return result
    }
    
    // Check authentication & redirect if needed
    static async checkAuth(requiredRole = null) {
        // Get current user
        const userResult = await AuthModel.getCurrentUser()
        if (!userResult.success || !userResult.user) {
            window.location.href = '/views/login.html'
            return { success: false, error: 'Not authenticated' }
        }
        
        // Get profile
        const profileResult = await AuthModel.getUserProfile(userResult.user.id)
        if (!profileResult.success) {
            window.location.href = '/views/login.html'
            return { success: false, error: 'Profile not found' }
        }
        
        // Check role if specified
        if (requiredRole && profileResult.profile.role !== requiredRole) {
            showError('Akses ditolak! Anda tidak memiliki izin untuk halaman ini.')
            window.location.href = '/views/login.html'
            return { success: false, error: 'Access denied' }
        }
        
        return { 
            success: true, 
            user: userResult.user,
            profile: profileResult.profile 
        }
    }
}