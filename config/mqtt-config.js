// KONFIGURASI MQTT

export const MQTT_CONFIG = {
    // MQTT Broker
    broker: 'broker.hivemq.com',
    port: 8884, // WebSocket Secure port (wss, untuk browser via HTTPS)
    
    // Client ID
    clientId: 'dashboard_' + Math.random().toString(16).substr(2, 8),
    
    // Topics
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