/**
 * SANDHI wire protocol - v1. Port of web/lib/dsp/protocol.ts.
 *
 * The kit is a BLE peripheral. One service, three characteristics:
 *
 *   Service           6e5a0001-b5a3-f393-e0a9-e50e24dcca9e
 *     0x0002  notify  IMU stream        20-byte frames, 100 Hz per sensor
 *     0x0003  notify  Acoustic block    185-byte frames, burst after capture
 *     0x0004  write   Control           start / stop / calibrate / status / audio
 *
 * IMU frame (20 bytes, fits the default BLE 4.2 ATT payload):
 *   byte  0      type (upper nibble) | sensor id (lower nibble)
 *   byte  1      sequence number, wraps at 256 - gaps mean dropped frames
 *   bytes 2-3    device timestamp, ms, uint16 LE, wraps every 65.5 s
 *   bytes 4-15   ax ay az gx gy gz, int16 LE
 *                accel  -4 g   -> 8192 LSB/g
 *                gyro   -2000 dps -> 16.384 LSB/(deg/s)
 *   bytes 16-17  flags: bit0 saturation, bit1 cuff-slip suspected, bit2 low batt
 *   bytes 18-19  CRC-16/CCITT-FALSE over bytes 0..17, big endian
 *
 * Acoustic block (185 bytes, shipped after a 6 s @4 kHz capture):
 *   byte  0      type (0x2) in upper nibble
 *   bytes 1-2    block index, uint16 LE
 *   byte  3      flags: bit0 = last block of the capture
 *   byte  4      sample rate in kHz (4)
 *   bytes 5..182 89 signed int16 LE samples
 *   bytes 183-184 CRC-16/CCITT-FALSE over bytes 0..182, big endian
 *
 * Status frame (20 bytes, type 0x3) - sent on connect or on CMD_STATUS:
 *   byte 0 type, byte 1 mode, byte 2 sensor mask, bytes 3-4 battery mV,
 *   bytes 5-6 free heap KB, bytes 7-8 uptime s, bytes 9-10 thigh/shank seq,
 *   bytes 18-19 CRC over 0..17.
 */

export const SERVICE_UUID = "6e5a0001-b5a3-f393-e0a9-e50e24dcca9e";
export const CHAR_IMU = "6e5a0002-b5a3-f393-e0a9-e50e24dcca9e";
export const CHAR_ACOUSTIC = "6e5a0003-b5a3-f393-e0a9-e50e24dcca9e";
export const CHAR_CONTROL = "6e5a0004-b5a3-f393-e0a9-e50e24dcca9e";

export const IMU_FRAME_BYTES = 20;
export const ACOUSTIC_BLOCK_BYTES = 185;
export const ACOUSTIC_SAMPLES_PER_BLOCK = 89;
export const ACCEL_LSB_PER_G = 8192;
export const GYRO_LSB_PER_DPS = 16.384;

export const FRAME_TYPE = { imu: 0x1, acoustic: 0x2, status: 0x3 } as const;
export const SENSOR = { thigh: 0x1, shank: 0x2, mic: 0x3 } as const;

export const CMD = {
  START: 0x01,
  STOP: 0x02,
  CALIBRATE: 0x03,
  STATUS: 0x04,
  AUDIO: 0x05,
} as const;

export const FLAG = {
  SATURATION: 0x0001,
  CUFF_SLIP: 0x0002,
  LOW_BATT: 0x0004,
} as const;

export function crc16(bytes: ArrayLike<number>, len = bytes.length): number {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export interface ImuSample {
  sensor: number;
  seq: number;
  tMs: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  flags?: number;
}

export interface DecodedFrame extends ImuSample {
  crcOk: boolean;
  raw: Uint8Array;
}

export function decodeRaw(frame: Uint8Array): DecodedFrame {
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const type = frame[0] >> 4;
  if (type !== FRAME_TYPE.imu) {
    throw new Error(`not an IMU frame: type ${type}`);
  }
  const got = dv.getUint16(18, false);
  return {
    sensor: frame[0] & 0x0f,
    seq: frame[1],
    tMs: dv.getUint16(2, true),
    ax: dv.getInt16(4, true) / ACCEL_LSB_PER_G,
    ay: dv.getInt16(6, true) / ACCEL_LSB_PER_G,
    az: dv.getInt16(8, true) / ACCEL_LSB_PER_G,
    gx: dv.getInt16(10, true) / GYRO_LSB_PER_DPS,
    gy: dv.getInt16(12, true) / GYRO_LSB_PER_DPS,
    gz: dv.getInt16(14, true) / GYRO_LSB_PER_DPS,
    flags: dv.getUint16(16, true),
    crcOk: got === crc16(frame, 18),
    raw: frame,
  };
}

export interface AcousticBlock {
  index: number;
  last: boolean;
  khz: number;
  samples: Int16Array;
  crcOk: boolean;
}

export function decodeAcousticBlock(block: Uint8Array): AcousticBlock {
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  const type = block[0] >> 4;
  if (type !== FRAME_TYPE.acoustic) {
    throw new Error(`not an acoustic frame: type ${type}`);
  }
  const n = (ACOUSTIC_BLOCK_BYTES - 7) / 2; // 89 samples, CRC in last 2 bytes
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) samples[i] = dv.getInt16(5 + i * 2, true);
  return {
    index: dv.getUint16(1, true),
    last: (block[3] & 0x01) === 0x01,
    khz: block[4],
    samples,
    crcOk: dv.getUint16(183, false) === crc16(block, 183),
  };
}

export interface StatusFrame {
  mode: number;
  sensorMask: number;
  batteryMv: number;
  freeHeapKb: number;
  uptimeS: number;
  seqThigh: number;
  seqShank: number;
  crcOk: boolean;
}

export function decodeStatus(frame: Uint8Array): StatusFrame {
  const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  return {
    mode: frame[1],
    sensorMask: frame[2],
    batteryMv: dv.getUint16(3, true),
    freeHeapKb: dv.getUint16(5, true),
    uptimeS: dv.getUint16(7, true),
    seqThigh: frame[9],
    seqShank: frame[10],
    crcOk: dv.getUint16(18, false) === crc16(frame, 18),
  };
}

/** Decode any 20-byte notification by its frame type. */
export function decodeFrame(frame: Uint8Array): DecodedFrame | StatusFrame {
  const type = frame[0] >> 4;
  if (type === FRAME_TYPE.acoustic) throw new Error("acoustic over IMU char");
  if (type === FRAME_TYPE.status) return decodeStatus(frame);
  return decodeRaw(frame);
}

/** Base64 (ble-plx) -> Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes -> base64 (ble-plx), used for the 4-byte control writes. */
export function bytesToBase64(bytes: ArrayLike<number>): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* --------------------- encoder + web-compat names --------------------- */

const clampI16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));

export function encodeImuFrame(s: ImuSample): Uint8Array {
  const f = new Uint8Array(IMU_FRAME_BYTES);
  const dv = new DataView(f.buffer);
  f[0] = (FRAME_TYPE.imu << 4) | (s.sensor & 0x0f);
  f[1] = s.seq & 0xff;
  dv.setUint16(2, s.tMs & 0xffff, true);
  const vals = [
    clampI16(s.ax * ACCEL_LSB_PER_G),
    clampI16(s.ay * ACCEL_LSB_PER_G),
    clampI16(s.az * ACCEL_LSB_PER_G),
    clampI16(s.gx * GYRO_LSB_PER_DPS),
    clampI16(s.gy * GYRO_LSB_PER_DPS),
    clampI16(s.gz * GYRO_LSB_PER_DPS),
  ];
  vals.forEach((v, i) => dv.setInt16(4 + i * 2, v, true));
  dv.setUint16(16, s.flags ?? 0, true);
  dv.setUint16(18, crc16(f, 18), false);
  return f;
}

export const decodeImuFrame = decodeRaw;

export const hex = (b: Uint8Array) =>
  Array.from(b)
    .map((v) => v.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");