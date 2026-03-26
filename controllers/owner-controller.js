import { TransaksiModel } from '/models/transaksi-model.js'
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
} from '/utils/helpers.js'
import { showSuccess, showError } from '/utils/notification.js'

const tarif = 2000

// OWNER CONTROLLER
export class OwnerController {
    constructor(profile) {
        this.profile     = profile
        this.currentData = []
        // Pagination tabel transaksi (client-side dari currentData)
        this.transaksiPage  = 1
        this.transaksiLimit = 10
        // Pagination tabel motor parkir (server-side)
        this.parkirPage  = 1
        this.parkirLimit = 10
        this.parkirTotal = 0
    }

    async init() {
        await this.loadStatsHariIni()
        await this.loadTransaksiParkir()
        await this.updatePendapatanChart()
        await this.setDefaultDates()
        await this.filterData()

        setInterval(async () => {
            await this.loadTransaksiParkir()
            await this.loadStatsHariIni()
        }, 30000)
    }

    async loadTarifTable() {
        const tarifEl = document.getElementById('tarifMotor')
        if (tarifEl) {
            tarifEl.textContent = `${formatRupiah(tarif)}/jam`
        }
    }

    // STATISTIK & TRANSAKSI    
    async loadStatsHariIni() {
        const result = await TransaksiModel.getStatsByDateRange(getTodayISO(), getTodayEndISO())
        if (!result.success) return
        
        const data            = result.data
        const totalMotor      = data.length
        const totalPendapatan = sumBiaya(data)
        
        const totalEl     = document.getElementById('totalHariIni')
        const pendapatanEl = document.getElementById('pendapatanHariIni')
        
        if (totalEl)      totalEl.textContent      = totalMotor
        if (pendapatanEl) pendapatanEl.textContent = formatRupiah(totalPendapatan)
    }
    
    async loadTransaksiParkir() {
        const countResult = await TransaksiModel.countTransaksiParkir()
        if (countResult.success) this.parkirTotal = countResult.count || 0

        const result = await TransaksiModel.getTransaksiParkir(this.parkirLimit, this.parkirPage)
        if (!result.success) return

        const parkir = result.data
        const tbody  = document.getElementById('parkir-body')
        if (!tbody) return

        if (parkir.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center muted">Tidak ada motor parkir</td></tr>`
            this.updatePaginationUI('parkir', this.parkirPage, this.parkirTotal, this.parkirLimit)
            return
        }

        const offset = (this.parkirPage - 1) * this.parkirLimit
        tbody.innerHTML = parkir.map((t, index) => {
            const durasiMenit   = hitungDurasi(t.checkin_time)
            const estimasiBiaya = hitungBiaya(durasiMenit, tarif)
            return `
                <tr>
                    <td><strong>${t.card_id}</strong></td>
                    <td>${formatTanggalWaktu(t.checkin_time)}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>`
        }).join('')

        this.updatePaginationUI('parkir', this.parkirPage, this.parkirTotal, this.parkirLimit)
    }

    async prevParkir() {
        if (this.parkirPage <= 1) return
        this.parkirPage--
        await this.loadTransaksiParkir()
    }

    async nextParkir() {
        if (this.parkirPage >= Math.ceil(this.parkirTotal / this.parkirLimit)) return
        this.parkirPage++
        await this.loadTransaksiParkir()
    }
    
    setDefaultDates() {
        const today          = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const dariEl          = document.getElementById('tanggalDari')
        const sampaiEl        = document.getElementById('tanggalSampai')
        if (dariEl)  dariEl.valueAsDate  = firstDayOfMonth
        if (sampaiEl) sampaiEl.valueAsDate = today
    }
    
    async filterData() {
        const tanggalDari   = document.getElementById('tanggalDari')?.value
        const tanggalSampai = document.getElementById('tanggalSampai')?.value
        
        if (!tanggalDari || !tanggalSampai) {
            showError('⚠️ Pilih tanggal dari dan sampai!')
            return
        }
        
        const dateFrom = new Date(tanggalDari);  dateFrom.setHours(0, 0, 0, 0)
        const dateTo   = new Date(tanggalSampai); dateTo.setHours(23, 59, 59, 999)
        
        if (dateFrom > dateTo) {
            showError('⚠️ Tanggal dari tidak boleh lebih besar dari tanggal sampai!')
            return
        }
        
        const result = await TransaksiModel.getStatsByDateRange(dateFrom.toISOString(), dateTo.toISOString())
        if (!result.success) { showError('Gagal memuat data'); return }
        
        this.currentData = result.data
        const totalTransaksi  = this.currentData.length
        const totalPendapatan = sumBiaya(this.currentData)
        
        const periodeEl       = document.getElementById('periodeText')
        const summaryTotalEl  = document.getElementById('summaryTotal')
        const summaryPendEl   = document.getElementById('summaryPendapatan')
        const summaryBoxEl    = document.getElementById('summaryBox')
        
        if (periodeEl)      periodeEl.textContent      = `${ formatTanggal(tanggalDari) } - ${ formatTanggal(tanggalSampai) } `
        if (summaryTotalEl) summaryTotalEl.textContent = totalTransaksi
        if (summaryPendEl)  summaryPendEl.textContent  = formatRupiah(totalPendapatan)
        if (summaryBoxEl)   summaryBoxEl.style.display = 'block'
        
        this.updateTransaksiTable()
    }
    
    updateTransaksiTable() {
        const tbody = document.getElementById('transaksi-body')
        if (!tbody) return

        if (this.currentData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center muted">Tidak ada data untuk periode ini</td></tr>`
            this.updatePaginationUI('transaksi', 1, 0, this.transaksiLimit)
            return
        }

        // Reset ke halaman 1 saat filter baru diterapkan
        this.transaksiPage = 1
        this.renderTransaksiPage()
    }

    renderTransaksiPage() {
        const tbody = document.getElementById('transaksi-body')
        if (!tbody) return

        const offset   = (this.transaksiPage - 1) * this.transaksiLimit
        const pageData = this.currentData.slice(offset, offset + this.transaksiLimit)

        tbody.innerHTML = pageData.map((t, index) => `
            <tr>
                <td>${offset + index + 1}</td>
                <td>${formatTanggal(t.checkin_time)}</td>
                <td><strong>${t.card_id}</strong></td>
                <td>${formatTanggalWaktu(t.checkin_time)}</td>
                <td>${new Date(t.checkout_time).toLocaleTimeString('id-ID')}</td>
                <td>${formatDurasi(t.duration)}</td>
                <td><strong class="text-success">${formatRupiah(t.fee)}</strong></td>
            </tr>`
        ).join('')

        this.updatePaginationUI('transaksi', this.transaksiPage, this.currentData.length, this.transaksiLimit)
    }

    prevTransaksi() {
        if (this.transaksiPage <= 1) return
        this.transaksiPage--
        this.renderTransaksiPage()
    }

    nextTransaksi() {
        if (this.transaksiPage >= Math.ceil(this.currentData.length / this.transaksiLimit)) return
        this.transaksiPage++
        this.renderTransaksiPage()
    }

    // Update tampilan pagination generik
    updatePaginationUI(prefix, currentPage, total, limit) {
        const totalPages = Math.ceil(total / limit) || 1
        const infoEl = document.getElementById(`${prefix}-page-info`)
        const prevEl = document.getElementById(`${prefix}-prev`)
        const nextEl = document.getElementById(`${prefix}-next`)

        if (infoEl) infoEl.textContent = `Halaman ${currentPage} / ${totalPages} (${total} data)`
        if (prevEl) prevEl.disabled = currentPage <= 1
        if (nextEl) nextEl.disabled = currentPage >= totalPages
    }
    
    exportToExcel() {
        if (!this.currentData || this.currentData.length === 0) {
            showError('⚠️ Tidak ada data untuk di-export. Lakukan filter terlebih dahulu!')
            return
        }
        
        const tanggalDari   = document.getElementById('tanggalDari').value
        const tanggalSampai = document.getElementById('tanggalSampai').value
        
        const excelData = this.currentData.map((t, index) => ({
            'No': index + 1,
            'Tanggal': formatTanggal(t.checkin_time),
            'Card ID': t.card_id,
            'Checkin Time': formatTanggalWaktu(t.checkin_time),
            'Checkout Time': formatTanggalWaktu(t.checkout_time),
            'Duration (menit)': t.duration,
            'Fee': t.fee
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
        const filename = `Rekap_Parkir_Motor_${ tanggalDari }_to_${ tanggalSampai }.xlsx`
        XLSX.writeFile(wb, filename)
        showSuccess(`File ${ filename } berhasil di - download!`)
    }
    
    async updatePendapatanChart() {
        const today    = new Date()
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        
        const result = await TransaksiModel.getStatsByDateRange(last7Days.toISOString(), today.toISOString())
        if (!result.success) return
        
        const grouped = groupByTanggal(result.data)
        const labels  = Object.keys(grouped)
        const values  = Object.values(grouped).map(arr => sumBiaya(arr))
        
        if (window.pendapatanChart) {
            window.pendapatanChart.data.labels             = labels
            window.pendapatanChart.data.datasets[0].data   = values
            window.pendapatanChart.update()
        }
    }
}