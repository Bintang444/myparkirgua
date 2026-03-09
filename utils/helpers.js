// HELPER FUNCTIONS

// Format durasi dalam menit jadi "X jam Y menit"
export function formatDurasi(menit) {
    if (!menit || menit < 0) return '-'
    
    const jam = Math.floor(menit / 60)
    const sisaMenit = menit % 60
    
    if (jam > 0) {
        return `${jam} jam ${sisaMenit} menit`
    }
    return `${sisaMenit} menit`
}

// Hitung durasi parkir dalam menit
export function hitungDurasi(waktuMasuk, waktuKeluar = new Date()) {
    const masuk = new Date(waktuMasuk)
    const keluar = new Date(waktuKeluar)
    return Math.floor((keluar - masuk) / 1000 / 60)
}

// Hitung biaya parkir (durasi dibulatkan ke atas per jam)
export function hitungBiaya(durasiMenit, tarifPerJam) {
    const durasiJam = Math.ceil(durasiMenit / 60)
    return durasiJam * tarifPerJam
}

// Format angka jadi Rupiah
export function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0'
    return 'Rp ' + angka.toLocaleString('id-ID')
}

// Format tanggal
export function formatTanggal(date) {
    return new Date(date).toLocaleDateString('id-ID')
}

// Format waktu
export function formatWaktu(date) {
    return new Date(date).toLocaleTimeString('id-ID')
}

// Format tanggal & waktu lengkap
export function formatTanggalWaktu(date) {
    return new Date(date).toLocaleString('id-ID')
}

// Validasi Card ID (harus ada & minimal 3 karakter)
export function validateCardId(cardId) {
    if (!cardId || cardId.trim().length === 0) {
        return { valid: false, error: 'Card ID wajib diisi!' }
    }
    
    if (cardId.trim().length < 3) {
        return { valid: false, error: 'Card ID minimal 3 karakter!' }
    }
    
    return { valid: true }
}

// Get tanggal hari ini (ISO format untuk database)
export function getTodayISO() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString()
}

// Get tanggal akhir hari ini (ISO format)
export function getTodayEndISO() {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return today.toISOString()
}

// Group data by tanggal untuk chart
export function groupByTanggal(data, keyField = 'waktu_masuk') {
    const grouped = {}
    
    data.forEach(item => {
        const tanggal = formatTanggal(item[keyField])
        if (!grouped[tanggal]) {
            grouped[tanggal] = []
        }
        grouped[tanggal].push(item)
    })
    
    return grouped
}

// Hitung total transaksi per tanggal
export function countByTanggal(data) {
    const grouped = groupByTanggal(data)
    const result = {}
    Object.keys(grouped).forEach(tanggal => {
        result[tanggal] = grouped[tanggal].length
    })
    return result
}

// Sum biaya
export function sumBiaya(data) {
    return data.reduce((sum, item) => sum + (item.biaya || 0), 0)
}