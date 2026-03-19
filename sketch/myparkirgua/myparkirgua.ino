#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

/* ================= WIFI & MQTT ================= */
const char *ssid     = "binbin";
const char *password = "12121212";

const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

/* ================= MQTT TOPIC ================= */
#define TOPIC_ENTRY_RFID  "parking/tbintanh/entry/rfid"
#define TOPIC_EXIT_RFID   "parking/tbintanh/exit/rfid"
#define TOPIC_ENTRY_SERVO "parking/tbintanh/entry/servo"
#define TOPIC_EXIT_SERVO  "parking/tbintanh/exit/servo"
#define TOPIC_LCD         "parking/tbintanh/lcd"

/* ================= RFID ================= */
#define RST_ENTRY_PIN 27
#define SS_ENTRY_PIN 5

#define RST_EXIT_PIN 17
#define SS_EXIT_PIN 15

MFRC522 rfidEntry(SS_ENTRY_PIN, RST_ENTRY_PIN);
MFRC522 rfidExit(SS_EXIT_PIN, RST_EXIT_PIN);

/* ================= SERVO ================= */
#define SERVO_ENTRY_PIN 32
#define SERVO_EXIT_PIN 33

Servo servoEntry;
Servo servoExit;

/* ================= OLED ================= */
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

/* ================= MQTT ================= */
WiFiClient espClient;
PubSubClient client(espClient);

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

/* ================= OLED DISPLAY ================= */
void showOLED(String line1, String line2)
{
	display.clearDisplay();
	display.setTextSize(1);
	display.setTextColor(SSD1306_WHITE);

	display.setCursor(0, 10);
	display.println(line1);

	display.setTextSize(1);
	display.setCursor(0, 40);
	display.println(line2);

	display.display();
}

/* ================= MQTT CALLBACK ================= */
void callback(char *topic, byte *payload, unsigned int length)
{
	String message;
	for (int i = 0; i < length; i++)
	{
		message += (char)payload[i];
	}

	// Servo Entry: dashboard kirim "OPEN"
	if (String(topic) == TOPIC_ENTRY_SERVO)
	{
		if (message.indexOf("OPEN") >= 0)
		{
			openServo(servoEntry);
		}
	}

	// Servo Exit: dashboard kirim "OPEN"
	if (String(topic) == TOPIC_EXIT_SERVO)
	{
		if (message.indexOf("OPEN") >= 0)
		{
			openServo(servoExit);
		}
	}

	// LCD: dashboard kirim "line1|line2"
	if (String(topic) == TOPIC_LCD)
	{
		int separator = message.indexOf('|');
		String line1 = message.substring(0, separator);
		String line2 = message.substring(separator + 1);
		showOLED(line1, line2);
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

/* ================= SETUP ================= */
void setup()
{
	Serial.begin(115200);

	// RFID Setup
	SPI.begin();
	rfidEntry.PCD_Init();
	rfidExit.PCD_Init();

	// Servo Setup
	servoEntry.attach(SERVO_ENTRY_PIN);
	servoExit.attach(SERVO_EXIT_PIN);
	servoEntry.write(0);
	servoExit.write(0);

	// OLED Init
	Wire.begin(21, 22);
	if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
	{
		Serial.println("OLED not found");
		while (true);
	}

	showOLED("Smart Parking", "System Ready");

	// WiFi & MQTT Setup
	connectWiFi();
	client.setServer(mqtt_server, mqtt_port);
	client.setCallback(callback);
}

/* ================= LOOP ================= */
void loop()
{
	if (!client.connected())
	{
		reconnectMQTT();
	}
	client.loop();

	// ENTRY: publish {"rfid":"UID"}
	String uidEntry = readRFID(rfidEntry);
	if (uidEntry != "")
	{
		String payload = "{\"rfid\":\"" + uidEntry + "\"}";
		client.publish(TOPIC_ENTRY_RFID, payload.c_str());
		Serial.println("ENTRY : " + payload);
		delay(2000);
	}

	// EXIT: publish {"rfid":"UID"}
	String uidExit = readRFID(rfidExit);
	if (uidExit != "")
	{
		String payload = "{\"rfid\":\"" + uidExit + "\"}";
		client.publish(TOPIC_EXIT_RFID, payload.c_str());
		Serial.println("EXIT : " + payload);
		delay(2000);
	}
}