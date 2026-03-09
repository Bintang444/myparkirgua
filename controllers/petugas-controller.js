import { TransaksiModel } from '../models/transaksi-model.js'
import { TarifModel } from '../models/tarif-model.js'
import { mqttController } from './mqtt-controller.js'
import { MQTT_CONFIG } from '../config/mqtt-config.js'
import { supabase } from '../config/supabase.js'
import { 
    formatDurasi, 
    hitungDurasi, 
    hitungBiaya,
    formatRupiah,
    groupByTanggal
} from '../utils/helpers.js'
import { showSuccess, showError, showWarning } from '../utils/notification.js'

// PETUGAS CONTROLLER

// Handle business logic untuk dashboard petugas
// 2 RFID reader: entry khusus check-in, exit khusus check-out

export class PetugasController {
    constructor(profile) {
        this.profile = profile
        this.tarifData = {}
    }
    
    // Initialize
    async init() {
        await this.loadTarif()
        await this.loadData()
        this.initMQTT()
        
        // Auto refresh setiap 10 detik
        setInterval(() => this.loadData(), 10000)
    }
    
    // Load tarif
    async loadTarif() {
        const result = await TarifModel.getTarifMap()
        if (result.success) {
            this.tarifData = result.tarifMap
            this.updateTarifUI()
        }
    }
    
    // Update tarif UI
    updateTarifUI() {
        const tarifMotor = document.getElementById('tarifMotor')
        if (tarifMotor) tarifMotor.textContent = formatRupiah(this.tarifData['Motor']) + '/jam'
    }
    
    // Load semua data
    async loadData() {
        await this.loadCheckIn()
        await this.loadCheckOut()
        await this.loadRiwayat()
        await this.updateCharts()
    }
    
    // Load TABEL 1: Check-In (status IN)
    async loadCheckIn() {
        const { data, error } = await supabase
            .from('transaksi')
            .select('*')
            .eq('status', 'IN')
            .order('waktu_masuk', { ascending: false })
        
        if (error) {
            console.error('Error loading check-in:', error)
            return
        }
        
        const checkIn = data || []
        
        const jumlahEl = document.getElementById('jumlahCheckIn')
        if (jumlahEl) jumlahEl.textContent = checkIn.length
        
        const tbody = document.getElementById('checkin-body')
        if (!tbody) return
        
        if (checkIn.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center muted">Belum ada motor parkir</td></tr>
            `
            return
        }
        
        tbody.innerHTML = checkIn.map((t, index) => {
            const durasiMenit = hitungDurasi(t.waktu_masuk)
            const estimasiBiaya = hitungBiaya(durasiMenit, this.tarifData['Motor'] || 0)
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${t.card_id}</strong></td>
                    <td>${t.plat_nomor || '-'}</td>
                    <td>${new Date(t.waktu_masuk).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>
            `
        }).join('')
    }
    
    // Load TABEL 2: Check-Out (status OUT)
    async loadCheckOut() {
        const { data, error } = await supabase
            .from('transaksi')
            .select('*')
            .eq('status', 'OUT')
            .order('waktu_keluar', { ascending: false })
        
        if (error) {
            console.error('Error loading check-out:', error)
            return
        }
        
        const checkOut = data || []
        
        const jumlahEl = document.getElementById('jumlahCheckOut')
        if (jumlahEl) jumlahEl.textContent = checkOut.length
        
        const tbody = document.getElementById('checkout-body')
        if (!tbody) return
        
        if (checkOut.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="8" class="text-center muted">Belum ada motor checkout</td></tr>
            `
            return
        }
        
        tbody.innerHTML = checkOut.map((t, index) => {
            return `
                <tr class="highlight-row">
                    <td>${index + 1}</td>
                    <td><strong>${t.card_id}</strong></td>
                    <td>${t.plat_nomor || '-'}</td>
                    <td>${new Date(t.waktu_masuk).toLocaleString('id-ID')}</td>
                    <td>${new Date(t.waktu_keluar).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(t.durasi_menit)}</td>
                    <td><strong class="text-success" style="font-size: 1.1em;">${formatRupiah(t.biaya)}</strong></td>
                    <td>
                        <button class="btn-primary" onclick="bukaPalang('${t.id}')">
                            🚪 Buka Palang
                        </button>
                    </td>
                </tr>
            `
        }).join('')
    }
    
    // Load TABEL 3: Riwayat (status DONE)
    async loadRiwayat() {
        const result = await TransaksiModel.getTransaksiSelesai(10)
        if (!result.success) {
            console.error('Error loading riwayat:', result.error)
            return
        }
        
        const riwayat = result.data
        const tbody = document.getElementById('riwayat-body')
        if (!tbody) return
        
        if (riwayat.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="text-center muted">Belum ada riwayat</td></tr>
            `
            return
        }
        
        tbody.innerHTML = riwayat.map((t, index) => `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${t.card_id}</strong></td>
                <td>${t.plat_nomor || '-'}</td>
                <td>${new Date(t.waktu_masuk).toLocaleString('id-ID')}</td>
                <td>${new Date(t.waktu_keluar).toLocaleString('id-ID')}</td>
                <td>${formatDurasi(t.durasi_menit)}</td>
                <td><strong class="text-success">${formatRupiah(t.biaya)}</strong></td>
            </tr>
        `).join('')
    }
    
    // Handle "Buka Palang" button (Update status OUT → DONE)
    async handleBukaPalang(transaksiId) {
        if (!transaksiId) return
        
        const { data, error } = await supabase
            .from('transaksi')
            .update({
                status: 'DONE',
                petugas_keluar: this.profile.nama
            })
            .eq('id', transaksiId)
            .select()
            .single()
        
        if (error) {
            showError('Gagal membuka palang: ' + error.message)
            return
        }
        
        // MQTT: Buka palang Exit
        mqttController.publishServo('exit', 'open')
        
        // MQTT: LCD terima kasih
        mqttController.publishLCD('Terima Kasih', 'Selamat Jalan')
        
        showSuccess(`✅ Palang dibuka! Motor ${data.card_id} keluar. Biaya: ${formatRupiah(data.biaya)}`)
        
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
        const cardId = payload.card_id
        
        console.log('🏍️ RFID Entry (Check-In):', cardId)
        showSuccess(`🏍️ RFID Entry: ${cardId}`)
        
        const result = await TransaksiModel.checkIn(
            cardId,
            null,       // plat nomor optional
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
        showSuccess(`✅ Motor ${cardId} berhasil masuk!`)
    }
    
    // Handle RFID Exit → Check-Out (status OUT, tunggu petugas)
    async handleRFIDExit(payload) {
        const cardId = payload.card_id
        
        console.log('🚪 RFID Exit (Check-Out):', cardId)
        showSuccess(`🚪 RFID Exit: ${cardId}`)
        
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
        
        const durasiMenit = hitungDurasi(transaksi.waktu_masuk)
        const biaya = hitungBiaya(durasiMenit, this.tarifData['Motor'] || 0)
        
        const { data, error } = await supabase
            .from('transaksi')
            .update({
                waktu_keluar: new Date().toISOString(),
                durasi_menit: durasiMenit,
                biaya: biaya,
                status: 'OUT'
            })
            .eq('id', transaksi.id)
            .select()
            .single()
        
        if (error) {
            showError('Error: ' + error.message)
            return
        }
        
        mqttController.publishLCD(`Biaya:${formatRupiah(biaya)}`, 'Bayar ke Petugas')
        
        await this.loadData()
        showSuccess(`💰 Motor ${cardId} checkout. Biaya: ${formatRupiah(biaya)}. Menunggu pembayaran...`)
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