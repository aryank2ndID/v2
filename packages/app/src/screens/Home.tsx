import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Lang, t } from "../i18n";
import { C, S } from "../theme";
import { Button, Card, Screen, Title } from "../ui";

export function HomeScreen({
  lang,
  pendingCount,
  sentCount,
  connected,
  demoMode,
  onStart,
  onQueue,
  onSettings,
}: {
  lang: Lang;
  pendingCount: number;
  sentCount: number;
  connected: boolean;
  demoMode: boolean;
  onStart: () => void;
  onQueue: () => void;
  onSettings: () => void;
}) {
  return (
    <Screen>
      <Title sub="Synchronous Assessment & Nudge for Distal Heusus-Injury">
        SANDHI
      </Title>

      <Card>
        <Text style={styles.lede}>
          A 3-part knee screening: a timed walk, five sit-to-stands and a joint
          sound capture. Works fully offline; results sync when you reach the
          district server.
        </Text>
      </Card>

      <Button label={t(lang, "ui.scan")} onPress={onStart} />
      <Button
        label={`${t(lang, "ui.inbox")}${pendingCount ? `  (${pendingCount})` : ""}`}
        onPress={onQueue}
        variant="ghost"
      />

      <Card tone={demoMode ? "warn" : undefined}>
        <Text style={styles.row}>
          {demoMode ? "SIMULATED data source (no kit connected)" : "Kit: ready"}
        </Text>
        <Text style={styles.row}>
          {pendingCount === 0 && sentCount === 0
            ? "No screenings yet - the queue stays empty until you run one."
            : `${sentCount} uploaded · ${pendingCount} waiting for network`}
        </Text>
      </Card>

      <View style={styles.foot}>
        <Text style={styles.version}>{t(lang, "ui.version")}</Text>
        <Text style={styles.version}>·</Text>
        <Text style={[styles.version, styles.link]} onPress={onSettings}>
          {t(lang, "ui.settings")}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { color: C.sub, fontSize: 15, lineHeight: 22 },
  row: { color: C.sub, fontSize: 13, lineHeight: 18 },
  foot: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 },
  version: { color: C.sub, fontSize: 12 },
  link: { color: C.accent, textDecorationLine: "underline" },
});