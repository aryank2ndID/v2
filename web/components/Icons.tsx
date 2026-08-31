/** Hairline icon set — 1.5px strokes on a 16px grid, drawn to match the UI weight. */
import * as React from "react";

type P = React.SVGProps<SVGSVGElement> & { size?: number };

const Base = ({ size = 16, children, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
       stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"
       strokeLinejoin="round" {...p}>{children}</svg>
);

export const IcOverview = (p: P) => (<Base {...p}><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></Base>);
export const IcScreen = (p: P) => (<Base {...p}><rect x="4" y="1.5" width="8" height="13" rx="1.8"/><path d="M6.8 12.4h2.4"/></Base>);
export const IcKit = (p: P) => (<Base {...p}><rect x="1.8" y="4.5" width="12.4" height="7" rx="1.6"/><path d="M4.6 4.5V3.2M11.4 4.5V3.2M5 8h1.6M9.4 8H11"/></Base>);
export const IcDash = (p: P) => (<Base {...p}><path d="M2 13.2h12"/><path d="M4 13V8.4M7.3 13V4.6M10.6 13V7M13.6 13V10"/></Base>);
export const IcRegistry = (p: P) => (<Base {...p}><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.6"/><path d="M2.2 6h11.6M6 6v7.8"/></Base>);
export const IcModel = (p: P) => (<Base {...p}><circle cx="8" cy="3.4" r="1.7"/><circle cx="3.4" cy="12" r="1.7"/><circle cx="12.6" cy="12" r="1.7"/><path d="M6.9 4.8 4.5 10.4M9.1 4.8l2.4 5.6M5.1 12h5.8"/></Base>);
export const IcSystem = (p: P) => (<Base {...p}><rect x="2" y="2.2" width="12" height="4" rx="1.2"/><rect x="2" y="9.8" width="12" height="4" rx="1.2"/><path d="M8 6.2v3.6"/></Base>);
export const IcWifi = (p: P) => (<Base {...p}><path d="M1.6 5.6a9 9 0 0 1 12.8 0"/><path d="M4 8.2a5.6 5.6 0 0 1 8 0"/><path d="M6.4 10.8a2.3 2.3 0 0 1 3.2 0"/><circle cx="8" cy="13" r=".7" fill="currentColor"/></Base>);
export const IcWifiOff = (p: P) => (<Base {...p}><path d="M2 2l12 12"/><path d="M1.6 5.6a9 9 0 0 1 3.6-2.2M10.4 3a9 9 0 0 1 4 2.6"/><path d="M4 8.2a5.6 5.6 0 0 1 2-1.3M11.4 7.4c.2.2.4.5.6.8"/><circle cx="8" cy="13" r=".7" fill="currentColor"/></Base>);
export const IcSync = (p: P) => (<Base {...p}><path d="M13.6 7A5.6 5.6 0 0 0 3.3 4.6"/><path d="M2.4 9A5.6 5.6 0 0 0 12.7 11.4"/><path d="M2.6 2.2v2.6h2.6M13.4 13.8v-2.6h-2.6"/></Base>);
export const IcCheck = (p: P) => (<Base {...p}><path d="M3 8.4l3.2 3.2L13 4.8"/></Base>);
export const IcAlert = (p: P) => (<Base {...p}><path d="M8 2.6 14.4 13H1.6L8 2.6Z"/><path d="M8 6.6v3M8 11.4h.01"/></Base>);
export const IcArrow = (p: P) => (<Base {...p}><path d="M3 8h10M9 4l4 4-4 4"/></Base>);
export const IcChevron = (p: P) => (<Base {...p}><path d="M6 3.5 10.5 8 6 12.5"/></Base>);
export const IcClose = (p: P) => (<Base {...p}><path d="M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4"/></Base>);
export const IcPlay = (p: P) => (<Base {...p}><path d="M4.6 2.9 12.6 8l-8 5.1V2.9Z" fill="currentColor" strokeWidth={1.2}/></Base>);
export const IcPause = (p: P) => (<Base {...p}><rect x="4.2" y="3" width="2.6" height="10" rx=".9" fill="currentColor" stroke="none"/><rect x="9.2" y="3" width="2.6" height="10" rx=".9" fill="currentColor" stroke="none"/></Base>);
export const IcBattery = (p: P) => (<Base {...p}><rect x="1.4" y="5" width="11.4" height="6" rx="1.5"/><path d="M14.4 7.2v1.6"/></Base>);
export const IcBluetooth = (p: P) => (<Base {...p}><path d="M5 4.6 11 11.4 8 14V2l3 2.6L5 11.4"/></Base>);
export const IcSpark = (p: P) => (<Base {...p}><path d="M8 1.6v3M8 11.4v3M1.6 8h3M11.4 8h3M3.6 3.6l2.1 2.1M10.3 10.3l2.1 2.1M12.4 3.6l-2.1 2.1M5.7 10.3l-2.1 2.1"/></Base>);
export const IcPin = (p: P) => (<Base {...p}><path d="M8 14.4s5-4.3 5-8A5 5 0 0 0 3 6.4c0 3.7 5 8 5 8Z"/><circle cx="8" cy="6.3" r="1.9"/></Base>);
export const IcDoc = (p: P) => (<Base {...p}><path d="M9 1.8H4.4A1.4 1.4 0 0 0 3 3.2v9.6a1.4 1.4 0 0 0 1.4 1.4h7.2a1.4 1.4 0 0 0 1.4-1.4V5.8L9 1.8Z"/><path d="M9 1.8v4h4"/></Base>);
export const IcFlask = (p: P) => (<Base {...p}><path d="M6.2 1.8v4.4L2.6 12a1.4 1.4 0 0 0 1.2 2.2h8.4A1.4 1.4 0 0 0 13.4 12L9.8 6.2V1.8"/><path d="M5.4 1.8h5.2M4.4 9.6h7.2"/></Base>);
export const IcUser = (p: P) => (<Base {...p}><circle cx="8" cy="5.4" r="2.7"/><path d="M2.9 13.6a5.4 5.4 0 0 1 10.2 0"/></Base>);
export const IcClock = (p: P) => (<Base {...p}><circle cx="8" cy="8" r="6.2"/><path d="M8 4.4V8l2.4 1.6"/></Base>);
export const IcDownload = (p: P) => (<Base {...p}><path d="M8 2.2v8M4.8 7l3.2 3.2L11.2 7"/><path d="M2.6 13.4h10.8"/></Base>);
export const IcFilter = (p: P) => (<Base {...p}><path d="M2 3.6h12L9.4 8.4v4.4l-2.8 1.2V8.4L2 3.6Z"/></Base>);
