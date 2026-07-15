// ============================================================
//  myparkirgua_s3.ino  –  Versi ESP32-S3
//  Pin khusus ESP32-S3 + LCD I2C 16x2 + 2x RFID + 2x Servo + MQTT
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

/* ================= WIFI & MQTT ================= */
const char *ssid     = "binbin";
const char *password = "12121212";

const char *mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;

/* ================= MQTT TOPIC ================= */
#define TOPIC_ENTRY_RFID  "parking/tbintanh/entry/rfid"
#define TOPIC_EXIT_RFID   "parking/tbintanh/exit/rfid"
#define TOPIC_ENTRY_SERVO "parking/tbintanh/entry/servo"
#define TOPIC_EXIT_SERVO  "parking/tbintanh/exit/servo"
#define TOPIC_LCD         "parking/tbintanh/lcd"

/* ================= RFID (ESP32-S3) =================
   SPI: SCK=12  MOSI=13  MISO=14
   RFID Entry : SS=10  RST=2
   RFID Exit  : SS=15  RST=4
   ================================================== */
#define SPI_SCK_PIN   12
#define SPI_MOSI_PIN  13
#define SPI_MISO_PIN  14

#define RST_ENTRY_PIN 2
#define SS_ENTRY_PIN  10

#define RST_EXIT_PIN  4
#define SS_EXIT_PIN   15

MFRC522 rfidEntry(SS_ENTRY_PIN, RST_ENTRY_PIN);
MFRC522 rfidExit(SS_EXIT_PIN,  RST_EXIT_PIN);

/* ================= SERVO (ESP32-S3) =================
   Servo Entry : GPIO 1
   Servo Exit  : GPIO 3
   ================================================== */
#define SERVO_ENTRY_PIN 1
#define SERVO_EXIT_PIN  3

Servo servoEntry;
Servo servoExit;

/* ================= LCD I2C 16x2 (ESP32-S3) ==========
   I2C: SDA=37  SCL=36
   Alamat I2C LCD biasanya 0x27, coba 0x3F jika tidak muncul
   ================================================== */
#define I2C_SDA_PIN 37
#define I2C_SCL_PIN 36

LiquidCrystal_I2C lcd(0x27, 16, 2);

/* ================= MQTT ================= */
WiFiClient    espClient;
PubSubClient  client(espClient);

void connectWiFi()
{
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
    }
}

String getMqttClientId()
{
    uint64_t chipid = ESP.getEfuseMac();
    char id[50];
    snprintf(id, sizeof(id), "smartparking-%04X%08X",
             (uint16_t)(chipid >> 32),
             (uint32_t)chipid);
    return String(id);
}

void reconnectMQTT()
{
    while (!client.connected())
    {
        if (client.connect(getMqttClientId().c_str()))
        {
            client.subscribe(TOPIC_ENTRY_SERVO);
            client.subscribe(TOPIC_EXIT_SERVO);
            client.subscribe(TOPIC_LCD);
        }
        else
        {
            delay(2000);
        }
    }
}

/* ================= SERVO CONTROL ================= */
void openServo(Servo &servo)
{
    servo.write(90);
    delay(3000);
    servo.write(0);
}

/* ================= LCD DISPLAY ================= */
void showLCD(String line1, String line2)
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
}

/* ================= MQTT CALLBACK ================= */
void callback(char *topic, byte *payload, unsigned int length)
{
    String message;
    for (int i = 0; i < length; i++)
    {
        message += (char)payload[i];
    }

    if (String(topic) == TOPIC_ENTRY_SERVO)
    {
        if (message.indexOf("OPEN") >= 0)
        {
            openServo(servoEntry);
        }
    }

    if (String(topic) == TOPIC_EXIT_SERVO)
    {
        if (message.indexOf("OPEN") >= 0)
        {
            openServo(servoExit);
        }
    }

    if (String(topic) == TOPIC_LCD)
    {
        int    separator = message.indexOf('|');
        String line1     = message.substring(0, separator);
        String line2     = message.substring(separator + 1);
        showLCD(line1, line2);
    }
}

/* ================= RFID READ ================= */
String readRFID(MFRC522 &rfid)
{
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
    {
        return "";
    }

    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++)
    {
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    return uid;
}

/* ================= DEBUG RFID ================= */
void debugRFID(MFRC522 &rfid, String label)
{
    byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.print("[RFID DEBUG] " + label + " VersionReg = 0x");
    Serial.print(v, HEX);
    if (v == 0x91 || v == 0x92)
        Serial.println(" -> OK (MFRC522 terdeteksi)");
    else if (v == 0x00 || v == 0xFF)
        Serial.println(" -> ERROR! Tidak terdeteksi. Cek kabel SPI & SS/RST.");
    else
        Serial.println(" -> nilai tidak dikenal, mungkin bukan MFRC522");
}

/* ================= SETUP ================= */
void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n===== BOOT ESP32-S3 =====");

    // ----- SS pin HIGH dulu sebelum SPI -----
    pinMode(SS_ENTRY_PIN, OUTPUT);
    pinMode(SS_EXIT_PIN,  OUTPUT);
    digitalWrite(SS_ENTRY_PIN, HIGH);
    digitalWrite(SS_EXIT_PIN,  HIGH);

    // ----- SPI -----
    SPI.begin(SPI_SCK_PIN, SPI_MISO_PIN, SPI_MOSI_PIN, SS_ENTRY_PIN);
    Serial.println("[SPI] Begin SCK=12 MOSI=13 MISO=14");

    // ----- RFID -----
    Serial.println("[RFID] Init Entry...");
    rfidEntry.PCD_Init();
    debugRFID(rfidEntry, "ENTRY");

    Serial.println("[RFID] Init Exit...");
    rfidExit.PCD_Init();
    debugRFID(rfidExit, "EXIT");

    // ----- Servo -----
    servoEntry.attach(SERVO_ENTRY_PIN);
    servoExit.attach(SERVO_EXIT_PIN);
    servoEntry.write(0);
    servoExit.write(0);

    // ----- I2C + LCD -----
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.init();
    lcd.backlight();
    showLCD("Smart Parking", "System Ready");

    // ----- WiFi & MQTT -----
    connectWiFi();
    Serial.println("[WiFi] Connected: " + WiFi.localIP().toString());
    client.setServer(mqtt_server, mqtt_port);
    client.setCallback(callback);

    Serial.println("===== SETUP DONE =====\n");
}

/* ================= LOOP ================= */
void loop()
{
    if (!client.connected())
    {
        reconnectMQTT();
    }
    client.loop();

    // --- ENTRY ---
    if (rfidEntry.PICC_IsNewCardPresent())
    {
        Serial.println("[RFID ENTRY] Kartu terdeteksi...");
        if (rfidEntry.PICC_ReadCardSerial())
        {
            String uid = "";
            for (byte i = 0; i < rfidEntry.uid.size; i++)
                uid += String(rfidEntry.uid.uidByte[i], HEX);
            uid.toUpperCase();
            rfidEntry.PICC_HaltA();
            rfidEntry.PCD_StopCrypto1();

            String payload = "{\"rfid\":\"" + uid + "\"}";
            client.publish(TOPIC_ENTRY_RFID, payload.c_str());
            Serial.println("[RFID ENTRY] Publish: " + payload);
            delay(2000);
        }
        else
        {
            Serial.println("[RFID ENTRY] Gagal baca serial kartu.");
        }
    }

    // --- EXIT ---
    if (rfidExit.PICC_IsNewCardPresent())
    {
        Serial.println("[RFID EXIT] Kartu terdeteksi...");
        if (rfidExit.PICC_ReadCardSerial())
        {
            String uid = "";
            for (byte i = 0; i < rfidExit.uid.size; i++)
                uid += String(rfidExit.uid.uidByte[i], HEX);
            uid.toUpperCase();
            rfidExit.PICC_HaltA();
            rfidExit.PCD_StopCrypto1();

            String payload = "{\"rfid\":\"" + uid + "\"}";
            client.publish(TOPIC_EXIT_RFID, payload.c_str());
            Serial.println("[RFID EXIT] Publish: " + payload);
            delay(2000);
        }
        else
        {
            Serial.println("[RFID EXIT] Gagal baca serial kartu.");
        }
    }
}
