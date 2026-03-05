import { supabase } from '../config/supabase.js'

// TARIF MODEL

// Handle operasi tarif parkir
export class TarifModel {
    
    // Get semua tarif
    static async getAll() {
        try {
            const { data, error } = await supabase
                .from('tarif_parkir')
                .select('*')
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
    
    // Get tarif by jenis
    static async getByJenis(jenis) {
        try {
            const { data, error } = await supabase
                .from('tarif_parkir')
                .select('tarif_per_jam')
                .eq('jenis', jenis)
                .single()
            
            if (error) throw error
            return { success: true, tarif: data.tarif_per_jam }
        } catch (error) {
            return { success: false, error: error.message } 
        }
    }
    
    // Get tarif as object map {Motor: 2000}
    static async getTarifMap() {
        try {
            const result = await this.getAll()
            if (!result.success) throw new Error(result.error)
            
            const tarifMap = {}
            result.data.forEach(t => {
                tarifMap[t.jenis] = t.tarif_per_jam
            })
            
            return { success: true, tarifMap }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}