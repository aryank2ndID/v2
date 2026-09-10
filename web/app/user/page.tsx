"use client";
/**
 * The patient's own console.
 *
 * Everything a volunteer's console does for the person in front of them, this
 * does for yourself: run the same kit-and-camera screening on your own knees,
 * find the nearest physiotherapist or hospital, and know who to call. No
 * ASHA worker has to be in the room — the phone in your hand is the kit.
 */
import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, PageHead, Empty, SimBadge } from "@/components/ui";
import { Tabs, TabPanel } from "@/components/Segmented";
import { useAuth } from "@/lib/auth";
import { useSandhi } from "@/lib/store";
import { facilitiesFor, HELPLINES, KIND_LABEL, KIND_CHIP, type Facility } from "@/lib/data/care";
import { usePoseCamera } from "@/lib/usePoseCamera";
import {
  IcScreen, IcCamera, IcCalendar, IcPhone, IcArrow, IcPin, IcClock,
  IcCheck, IcHeart, IcUser,
} from "@/components/Icons";

type Tab = "screen" | "care" | "help";

const TABS = [
  { id: "screen" as const, label: "Screen myself", Icon: IcScreen },
  { id: "care" as const, label: "Appointments", Icon: IcCalendar },
  { id: "help" as const, label: "Helpline", Icon: IcPhone },
];

const FALLBACK_DISTRICT = { id: "AS-JOR", name: "Jorhat", state: "Assam", terrain: 0.55, phc: 6 };

export default function UserConsole() {
  const { session } = useAuth();
  const { cohort } = useSandhi();
  const [tab, setTab] = React.useState<Tab>("screen");

  // Your own district if it is one we have a facility list for, otherwise the
  // first district in the cohort so the page still has something real to show.
  const district = React.useMemo(() => {
    const list = cohort?.districts ?? [];
    return list.find((d) => d.id === session?.district) ?? list[0] ?? FALLBACK_DISTRICT;
  }, [cohort, session]);

  const firstName = session?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <TopBar title="My health" right={<Chip tone="chip-sky">self-screening</Chip>} />
      <div className="page">
        <PageHead
          eyebrow="Welcome back"
          title={`Hi, ${firstName}`}
          lead="Screen your own knees with the kit and your phone's camera, find the nearest physiotherapist, or call a helpline — all from here."
        />

        <Tabs label="My health sections" value={tab} onChange={setTab} items={TABS} />

        <div style={{ marginTop: 20 }}>
          {tab === "screen" && <TabPanel id="screen"><ScreenTab /></TabPanel>}
          {tab === "care" && <TabPanel id="care"><CareTab district={district} /></TabPanel>}
          {tab === "help" && <TabPanel id="help"><HelpTab /></TabPanel>}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------- screen myself -- */

function ScreenTab() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card className="enter">
        <div className="card-bd" style={{
          display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ maxWidth: 520 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Takes about 3 minutes</div>
            <h2 style={{ fontSize: 20 }}>Ready to check your knees?</h2>
            <p className="small muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              Strap on the kit, walk for thirty seconds, then sit and stand five times. Your
              phone's camera watches your posture while the sensors feel the swing — no clinic,
              no waiting room, no doctor needed to start.
            </p>
          </div>
          <Link href="/screening" className="btn btn-primary btn-lg">
            <IcScreen size={15} />Start my screening<IcArrow size={13} />
          </Link>
        </div>
      </Card>

      <QuickCameraCheck />

      <SimBadge
        what="Sensor stream is emulated."
        why="No physical kit is attached to this device yet. The screening flow, camera check and scoring are exactly the code a real kit would drive."
      />
    </div>
  );
}

/** A standalone posture check — the same pose engine the screening flow
    uses, without needing to start a full session first. */
function QuickCameraCheck() {
  const cam = usePoseCamera();
  const live = cam.phase === "live";
  const fmt = (v: number | null) => (v === null ? "—" : `${Math.round(v)}°`);

  return (
    <Card>
      <CardHead
        title="Quick posture check"
        sub="Point the camera at your legs — your knee angle updates live, on this device"
        icon={<IcCamera size={15} />}
        right={live
          ? <Chip tone="chip-sage"><span className="dot pulse" />live</Chip>
          : <Chip>camera off</Chip>}
      />
      <div className="card-bd">
        <div style={{
          position: "relative", borderRadius: "var(--r)", overflow: "hidden",
          background: "#0A1520", aspectRatio: "16 / 10", border: "1px solid var(--line)",
        }}>
          <video ref={cam.videoRef} playsInline muted style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)", display: live ? "block" : "none",
          }} />
          <canvas ref={cam.canvasRef} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)", display: live ? "block" : "none",
          }} />

          {!live && (
            <div style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              textAlign: "center", padding: 22, color: "rgba(255,255,255,.62)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 620, color: "rgba(255,255,255,.88)" }}>
                  {cam.phase === "loading" ? "Opening the camera…" : "Camera is off"}
                </div>
                <div style={{ fontSize: 12.2, marginTop: 6, lineHeight: 1.55, maxWidth: 280 }}>
                  {cam.note ?? "Stand back so your whole body is in frame, then bend a knee."}
                </div>
              </div>
            </div>
          )}

          {live && (
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Readout k="Left knee" v={fmt(cam.angles.left)} />
              <Readout k="Right knee" v={fmt(cam.angles.right)} />
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 9, marginTop: 12, flexWrap: "wrap" }}>
          {live ? (
            <button className="btn btn-sm" onClick={cam.stop}>Turn camera off</button>
          ) : (
            <button className="btn btn-sm btn-accent" onClick={cam.start} disabled={cam.phase === "loading"}>
              <IcCamera size={13} />{cam.phase === "loading" ? "Starting…" : "Turn on the camera"}
            </button>
          )}
          <span className="tiny dim" style={{ flex: "1 1 200px" }}>
            Nothing is recorded or sent anywhere — this stays on your device.
          </span>
        </div>
      </div>
    </Card>
  );
}

function Readout({ k, v }: { k: string; v: string }) {
  return (
    <div style={{
      background: "rgba(6,20,17,.66)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "7px 12px", color: "#fff",
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 750, letterSpacing: ".12em", textTransform: "uppercase", opacity: .6 }}>{k}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{v}</div>
    </div>
  );
}

/* ---------------------------------------------------------- appointments -- */

function CareTab({ district }: { district: { id: string; name: string; state: string; terrain: number; phc: number } }) {
  const facilities = React.useMemo(() => facilitiesFor(district), [district]);
  const [booked, setBooked] = React.useState<Record<string, number>>({});

  return (
    <Card className="enter">
      <CardHead
        title="Nearest care"
        sub={`${district.name}, ${district.state} — sorted by road distance`}
        icon={<IcPin size={15} />}
      />
      <div className="card-bd">
        {facilities.length === 0 ? <Empty>No facilities listed for this district yet.</Empty> : (
          <div className="stack enter-list" style={{ gap: 10 }}>
            {facilities.map((f, i) => (
              <FacilityRow
                key={f.id} f={f} i={i}
                bookedIn={booked[f.id]}
                onBook={() => setBooked((b) => ({ ...b, [f.id]: f.nextSlotDays }))}
              />
            ))}
          </div>
        )}
      </div>
      <div className="card-ft">
        Distances and slots are demo values. In deployment this table comes from the state health directory.
      </div>
    </Card>
  );
}

function FacilityRow({ f, i, bookedIn, onBook }: {
  f: Facility; i: number; bookedIn?: number; onBook: () => void;
}) {
  return (
    <div className="card card-quiet lift" style={{ padding: "13px 15px", ["--i" as string]: i }}>
      <div className="between wrap" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <span style={{
            width: 36, height: 36, flex: "0 0 36px", borderRadius: 12, display: "grid", placeItems: "center",
            background: "var(--surface-3)", color: "var(--ink-2)",
          }}>
            {f.kind === "physio" ? <IcHeart size={16} /> : f.kind === "district" ? <IcPin size={16} /> : <IcUser size={16} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span style={{ fontSize: 13.8, fontWeight: 640 }}>{f.name}</span>
              <Chip tone={KIND_CHIP[f.kind]} style={{ fontSize: 10.4, padding: "2px 8px" }}>{KIND_LABEL[f.kind]}</Chip>
              {f.xray && <Chip style={{ fontSize: 10.4, padding: "2px 8px" }}>X-ray</Chip>}
            </div>
            <div className="row wrap dim" style={{ gap: 12, marginTop: 5, fontSize: 12.2 }}>
              <span className="row" style={{ gap: 4 }}><IcPin size={11} />{f.km} km</span>
              <span className="row" style={{ gap: 4 }}><IcClock size={11} />~{f.travelMin} min</span>
              <span className="row" style={{ gap: 4 }}><IcCalendar size={11} />{f.days.join(" ")}</span>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 9 }}>
          <a className="btn btn-sm" href={`tel:${f.phone.replace(/\s/g, "")}`}>
            <IcPhone size={12} />Call
          </a>
          {bookedIn === undefined ? (
            <button className="btn btn-sm btn-primary" onClick={onBook}>
              {f.nextSlotDays === 0 ? "Book today" : `Book in ${f.nextSlotDays}d`}
            </button>
          ) : (
            <span className="chip chip-sage enter"><IcCheck size={11} />
              {bookedIn === 0 ? "Booked today" : `Booked in ${bookedIn}d`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- helpline -- */

function HelpTab() {
  return (
    <Card className="enter">
      <CardHead title="Helplines" sub="National, toll-free, and answered in regional languages" icon={<IcPhone size={15} />} />
      <div className="card-bd">
        <div className="grid g3 enter-list">
          {HELPLINES.map((h, i) => (
            <a
              key={h.number} href={`tel:${h.number}`}
              className="card lift" style={{
                padding: 18, display: "block", ["--i" as string]: i,
                background: h.urgent ? "var(--clay-bg)" : "var(--surface)",
                borderColor: h.urgent ? "var(--clay-line)" : "var(--line)",
              }}
            >
              <div className="row" style={{ gap: 9 }}>
                <span style={{
                  width: 30, height: 30, flex: "0 0 30px", borderRadius: 10, display: "grid", placeItems: "center",
                  background: h.urgent ? "var(--clay-line)" : "var(--accent-soft)",
                  color: h.urgent ? "var(--clay-ink)" : "var(--accent)",
                }}><IcPhone size={14} /></span>
                <span className="serif num" style={{
                  fontSize: 27, letterSpacing: "-0.02em",
                  color: h.urgent ? "var(--clay-ink)" : "var(--ink)",
                }}>{h.number}</span>
              </div>
              <div style={{ fontSize: 13.6, fontWeight: 640, marginTop: 11 }}>{h.name}</div>
              <div className="tiny dim" style={{ marginTop: 5, lineHeight: 1.5 }}>{h.detail}</div>
              {h.languages && <Chip style={{ marginTop: 10, fontSize: 10.4, padding: "2px 8px" }}>{h.languages}</Chip>}
            </a>
          ))}
        </div>
      </div>
      <div className="card-ft">Tap a number to dial. These work without data — only a voice line is needed.</div>
    </Card>
  );
}
