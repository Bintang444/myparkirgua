import { KendaraanModel } from '../models/kendaraan-model.js'
import { TarifModel } from '../models/tarif-model.js'
import { 
    formatDurasi, 
    hitungDurasi, 
    hitungBiaya,
    formatRupiah,
    formatTanggal,
    formatTanggalWaktu,
    getTodayISO,
    getTodayEndISO,
    groupByTanggal,
    sumBiaya
} from '../utils/helpers.js'
import { showSuccess, showError } from '../utils/notification.js'

// OWNER CONTROLLER

// Handle business logic for dashboard owner
export class OwnerController {
    constructor(profile) {
        this.profile = profile
        this.tarifData = {}
        this.currentData = []
    }
    
    // Initialize
    async init() {
        await this.loadTarif()
        await this.loadStatsHariIni()
        await this.loadKendaraanParkir()
        await this.updatePendapatanChart()
        await this.setDefaultDates()
        await this.filterData()
        
        // Auto refresh every 30 seconds
        setInterval(async () => {
            await this.loadKendaraanParkir()
            await this.loadStatsHariIni()
        }, 30000)
    }
    
    // Load tarif
    async loadTarif() {
        const result = await TarifModel.getTarifMap()
        if (result.success) {
            this.tarifData = result.tarifMap
        }
    }
    
    // Load statistik hari ini (Motor only)
    async loadStatsHariIni() {
        const result = await KendaraanModel.getStatsByDateRange(
            getTodayISO(),
            getTodayEndISO()
        )
        
        if (!result.success) {
            console.error('Error loading stats:', result.error)
            return
        }
        
        const data = result.data
        const totalMotor = data.length  // Semua data
        const totalPendapatan = sumBiaya(data)
        
        // Update UI
        const totalEl = document.getElementById('totalHariIni')
        const pendapatanEl = document.getElementById('pendapatanHariIni')
        
        if (totalEl) totalEl.textContent = totalMotor
        if (pendapatanEl) pendapatanEl.textContent = formatRupiah(totalPendapatan)
    }
    
    // Load kendaraan parkir (real-time)
    async loadKendaraanParkir() {
        const result = await KendaraanModel.getKendaraanParkir()
        if (!result.success) {
            console.error('Error loading parkir:', result.error)
            return
        }
        
        const parkir = result.data
        const tbody = document.getElementById('parkir-body')
        if (!tbody) return
        
        if (parkir.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="5" class="text-center muted">Tidak ada motor parkir</td></tr>
            `
            return
        }
        
        tbody.innerHTML = parkir.map(k => {
            const durasiMenit = hitungDurasi(k.waktu_masuk)
            const estimasiBiaya = hitungBiaya(durasiMenit, this.tarifData[k.jenis] || 0)
            
            return `
                <tr>
                    <td><strong>${k.card_id}</strong></td>
                    <td>${k.plat_nomor || '-'}</td>
                    <td>${formatTanggalWaktu(k.waktu_masuk)}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>
            `
        }).join('')
    }
    
    // Set default dates (first day of month to today)
    setDefaultDates() {
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        
        const dariEl = document.getElementById('tanggalDari')
        const sampaiEl = document.getElementById('tanggalSampai')
        
        if (dariEl) dariEl.valueAsDate = firstDayOfMonth
        if (sampaiEl) sampaiEl.valueAsDate = today
    }
    
    // Filter data by date range
    async filterData() {
        const tanggalDariEl = document.getElementById('tanggalDari')
        const tanggalSampaiEl = document.getElementById('tanggalSampai')
        
        if (!tanggalDariEl || !tanggalSampaiEl) return
        
        const tanggalDari = tanggalDariEl.value
        const tanggalSampai = tanggalSampaiEl.value
        
        if (!tanggalDari || !tanggalSampai) {
            showError('⚠️ Pilih tanggal dari dan sampai!')
            return
        }
        
        const dateFrom = new Date(tanggalDari)
        dateFrom.setHours(0, 0, 0, 0)
        
        const dateTo = new Date(tanggalSampai)
        dateTo.setHours(23, 59, 59, 999)
        
        if (dateFrom > dateTo) {
            showError('⚠️ Tanggal dari tidak boleh lebih besar dari tanggal sampai!')
            return
        }
        
        // Get data
        const result = await KendaraanModel.getStatsByDateRange(
            dateFrom.toISOString(),
            dateTo.toISOString()
        )
        
        if (!result.success) {
            showError('❌ Gagal memuat data')
            return
        }
        
        this.currentData = result.data
        
        // Update summary (Motor only - no mobil)
        const totalTransaksi = this.currentData.length
        const totalPendapatan = sumBiaya(this.currentData)
        
        const periodeEl = document.getElementById('periodeText')
        const summaryTotalEl = document.getElementById('summaryTotal')
        const summaryPendapatanEl = document.getElementById('summaryPendapatan')
        const summaryBoxEl = document.getElementById('summaryBox')
        
        if (periodeEl) periodeEl.textContent = `${formatTanggal(tanggalDari)} - ${formatTanggal(tanggalSampai)}`
        if (summaryTotalEl) summaryTotalEl.textContent = totalTransaksi
        if (summaryPendapatanEl) summaryPendapatanEl.textContent = formatRupiah(totalPendapatan)
        if (summaryBoxEl) summaryBoxEl.style.display = 'block'
        
        // Update table
        this.updateTransaksiTable()
    }
    
    // Update tabel transaksi
    updateTransaksiTable() {
        const tbody = document.getElementById('transaksi-body')
        if (!tbody) return
        
        if (this.currentData.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="8" class="text-center muted">Tidak ada data untuk periode ini</td></tr>
            `
            return
        }
        
        tbody.innerHTML = this.currentData.map((k, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${formatTanggal(k.waktu_masuk)}</td>
                <td><strong>${k.card_id}</strong></td>
                <td>${k.plat_nomor || '-'}</td>
                <td>${new Date(k.waktu_masuk).toLocaleTimeString('id-ID')}</td>
                <td>${new Date(k.waktu_keluar).toLocaleTimeString('id-ID')}</td>
                <td>${formatDurasi(k.durasi_menit)}</td>
                <td><strong class="text-success">${formatRupiah(k.biaya)}</strong></td>
            </tr>
        `).join('')
    }
    
    // Export to Excel
    exportToExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            showError('⚠️ Tidak ada data untuk di-export. Lakukan filter terlebih dahulu!')
            return
        }
        
        const tanggalDari = document.getElementById('tanggalDari').value
        const tanggalSampai = document.getElementById('tanggalSampai').value
        
        // Prepare data
        const excelData = this.currentData.map((k, index) => ({
            'No': index + 1,
            'Tanggal': formatTanggal(k.waktu_masuk),
            'Card ID': k.card_id,
            'Plat Nomor': k.plat_nomor || '-',
            'Jenis': 'Motor',  // Hardcode Motor
            'Waktu Masuk': formatTanggalWaktu(k.waktu_masuk),
            'Waktu Keluar': formatTanggalWaktu(k.waktu_keluar),
            'Durasi (menit)': k.durasi_menit,
            'Biaya': k.biaya,
            'Petugas Masuk': k.petugas_masuk || '-',
            'Petugas Keluar': k.petugas_keluar || '-'
        }))
        
        // Add summary
        const totalPendapatan = sumBiaya(this.currentData)
        
        excelData.push({})
        excelData.push({ 'No': 'RINGKASAN' })
        excelData.push({ 'No': 'Total Transaksi', 'Tanggal': this.currentData.length })
        excelData.push({ 'No': 'Total Motor', 'Tanggal': this.currentData.length })
        excelData.push({ 'No': 'Total Pendapatan', 'Tanggal': totalPendapatan })
        
        // Create workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(excelData)
        
        // Set column widths
        ws['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ]
        
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Parkir Motor')
        
        // Download
        const filename = `Rekap_Parkir_Motor_${tanggalDari}_to_${tanggalSampai}.xlsx`
        XLSX.writeFile(wb, filename)
        
        showSuccess(`File ${filename} berhasil di-download!`)
    }
    
    // Update chart pendapatan
    async updatePendapatanChart() {
        // Get data 7 hari terakhir
        const today = new Date()
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        
        const result = await KendaraanModel.getStatsByDateRange(
            last7Days.toISOString(),
            today.toISOString()
        )
        
        if (!result.success) return
        
        const grouped = groupByTanggal(result.data)
        const labels = Object.keys(grouped)
        const values = Object.values(grouped).map(arr => sumBiaya(arr))
        
        if (window.pendapatanChart) {
            window.pendapatanChart.data.labels = labels
            window.pendapatanChart.data.datasets[0].data = values
            window.pendapatanChart.update()
        }
    }
}