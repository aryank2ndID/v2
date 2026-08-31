import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { core, Lang, t } from "../i18n";
import { ScoreOutcome } from "../store";
import { C, S } from "../theme";
import { Button, Card, Screen, Title } from "../ui";

const BAND_COLOR = { low: C.low, watch: C.watch, refer: C.refer } as const;
const BAND_NAME = { low: "Low", watch: "Moderate", refer: "High" } as const;

export function ResultScreen({
  lang,
  outcome,
  saved,
  saveBusy,
  syncState,
  onSave,
  onSync,
  onHome,
  onRetest,
  onQueue,
}: {
  lang: Lang;
  outcome: ScoreOutcome;
  saved: boolean;
  saveBusy: boolean;
  syncState: "idle" | "syncing" | "ok" | "fail";
  onSave: () => Promise<void>;
  onSync: () => Promise<void>;
  onHome: () => void;
  onRetest: () => void;
  onQueue: () => void;
}) {
  const color = BAND_COLOR[outcome.band];
  return (
    <Screen scroll>
      <Title sub={outcome.client_id}>Report</Title>

      <Card tone={outcome.band}>
        <View style={styles.bandLine}>
          <View style={[styles.bandDot, { backgroundColor: color }]} />
          <Text style={[styles.bandText, { color }]}>
            {BAND_NAME[outcome.band]} {core(lang, "app.title").toLowerCase()}
          </Text>
        </View>
        <Text style={styles.score}>
          {Math.round(outcome.risk * 100)}%
        </Text>
        <Text style={styles.sub}>
          {t(lang, "ui.risk_score")} — model says {bandOf(outcome.risk)}
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t(lang, "ui.indicators")}</Text>
        {outcome.explanation.length === 0 ? (
          <Text style={styles.sub}>—</Text>
        ) : (
          outcome.explanation.map((e, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowName}>{e.feature}</Text>
              <Text style={[styles.rowDir, { color: e.direction === "raises" ? C.danger : C.low }]}>
                {e.direction === "raises" ? "▲" : "▼"} {e.contribution.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t(lang, "ui.guidance")}</Text>
        {outcome.guidanceKeys.map((k, i) => (
          <Text key={i} style={styles.bullet}>
            · {core(lang, k)}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t(lang, "ui.recommendation")}</Text>
        {outcome.recommendationKeys.map((k, i) => (
          <Text key={i} style={[styles.bullet, { fontWeight: "700", color: C.text }]}>
            · {core(lang, k)}
          </Text>
        ))}
        <Text style={styles.disclaimer}>{core(lang, "disclaimer.not_a_diagnosis")}</Text>
      </Card>

      <Button
        label={
          saved
            ? t(lang, "ui.queued")
            : saveBusy
              ? "…"
              : `${t(lang, "ui.save")}  ·  ${outcome.features["cadence_spm"]?.toFixed(0) ?? "-"} spm`
        }
        onPress={saved ? () => undefined : () => onSave()}
        disabled={saved || saveBusy}
      />

      <Button
        label={
          syncState === "ok"
            ? `✓ ${t(lang, "ui.sync_ok")}`
            : syncState === "fail"
              ? `${t(lang, "ui.sync_fail")}`
              : syncState === "syncing"
                ? "…"
                : t(lang, "ui.sync_now")
        }
        variant="ghost"
        onPress={() => !saved && onSync()}
        disabled={!saved || syncState === "syncing"}
      />

      <Button label={t(lang, "ui.back_home")} variant="ghost" onPress={onHome} />
      <Button label={t(lang, "ui.retest")} variant="ghost" onPress={onRetest} />
    </Screen>
  );
}

function bandOf(risk: number): string {
  return risk >= 0.5 ? "≥ 0.50" : risk >= 0.25 ? "0.25–0.50" : "< 0.25";
}

const styles = StyleSheet.create({
  bandLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  bandDot: { width: 12, height: 12, borderRadius: 6 },
  bandText: { fontSize: 16, fontWeight: "800", textTransform: "uppercase" },
  score: { color: C.text, fontSize: 44, fontWeight: "900" },
  sub: { color: C.sub, fontSize: 13 },
  cardTitle: {
    color: C.text,
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowName: { color: C.sub, fontSize: 13, flexShrink: 1 },
  rowDir: { fontSize: 13, fontWeight: "700" },
  bullet: { color: C.sub, fontSize: 14, lineHeight: 21 },
  disclaimer: { color: C.sub, fontSize: 12, fontStyle: "italic", lineHeight: 17 },
});