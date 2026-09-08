"use client";
/**
 * The nine ideas the product is built around (docs/usp.md), shown as a grid.
 *
 * Rule for this component: a title of three or four words and one line under
 * it. Anyone who wants the detail can open the console where the thing
 * actually lives — a landing page that explains a feature in a paragraph is a
 * landing page nobody finishes.
 */
import * as React from "react";
import Link from "next/link";
import {
  IcHistory, IcSpark, IcHeart, IcUsers, IcCloud, IcMap, IcCalendar, IcPhone, IcShield,
} from "./Icons";

type Owner = "patient" | "admin" | "business";

interface Usp {
  n: number;
  title: string;
  line: string;
  owner: Owner;
  Icon: (p: { size?: number }) => React.JSX.Element;
  /** Where the feature actually lives, once you are signed in. */
  href?: string;
}

const OWNER_LABEL: Record<Owner, string> = {
  patient: "Volunteer",
  admin: "Admin",
  business: "Product",
};
const OWNER_TONE: Record<Owner, string> = {
  patient: "sage",
  admin: "lilac",
  business: "amber",
};

export const USPS: Usp[] = [
  { n: 1, owner: "patient", Icon: IcHistory, href: "/volunteer",
    title: "Screened again, and again",
    line: "Every visit is kept, so improvement is something you can see." },
  { n: 3, owner: "patient", Icon: IcSpark, href: "/volunteer",
    title: "Advice, not a number",
    line: "The reading comes back as one sentence a person can act on." },
  { n: 4, owner: "patient", Icon: IcHeart, href: "/volunteer",
    title: "Exercises that talk back",
    line: "Guided movements in your own language, read aloud." },
  { n: 8, owner: "patient", Icon: IcCalendar, href: "/volunteer",
    title: "The nearest open slot",
    line: "Physiotherapy and hospital appointments, sorted by road distance." },
  { n: 6, owner: "patient", Icon: IcCloud, href: "/volunteer",
    title: "Better model when online",
    line: "The same capture is re-scored in the cloud once there's a bar." },
  { n: 9, owner: "patient", Icon: IcPhone, href: "/volunteer",
    title: "Someone to call",
    line: "National helplines, one tap, no data needed." },
  { n: 5, owner: "admin", Icon: IcUsers, href: "/admin",
    title: "Workers, matched to camps",
    line: "Who is free, who has a kit, who lives in that village." },
  { n: 7, owner: "admin", Icon: IcMap, href: "/admin",
    title: "Census by district",
    line: "Coverage measured against real adult population." },
  { n: 2, owner: "business", Icon: IcShield,
    title: "Make in India",
    line: "A ₹3,000 kit, designed and built here." },
];

export function UspGrid({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="grid g3 enter-list">
      {USPS.map((u, i) => {
        const inner = (
          <>
            <div className="between" style={{ gap: 10 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center",
                background: `var(--${OWNER_TONE[u.owner]}-bg)`,
                color: `var(--${OWNER_TONE[u.owner]}-ink)`,
                border: `1px solid var(--${OWNER_TONE[u.owner]}-line)`,
              }}><u.Icon size={16} /></span>
              <span className="tiny" style={{
                color: `var(--${OWNER_TONE[u.owner]}-ink)`, fontWeight: 650,
                letterSpacing: ".04em", textTransform: "uppercase", fontSize: 9.8,
              }}>{OWNER_LABEL[u.owner]}</span>
            </div>
            <h3 style={{ marginTop: 13, fontSize: 14.6 }}>{u.title}</h3>
            <p className="small dim" style={{ marginTop: 6, lineHeight: 1.5 }}>{u.line}</p>
          </>
        );

        const style: React.CSSProperties = { padding: "17px 18px", ["--i" as string]: i };

        // Only link where the visitor can actually get in; a link that bounces
        // to a sign-in page is worse than plain text.
        return signedIn && u.href
          ? <Link key={u.n} href={u.href} className="card lift" style={{ ...style, display: "block" }}>{inner}</Link>
          : <div key={u.n} className="card lift" style={style}>{inner}</div>;
      })}
    </div>
  );
}
