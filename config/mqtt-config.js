// // KONFIGURASI MQTT
// // =============================================================
// // SETUP BROKER PRIVATE (HiveMQ Cloud - Gratis):
// // 1. Daftar di https://www.hivemq.com/mqtt-cloud-broker/
// // 2. Buat cluster baru (Free tier tersedia)
// // 3. Masuk ke cluster → Access Management → buat username & password
// // 4. Isi BROKER_HOST, MQTT_USERNAME, MQTT_PASSWORD di bawah
// // 5. Port 8884 adalah WSS (WebSocket Secure / TLS) - default HiveMQ Cloud
// // =============================================================

// const BROKER_HOST     = '10bc7cce18264ae1bcdb654ea297e46f.s1.eu.hivemq.cloud'
// const BROKER_PORT     = 8884   // WSS port (TLS) - jangan diubah untuk HiveMQ Cloud
// const MQTT_USERNAME   = 'tbintanh'
// const MQTT_PASSWORD   = 'Bandung120408'

// export const MQTT_CONFIG = {
//     broker: BROKER_HOST,
//     port: BROKER_PORT,

//     // Client ID unik per koneksi
//     clientId: 'dashboard_' + Math.random().toString(16).substr(2, 8),

//     // Kredensial autentikasi
//     username: MQTT_USERNAME,
//     password: MQTT_PASSWORD,

//     // Topics
//     topics: {
//         rfidEntry:  'parking/tbintanh/entry/rfid',
//         rfidExit:   'parking/tbintanh/exit/rfid',
//         servoEntry: 'parking/tbintanh/entry/servo',
//         servoExit:  'parking/tbintanh/exit/servo',
//         lcd:        'parking/tbintanh/lcd'
//     },

//     // Options
//     options: {
//         keepalive: 60,
//         clean: true,
//         reconnectPeriod: 3000,
//         connectTimeout: 30 * 1000,
//         rejectUnauthorized: true  // Wajib true untuk koneksi TLS yang aman
//     }
// }




// KONFIGURASI MQTT
// Ganti sesuai kebutuhan kamu

export const MQTT_CONFIG = {
    // MQTT Broker (Public Broker - Gratis)
    broker: 'broker.hivemq.com',
    port: 8000, // WebSocket port (untuk browser)
    
    // Client ID (harus unik per koneksi)
    clientId: 'dashboard_' + Math.random().toString(16).substr(2, 8),
    
    // Topics (ganti 'test' dengan nama kamu)
    topics: {
        rfidEntry: 'parking/tbintanh/entry/rfid',
        rfidExit: 'parking/tbintanh/exit/rfid', 
        servoEntry: 'parking/tbintanh/entry/servo',
        servoExit: 'parking/tbintanh/exit/servo',
        lcd: 'parking/tbintanh/lcd'
    },
    
    // Options
    options: {
        keepalive: 60,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000
    }
}