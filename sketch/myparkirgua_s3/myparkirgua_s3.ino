// ============================================================
//  myparkirgua_s3.ino  –  Versi ESP32-S3 (ENTRY ONLY)
//  1 RFID + 1 Servo + LCD I2C 16x2 + MQTT
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
#define TOPIC_ENTRY_SERVO "parking/tbintanh/entry/servo"
#define TOPIC_LCD         "parking/tbintanh/lcd"

/* ================= RFID (ESP32-S3) =================
   SPI: SCK=15  MOSI=16  MISO=17
   RFID Entry : SS=18  RST=21
   ================================================== */
#define SPI_SCK_PIN   15
#define SPI_MOSI_PIN  16
#define SPI_MISO_PIN  17

#define RST_ENTRY_PIN 21
#define SS_ENTRY_PIN  18

MFRC522 rfidEntry(SS_ENTRY_PIN, RST_ENTRY_PIN);

/* ================= SERVO ================= */
#define SERVO_ENTRY_PIN 4

Servo servoEntry;

/* ================= LCD I2C 16x2 =================
   I2C: SDA=6  SCL=7
   ================================================== */
#define I2C_SDA_PIN 6
#define I2C_SCL_PIN 7

LiquidCrystal_I2C lcd(0x27, 16, 2);

/* ================= MQTT ================= */
WiFiClient    espClient;
PubSubClient  client(espClient);

void connectWiFi()
{
    Serial.print("[WiFi] Connecting to ");
    Serial.println(ssid);

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    Serial.println();
    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("[WiFi] Connected: " + WiFi.localIP().toString());
    }
    else
    {
        Serial.println("[WiFi] GAGAL konek! Cek SSID/password/sinyal.");
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
            client.subscribe(TOPIC_LCD);
            Serial.println("[MQTT] Connected!");
        }
        else
        {
            Serial.print("[MQTT] Gagal, retry...");
            delay(2000);
        }
    }
}

/* ================= SERVO CONTROL ================= */
void openServo()
{
    servoEntry.write(0);
    delay(10000);
    servoEntry.write(90);
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
            Serial.println("[MQTT] Perintah buka palang!");
            openServo();
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
String readRFID()
{
    if (!rfidEntry.PICC_IsNewCardPresent())
    {
        return "";
    }

    if (!rfidEntry.PICC_ReadCardSerial())
    {
        return "";
    }

    String uid = "";
    for (byte i = 0; i < rfidEntry.uid.size; i++)
    {
        if (rfidEntry.uid.uidByte[i] < 0x10)
            uid += "0";
        uid += String(rfidEntry.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    rfidEntry.PICC_HaltA();
    rfidEntry.PCD_StopCrypto1();

    return uid;
}

/* ================= SETUP ================= */
void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n===== BOOT ESP32-S3 (ENTRY ONLY) =====");

    // ----- RFID Init -----
    pinMode(SS_ENTRY_PIN, OUTPUT);
    digitalWrite(SS_ENTRY_PIN, HIGH);

    SPI.begin(SPI_SCK_PIN, SPI_MISO_PIN, SPI_MOSI_PIN, SS_ENTRY_PIN);

    Serial.println("[SPI] Begin: SCK=15 MOSI=16 MISO=17 SS=18");

    rfidEntry.PCD_Init();
    delay(100);

    byte v = rfidEntry.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.print("[RFID] VersionReg = 0x");
    Serial.print(v, HEX);
    if (v == 0x91 || v == 0x92)
    {
        Serial.println(" -> OK (MFRC522 terdeteksi)");
        rfidEntry.PCD_SetAntennaGain(MFRC522::RxGain_max);
    }
    else if (v == 0x00 || v == 0xFF)
    {
        Serial.println(" -> ERROR! Cek kabel SPI & power.");
    }
    else
    {
        Serial.println(" -> Chip tidak dikenal");
    }

    // ----- Servo -----
    servoEntry.attach(SERVO_ENTRY_PIN);
    servoEntry.write(90);
    Serial.println("[Servo] Init GPIO 4");

    // ----- LCD -----
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.init();
    lcd.backlight();
    showLCD("Smart Parking", "System Ready");
    Serial.println("[LCD] Init SDA=6 SCL=7");

    // ----- WiFi -----
    connectWiFi();

    // ----- MQTT -----
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

    String uidEntry = readRFID();
    if (uidEntry != "")
    {
        String payload = "{\"rfid\":\"" + uidEntry + "\"}";
        client.publish(TOPIC_ENTRY_RFID, payload.c_str());
        Serial.println("[RFID ENTRY] Terbaca: " + uidEntry + " -> Publish ke MQTT");
        delay(2000);
    }
}
