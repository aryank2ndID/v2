/**
 * SANDHI - kit transport. Two backends behind one interface:
 *
 *   BleKit   talks to the ESP32 kit over BLE (fork @sfourdrinier/react-native-ble-plx).
 *            Requires a development build - the BLE native module is not in Expo Go.
 *   SimKit   replays a synthetic but biomechanically plausible session so the whole
 *            flow works in Expo Go, with no hardware, or in a demo hall.
 *
 * Both surface the same callbacks; capture screens and the scoring pipeline
 * never know which one is underneath.
 */
import { PermissionsAndroid, Platform } from "react-native";

import {
  CHAR_ACOUSTIC,
  CHAR_CONTROL,
  CHAR_IMU,
  CMD,
  SERVICE_UUID,
  AcousticBlock,
  DecodedFrame,
  StatusFrame,
  base64ToBytes,
  bytesToBase64,
  decodeAcousticBlock,
  decodeFrame,
} from "../lib/protocol";
import { Phase } from "../lib/kinematics";
import {
  Rng,
  StsSignal,
  WalkSignal,
  sampleSubject,
  synthSession,
} from "../lib/simulator";
import { Intake } from "../store";

export type KitKind = "ble" | "sim";

export interface KitHooks {
  onFrame: (f: DecodedFrame) => void;
  onAcoustic: (b: AcousticBlock) => void;
  onStatus: (s: StatusFrame) => void;
  onDisconnect: (reason: string) => void;
}

export interface SimSession {
  subject: ReturnType<typeof sampleSubject>;
  walk: WalkSignal;
  sts: StsSignal;
  vag: { mic: Float64Array; fs: number };
}

export interface Kit {
  kind: KitKind;
  name: string;
  connect: (hook: KitHooks) => Promise<void>;
  beginPhase: (phase: Phase) => Promise<{ durationMs: number }>;
  endPhase: () => Promise<void>;
  requestStatus: () => Promise<void>;
  disconnect: () => Promise<void>;
  simSession: () => SimSession | null;
}

/* ------------------------------------------------------------------ */
/* Bluetooth                                                           */
/* ------------------------------------------------------------------ */

const PHASE_DURATION_MS: Record<Phase, number> = {
  walk: 30_000,
  sts: 15_000,
  vag: 6_000,
};

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const V = Number(Platform.Version);
    if (V >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === "granted" &&
        res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === "granted"
      );
    }
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return res === "granted";
  } catch {
    return false;
  }
}

type BleManagerT = import("@sfourdrinier/react-native-ble-plx").BleManager;
type BleDeviceT = import("@sfourdrinier/react-native-ble-plx").Device;

export function createBleKit(name = "SANDHI-K1"): Kit {
  let manager: BleManagerT | null = null;
  let device: BleDeviceT | null = null;
  let hook: KitHooks | null = null;
  let subscriptions: { remove: () => void }[] = [];
  let currentPhase: Phase | null = null;

  async function ensureManager(): Promise<BleManagerT> {
    if (manager) return manager;
    const ok = await ensureBlePermissions();
    if (!ok) throw new Error("Bluetooth permission not granted");
    const mod = await import("@sfourdrinier/react-native-ble-plx").catch(() => null);
    if (!mod || !mod.BleManager)
      throw new Error(
        "BLE needs a development build (npx expo run:android). Expo Go has no BLE module.",
      );
    manager = new mod.BleManager({ restoreStateIdentifier: "sandhi-kit" });
    return manager;
  }

  function clearSubs() {
    for (const sub of subscriptions) sub.remove();
    subscriptions = [];
  }

  async function writeCmd(cmd: number, param = 0): Promise<void> {
    if (!manager || !device) return;
    const body = bytesToBase64([cmd, param, 0, 0, 0, 0]);
    await manager.writeCharacteristicWithResponseForDevice(
      device.id,
      SERVICE_UUID,
      CHAR_CONTROL,
      body,
    );
  }

  function onImu(err: Error | null, ch: { value?: string | null } | null) {
    if (!hook || err || !ch?.value) return;
    try {
      const frame = decodeFrame(base64ToBytes(ch.value));
      if ("sensor" in frame) hook.onFrame(frame);
      else hook.onStatus(frame);
    } catch {
      /* not an IMU/status frame; ignore */
    }
  }

  function onAcousticChar(err: Error | null, ch: { value?: string | null } | null) {
    if (!hook || err || !ch?.value) return;
    try {
      hook.onAcoustic(decodeAcousticBlock(base64ToBytes(ch.value)));
    } catch {
      /* malformed block; ignore */
    }
  }

  const isStreamPhase = (p: Phase) => p === "walk" || p === "sts";

  return {
    kind: "ble",
    name,

    connect: async (h: KitHooks) => {
      hook = h;
      const mgr = await ensureManager();
      const found = await new Promise<BleDeviceT>((resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("No SANDHI kit found in 15 s")),
          15_000,
        );
        mgr.startDeviceScan(null, { allowDuplicates: false }, (err, d) => {
          if (err) {
            clearTimeout(t);
            reject(new Error(err.message));
            return;
          }
          if (!d) return;
          const hasService = (d.serviceUUIDs ?? []).some((u) =>
            u.toUpperCase().includes("6E5A0001"),
          );
          if (d.name?.toUpperCase().includes("SANDHI") || hasService) {
            clearTimeout(t);
            mgr.stopDeviceScan();
            resolve(d);
          }
        });
      });

      device = await mgr.connectToDevice(found.id, { timeout: 15_000 });
      await device.discoverAllServicesAndCharacteristics();
      try {
        await device.requestMTU(512);
      } catch {
        /* MTU is best effort */
      }

      subscriptions.push(
        mgr.monitorCharacteristicForDevice(device.id, SERVICE_UUID, CHAR_IMU, onImu),
        mgr.monitorCharacteristicForDevice(
          device.id,
          SERVICE_UUID,
          CHAR_ACOUSTIC,
          onAcousticChar,
        ),
      );
      device.onDisconnected(() => {
        if (hook) hook.onDisconnect("kit disconnected");
      });
      await writeCmd(CMD.STATUS);
    },

    beginPhase: async (phase: Phase) => {
      currentPhase = phase;
      if (isStreamPhase(phase)) await writeCmd(CMD.START);
      else if (phase === "vag") await writeCmd(CMD.AUDIO);
      return { durationMs: PHASE_DURATION_MS[phase] };
    },

    endPhase: async () => {
      if (currentPhase && isStreamPhase(currentPhase)) await writeCmd(CMD.STOP);
      currentPhase = null;
    },

    requestStatus: async () => {
      await writeCmd(CMD.STATUS);
    },

    disconnect: async () => {
      clearSubs();
      if (manager && device) {
        try {
          manager.cancelDeviceConnection(device.id);
        } catch {
          /* already gone */
        }
      }
      manager?.destroy();
      manager = null;
      device = null;
      hook = null;
    },

    simSession: () => null,
  };
}

/* ------------------------------------------------------------------ */
/* Simulator                                                           */
/* ------------------------------------------------------------------ */

export function createSimSession(intake: Intake): SimSession {
  const rng = new Rng(0x5a174e1);
  const s = sampleSubject(rng);
  s.age = intake.age;
  s.sex_f = intake.sex !== "M" ? 1 : 0;
  s.bmi = intake.bmi;
  s.occupation = intake.occupation;
  s.occ_squat_load = intake.occ_squat_load;
  s.stairs_per_day = intake.stairs_per_day;
  s.terrain_slope_idx = intake.terrain_slope_idx;
  s.prior_injury = intake.prior_injury;
  s.family_hx = intake.family_hx;
  s.womac_pain = intake.womac_pain;
  s.womac_stiff = intake.womac_stiff;
  const session = synthSession(new Rng(2), s);
  return {
    subject: s,
    walk: session.walk,
    sts: session.sts,
    vag: session.vag,
  };
}

export function createSimKit(session: SimSession): Kit {
  let hook: KitHooks | null = null;
  let phase: Phase | null = null;

  return {
    kind: "sim",
    name: "Simulator",

    connect: async (h: KitHooks) => {
      hook = h;
      if (hook.onStatus) {
        hook.onStatus({
          mode: 0,
          sensorMask: 0x03,
          batteryMv: 0xffff,
          freeHeapKb: 1024,
          uptimeS: 0,
          seqThigh: 0,
          seqShank: 0,
          crcOk: true,
        });
      }
    },

    beginPhase: async (p: Phase) => {
      phase = p;
      return { durationMs: 0 };
    },

    endPhase: async () => {
      phase = null;
    },

    requestStatus: async () => undefined,

    disconnect: async () => {
      hook = null;
      phase = null;
    },

    simSession: () => session,
  };
}