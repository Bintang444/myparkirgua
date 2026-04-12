import { supabase } from '/config/supabase.js'

// TRANSAKSI MODEL
// Handle semua CRUD transaksi parkir motor
export class TransaksiModel {

    // Get transaksi yang sedang parkir (status IN) dengan pagination
    static async getTransaksiParkir(limit = 10, page = 1) {
        try {
            const offset = (page - 1) * limit
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'IN')
                .order('checkin_time', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Hitung total transaksi parkir (status IN)
    static async countTransaksiParkir() {
        try {
            const { count, error } = await supabase
                .from('transaksi')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'IN')

            if (error) throw error
            return { success: true, count }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get transaksi yang sudah selesai (status DONE) dengan pagination
    static async getTransaksiSelesai(limit = 10, page = 1) {
        try {
            const offset = (page - 1) * limit
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'DONE')
                .order('checkout_time', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Hitung total transaksi selesai (untuk pagination)
    static async countTransaksiSelesai() {
        try {
            const { count, error } = await supabase
                .from('transaksi')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'DONE')

            if (error) throw error
            return { success: true, count }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get transaksi by card_id (yang sedang parkir)
    static async getByCardId(cardId) {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('card_id', cardId)
                .eq('status', 'IN')
                .maybeSingle()

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

    // Check in motor (masuk parkir)
    static async checkIn(cardId, petugasNama) {
        try {
            // Cek dulu apakah card_id sedang parkir
            const existing = await this.getByCardId(cardId)
            if (!existing.success) throw new Error(existing.error)

            if (existing.data) {
                return {
                    success: false,
                    error: 'Motor dengan card ID ini sedang parkir!',
                    code: 'ALREADY_PARKED'
                }
            }

            // Insert transaksi baru
            const { data, error } = await supabase
                .from('transaksi')
                .insert({
                    card_id: cardId,
                    checkin_time: new Date().toISOString(),
                    status: 'IN',
                    petugas_masuk: petugasNama || 'Petugas Parkir'
                })
                .select()
                .single()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get transaksi yang sudah checkout (status OUT) dengan pagination
    static async getTransaksiCheckOut(limit = 10, page = 1) {
        try {
            const offset = (page - 1) * limit
            const { data, error } = await supabase
                .from('transaksi')
                .select('*')
                .eq('status', 'OUT')
                .order('checkout_time', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Hitung total transaksi checkout (status OUT)
    static async countTransaksiCheckOut() {
        try {
            const { count, error } = await supabase
                .from('transaksi')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'OUT')

            if (error) throw error
            return { success: true, count }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Check out motor (keluar parkir) - update status jadi OUT
    static async checkOut(cardId, checkoutTime, duration, fee) {
        try {
            // Cek dulu apakah card_id sedang parkir
            const existing = await this.getByCardId(cardId)
            if (!existing.success) throw new Error(existing.error)

            if (!existing.data) {
                return {
                    success: false,
                    error: 'Motor dengan card ID ini tidak sedang parkir!',
                    code: 'NOT_PARKED'
                }
            }

            // Update status jadi OUT (menunggu konfirmasi petugas)
            const { data, error } = await supabase
                .from('transaksi')
                .update({
                    checkout_time: checkoutTime,
                    duration: duration,
                    fee: fee,
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
                .gte('checkin_time', dateFrom)
                .lte('checkin_time', dateTo)
                .order('checkin_time', { ascending: false })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Get semua transaksi untuk chart
    static async getAllForChart() {
        try {
            const { data, error } = await supabase
                .from('transaksi')
                .select('checkin_time, fee')
                .order('checkin_time', { ascending: true })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}