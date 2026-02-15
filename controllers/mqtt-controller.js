import { MQTT_CONFIG } from '../config/mqtt-config.js'
import { showSuccess, showError, showInfo } from '../utils/notification.js'

// MQTT CONTROLLER

// Handle MQTT communication
export class MQTTController {
    constructor() {
        this.client = null
        this.connected = false
        this.messageHandlers = {}
    }
    
    // Initialize MQTT connection
    init() {
        const wsUrl = `ws://${MQTT_CONFIG.broker}:${MQTT_CONFIG.port}/mqtt`
        
        console.log('Connecting to MQTT broker:', wsUrl)
        
        this.client = mqtt.connect(wsUrl, {
            clientId: MQTT_CONFIG.clientId,
            ...MQTT_CONFIG.options
        })
        
        this.setupEventHandlers()
    }
    
    // Setup event handlers
    setupEventHandlers() {
        // Connected
        this.client.on('connect', () => {
            console.log('MQTT Connected!')
            this.connected = true
            
            // Subscribe to topics
            this.subscribe(MQTT_CONFIG.topics.rfidEntry)
            this.subscribe(MQTT_CONFIG.topics.rfidExit)
            
            showSuccess('MQTT Connected - Siap terima data dari IoT!')
        })
        
        // Message received
        this.client.on('message', (topic, message) => {
            console.log('MQTT Message:', topic, message.toString())
            
            try {
                const payload = JSON.parse(message.toString())
                
                // Call registered handlers
                if (this.messageHandlers[topic]) {
                    this.messageHandlers[topic].forEach(handler => {
                        handler(payload, topic)
                    })
                }
            } catch (error) {
                console.error('Error processing MQTT message:', error)
            }
        })
        
        // Error
        this.client.on('error', (error) => {
            console.error('MQTT Error:', error)
            this.connected = false
        })
        
        // Disconnected
        this.client.on('close', () => {
            console.log('MQTT Disconnected')
            this.connected = false
        })
        
        // Reconnecting
        this.client.on('reconnect', () => {
            console.log('MQTT Reconnecting...')
        })
    }
    
    // Subscribe to topic
    subscribe(topic) {
        if (!this.client) return
        
        this.client.subscribe(topic, { qos: 0 }, (err) => {
            if (!err) {
                console.log('Subscribed to:', topic)
            } else {
                console.error('Subscribe error:', err)
            }
        })
    }
    
    // Publish message
    publish(topic, payload) {
        if (!this.connected) {
            console.warn('MQTT not connected, skip publish')
            return false
        }
        
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
        
        this.client.publish(topic, message, { qos: 0 }, (err) => {
            if (err) {
                console.error('Error publish:', err)
            } else {
                console.log(`Published to ${topic}:`, message)
            }
        })
        
        return true
    }
    
    // Register message handler for specific topic
    onMessage(topic, handler) {
        if (!this.messageHandlers[topic]) {
            this.messageHandlers[topic] = []
        }
        this.messageHandlers[topic].push(handler)
    }
    
    // Publish servo command
    publishServo(gate, action) {
        const topic = gate === 'entry' ? MQTT_CONFIG.topics.servoEntry : MQTT_CONFIG.topics.servoExit
        return this.publish(topic, { action })
    }
    
    // Publish LCD message
    publishLCD(line1, line2) {
        return this.publish(MQTT_CONFIG.topics.lcd, { line1, line2 })
    }
}

// Export singleton instance
export const mqttController = new MQTTController()