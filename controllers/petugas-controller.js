import { KendaraanModel } from '../models/kendaraan-model.js'
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

// ===============================================
// PETUGAS CONTROLLER - REVISED (1 RFID Toggle Mode)
// ===============================================
// Handle business logic for dashboard petugas
// 1 RFID dipakai untuk entry DAN exit.
// Logic: cek status card di DB → tentukan check-in atau check-out

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
        
        // Auto refresh every 10 seconds
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
    
    // Load all data
    async loadData() {
        await this.loadCheckIn()
        await this.loadCheckOut()
        await this.loadRiwayat()
        await this.updateCharts()
    }
    
    // Load TABEL 1: Check-In (status IN)
    async loadCheckIn() {
        const { data, error } = await supabase
            .from('kendaraan')
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
        
        tbody.innerHTML = checkIn.map((k, index) => {
            const durasiMenit = hitungDurasi(k.waktu_masuk)
            const estimasiBiaya = hitungBiaya(durasiMenit, this.tarifData[k.jenis] || 0)
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${k.card_id}</strong></td>
                    <td>${k.plat_nomor || '-'}</td>
                    <td>${new Date(k.waktu_masuk).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                </tr>
            `
        }).join('')
    }
    
    // Load TABEL 2: Check-Out (status OUT)
    async loadCheckOut() {
        const { data, error } = await supabase
            .from('kendaraan')
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
        
        tbody.innerHTML = checkOut.map((k, index) => {
            return `
                <tr class="highlight-row">
                    <td>${index + 1}</td>
                    <td><strong>${k.card_id}</strong></td>
                    <td>${k.plat_nomor || '-'}</td>
                    <td>${new Date(k.waktu_masuk).toLocaleString('id-ID')}</td>
                    <td>${new Date(k.waktu_keluar).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(k.durasi_menit)}</td>
                    <td><strong class="text-success" style="font-size: 1.1em;">${formatRupiah(k.biaya)}</strong></td>
                    <td>
                        <button class="btn-primary" onclick="bukaPalang('${k.id}')">
                            🚪 Buka Palang
                        </button>
                    </td>
                </tr>
            `
        }).join('')
    }
    
    // Load TABEL 3: Riwayat (status DONE)
    async loadRiwayat() {
        const result = await KendaraanModel.getKendaraanSelesai(10)
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
        
        tbody.innerHTML = riwayat.map((k, index) => `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${k.card_id}</strong></td>
                <td>${k.plat_nomor || '-'}</td>
                <td>${new Date(k.waktu_masuk).toLocaleString('id-ID')}</td>
                <td>${new Date(k.waktu_keluar).toLocaleString('id-ID')}</td>
                <td>${formatDurasi(k.durasi_menit)}</td>
                <td><strong class="text-success">${formatRupiah(k.biaya)}</strong></td>
            </tr>
        `).join('')
    }
    
    // Handle "Buka Palang" button (Update status OUT → DONE)
    async handleBukaPalang(kendaraanId) {
        if (!kendaraanId) return
        
        const { data, error } = await supabase
            .from('kendaraan')
            .update({
                status: 'DONE',
                petugas_keluar: this.profile.nama
            })
            .eq('id', kendaraanId)
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
        
        // Update status UI
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
        
        // =============================================
        // TOGGLE MODE: 1 RFID untuk Entry & Exit
        // Semua scan masuk lewat topic entry/rfid.
        // Logic di sini yang tentukan check-in atau check-out
        // berdasarkan status card di database.
        // =============================================
        mqttController.onMessage(MQTT_CONFIG.topics.rfidEntry, async (payload) => {
            await this.handleRFIDToggle(payload)
        })

        // Topic exit/rfid tetap dihandle untuk kompatibilitas
        // saat nanti pakai 2 RFID di sekolah
        mqttController.onMessage(MQTT_CONFIG.topics.rfidExit, async (payload) => {
            await this.handleRFIDExit(payload)
        })
    }

    // =============================================
    // HANDLE RFID TOGGLE (1 RFID Mode)
    // Cek status card di DB:
    // - Tidak ada / status DONE → Check-In
    // - Status IN               → Check-Out
    // - Status OUT              → Sudah checkout, tunggu petugas
    // =============================================
    async handleRFIDToggle(payload) {
        const cardId = payload.card_id
        console.log('📡 RFID Scan:', cardId)

        // Cek status card di DB
        const kendaraanResult = await KendaraanModel.getByCardId(cardId)

        if (!kendaraanResult.success) {
            showError('Error cek kartu: ' + kendaraanResult.error)
            mqttController.publishLCD('ERROR!', 'Hubungi Petugas')
            return
        }

        const kendaraan = kendaraanResult.data

        // Tidak ada data / status DONE → proses Check-In
        if (!kendaraan || kendaraan.status === 'DONE') {
            console.log('→ Status: Belum parkir → Check-In')
            await this.handleRFIDEntry(payload)
            return
        }

        // Status IN → proses Check-Out
        if (kendaraan.status === 'IN') {
            console.log('→ Status: Sedang parkir → Check-Out')
            await this.handleRFIDExit(payload)
            return
        }

        // Status OUT → sudah checkout, menunggu petugas buka palang
        if (kendaraan.status === 'OUT') {
            console.log('→ Status: Menunggu petugas')
            mqttController.publishLCD('Tunggu Petugas', 'Proses Bayar...')
            showWarning(`⚠️ Motor ${cardId} sudah checkout. Menunggu petugas buka palang.`)
            return
        }
    }
    
    // Handle RFID Entry → Check-In
    async handleRFIDEntry(payload) {
        const cardId = payload.card_id
        
        console.log('🏍️ RFID Entry (Check-In):', cardId)
        showSuccess(`🏍️ RFID Entry: ${cardId}`)
        
        const result = await KendaraanModel.checkIn(
            cardId,
            null,       // plat nomor optional
            'Motor',
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
        
        // Buka palang entry & tampilkan pesan
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
        
        // Get data kendaraan
        const kendaraanResult = await KendaraanModel.getByCardId(cardId)
        if (!kendaraanResult.success) {
            showError('Error: ' + kendaraanResult.error)
            return
        }
        
        if (!kendaraanResult.data) {
            mqttController.publishLCD('DITOLAK!', 'Tidak Parkir')
            showWarning(`⚠️ Motor ${cardId} tidak sedang parkir!`)
            return
        }
        
        const kendaraan = kendaraanResult.data
        
        // Hitung durasi & biaya
        const durasiMenit = hitungDurasi(kendaraan.waktu_masuk)
        const biaya = hitungBiaya(durasiMenit, this.tarifData[kendaraan.jenis] || 0)
        
        // Update status → OUT (menunggu konfirmasi petugas)
        const { data, error } = await supabase
            .from('kendaraan')
            .update({
                waktu_keluar: new Date().toISOString(),
                durasi_menit: durasiMenit,
                biaya: biaya,
                status: 'OUT'
            })
            .eq('id', kendaraan.id)
            .select()
            .single()
        
        if (error) {
            showError('Error: ' + error.message)
            return
        }
        
        // Tampilkan biaya di LCD
        mqttController.publishLCD(`Biaya:${formatRupiah(biaya)}`, 'Bayar ke Petugas')
        
        await this.loadData()
        showSuccess(`💰 Motor ${cardId} checkout. Biaya: ${formatRupiah(biaya)}. Menunggu pembayaran...`)
    }
    
    // Update charts
    async updateCharts() {
        const result = await KendaraanModel.getAllForChart()
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