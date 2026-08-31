#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLECharacteristic.h>

#include <esp_gatts_api.h>
#include "sandhi_proto.h"

// ------------------------------------------------------------------ config --
// Every pin can be overridden from platformio.ini build_flags for a given rig.

#ifndef PIN_SDA0
#define PIN_SDA0 21
#endif
#ifndef PIN_SCL0
#define PIN_SCL0 22
#endif
#ifndef PIN_SDA1
#define PIN_SDA1 26
#endif
#ifndef PIN_SCL1
#define PIN_SCL1 27
#endif
#ifndef PIN_MIC
#define PIN_MIC 34
#endif
#ifndef PIN_BATTERY
#define PIN_BATTERY 35
#endif
#ifndef PIN_LED
#define PIN_LED 2
#endif

static constexpr uint32_t kSamplePeriodUs = 10000;    // 100 Hz per IMU
static constexpr uint32_t kAudioPeriodUs = 250;       // 4 kHz
static constexpr size_t kAudioSamples = 24000;        // 6 s
static constexpr uint32_t kCalibSamples = 512;
static constexpr uint16_t kBatteryLowMv = 3300;
static constexpr float kBatteryDivider = 2.0f;

// ------------------------------------------------------------------ mode -----
enum {
  MODE_IDLE = 0,
  MODE_IMU = 1,
  MODE_AUDIO_REC = 2,
  MODE_AUDIO_SHIP = 3,
};

enum {
  CMD_START = 0x01,
  CMD_STOP = 0x02,
  CMD_CALIBRATE = 0x03,
  CMD_STATUS = 0x04,
  CMD_AUDIO = 0x05,
};

// ----------------------------------------------------------------- sensors ---
Adafruit_MPU6050 mpuThigh;
Adafruit_MPU6050 mpuShank;

bool gThighOk = false;
bool gShankOk = false;
float gBiasThigh[3] = {0, 0, 0};
float gBiasShank[3] = {0, 0, 0};
float gAccelScale = 8192.0f / 9.80665f;  // m/s^2 -> LSB
float gGyroScale = SANDHI_GYRO_LSB_PER_DPS * 57.29578f;  // rad/s -> LSB

// ------------------------------------------------------------------ BLE ------
BLEServer *gServer = nullptr;
BLEService *gService = nullptr;
BLECharacteristic *gCharImu = nullptr;
BLECharacteristic *gCharAcoustic = nullptr;
BLECharacteristic *gCharControl = nullptr;

bool gConnected = false;

// ----------------------------------------------------------------- state -----
uint8_t gMode = MODE_IDLE;
volatile uint8_t gCmd = 0;
bool gLowBatt = false;
uint16_t gBattMv = 0;
int64_t gBattNextUs = 0;

uint8_t gSeqThigh = 0;
uint8_t gSeqShank = 0;

int16_t *gAudioBuf = nullptr;
size_t gAudioIdx = 0;
int64_t gAudioNextUs = 0;

uint8_t gImuSeqT = 0;
uint8_t gImuSeqS = 0;

// ---------------------------------------------------------------- helpers ----

static uint8_t sensorMask() {
  uint8_t m = 0;
  if (gThighOk) m |= SANDHI_SENSOR_THIGH;
  if (gShankOk) m |= SANDHI_SENSOR_SHANK;
  return m;
}

static int16_t lshift(float v) {
  int32_t q = (int32_t)lroundf(v);
  if (q > 32767) return 32767;
  if (q < -32768) return -32768;
  return (int16_t)q;
}

static void sendImu(bool shank, float fm[3], float fg[3]) {
  int16_t acc[3], gyro[3];
  uint16_t flags = 0;
  for (int i = 0; i < 3; i++) {
    float av = fm[i] * gAccelScale;
    float gv = (fg[i] * gGyroScale) - (shank ? gBiasShank[i] * SANDHI_GYRO_LSB_PER_DPS
                                             : gBiasThigh[i] * SANDHI_GYRO_LSB_PER_DPS);
    int32_t ai = (int32_t)lroundf(av);
    int32_t gi = (int32_t)lroundf(gv);
    if (ai > 32767 || ai < -32768) flags |= SANDHI_FLAG_SATURATION;
    if (gi > 32767 || gi < -32768) flags |= SANDHI_FLAG_SATURATION;
    acc[i] = lshift(av);
    gyro[i] = lshift(gv);
  }
  flags |= gLowBatt ? SANDHI_FLAG_LOW_BATT : 0;
  uint16_t tMs = (uint16_t)((esp_timer_get_time() / 1000) & 0xFFFF);
  uint8_t frame[SANDHI_IMU_FRAME_BYTES];
  sandhiWriteImuFrame(shank ? SANDHI_SENSOR_SHANK : SANDHI_SENSOR_THIGH,
                      shank ? gSeqShank++ : gSeqThigh++, tMs, acc, gyro, flags, frame);
  gCharImu->setValue((uint8_t *)frame, SANDHI_IMU_FRAME_BYTES);
  gCharImu->notify();
}

static void sendStatus() {
  uint8_t msg[SANDHI_IMU_FRAME_BYTES];
  memset(msg, 0, sizeof(msg));
  msg[0] = (uint8_t)(SANDHI_TYPE_STATUS << 4);
  msg[1] = gMode;
  msg[2] = sensorMask();
  msg[3] = gBattMv & 0xFF;
  msg[4] = (gBattMv >> 8) & 0xFF;
  uint32_t heap = ESP.getFreeHeap() / 1024;
  msg[5] = heap & 0xFF;
  msg[6] = (heap >> 8) & 0xFF;
  uint32_t up = (uint32_t)(esp_timer_get_time() / 1000000);
  msg[7] = up & 0xFF;
  msg[8] = (up >> 8) & 0xFF;
  msg[9] = (gSeqThigh) & 0xFF;
  msg[10] = (gSeqShank) & 0xFF;
  uint16_t crc = sandhiCrc16(msg, 18);
  msg[18] = (crc >> 8) & 0xFF;
  msg[19] = crc & 0xFF;
  gCharImu->setValue((uint8_t *)msg, SANDHI_IMU_FRAME_BYTES);
  gCharImu->notify();
}

static void readBatteryOnce() {
  int64_t now = esp_timer_get_time();
  if (now < gBattNextUs) return;
  gBattNextUs = now + 2000000;
  uint32_t mv = analogReadMilliVolts(PIN_BATTERY);
  uint32_t pack = (uint32_t)((float)mv * kBatteryDivider);
  gBattMv = pack;
  gLowBatt = pack > 0 && pack < kBatteryLowMv;
}

// ------------------------------------------------------------- calibration ---

static void calibrateGyro() {
  sensors_event_t a, g, t;
  float rt[3] = {0, 0, 0}, rs[3] = {0, 0, 0};
  for (uint32_t i = 0; i < kCalibSamples; i++) {
    if (gThighOk) {
      mpuThigh.getEvent(&a, &g, &t);
      rt[0] += g.gyro.x; rt[1] += g.gyro.y; rt[2] += g.gyro.z;
    }
    if (gShankOk) {
      mpuShank.getEvent(&a, &g, &t);
      rs[0] += g.gyro.x; rs[1] += g.gyro.y; rs[2] += g.gyro.z;
    }
    delayMicroseconds(1500);
  }
  for (int i = 0; i < 3; i++) {
    if (gThighOk) gBiasThigh[i] = rt[i] / kCalibSamples * 57.29578f;
    if (gShankOk) gBiasShank[i] = rs[i] / kCalibSamples * 57.29578f;
  }
}

// ------------------------------------------------------------- IMU sampler ---

static void sampleImus() {
  sensors_event_t a, g, t;
  if (gThighOk) {
    if (mpuThigh.getEvent(&a, &g, &t)) {
      float fm[3] = {a.acceleration.x, a.acceleration.y, a.acceleration.z};
      float fg[3] = {g.gyro.x, g.gyro.y, g.gyro.z};
      sendImu(false, fm, fg);
    }
  }
  if (gShankOk) {
    if (mpuShank.getEvent(&a, &g, &t)) {
      float fm[3] = {a.acceleration.x, a.acceleration.y, a.acceleration.z};
      float fg[3] = {g.gyro.x, g.gyro.y, g.gyro.z};
      sendImu(true, fm, fg);
    }
  }
}

// -------------------------------------------------------------- audio ship ---

static void shipAudio() {
  static constexpr size_t per = SANDHI_ACOUSTIC_SAMPLES_PER_BLOCK;
  size_t done = 0;
  uint16_t index = 0;
  while (done < gAudioIdx) {
    size_t n = gAudioIdx - done;
    bool last = n <= per;
    size_t take = last ? n : per;
    uint8_t block[SANDHI_ACOUSTIC_BLOCK_BYTES];
    sandhiWriteAcousticBlock(index, last, 4, gAudioBuf + done, take, block);
    gCharAcoustic->setValue((uint8_t *)block, SANDHI_ACOUSTIC_BLOCK_BYTES);
    gCharAcoustic->notify();
    done += take;
    index++;
    delay(2);
  }
  gAudioIdx = 0;
}

// ------------------------------------------------------ mode state machine ---

static void enterIdle() { gMode = MODE_IDLE; }

static void enterImu() {
  gSeqThigh = 0;
  gSeqShank = 0;
  gMode = MODE_IMU;
}

static void enterAudioRec() {
  if (!gAudioBuf) return;
  memset(gAudioBuf, 0, kAudioSamples * sizeof(int16_t));
  gAudioIdx = 0;
  gAudioNextUs = esp_timer_get_time();
  gMode = MODE_AUDIO_REC;
}

static void sampleAudio() {
  int64_t now = esp_timer_get_time();
  if (now < gAudioNextUs) return;
  gAudioNextUs += kAudioPeriodUs;
  int raw = analogRead(PIN_MIC);
  gAudioBuf[gAudioIdx++] = (int16_t)(((int32_t)raw - 2048) << 4);
  if (gAudioIdx >= kAudioSamples) gMode = MODE_AUDIO_SHIP;
}

// ---------------------------------------------------------- BLE callbacks ----

class SandhiServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *s, esp_ble_gatts_cb_param_t *param) override {
    gConnected = true;
    s->updateConnParams(param->connect.remote_bda, 6, 12, 0, 200);
  }
  void onConnect(BLEServer *s) override { gConnected = true; }
  void onDisconnect(BLEServer *s) override {
    gConnected = false;
    enterIdle();
    s->getAdvertising()->start();
  }
};

class SandhiControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    std::string v = c->getValue();
    if (v.empty()) return;
    uint8_t cmd = (uint8_t)v[0];
    if (cmd == CMD_CALIBRATE) {
      calibrateGyro();
      gCmd = CMD_STATUS;
      return;
    }
    gCmd = cmd;
  }
};

// ---------------------------------------------------------------- setup ------

bool initImus() {
  Wire.begin(PIN_SDA0, PIN_SCL0);
  Wire1.begin(PIN_SDA1, PIN_SCL1);
  Wire.setClock(400000);
  Wire1.setClock(400000);

  gThighOk = mpuThigh.begin(0x68, &Wire, 0);
  gShankOk = mpuShank.begin(0x68, &Wire1, 0);

  if (gThighOk) {
    mpuThigh.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpuThigh.setGyroRange(MPU6050_RANGE_2000_DEG);
    mpuThigh.setFilterBandwidth(MPU6050_BAND_184_HZ);
    mpuThigh.setSampleRateDivisor(9);
  }
  if (gShankOk) {
    mpuShank.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpuShank.setGyroRange(MPU6050_RANGE_2000_DEG);
    mpuShank.setFilterBandwidth(MPU6050_BAND_184_HZ);
    mpuShank.setSampleRateDivisor(9);
  }
  return gThighOk || gShankOk;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);

  if (!initImus()) {
    Serial.println("SANDHI: no IMU found on either bus");
  } else {
    calibrateGyro();
  }

  analogSetPinAttenuation(PIN_MIC, ADC_11db);
  analogSetPinAttenuation(PIN_BATTERY, ADC_11db);
  analogReadResolution(12);
  readBatteryOnce();

  gAudioBuf = (int16_t *)malloc(kAudioSamples * sizeof(int16_t));
  if (!gAudioBuf) Serial.println("SANDHI: audio buffer alloc failed");

  BLEDevice::init("SANDHI-K1");
  BLEDevice::setMTU(517);

  gServer = BLEDevice::createServer();
  gServer->setCallbacks(new SandhiServerCallbacks());
  gService = gServer->createService(SANDHI_SERVICE_UUID);

  gCharImu = gService->createCharacteristic(
      SANDHI_CHAR_IMU, BLECharacteristic::PROPERTY_NOTIFY);
  gCharAcoustic = gService->createCharacteristic(
      SANDHI_CHAR_ACOUSTIC, BLECharacteristic::PROPERTY_NOTIFY);
  gCharControl = gService->createCharacteristic(
      SANDHI_CHAR_CONTROL,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  gCharControl->setCallbacks(new SandhiControlCallbacks());

  gService->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLEUUID(SANDHI_SERVICE_UUID));
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  adv->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("SANDHI-K1 ready");
}

// ------------------------------------------------------------------ loop -----

void handleCommand(uint8_t cmd) {
  gCmd = 0;
  switch (cmd) {
    case CMD_START:
      enterImu();
      break;
    case CMD_STOP:
      enterIdle();
      break;
    case CMD_STATUS:
      sendStatus();
      break;
    case CMD_AUDIO:
      if (gConnected) enterAudioRec();
      break;
    default:
      break;
  }
}

void loop() {
  if (gCmd != 0) handleCommand((uint8_t)gCmd);
  if (!gConnected) {
    delay(10);
    return;
  }

  readBatteryOnce();

  switch (gMode) {
    case MODE_IMU: {
      static int64_t nextUs = 0;
      int64_t now = esp_timer_get_time();
      if (now < nextUs) {
        delayMicroseconds(200);
        return;
      }
      nextUs = now + kSamplePeriodUs;
      sampleImus();
      digitalWrite(PIN_LED, !digitalRead(PIN_LED));
      break;
    }
    case MODE_AUDIO_REC:
      sampleAudio();
      break;
    case MODE_AUDIO_SHIP:
      shipAudio();
      enterIdle();
      break;
    default:
      delay(10);
      break;
  }
}