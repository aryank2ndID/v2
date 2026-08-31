#pragma once

#include <Arduino.h>
#include <stddef.h>
#include <stdint.h>

#define SANDHI_SERVICE_UUID "6e5a0001-b5a3-f393-e0a9-e50e24dcca9e"
#define SANDHI_CHAR_IMU "6e5a0002-b5a3-f393-e0a9-e50e24dcca9e"
#define SANDHI_CHAR_ACOUSTIC "6e5a0003-b5a3-f393-e0a9-e50e24dcca9e"
#define SANDHI_CHAR_CONTROL "6e5a0004-b5a3-f393-e0a9-e50e24dcca9e"

#define SANDHI_TYPE_IMU 0x1
#define SANDHI_TYPE_ACOUSTIC 0x2
#define SANDHI_TYPE_STATUS 0x3

#define SANDHI_SENSOR_THIGH 0x1
#define SANDHI_SENSOR_SHANK 0x2
#define SANDHI_SENSOR_MIC 0x3

#define SANDHI_FLAG_SATURATION 0x0001
#define SANDHI_FLAG_CUFF_SLIP 0x0002
#define SANDHI_FLAG_LOW_BATT 0x0004

#define SANDHI_ACCEL_LSB_PER_G 8192.0f
#define SANDHI_GYRO_LSB_PER_DPS 16.384f

#define SANDHI_IMU_FRAME_BYTES 20
#define SANDHI_ACOUSTIC_BLOCK_BYTES 185
#define SANDHI_ACOUSTIC_SAMPLES_PER_BLOCK 89
#define SANDHI_ACOUSTIC_CRC_OFFSET 183

uint16_t sandhiCrc16(const uint8_t *data, size_t len);

void sandhiWriteImuFrame(uint8_t sensor, uint8_t seq, uint16_t tMs,
                         const int16_t acc[3], const int16_t gyro[3],
                         uint16_t flags, uint8_t out[SANDHI_IMU_FRAME_BYTES]);

void sandhiWriteAcousticBlock(uint16_t index, bool last, uint8_t khz,
                              const int16_t *samples, size_t nSamples,
                              uint8_t out[SANDHI_ACOUSTIC_BLOCK_BYTES]);