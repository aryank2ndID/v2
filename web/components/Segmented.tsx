"use client";
/**
 * The two pill controls the app uses everywhere, kept apart because they mean
 * different things to a screen reader.
 *
 *  <Tabs>    switches which panel is shown. That is the ARIA tab pattern, and
 *            the pattern requires arrow-key navigation with a roving tabindex —
 *            `role="tab"` without it announces a widget the keyboard cannot
 *            actually drive.
 *
 *  <Choice>  filters what is already shown. Those are toggle buttons, so they
 *            carry `aria-pressed`. Marking them `aria-selected` would promise a
 *            tab panel that does not exist.
 */
import * as React from "react";

export interface SegItem<T extends string> {
  id: T;
  label: string;
  Icon?: (p: { size?: number }) => React.JSX.Element;
}

export function Tabs<T extends string>({ items, value, onChange, label }: {
  items: SegItem<T>[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = items.findIndex((x) => x.id === value);
    const next =
      e.key === "Home" ? 0 :
      e.key === "End" ? items.length - 1 :
      e.key === "ArrowRight" ? (i + 1) % items.length :
      (i - 1 + items.length) % items.length;
    onChange(items[next].id);
    // move focus with the selection, as the tab pattern expects
    ref.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  return (
    <div className="seg" role="tablist" aria-label={label} ref={ref} onKeyDown={onKeyDown}>
      {items.map(({ id, label: text, Icon }) => {
        const on = id === value;
        return (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={on}
            aria-controls={`panel-${id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(id)}
          >
            {Icon && <Icon size={14} />}{text}
          </button>
        );
      })}
    </div>
  );
}

/** The panel a <Tabs> switches to. Pair the ids so the two are linked. */
export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={-1}>
      {children}
    </div>
  );
}

/** A filter row: independent toggles, not a tab strip. */
export function Choice<T extends string>({ items, value, onChange, label }: {
  items: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          // `.seg` styles the active pill off aria-selected, so mirror it here
          // as a data attribute the stylesheet also matches.
          data-on={value === id ? "true" : undefined}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
