import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Lang, t } from "../i18n";
import { defaultIntake, Intake, occupationFor } from "../store";
import { OCCUPATIONS } from "../lib/simulator";
import { C, S } from "../theme";
import {
  Button,
  Card,
  ChipRow,
  Field,
  NumInput,
  Screen,
  SliderRow,
  Title,
} from "../ui";

export function IntakeScreen({
  lang,
  intake,
  onChange,
  onNext,
}: {
  lang: Lang;
  intake: Intake;
  onChange: (p: Partial<Intake>) => void;
  onNext: () => void;
}) {
  const [error, setError] = useState("");

  function pickOccupation(name: string) {
    const occ = occupationFor(name);
    onChange({ occupation: name, ...occ });
  }

  return (
    <Screen scroll>
      <Title
        sub="Sets the intake features the model scores alongside the physical test."
      >
        {t(lang, "ui.scan")}
      </Title>

      <Card>
        <Field label={t(lang, "ui.patient")}>
          <TextInput
            style={styles.input}
            value={intake.patient}
            placeholder="e.g. M. Das"
            placeholderTextColor={C.sub}
            onChangeText={(v) => onChange({ patient: v })}
          />
        </Field>
        <Field label={t(lang, "ui.district")}>
          <TextInput
            style={styles.input}
            value={intake.district}
            placeholder="e.g. Kamrup"
            placeholderTextColor={C.sub}
            onChangeText={(v) => onChange({ district: v })}
          />
        </Field>
      </Card>

      <Card>
        <View style={styles.twoCol}>
          <Field label={t(lang, "ui.age")}>
            <NumInput
              value={intake.age}
              min={18}
              max={90}
              onChange={(v) => onChange({ age: v })}
            />
          </Field>
          <View style={styles.grow}>
            <Field label={t(lang, "ui.sex")}>
              <ChipRow
                options={["M", "F"] as const}
                selected={intake.sex}
                render={(s) => (s === "M" ? "Male" : "Female")}
                onSelect={(v) => onChange({ sex: v })}
              />
            </Field>
          </View>
        </View>

        <Field label={t(lang, "ui.bmi")}>
          <NumInput
            value={intake.bmi}
            min={15}
            max={45}
            onChange={(v) => onChange({ bmi: v })}
          />
        </Field>
      </Card>

      <Card>
        <Field label={t(lang, "ui.occupation")}>
          <View style={styles.chips}>
            {OCCUPATIONS.map((o) => (
              <Text
                key={o.name}
                onPress={() => pickOccupation(o.name)}
                style={[
                  styles.occChip,
                  intake.occupation === o.name && styles.occChipSel,
                ]}
              >
                {o.name}
              </Text>
            ))}
          </View>
        </Field>
      </Card>

      <Card>
        <Field label={t(lang, "ui.prior_injury")}>
          <ChipRow
            options={[0, 1] as const}
            selected={intake.prior_injury as 0 | 1}
            render={(v) => (v === 1 ? "Yes" : "No")}
            onSelect={(v) => onChange({ prior_injury: v })}
          />
        </Field>
        <Field label={t(lang, "ui.family_hx")}>
          <ChipRow
            options={[0, 1] as const}
            selected={intake.family_hx as 0 | 1}
            render={(v) => (v === 1 ? "Yes" : "No")}
            onSelect={(v) => onChange({ family_hx: v })}
          />
        </Field>
      </Card>

      <Card>
        <View style={styles.scaleNote}>
          <Text style={styles.scaleTitle}>WOMAC (self-reported)</Text>
          <Text style={styles.scaleHint}>
            Pain: none → worst. Stiffness: morning stiffness severity.
          </Text>
        </View>
        <SliderRow
          label={t(lang, "ui.pain_score")}
          value={intake.womac_pain}
          min={0}
          max={20}
          step={1}
          onChange={(v) => onChange({ womac_pain: v })}
        />
        <SliderRow
          label={t(lang, "ui.stiffness")}
          value={intake.womac_stiff}
          min={0}
          max={8}
          step={1}
          onChange={(v) => onChange({ womac_stiff: v })}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={t(lang, "ui.next")}
        onPress={() => {
          if (!intake.patient.trim() || !intake.district.trim()) {
            setError("Patient name and district are required.");
            return;
          }
          onNext();
        }}
      />
      <Text style={styles.disclaimer}>
        {t(lang, "ui.scan")} — stored only on this device until you sync. Never
        transmitted without consent.
      </Text>
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
    fontSize: 15,
  },
  twoCol: { flexDirection: "row", gap: S.gap },
  grow: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  occChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: C.chip,
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
  },
  occChipSel: { backgroundColor: C.chipSel, color: "#fff" },
  scaleNote: { gap: 2 },
  scaleTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  scaleHint: { color: C.sub, fontSize: 12 },
  error: { color: C.danger, fontSize: 13 },
  disclaimer: { color: C.sub, fontSize: 11, textAlign: "center", lineHeight: 16 },
});