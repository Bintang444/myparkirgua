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
        rfidEntry: 'parking/test/entry/rfid',
        rfidExit: 'parking/test/exit/rfid',
        servoEntry: 'parking/test/entry/servo',
        servoExit: 'parking/test/exit/servo',
        lcd: 'parking/test/lcd'
    },
    
    // Options
    options: {
        keepalive: 60,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000
    }
}