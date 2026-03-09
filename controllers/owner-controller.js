import { TransaksiModel } from '../models/transaksi-model.js'
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

// Handle business logic untuk dashboard owner
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
        await this.loadTransaksiParkir()
        await this.updatePendapatanChart()
        await this.setDefaultDates()
        await this.filterData()
        
        // Auto refresh setiap 30 detik
        setInterval(async () => {
            await this.loadTransaksiParkir()
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
    
    // Load statistik hari ini
    async loadStatsHariIni() {
        const result = await TransaksiModel.getStatsByDateRange(
            getTodayISO(),
            getTodayEndISO()
        )
        
        if (!result.success) {
            console.error('Error loading stats:', result.error)
            return
        }
        
        const data = result.data
        const totalMotor = data.length
        const totalPendapatan = sumBiaya(data)
        
        // Update UI
        const totalEl = document.getElementById('totalHariIni')
        const pendapatanEl = document.getElementById('pendapatanHariIni')
        
        if (totalEl) totalEl.textContent = totalMotor
        if (pendapatanEl) pendapatanEl.textContent = formatRupiah(totalPendapatan)
    }
    
    // Load transaksi yang sedang parkir (real-time)
    async loadTransaksiParkir() {
        const result = await TransaksiModel.getTransaksiParkir()
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
        
        tbody.innerHTML = parkir.map(t => {
            const durasiMenit = hitungDurasi(t.waktu_masuk)
            const estimasiBiaya = hitungBiaya(durasiMenit, this.tarifData['Motor'] || 0)
            
            return `
                <tr>
                    <td><strong>${t.card_id}</strong></td>
                    <td>${t.plat_nomor || '-'}</td>
                    <td>${formatTanggalWaktu(t.waktu_masuk)}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>
            `
        }).join('')
    }
    
    // Set default dates (awal bulan sampai hari ini)
    setDefaultDates() {
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        
        const dariEl = document.getElementById('tanggalDari')
        const sampaiEl = document.getElementById('tanggalSampai')
        
        if (dariEl) dariEl.valueAsDate = firstDayOfMonth
        if (sampaiEl) sampaiEl.valueAsDate = today
    }
    
    // Filter data berdasarkan rentang tanggal
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
        
        const result = await TransaksiModel.getStatsByDateRange(
            dateFrom.toISOString(),
            dateTo.toISOString()
        )
        
        if (!result.success) {
            showError('❌ Gagal memuat data')
            return
        }
        
        this.currentData = result.data
        
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
        
        tbody.innerHTML = this.currentData.map((t, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${formatTanggal(t.waktu_masuk)}</td>
                <td><strong>${t.card_id}</strong></td>
                <td>${t.plat_nomor || '-'}</td>
                <td>${new Date(t.waktu_masuk).toLocaleTimeString('id-ID')}</td>
                <td>${new Date(t.waktu_keluar).toLocaleTimeString('id-ID')}</td>
                <td>${formatDurasi(t.durasi_menit)}</td>
                <td><strong class="text-success">${formatRupiah(t.biaya)}</strong></td>
            </tr>
        `).join('')
    }
    
    // Export ke Excel
    exportToExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            showError('⚠️ Tidak ada data untuk di-export. Lakukan filter terlebih dahulu!')
            return
        }
        
        const tanggalDari = document.getElementById('tanggalDari').value
        const tanggalSampai = document.getElementById('tanggalSampai').value
        
        const excelData = this.currentData.map((t, index) => ({
            'No': index + 1,
            'Tanggal': formatTanggal(t.waktu_masuk),
            'Card ID': t.card_id,
            'Plat Nomor': t.plat_nomor || '-',
            'Jenis': 'Motor',
            'Waktu Masuk': formatTanggalWaktu(t.waktu_masuk),
            'Waktu Keluar': formatTanggalWaktu(t.waktu_keluar),
            'Durasi (menit)': t.durasi_menit,
            'Biaya': t.biaya,
            'Petugas Masuk': t.petugas_masuk || '-',
            'Petugas Keluar': t.petugas_keluar || '-'
        }))
        
        const totalPendapatan = sumBiaya(this.currentData)
        
        excelData.push({})
        excelData.push({ 'No': 'RINGKASAN' })
        excelData.push({ 'No': 'Total Transaksi', 'Tanggal': this.currentData.length })
        excelData.push({ 'No': 'Total Pendapatan', 'Tanggal': totalPendapatan })
        
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(excelData)
        
        ws['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ]
        
        XLSX.utils.book_append_sheet(wb, ws, 'Rekap Parkir Motor')
        
        const filename = `Rekap_Parkir_Motor_${tanggalDari}_to_${tanggalSampai}.xlsx`
        XLSX.writeFile(wb, filename)
        
        showSuccess(`File ${filename} berhasil di-download!`)
    }
    
    // Update chart pendapatan 7 hari terakhir
    async updatePendapatanChart() {
        const today = new Date()
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        
        const result = await TransaksiModel.getStatsByDateRange(
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