/**
 * SANDHI wire protocol — v1.
 *
 * The kit is a BLE peripheral. One service, three characteristics:
 *
 *   Service           6e5a0001-b5a3-f393-e0a9-e50e24dcca9e
 *     0x0002  notify  IMU stream        20-byte frames, 100 Hz per sensor
 *     0x0003  notify  Acoustic block    185-byte frames, burst after capture
 *     0x0004  write   Control           start / stop / calibrate / status
 *
 * The 20-byte IMU frame is sized for the default BLE 4.2 ATT payload so it
 * works on the cheapest Android phone in the field with no MTU negotiation:
 *
 *   byte  0      type (upper nibble) | sensor id (lower nibble)
 *   byte  1      sequence number, wraps at 256 — gaps mean dropped frames
 *   bytes 2-3    device timestamp, ms, uint16 LE, wraps every 65.5 s
 *   bytes 4-15   ax ay az gx gy gz, int16 LE
 *                accel  ±4 g   -> 8192 LSB/g
 *                gyro   ±2000 dps -> 16.384 LSB/(deg/s)
 *   bytes 16-17  flags: bit0 saturation, bit1 cuff-slip suspected, bit2 low batt
 *   bytes 18-19  CRC-16/CCITT-FALSE over bytes 0..17
 */

export const SERVICE_UUID = "6e5a0001-b5a3-f393-e0a9-e50e24dcca9e";
export const CHAR_IMU = "6e5a0002-b5a3-f393-e0a9-e50e24dcca9e";
export const CHAR_CONTROL = "6e5a0004-b5a3-f393-e0a9-e50e24dcca9e";

export const IMU_FRAME_BYTES = 20;
export const ACCEL_LSB_PER_G = 8192;      // ±4 g on a 16-bit signed word
export const GYRO_LSB_PER_DPS = 16.384;   // ±2000 dps

export const FRAME_TYPE = { imu: 0x1, status: 0x3 } as const;
export const SENSOR = { thigh: 0x1, shank: 0x2 } as const;

/** CRC-16/CCITT-FALSE. poly 0x1021, init 0xFFFF, no reflection, no xorout. */
export function crc16(bytes: Uint8Array, len = bytes.length): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

const clampI16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

export interface ImuSample {
  sensor: number; seq: number; tMs: number;
  ax: number; ay: number; az: number;     // g
  gx: number; gy: number; gz: number;     // deg/s
  flags?: number;
}

export function encodeImuFrame(s: ImuSample): Uint8Array {
  const f = new Uint8Array(IMU_FRAME_BYTES);
  const dv = new DataView(f.buffer);
  f[0] = (FRAME_TYPE.imu << 4) | (s.sensor & 0x0f);
  f[1] = s.seq & 0xff;
  dv.setUint16(2, s.tMs & 0xffff, true);
  const vals = [
    clampI16(s.ax * ACCEL_LSB_PER_G), clampI16(s.ay * ACCEL_LSB_PER_G), clampI16(s.az * ACCEL_LSB_PER_G),
    clampI16(s.gx * GYRO_LSB_PER_DPS), clampI16(s.gy * GYRO_LSB_PER_DPS), clampI16(s.gz * GYRO_LSB_PER_DPS),
  ];
  vals.forEach((v, i) => dv.setInt16(4 + i * 2, v, true));
  dv.setUint16(16, s.flags ?? 0, true);
  dv.setUint16(18, crc16(f, 18), false);
  return f;
}

export interface DecodedFrame extends ImuSample { crcOk: boolean; raw: Uint8Array; }

export function decodeImuFrame(f: Uint8Array): DecodedFrame {
  const dv = new DataView(f.buffer, f.byteOffset, f.byteLength);
  const got = dv.getUint16(18, false);
  return {
    sensor: f[0] & 0x0f,
    seq: f[1],
    tMs: dv.getUint16(2, true),
    ax: dv.getInt16(4, true) / ACCEL_LSB_PER_G,
    ay: dv.getInt16(6, true) / ACCEL_LSB_PER_G,
    az: dv.getInt16(8, true) / ACCEL_LSB_PER_G,
    gx: dv.getInt16(10, true) / GYRO_LSB_PER_DPS,
    gy: dv.getInt16(12, true) / GYRO_LSB_PER_DPS,
    gz: dv.getInt16(14, true) / GYRO_LSB_PER_DPS,
    flags: dv.getUint16(16, true),
    crcOk: got === crc16(f, 18),
    raw: f,
  };
}

export const hex = (b: Uint8Array) =>
  Array.from(b).map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join(" ");

/** Power budget, measured against the datasheets rather than guessed. */
export const POWER_BUDGET = [
  { part: "ESP32 — BLE advertising, idle", ma: 22, duty: "between sessions" },
  { part: "ESP32 — BLE connected, streaming", ma: 108, duty: "during capture" },
  { part: "MPU-6050 ×2 — gyro + accel active", ma: 7.6, duty: "during capture" },
  { part: "Regulator quiescent + LED", ma: 3.2, duty: "always" },
];
