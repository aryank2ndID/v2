import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreeningRecord } from "../db";
import { core, Lang, t } from "../i18n";
import { C, S } from "../theme";
import { Button, Card, Screen, Title } from "../ui";

function stateColor(state: ScreeningRecord["state"]) {
  return state === "sent" ? C.low : state === "failed" ? C.danger : state === "sending" ? C.watch : C.sub;
}

const STATE_LABEL: Record<ScreeningRecord["state"], string> = {
  queued: "queued",
  sending: "sending…",
  sent: "synced",
  failed: "retry needed",
};

export function QueueScreen({
  lang,
  items,
  syncState,
  onSyncAll,
  refreshPending,
  onHome,
}: {
  lang: Lang;
  items: ScreeningRecord[];
  syncState: "idle" | "syncing" | "ok" | "fail";
  onSyncAll: () => Promise<void>;
  refreshPending: () => void;
  onHome: () => void;
}) {
  const pending = items.filter((r) => r.state !== "sent").length;
  return (
    <Screen>
      <Title
        sub={`${pending} ${t(lang, "ui.sync_pending")}${items.length ? "" : " — " + t(lang, "ui.empty_queue")}`}
      >
        {t(lang, "ui.inbox")}
      </Title>

      {items.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{t(lang, "ui.empty_queue")}</Text>
        </Card>
      ) : (
        items.map((r) => (
          <Card key={r.client_id}>
            <View style={styles.head}>
              <Text style={styles.name}>{r.patient || r.client_id}</Text>
              <Text style={[styles.state, { color: stateColor(r.state) }]}>
                {STATE_LABEL[r.state]}
              </Text>
            </View>
            <Text style={styles.meta}>
              {r.district} · {new Date(r.captured_at).toLocaleString()}
            </Text>
            <View style={styles.bandRow}>
              <Text style={[styles.band, { color: C[`${r.band}` as "low" | "watch" | "refer"] }]}>
                {r.band === "refer" ? "HIGH" : r.band === "watch" ? "MODERATE" : "LOW"}
              </Text>
              <Text style={styles.risk}>risk {Math.round(r.risk * 100)}%</Text>
            </View>
          </Card>
        ))
      )}

      <Button
        label={
          syncState === "syncing"
            ? "…"
            : syncState === "ok"
              ? `✓ ${t(lang, "ui.sync_ok")}`
              : syncState === "fail"
                ? `${t(lang, "ui.sync_fail")} — ${t(lang, "ui.sync_now")}`
                : t(lang, "ui.sync_now")
        }
        onPress={() => onSyncAll()}
        disabled={pending === 0 || syncState === "syncing"}
      />
      <Button label={t(lang, "ui.back_home")} variant="ghost" onPress={onHome} />
      <Text style={styles.peer} onPress={refreshPending}>
        refresh pending view
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: C.sub, fontSize: 14 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { color: C.text, fontWeight: "700", fontSize: 15, flexShrink: 1 },
  state: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: C.sub, fontSize: 12 },
  bandRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  band: { fontWeight: "800", fontSize: 14 },
  risk: { color: C.sub, fontSize: 12 },
  peer: { color: C.accent, fontSize: 12, textAlign: "center", textDecorationLine: "underline" },
});