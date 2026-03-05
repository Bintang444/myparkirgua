import { supabase } from '../config/supabase.js'

// KENDARAAN MODEL

// Handle semua operasi CRUD kendaraan
export class KendaraanModel {
    
    // Get kendaraan yang sedang parkir (status IN)
    static async getKendaraanParkir() {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'IN')
                .order('waktu_masuk', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get kendaraan yang sudah keluar (status DONE)
    static async getKendaraanSelesai(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'DONE')
                .order('waktu_keluar', { ascending: false })
                .limit(limit)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get kendaraan by card_id (cek status IN)
    static async getByCardId(cardId) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('card_id', cardId)
                .eq('status', 'IN')
                .single()
            
            if (error) {
                // Jika tidak ditemukan, return null (bukan error)
                if (error.code === 'PGRST116') {
                    return { success: true, data: null }
                }
                throw error
            }
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get transaksi by ID
    static async getById(id) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('id', id)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Check in kendaraan (masuk parkir)
    static async checkIn(cardId, platNomor, jenis, petugasNama) {
        try {
            // Cek dulu apakah card_id sedang parkir
            const existing = await this.getByCardId(cardId)
            if (!existing.success) throw new Error(existing.error)
            
            if (existing.data) {
                return { 
                    success: false, 
                    error: 'Kendaraan dengan card ID ini sedang parkir!',
                    code: 'ALREADY_PARKED'
                }
            }
            
            // Insert transaksi baru
            const { data, error } = await supabase
                .from('transaksi')
                .insert({
                    card_id: cardId,
                    plat_nomor: platNomor || null,
                    jenis: jenis,
                    status: 'IN',
                    petugas_masuk: petugasNama
                })
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Check out kendaraan (keluar parkir) - update status jadi OUT
    static async checkOut(cardId, waktuKeluar, durasiMenit, biaya) {
        try {
            // Cek dulu apakah card_id sedang parkir
            const existing = await this.getByCardId(cardId)
            if (!existing.success) throw new Error(existing.error)
            
            if (!existing.data) {
                return { 
                    success: false, 
                    error: 'Kendaraan dengan card ID ini tidak sedang parkir!',
                    code: 'NOT_PARKED'
                }
            }
            
            // Update status jadi OUT (menunggu konfirmasi petugas)
            const { data, error } = await supabase
                .from('transaksi')
                .update({
                    waktu_keluar: waktuKeluar,
                    durasi_menit: durasiMenit,
                    biaya: biaya,
                    status: 'OUT'
                })
                .eq('id', existing.data.id)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Konfirmasi keluar (update status jadi DONE)
    static async konfirmasiKeluar(id, petugasNama) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .update({
                    status: 'DONE',
                    petugas_keluar: petugasNama
                })
                .eq('id', id)
                .select()
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get statistik berdasarkan rentang tanggal
    static async getStatsByDateRange(dateFrom, dateTo) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'DONE')
                .gte('waktu_masuk', dateFrom)
                .lte('waktu_masuk', dateTo)
                .order('waktu_masuk', { ascending: false })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get semua data untuk chart
    static async getAllForChart() {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('waktu_masuk, jenis, biaya')
                .order('waktu_masuk', { ascending: true })
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}