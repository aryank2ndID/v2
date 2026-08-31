#include "sandhi_proto.h"

uint16_t sandhiCrc16(const uint8_t *data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= ((uint16_t)data[i]) << 8;
    for (int b = 0; b < 8; b++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

static int16_t clampI16(int32_t v) {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return (int16_t)v;
}

void sandhiWriteImuFrame(uint8_t sensor, uint8_t seq, uint16_t tMs,
                         const int16_t acc[3], const int16_t gyro[3],
                         uint16_t flags, uint8_t out[SANDHI_IMU_FRAME_BYTES]) {
  memset(out, 0, SANDHI_IMU_FRAME_BYTES);
  out[0] = (uint8_t)((SANDHI_TYPE_IMU << 4) | (sensor & 0x0F));
  out[1] = seq;
  out[2] = tMs & 0xFF;
  out[3] = (tMs >> 8) & 0xFF;
  for (int i = 0; i < 3; i++) {
    out[4 + i * 2] = acc[i] & 0xFF;
    out[5 + i * 2] = ((uint16_t)acc[i] >> 8) & 0xFF;
  }
  for (int i = 0; i < 3; i++) {
    out[10 + i * 2] = gyro[i] & 0xFF;
    out[11 + i * 2] = ((uint16_t)gyro[i] >> 8) & 0xFF;
  }
  out[16] = flags & 0xFF;
  out[17] = (flags >> 8) & 0xFF;
  uint16_t crc = sandhiCrc16(out, 18);
  out[18] = (crc >> 8) & 0xFF;
  out[19] = crc & 0xFF;
}

void sandhiWriteAcousticBlock(uint16_t index, bool last, uint8_t khz,
                              const int16_t *samples, size_t nSamples,
                              uint8_t out[SANDHI_ACOUSTIC_BLOCK_BYTES]) {
  memset(out, 0, SANDHI_ACOUSTIC_BLOCK_BYTES);
  out[0] = (uint8_t)(SANDHI_TYPE_ACOUSTIC << 4);
  out[1] = index & 0xFF;
  out[2] = (index >> 8) & 0xFF;
  out[3] = last ? 0x01 : 0x00;
  out[4] = khz;
  size_t n = nSamples > SANDHI_ACOUSTIC_SAMPLES_PER_BLOCK ? SANDHI_ACOUSTIC_SAMPLES_PER_BLOCK : nSamples;
  for (size_t i = 0; i < n; i++) {
    out[5 + i * 2] = samples[i] & 0xFF;
    out[6 + i * 2] = ((uint16_t)samples[i] >> 8) & 0xFF;
  }
  uint16_t crc = sandhiCrc16(out, SANDHI_ACOUSTIC_CRC_OFFSET);
  out[SANDHI_ACOUSTIC_CRC_OFFSET] = (crc >> 8) & 0xFF;
  out[SANDHI_ACOUSTIC_CRC_OFFSET + 1] = crc & 0xFF;
}