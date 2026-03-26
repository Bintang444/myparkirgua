import { TransaksiModel } from '/models/transaksi-model.js'
import { mqttController } from '/controllers/mqtt-controller.js'
import { MQTT_CONFIG } from '/config/mqtt-config.js'
import { 
    formatDurasi, 
    hitungDurasi, 
    hitungBiaya,
    formatRupiah,
    groupByTanggal
} from '/utils/helpers.js'
import { showSuccess, showError, showWarning } from '/utils/notification.js'

const tarif = 2000

// PETUGAS CONTROLLER
// Handle business logic untuk dashboard petugas

export class PetugasController {
    constructor(profile) {
        this.profile = profile
        // Pagination state untuk setiap tabel
        this.checkinPage  = 1; this.checkinLimit  = 10; this.checkinTotal  = 0
        this.riwayatPage  = 1; this.riwayatLimit  = 10; this.riwayatTotal  = 0
    }
    
    // Initialize
    async init() {
        await this.loadData()
        this.initMQTT()
        
        // Auto refresh setiap 10 detik
        setInterval(() => this.loadData(), 10000)
    }

    async loadData() {
        await Promise.all([
            this.loadCheckIn(),
            this.loadCheckOut(),
            this.loadRiwayat(),
            this.updateCharts()
        ])
    }

    // Load TABEL 1: Check-In (status IN) dengan pagination
    async loadCheckIn() {
        const countResult = await TransaksiModel.countTransaksiParkir()
        if (countResult.success) this.checkinTotal = countResult.count || 0

        const result = await TransaksiModel.getTransaksiParkir(this.checkinLimit, this.checkinPage)
        if (!result.success) {
            console.error('Error loading check-in:', result.error)
            return
        }

        const checkIn = result.data || []
        const jumlahEl = document.getElementById('jumlahCheckIn')
        if (jumlahEl) jumlahEl.textContent = this.checkinTotal

        const tbody = document.getElementById('checkin-body')
        if (!tbody) return

        if (checkIn.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center muted">Belum ada motor parkir</td></tr>`
            this.updatePaginationUI('checkin', this.checkinPage, this.checkinTotal, this.checkinLimit)
            return
        }

        const offset = (this.checkinPage - 1) * this.checkinLimit
        tbody.innerHTML = checkIn.map((t, index) => {
            const durasiMenit   = hitungDurasi(t.checkin_time)
            const estimasiBiaya = hitungBiaya(durasiMenit, tarif)
            return `
                <tr>
                    <td>${offset + index + 1}</td>
                    <td><strong>${t.card_id}</strong></td>
                    <td>${new Date(t.checkin_time).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>
            `
        }).join('')

        this.updatePaginationUI('checkin', this.checkinPage, this.checkinTotal, this.checkinLimit)
    }
    
    // Load TABEL 2: Check-Out (status OUT)
    async loadCheckOut() {
        const result = await TransaksiModel.getTransaksiCheckOut()
        if (!result.success) {
            console.error('Error loading check-out:', result.error)
            return
        }

        const checkOut = result.data || []
        const jumlahEl = document.getElementById('jumlahCheckOut')
        if (jumlahEl) jumlahEl.textContent = checkOut.length

        const tbody = document.getElementById('checkout-body')
        if (!tbody) return

        if (checkOut.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center muted">Belum ada motor checkout</td></tr>`
            return
        }

        tbody.innerHTML = checkOut.map((t, index) => `
            <tr class="highlight-row">
                <td>${index + 1}</td>
                <td><strong>${t.card_id}</strong></td>
                <td>${new Date(t.checkin_time).toLocaleString('id-ID')}</td>
                <td>${new Date(t.checkout_time).toLocaleString('id-ID')}</td>
                <td>${formatDurasi(t.duration)}</td>
                <td><strong class="text-success" style="font-size: 1.1em;">${formatRupiah(t.fee)}</strong></td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="cetakStruk('${t.id}')">
                        Cetak Struk
                    </button>
                    <button class="btn-primary btn-sm" onclick="bukaPalang('${t.id}')">
                        Buka Palang
                    </button>
                </td>
            </tr>
        `).join('')
    }
    
    // Load TABEL 3: Riwayat (status DONE) dengan pagination
    async loadRiwayat() {
        // Ambil total data untuk hitung jumlah halaman
        const countResult = await TransaksiModel.countTransaksiSelesai()
        if (countResult.success) {
            this.riwayatTotal = countResult.count || 0
        }

        const result = await TransaksiModel.getTransaksiSelesai(this.riwayatLimit, this.riwayatPage)
        if (!result.success) {
            console.error('Error loading riwayat:', result.error)
            return
        }

        const riwayat = result.data
        const tbody   = document.getElementById('riwayat-body')
        if (!tbody) return

        if (riwayat.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center muted">Belum ada riwayat</td></tr>`
            this.updatePaginationUI('riwayat', this.riwayatPage, this.riwayatTotal, this.riwayatLimit)
            return
        }

        const offset = (this.riwayatPage - 1) * this.riwayatLimit
        tbody.innerHTML = riwayat.map((t, index) => `
            <tr>
                <td>${offset + index + 1}</td>
                <td><strong>${t.card_id}</strong></td>
                <td>${new Date(t.checkin_time).toLocaleString('id-ID')}</td>
                <td>${new Date(t.checkout_time).toLocaleString('id-ID')}</td>
                <td>${formatDurasi(t.duration)}</td>
                <td><strong class="text-success">${formatRupiah(t.fee)}</strong></td>
            </tr>
        `).join('')

        this.updatePaginationUI('riwayat', this.riwayatPage, this.riwayatTotal, this.riwayatLimit)
    }

    // Update tampilan pagination generik (dipakai semua tabel)
    updatePaginationUI(prefix, currentPage, total, limit) {
        const totalPages = Math.ceil(total / limit) || 1
        const infoEl = document.getElementById(`${prefix}-page-info`)
        const prevEl = document.getElementById(`${prefix}-prev`)
        const nextEl = document.getElementById(`${prefix}-next`)

        if (infoEl) infoEl.textContent = `Halaman ${currentPage} / ${totalPages} (${total} data)`
        if (prevEl) prevEl.disabled = currentPage <= 1
        if (nextEl) nextEl.disabled = currentPage >= totalPages
    }

    // Navigasi tabel Check-In
    async prevCheckIn() {
        if (this.checkinPage <= 1) return
        this.checkinPage--
        await this.loadCheckIn()
    }
    async nextCheckIn() {
        if (this.checkinPage >= Math.ceil(this.checkinTotal / this.checkinLimit)) return
        this.checkinPage++
        await this.loadCheckIn()
    }

    // Navigasi tabel Riwayat
    async prevRiwayat() {
        if (this.riwayatPage <= 1) return
        this.riwayatPage--
        await this.loadRiwayat()
    }
    async nextRiwayat() {
        if (this.riwayatPage >= Math.ceil(this.riwayatTotal / this.riwayatLimit)) return
        this.riwayatPage++
        await this.loadRiwayat()
    }

    // CETAK STRUK
    async handleCetakStruk(transaksiId) {
        if (!transaksiId) return

        // Ambil data transaksi
        const result = await TransaksiModel.getById(transaksiId)
        if (!result.success) {
            showError('Gagal mengambil data transaksi: ' + result.error)
            return
        }

        const t = result.data
        const waktuMasuk  = new Date(t.checkin_time).toLocaleString('id-ID')
        const waktuKeluar = new Date(t.checkout_time).toLocaleString('id-ID')
        const sekarang    = new Date().toLocaleString('id-ID')

        // Buka window baru khusus untuk print
        const struk = window.open('', '_blank', 'width=400,height=600')
        struk.document.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Struk Parkir</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 13px;
                        padding: 20px;
                        width: 300px;
                        color: #000;
                    }
                    .center { text-align: center; }
                    .bold   { font-weight: bold; }
                    .big    { font-size: 16px; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .row    { display: flex; justify-content: space-between; margin: 4px 0; }
                    .total  { font-size: 15px; font-weight: bold; }
                    .footer { margin-top: 12px; text-align: center; font-size: 11px; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="center bold big">SMART PARKING</div>
                <div class="center">Struk Parkir Kendaraan</div>
                <div class="divider"></div>

                <div class="row"><span>No. Transaksi</span><span>#${t.id}</span></div>
                <div class="row"><span>Card ID</span><span>${t.card_id}</span></div>
                <div class="row"><span>Jenis</span><span>Motor</span></div>

                <div class="divider"></div>

                <div class="row"><span>Waktu Masuk</span><span>${waktuMasuk}</span></div>
                <div class="row"><span>Waktu Keluar</span><span>${waktuKeluar}</span></div>
                <div class="row"><span>Durasi</span><span>${formatDurasi(t.duration)}</span></div>

                <div class="divider"></div>

                <div class="row total"><span>TOTAL BIAYA</span><span>${formatRupiah(t.fee)}</span></div>

                <div class="divider"></div>

                <div class="row"><span>Dicetak</span><span>${sekarang}</span></div>

                <div class="footer">
                    Terima kasih telah menggunakan<br>
                    layanan parkir kami!
                </div>

                <br>
                <div class="center no-print">
                    <button onclick="window.print()" style="padding:8px 20px;cursor:pointer;">
                        Print
                    </button>
                </div>

                <script>
                    // Auto print saat window terbuka
                    window.onload = () => window.print()
                <\/script>
            </body>
            </html>
        `)
        struk.document.close()
    }

    // BUKA PALANG (konfirmasi petugas → update status DONE)
    async handleBukaPalang(transaksiId) {
        if (!transaksiId) return
        
        const result = await TransaksiModel.konfirmasiKeluar(transaksiId, this.profile.nama)
        
        if (!result.success) {
            showError('Gagal membuka palang: ' + result.error)
            return
        }
        
        const data = result.data
        
        // MQTT: Buka palang Exit
        mqttController.publishServo('exit', 'open')
        
        // MQTT: LCD terima kasih
        mqttController.publishLCD('Terima Kasih', 'Selamat Jalan')
        
        showSuccess(`Palang dibuka! Motor ${data.card_id} keluar. Biaya: ${formatRupiah(data.fee)}`)
        
        await this.loadData()
    }
    
    // Initialize MQTT
    initMQTT() {
        mqttController.init()
        
        mqttController.client.on('connect', () => {
            const statusEl = document.getElementById('mqttStatus')
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-dot online"></span><span>Terhubung</span>'
            }
        })
        
        mqttController.client.on('error', () => {
            const statusEl = document.getElementById('mqttStatus')
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-dot offline"></span><span>Terputus</span>'
            }
        })
        
        // RFID Entry → hanya untuk check-in
        mqttController.onMessage(MQTT_CONFIG.topics.rfidEntry, async (payload) => {
            await this.handleRFIDEntry(payload)
        })

        // RFID Exit → hanya untuk check-out
        mqttController.onMessage(MQTT_CONFIG.topics.rfidExit, async (payload) => {
            await this.handleRFIDExit(payload)
        })
    }
    
    // Handle RFID Entry → Check-In
    async handleRFIDEntry(payload) {
        const cardId = payload.rfid
        
        console.log('RFID Entry (Check-In):', cardId)
        showSuccess(`RFID Entry: ${cardId}`)

        const result = await TransaksiModel.checkIn(
            cardId,
            null,
            this.profile.nama
        )
        
        if (!result.success) {
            if (result.code === 'ALREADY_PARKED') {
                mqttController.publishLCD('DITOLAK!', 'Sudah Parkir')
                showWarning(`⚠️ Motor ${cardId} sudah parkir!`)
            } else {
                mqttController.publishLCD('ERROR!', 'Hubungi Petugas')
                showError('Error: ' + result.error)
            }
            return
        }

        mqttController.publishServo('entry', 'open')
        mqttController.publishLCD('Selamat Datang', 'Silakan Masuk')
        
        await this.loadData()
        showSuccess(`Motor ${cardId} berhasil masuk!`)
    }
    
    // Handle RFID Exit → Check-Out (status OUT, tunggu petugas)
    async handleRFIDExit(payload) {
        const cardId = payload.rfid
        
        console.log('RFID Exit (Check-Out):', cardId)
        showSuccess(`RFID Exit: ${cardId}`)
        
        const transaksiResult = await TransaksiModel.getByCardId(cardId)
        if (!transaksiResult.success) {
            showError('Error: ' + transaksiResult.error)
            return
        }
        
        if (!transaksiResult.data) {
            mqttController.publishLCD('DITOLAK!', 'Tidak Parkir')
            showWarning(`⚠️ Motor ${cardId} tidak sedang parkir!`)
            return
        }
        
        const transaksi = transaksiResult.data
        
        const durasiMenit = hitungDurasi(transaksi.checkin_time)
        const biaya = hitungBiaya(durasiMenit, tarif)
        
        const checkOutResult = await TransaksiModel.checkOut(
            cardId,
            new Date().toISOString(),
            durasiMenit,
            biaya
        )
        
        if (!checkOutResult.success) {
            showError('Error: ' + checkOutResult.error)
            return
        }
        
        mqttController.publishLCD(`Biaya:${formatRupiah(biaya)}`, 'Bayar ke Petugas')
        
        await this.loadData()
        showSuccess(`Motor ${cardId} checkout. Biaya: ${formatRupiah(biaya)}. Menunggu pembayaran...`)
    }
    
    // Update charts
    async updateCharts() {
        const result = await TransaksiModel.getAllForChart()
        if (!result.success) return
        
        const data = result.data
        const grouped = groupByTanggal(data)
        const last7 = Object.entries(grouped).slice(-7)
        const labels = last7.map(e => e[0])
        const values = last7.map(e => e[1].length)
        
        this.updateHarianChart(labels, values)
    }
    
    // Update harian chart
    updateHarianChart(labels, values) {
        if (window.harianChart) {
            window.harianChart.data.labels = labels
            window.harianChart.data.datasets[0].data = values
            window.harianChart.update()
        }
    }
}