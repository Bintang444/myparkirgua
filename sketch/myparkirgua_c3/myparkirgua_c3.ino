// ============================================================
//  myparkirgua_c3.ino  –  Versi ESP32-C3 (untuk testing)
//  File asli (myparkirgua.ino) tidak diubah, ini file tambahan.
//  Perbedaan: pin ESP32-C3 + pakai LCD I2C 16x2 (bukan OLED)
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
const char *ssid     = "SSID WIFI";
const char *password = "PASSWORD WIFI";

const char *mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;

/* ================= MQTT TOPIC ================= */
#define TOPIC_ENTRY_RFID  "parking/tbintanh/entry/rfid"
#define TOPIC_EXIT_RFID   "parking/tbintanh/exit/rfid"
#define TOPIC_ENTRY_SERVO "parking/tbintanh/entry/servo"
#define TOPIC_EXIT_SERVO  "parking/tbintanh/exit/servo"
#define TOPIC_LCD         "parking/tbintanh/lcd"

/* ================= RFID (ESP32-C3) =================
   SPI Bus: SCK=6  MISO=2  MOSI=7  (default C3)
   RFID Entry : SS=5   RST=4
   RFID Exit  : SS=10  RST=9
   ================================================== */
#define SPI_SCK_PIN   6
#define SPI_MISO_PIN  7   // MISO = GPIO 7
#define SPI_MOSI_PIN  2   // MOSI = GPIO 2

#define RST_ENTRY_PIN 4
#define SS_ENTRY_PIN  5

#define RST_EXIT_PIN  8  // GPIO 9 = tombol BOOT di C3 devkit, ganti ke GPIO 21
#define SS_EXIT_PIN   10

MFRC522 rfidEntry(SS_ENTRY_PIN, RST_ENTRY_PIN);
MFRC522 rfidExit(SS_EXIT_PIN,  RST_EXIT_PIN);

/* ================= SERVO (ESP32-C3) =================
   ESP32-C3 tidak punya GPIO 32/33.
   Servo Entry : GPIO 3
   Servo Exit  : GPIO 1
   ================================================== */
#define SERVO_ENTRY_PIN 3
#define SERVO_EXIT_PIN  1

Servo servoEntry;
Servo servoExit;

/* ================= LCD I2C 16x2 (ESP32-C3) ==========
   I2C ESP32-C3: SDA=8  SCL=20
   (ESP32 biasa: SDA=21 SCL=22 — tidak diubah di file asli)
   Alamat I2C LCD biasanya 0x27, coba 0x3F jika tidak muncul
   ================================================== */
#define I2C_SDA_PIN 18
#define I2C_SCL_PIN 19

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
    // Cek versi chip MFRC522 — kalau 0x00 atau 0xFF berarti tidak terdeteksi
    byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.print("[RFID DEBUG] " + label + " VersionReg = 0x");
    Serial.print(v, HEX);
    if (v == 0x91 || v == 0x92)
        Serial.println(" → OK (MFRC522 terdeteksi)");
    else if (v == 0x00 || v == 0xFF)
        Serial.println(" → ERROR! Tidak terdeteksi. Cek kabel SPI & SS/RST.");
    else
        Serial.println(" → nilai tidak dikenal, mungkin bukan MFRC522");
}

/* ================= SETUP ================= */
void setup()
{
    Serial.begin(115200);
    delay(1000); // tunggu serial monitor siap

    Serial.println("\n===== BOOT =====");

    // ----- SS pin harus di-set HIGH dulu sebelum SPI.begin -----
    // Kalau tidak, dua reader bisa saling ganggu di bus yang sama
    pinMode(SS_ENTRY_PIN, OUTPUT);
    pinMode(SS_EXIT_PIN,  OUTPUT);
    digitalWrite(SS_ENTRY_PIN, HIGH);
    digitalWrite(SS_EXIT_PIN,  HIGH);

    // ----- SPI: ESP32-C3 perlu explicit pin -----
    SPI.begin(SPI_SCK_PIN, SPI_MISO_PIN, SPI_MOSI_PIN, SS_ENTRY_PIN);
    Serial.println("[SPI] Begin SCK=6 MOSI=2 MISO=7");

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

    // ----- I2C: ESP32-C3 pakai SDA=8, SCL=20 -----
    // ESP32 biasa: Wire.begin(21, 22) → tidak diubah di file asli
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    // LCD I2C 16x2 init
    lcd.begin();
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
