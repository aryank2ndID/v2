import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Lang, t } from "../i18n";
import { StatusFrame } from "../lib/protocol";
import { C, S } from "../theme";
import { Button, Card, Screen, Title } from "../ui";

export type ConnState = "idle" | "connecting" | "connected" | "error";

export function ConnectScreen({
  lang,
  connState,
  connError,
  status,
  framesSeen,
  onConnectBle,
  onUseDemo,
  onContinue,
  onBack,
}: {
  lang: Lang;
  connState: ConnState;
  connError: string;
  status: StatusFrame | null;
  framesSeen: number;
  onConnectBle: () => void;
  onUseDemo: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const connected = connState === "connected";
  return (
    <Screen>
      <Title sub="One ESP32 kit, two thigh/shank IMU cuffs, one piezo microphone.">
        Kit
      </Title>

      <Card>
        <Text style={styles.text}>
          Demo mode replays a realistic walk / sit-to-stand joint-signal session
          so the full pipeline works with no hardware. BLE mode streams live
          frames from the ESP32 kit and needs a development build.
        </Text>
      </Card>

      <Button
        label={t(lang, "ui.demo_simulate")}
        onPress={onUseDemo}
        disabled={connState === "connecting"}
      />
      <Button
        label={
          connState === "connecting"
            ? t(lang, "ui.connecting")
            : connected
              ? `${t(lang, "ui.connected")} · ${status ? `${(status.batteryMv / 1000).toFixed(2)}V` : ""}`
              : t(lang, "ui.scan_ble")
        }
        onPress={onConnectBle}
        variant="ghost"
        disabled={connState === "connecting"}
      />

      {connected ? (
        <Card tone="low">
          <Text style={styles.ok}>
            Kit online — streaming {framesSeen} frames so far.
          </Text>
          <Text style={styles.note}>
            Mount cuffs: one on the thigh, one just below the knee, front of the
            limb, sensors facing up. Put the mic's piezo in contact with the
            kneecap.
          </Text>
        </Card>
      ) : null}

      {connState === "error" ? (
        <Card tone="refer">
          <Text style={styles.err}>{connError}</Text>
        </Card>
      ) : null}

      <Button label="Back" variant="ghost" onPress={onBack} />

      {connected ? (
        <Button
          label={t(lang, "ui.run_test")}
          onPress={onContinue}
          disabled={connState !== "connected"}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { color: C.sub, fontSize: 14, lineHeight: 20 },
  ok: { color: C.low, fontWeight: "700", fontSize: 14 },
  note: { color: C.sub, fontSize: 13, lineHeight: 18 },
  err: { color: C.danger, fontSize: 13 },
});