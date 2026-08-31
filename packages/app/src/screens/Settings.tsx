import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Lang, LOCALE_NAMES, t } from "../i18n";
import { C, S } from "../theme";
import { Button, Card, ChipRow, Field, Screen, Title } from "../ui";

export function SettingsScreen({
  lang,
  setLang,
  serverUrl,
  setServerUrl,
  mode,
  setMode,
  onHome,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  serverUrl: string;
  setServerUrl: (u: string) => void;
  mode: "sim" | "ble";
  setMode: (m: "sim" | "ble") => void;
  onHome: () => void;
}) {
  return (
    <Screen>
      <Title>{t(lang, "ui.settings")}</Title>

      <Card>
        <Field label={t(lang, "ui.language")}>
          <ChipRow
            options={["en", "as", "hi"] as Lang[]}
            selected={lang}
            render={(l) => LOCALE_NAMES[l]}
            onSelect={setLang}
          />
        </Field>
      </Card>

      <Card>
        <Field label={t(lang, "ui.kit_source")}>
          <ChipRow
            options={["sim", "ble"]}
            selected={mode}
            render={(m) => (m === "sim" ? "Demo simulator" : "BLE kit (ESP32)")}
            onSelect={(m) => setMode(m as "sim" | "ble")}
          />
        </Field>
      </Card>

      <Card>
        <Field label={t(lang, "ui.server_url")}>
          <TextInput
            style={styles.input}
            value={serverUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setServerUrl}
          />
        </Field>
        <Text style={styles.hint}>
          The district Go server. Android emulator reaching the host machine uses
          10.0.2.2 instead of localhost.
        </Text>
      </Card>

      <Button label={t(lang, "ui.back_home")} variant="ghost" onPress={onHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.card2,
    borderRadius: S.radiusSm,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: { color: C.sub, fontSize: 12, lineHeight: 17 },
});