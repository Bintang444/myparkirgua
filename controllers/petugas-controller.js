import { KendaraanModel } from '../models/kendaraan-model.js'
import { TarifModel } from '../models/tarif-model.js'
import { mqttController } from './mqtt-controller.js'
import { MQTT_CONFIG } from '../config/mqtt-config.js'
import {
    formatDurasi,
    hitungDurasi,
    hitungBiaya,
    validateCardId,
    validateJenis,
    formatRupiah,
    groupByTanggal,
    countByJenis
} from '../utils/helpers.js'
import { showSuccess, showError, showWarning } from '../utils/notification.js'

// PETUGAS CONTROLLER

// Handle business logic for dashboard petugas
export class PetugasController {
    constructor(profile) {
        this.profile = profile
        this.tarifData = {}
        this.currentKendaraanId = null
    }

    // Initialize
    async init() {
        await this.loadTarif()
        await this.loadData()
        this.initMQTT()

        // Auto refresh every 30 seconds
        setInterval(() => this.loadData(), 30000)
    }

    // Load tarif
    async loadTarif() {
        const result = await TarifModel.getTarifMap()
        if (result.success) {
            this.tarifData = result.tarifMap
            this.updateTarifUI()
        }
    }

    // Update tarif UI (Motor only)
    updateTarifUI() {
        const tarifMotor = document.getElementById('tarifMotor')

        if (tarifMotor) tarifMotor.textContent = formatRupiah(this.tarifData['Motor'])
    }

    // Load all data
    async loadData() {
        await this.loadKendaraanParkir()
        await this.loadRiwayat()
        await this.updateCharts()
    }

    // Load kendaraan parkir
    async loadKendaraanParkir() {
        const result = await KendaraanModel.getKendaraanParkir()
        if (!result.success) {
            console.error('Error loading parkir:', result.error)
            return
        }

        const parkir = result.data

        // Update jumlah
        const jumlahEl = document.getElementById('jumlahParkir')
        if (jumlahEl) jumlahEl.textContent = parkir.length

        // Update table
        const tbody = document.getElementById('parkir-body')
        if (!tbody) return

        if (parkir.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center muted">Tidak ada motor parkir</td></tr>
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
                    <td>${new Date(k.waktu_masuk).toLocaleString('id-ID')}</td>
                    <td>${formatDurasi(durasiMenit)}</td>
                    <td><strong>${formatRupiah(estimasiBiaya)}</strong></td>
                    <td>
                        <button class="btn-danger" onclick="petugasController.showModalKeluar('${k.id}', '${k.card_id}', '${k.plat_nomor || '-'}', '${k.jenis}', ${durasiMenit})">
                            🚪 Keluar
                        </button>
                    </td>
                </tr>
            `
        }).join('')
    }

    // Load riwayat
    async loadRiwayat() {
        const result = await KendaraanModel.getKendaraanSelesai(10)
        if (!result.success) {
            console.error('Error loading riwayat:', result.error)
            return
        }

        const keluar = result.data
        const tbody = document.getElementById('keluar-body')
        if (!tbody) return

        if (keluar.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center muted">Belum ada riwayat</td></tr>
            `
            return
        }

        tbody.innerHTML = keluar.map(k => `
            <tr>
                <td><strong>${k.card_id}</strong></td>
                <td>${k.plat_nomor || '-'}</td>
                <td>${new Date(k.waktu_masuk).toLocaleString('id-ID')}</td>
                <td>${new Date(k.waktu_keluar).toLocaleString('id-ID')}</td>
                <td>${formatDurasi(k.durasi_menit)}</td>
                <td><strong class="text-success">${formatRupiah(k.biaya)}</strong></td>
            </tr>
        `).join('')
    }

    // Handle kendaraan masuk (manual input)
    async handleKendaraanMasuk(cardId, platNomor, jenis) {
        // Validasi
        const cardValidation = validateCardId(cardId)
        if (!cardValidation.valid) {
            showError(cardValidation.error)
            return
        }

        const jenisValidation = validateJenis(jenis)
        if (!jenisValidation.valid) {
            showError(jenisValidation.error)
            return
        }

        // Check in via model
        const result = await KendaraanModel.checkIn(
            cardId.trim(),
            platNomor ? platNomor.trim() : null,
            jenis,
            this.profile.nama
        )

        if (!result.success) {
            if (result.code === 'ALREADY_PARKED') {
                showWarning(result.error)
            } else {
                showError('Gagal memasukkan kendaraan: ' + result.error)
            }
            return
        }

        // Success
        showSuccess(`✅ Motor ${cardId} berhasil masuk!`)

        // Clear form
        const cardIdInput = document.getElementById('cardId')
        const platInput = document.getElementById('platNomor')
        if (cardIdInput) cardIdInput.value = ''
        if (platInput) platInput.value = ''

        // Reload data
        await this.loadData()
    }

    // Show modal keluar
    showModalKeluar(id, cardId, platNomor, jenis, durasiMenit) {
        this.currentKendaraanId = id

        const biaya = hitungBiaya(durasiMenit, this.tarifData[jenis] || 0)
        const durasiJam = Math.ceil(durasiMenit / 60)

        const modal = document.getElementById('modalKeluar')
        const detail = document.getElementById('detailKeluar')

        if (!modal || !detail) return

        detail.innerHTML = `
            <table class="detail-table">
                <tr>
                    <td><strong>Card ID:</strong></td>
                    <td>${cardId}</td>
                </tr>
                <tr>
                    <td><strong>Plat Nomor:</strong></td>
                    <td>${platNomor}</td>
                </tr>
                <tr>
                    <td><strong>Jenis:</strong></td>
                    <td>Motor</td>
                </tr>
                <tr>
                    <td><strong>Durasi:</strong></td>
                    <td>${formatDurasi(durasiMenit)} (${durasiJam} jam)</td>
                </tr>
                <tr>
                    <td><strong>Tarif:</strong></td>
                    <td>${formatRupiah(this.tarifData['Motor'])}/jam</td>
                </tr>
                <tr class="total-row">
                    <td><strong>TOTAL BIAYA:</strong></td>
                    <td><strong class="text-primary">${formatRupiah(biaya)}</strong></td>
                </tr>
            </table>
        `

        modal.style.display = 'flex'
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('modalKeluar')
        if (modal) modal.style.display = 'none'
        this.currentKendaraanId = null
    }

    // Konfirmasi keluar
    async handleKonfirmasiKeluar() {
        if (!this.currentKendaraanId) return

        // Ambil data kendaraan dulu
        const kendaraanResult = await KendaraanModel.getById(this.currentKendaraanId)
        if (!kendaraanResult.success) {
            showError('Gagal mengambil data kendaraan')
            return
        }

        const kendaraan = kendaraanResult.data

        // Kalau masih IN, lakukan checkOut dulu
        let finalKendaraan = kendaraan

        if (kendaraan.status === 'IN') {
            const durasiMenit = hitungDurasi(kendaraan.waktu_masuk)
            const biaya = hitungBiaya(durasiMenit, this.tarifData[kendaraan.jenis] || 0)

            const checkoutResult = await KendaraanModel.checkOut(
                kendaraan.card_id,
                new Date().toISOString(),
                durasiMenit,
                biaya
            )

            if (!checkoutResult.success) {
                showError('Gagal checkout: ' + checkoutResult.error)
                return
            }

            finalKendaraan = checkoutResult.data // <-- pakai data terbaru
        }

        // Baru konfirmasi DONE
        const result = await KendaraanModel.konfirmasiKeluar(
            this.currentKendaraanId,
            this.profile.nama
        )

        if (!result.success) {
            showError('Gagal konfirmasi keluar')
            return
        }

        showSuccess(`✅ Motor ${finalKendaraan.card_id} keluar. Biaya: ${formatRupiah(finalKendaraan.biaya)}`)

        this.closeModal()
        await this.loadData()
    }


    // Initialize MQTT
    initMQTT() {
        mqttController.init()

        // Handle RFID Entry
        mqttController.onMessage(MQTT_CONFIG.topics.rfidEntry, async (payload) => {
            await this.handleRFIDEntry(payload)
        })

        // Handle RFID Exit
        mqttController.onMessage(MQTT_CONFIG.topics.rfidExit, async (payload) => {
            await this.handleRFIDExit(payload)
        })
    }

    // Handle RFID Entry from IoT
    async handleRFIDEntry(payload) {
        const cardId = payload.card_id

        console.log('🏍️ RFID Entry detected:', cardId)
        showSuccess(`🏍️ RFID Entry: ${cardId} `)

        // Check in via model (Motor only)
        const result = await KendaraanModel.checkIn(
            cardId,
            null, // plat nomor optional
            'Motor', // Motor only!
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

        // Success - buka palang & tampilkan pesan
        mqttController.publishServo('entry', 'open')
        mqttController.publishLCD('Selamat Datang', 'Silakan Masuk')

        await this.loadData()
        showSuccess(`✅ Motor ${cardId} berhasil masuk!`)
    }

    // Handle RFID Exit from IoT
    async handleRFIDExit(payload) {
        const cardId = payload.card_id

        console.log('🚪 RFID Exit detected:', cardId)
        showSuccess(`🚪 RFID Exit: ${cardId} `)

        // Get kendaraan
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

        // Hitung biaya
        const durasiMenit = hitungDurasi(kendaraan.waktu_masuk)
        const biaya = hitungBiaya(durasiMenit, this.tarifData[kendaraan.jenis] || 0)

        // Check out (status jadi OUT, menunggu konfirmasi)
        const checkoutResult = await KendaraanModel.checkOut(
            cardId,
            new Date().toISOString(),
            durasiMenit,
            biaya
        )

        if (!checkoutResult.success) {
            showError('Error: ' + checkoutResult.error)
            return
        }

        // Tampilkan biaya di LCD
        mqttController.publishLCD(`Biaya: ${formatRupiah(biaya)} `, 'Bayar ke Petugas')

        // Auto-buka modal konfirmasi
        this.showModalKeluar(kendaraan.id, cardId, kendaraan.plat_nomor, kendaraan.jenis, durasiMenit)

        await this.loadData()
        showSuccess(`💰 Motor ${cardId} - Biaya: ${formatRupiah(biaya)} `)
    }

    // Update charts
    async updateCharts() {
        // Get all data for charts
        const result = await KendaraanModel.getAllForChart()
        if (!result.success) return

        const data = result.data

        // Update harian chart (chart jenis dihapus - Motor only)
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