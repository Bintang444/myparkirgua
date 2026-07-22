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

    // ─── DEMO: Seed Data ──────────────────────────────────
    static async seedDemoData() {
        try {
            const dummyCards = [
                'A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2', 'M3N4O5P6',
                'Q7R8S9T0', 'U1V2W3X4', 'Y5Z6A7B8', 'C9D0E1F2'
            ]
            const petugasList = ['Petugas Parkir', 'Ahmad', 'Siti', 'Budi']
            const now = new Date()
            const records = []

            for (let day = 6; day >= 0; day--) {
                const date = new Date(now)
                date.setDate(date.getDate() - day)
                date.setHours(0, 0, 0, 0)

                const txCount = 2 + Math.floor(Math.random() * 3)
                for (let i = 0; i < txCount; i++) {
                    const cardId = dummyCards[Math.floor(Math.random() * dummyCards.length)]
                    const checkinHour = 7 + Math.floor(Math.random() * 10)
                    const checkinMin = Math.floor(Math.random() * 60)
                    const checkinTime = new Date(date)
                    checkinTime.setHours(checkinHour, checkinMin, 0, 0)

                    const duration = 30 + Math.floor(Math.random() * 330)
                    const checkoutTime = new Date(checkinTime.getTime() + duration * 60000)
                    const fee = (Math.ceil(duration / 60) || 1) * 2000

                    let status = 'DONE'
                    if (day === 0 && i === 0) status = 'IN'
                    if (day === 0 && i === 1) status = 'OUT'

                    const petugasMasuk = petugasList[Math.floor(Math.random() * petugasList.length)]
                    const petugasKeluar = status === 'DONE' ? petugasList[Math.floor(Math.random() * petugasList.length)] : null

                    records.push({
                        card_id: cardId,
                        checkin_time: checkinTime.toISOString(),
                        checkout_time: status === 'IN' ? null : checkoutTime.toISOString(),
                        duration: status === 'IN' ? null : duration,
                        fee: status === 'IN' ? null : fee,
                        status: status,
                        petugas_masuk: petugasMasuk,
                        petugas_keluar: petugasKeluar
                    })
                }
            }

            const { data, error } = await supabase
                .from('transaksi')
                .insert(records)
                .select()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async countAll() {
        try {
            const { count, error } = await supabase
                .from('transaksi')
                .select('*', { count: 'exact', head: true })

            if (error) throw error
            return { success: true, count }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async deleteAllData() {
        try {
            const { error } = await supabase
                .from('transaksi')
                .delete()
                .neq('id', 0)

            if (error) throw error
            return { success: true }
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