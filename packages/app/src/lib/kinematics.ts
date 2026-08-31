/**
 * SANDHI - frame recorder + limb-angle estimator.
 *
 * Turns the raw 100 Hz-per-sensor BLE notification stream into the
 * WalkSignal / StsSignal / VAG buffers the feature extractor consumes.
 *
 * Mounting convention assumed by the estimator: each cuff sits on the front of
 * the limb with the sensor +Z pointing up the limb toward the hip and +X
 * anterior. Flexion/extension then rotates about the medial-lateral axis and
 * shows up on the gyro Z channel, while gravity direction from the
 * accelerometer (atan2(ax, az)) removes the gyro drift.
 *
 * Events from the two IMUs arrive interleaved (each at 100 Hz), so the
 * recorder places every channel on a shared 200 Hz event axis using a
 * last-sample-hold. This keeps the buffers aligned and prevents zero-fill
 * from creating false gait peaks.
 *
 * This is an estimator, not a measurement: absolute knee angles depend on cuff
 * placement. The features that matter (ROM range, peak velocities, cadence)
 * are robust to a roughly constant offset.
 */

import { AcousticBlock, DecodedFrame, SENSOR } from "./protocol";

export const RECORDER_FS = 200;
export const VAG_FS = 4000;

const DEG = (r: number) => (r * 180) / Math.PI;

function limbAngle(prev: number, gyroZDegS: number, ax: number, az: number, dt: number): number {
  const accTilt = DEG(Math.atan2(ax, az));
  return 0.97 * (prev + gyroZDegS * dt) + 0.03 * accTilt;
}

const WALK_SEC = 40;
const STS_SEC = 20;

export type Phase = "walk" | "sts" | "vag";

export class FrameRecorder {
  private phase: Phase = "idle" as Phase;
  private i = 0;
  private thighPitch = 0;
  private shankPitch = 0;
  private lastThighGz = 0;
  private lastShankGz = 0;
  private lastShankAz = 0;
  private lastKnee = 0;

  private walk = {
    knee: new Float64Array(WALK_SEC * RECORDER_FS),
    shankGyro: new Float64Array(WALK_SEC * RECORDER_FS),
    thighGyro: new Float64Array(WALK_SEC * RECORDER_FS),
    shankAcc: new Float64Array(WALK_SEC * RECORDER_FS),
  };

  private sts = {
    thighGyro: new Float64Array(STS_SEC * RECORDER_FS),
    trunk: new Float64Array(STS_SEC * RECORDER_FS),
  };

  private vag = new Float64Array(24000);
  private vagIdx = 0;
  private vagDone = false;
  private onVagDone: (() => void) | null = null;

  private t0 = 0;
  private framesSeen = 0;
  private crcFails = 0;
  private dropped = 0;

  reset(phase: Phase) {
    this.phase = phase;
    this.i = 0;
    this.thighPitch = 0;
    this.shankPitch = 0;
    this.lastThighGz = 0;
    this.lastShankGz = 0;
    this.lastShankAz = 0;
    this.lastKnee = 0;
    this.framesSeen = 0;
    this.crcFails = 0;
    this.dropped = 0;
    if (phase === "vag") {
      this.vagIdx = 0;
      this.vagDone = false;
      this.onVagDone = null;
      this.vag.fill(0);
    }
  }

  currentPhase(): Phase {
    return this.phase;
  }

  onFrame(f: DecodedFrame) {
    if (this.phase !== "walk" && this.phase !== "sts") return;
    if (!f.crcOk) {
      this.crcFails++;
      return;
    }
    if (this.i > 0 && f.seq !== ((this.lastSeq + 1) & 0xff)) this.dropped++;
    this.lastSeq = f.seq;
    this.framesSeen++;

    const i = this.i;
    if (this.phase === "walk") {
      if (f.sensor === SENSOR.thigh) {
        this.thighPitch = limbAngle(this.thighPitch, f.gz, f.ax, f.az, 1 / RECORDER_FS);
        this.walk.thighGyro[i] = f.gz;
        this.walk.shankGyro[i] = this.lastShankGz;
        this.walk.shankAcc[i] = this.lastShankAz;
        this.walk.knee[i] = this.lastKnee;
        this.lastThighGz = f.gz;
      } else {
        this.shankPitch = limbAngle(this.shankPitch, f.gz, f.ax, f.az, 1 / RECORDER_FS);
        const knee = this.thighPitch - this.shankPitch;
        this.walk.thighGyro[i] = this.lastThighGz;
        this.walk.shankGyro[i] = f.gz;
        this.walk.shankAcc[i] = f.az;
        this.walk.knee[i] = knee;
        this.lastKnee = knee;
        this.lastShankGz = f.gz;
        this.lastShankAz = f.az;
      }
    } else {
      const gz = f.gz;
      if (f.sensor === SENSOR.thigh) this.lastThighGz = gz;
      this.sts.thighGyro[i] = this.lastThighGz;
      this.sts.trunk[i] = this.lastThighGz;
    }
    this.i++;
  }

  private lastSeq = 0;

  onAcoustic(block: AcousticBlock) {
    if (this.phase !== "vag") return;
    if (!block.crcOk) {
      this.crcFails++;
      return;
    }
    for (let j = 0; j < block.samples.length && this.vagIdx < 24000; j++) {
      this.vag[this.vagIdx++] = block.samples[j];
    }
    if (block.last) {
      this.vagDone = true;
      if (this.onVagDone) this.onVagDone();
    }
  }

  waitAcousticDone(timeoutMs: number): Promise<boolean> {
    if (this.vagDone) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.onVagDone = () => resolve(true);
      setTimeout(() => {
        this.onVagDone = null;
        resolve(this.vagDone);
      }, timeoutMs);
    });
  }

  hasAcoustic(): boolean {
    return this.vagDone;
  }

  counts(): { framesSeen: number; crcFails: number; dropped: number } {
    return { framesSeen: this.framesSeen, crcFails: this.crcFails, dropped: this.dropped };
  }

  lastKneeDeg(): number {
    return this.lastKnee;
  }

  lastProfile(): number {
    return this.phase === "walk" || this.phase === "sts" ? this.lastShankGz : 0;
  }

  walkSignal() {
    const n = Math.max(2, Math.min(this.i, this.walk.knee.length));
    return {
      fs: RECORDER_FS,
      knee_angle: this.walk.knee.subarray(0, n),
      shank_gyro: this.walk.shankGyro.subarray(0, n),
      thigh_gyro: this.walk.thighGyro.subarray(0, n),
      shank_acc: this.walk.shankAcc.subarray(0, n),
    };
  }

  stsSignal() {
    const n = Math.max(2, Math.min(this.i, this.sts.thighGyro.length));
    return {
      fs: RECORDER_FS,
      thigh_gyro: this.sts.thighGyro.subarray(0, n),
      trunk_gyro: this.sts.trunk.subarray(0, n),
    };
  }

  vagSignal() {
    return { fs: VAG_FS, mic: this.vag.subarray(0, this.vagIdx) };
  }
}