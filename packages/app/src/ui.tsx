/**
 * SANDHI - shared UI atoms. No icon or chart libraries; everything is Views,
 * Text and a few scroll strips for the live waveform / progress traces.
 */
import React, { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { C, S } from "./theme";

export function Screen({
  children,
  scroll,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  if (scroll)
    return (
      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={[styles.screen, style]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  tone,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: keyof typeof C;
}) {
  return (
    <View
      style={[
        styles.card,
        tone ? { borderColor: C[tone], borderWidth: 1 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{children}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const bg =
    variant === "primary"
      ? C.accent
      : variant === "danger"
        ? C.danger
        : C.card2;
  const fg = variant === "ghost" ? C.text : C.onAccent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.btn, { backgroundColor: bg }, disabled ? { opacity: 0.4 } : null]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow<T>({
  options,
  selected,
  onSelect,
  render,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o, i) => {
        const sel = o === selected;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelect(o)}
            style={[styles.chip, sel ? { backgroundColor: C.chipSel } : null]}
          >
            <Text style={[styles.chipText, sel ? { color: "#fff" } : null]}>
              {render(o)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const ticks = 9;
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>
          {value}
          {suffix ?? ""}
        </Text>
      </View>
      <View style={styles.sliderTrack}>
        {Array.from({ length: ticks }, (_, i) => {
          const v = min + ((max - min) * i) / (ticks - 1);
          const active = value >= v - step / 2;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onChange(Math.round(v / step) * step)}
              style={[
                styles.tick,
                active ? { backgroundColor: C.accent } : { backgroundColor: C.line },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min ?? 1, value - 1))}>
        <Text style={styles.stepText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max ?? 999, value + 1))}>
        <Text style={styles.stepText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ProgressBar({ frac, tone }: { frac: number; tone?: string }) {
  return (
    <View style={styles.progress}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.min(100, Math.max(0, frac * 100))}%`,
            backgroundColor: tone ?? C.accent,
          },
        ]}
      />
    </View>
  );
}

export function Wave({ values, height = 44 }: { values: ArrayLike<number>; height?: number }) {
  const n = Math.min(values.length, 96);
  const bars = useRef<number[]>([]).current;
  bars.length = 0;
  if (n === 0) {
    for (let i = 0; i < 96; i++) bars.push(0);
  } else {
    for (let i = 0; i < 96; i++) bars.push(values[Math.floor((i / 96) * n)]);
  }
  const max = bars.some((v) => v !== 0)
    ? Math.max(1, ...bars.map((v) => Math.abs(v)))
    : 1;
  return (
    <View style={[styles.wave, { height }]}>
      {bars.map((v, i) => {
        const h = Math.max(2, Math.min(0.9, Math.abs(v) / max) * height);
        return (
          <View
            key={i}
            style={{
              width: 2,
              height: h,
              borderRadius: 1,
              backgroundColor: C.accent,
              opacity: 0.5 + 0.5 * (h / height),
            }}
          />
        );
      })}
    </View>
  );
}

export function Separator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: C.bg, padding: S.pad, gap: S.gap },
  card: {
    backgroundColor: C.card,
    borderRadius: S.radius,
    padding: S.pad,
    gap: 8,
  },
  titleWrap: { marginTop: 8, marginBottom: 4, gap: 4 },
  title: { color: C.text, fontSize: 24, fontWeight: "700" },
  sub: { color: C.sub, fontSize: 13, lineHeight: 18 },
  btn: {
    borderRadius: S.radiusSm,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.chip,
  },
  chipText: { color: C.text, fontSize: 14, fontWeight: "600" },
  field: { gap: 6 },
  fieldHead: { flexDirection: "row", justifyContent: "space-between" },
  fieldLabel: { color: C.sub, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { color: C.text, fontSize: 13, fontWeight: "700" },
  sliderTrack: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6 },
  tick: { flex: 1, height: 10, borderRadius: 5 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.card2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: C.text, fontSize: 22, fontWeight: "700" },
  stepValue: { color: C.text, fontSize: 18, fontWeight: "700", minWidth: 40, textAlign: "center" },
  progress: { height: 8, borderRadius: 4, backgroundColor: C.line, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  wave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.card2,
    borderRadius: S.radiusSm,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },
});