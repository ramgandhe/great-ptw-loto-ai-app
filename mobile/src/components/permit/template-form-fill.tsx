import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  isAnswered,
  requiredForSubmit,
  signNow,
  type FormAnswer,
  type FormAnswers,
  type SignatureAnswer,
  type TemplateConfig,
  type TemplateField,
} from "@/lib/permit/forms";
import { useTheme } from "@/providers/theme-provider";
import type { ThemeTokens } from "@/theme/types";
import { tint } from "@/theme/tokens";

/** Android's minimum touch target. */
const TARGET = 48;

function createStyles({ colors, radii, text, fonts, space }: ThemeTokens) {
  const body = { fontFamily: fonts.body, fontSize: text.base, color: colors.foreground };
  const pill = { minHeight: TARGET, justifyContent: "center" as const, paddingHorizontal: space[4], borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radii.full, backgroundColor: colors.card };
  return StyleSheet.create({
    // A form sits inside an editor card: a sunken panel, not a card in a card.
    card: { gap: space[3], padding: space[4], borderRadius: radii.md, backgroundColor: colors.muted },
    cardTitle: { fontFamily: fonts.display, fontSize: text.md, color: colors.foreground },
    left: { fontFamily: fonts.bodySemibold, fontSize: text.sm, color: colors.warning },
    done: { fontFamily: fonts.bodySemibold, fontSize: text.sm, color: colors.success },
    section: { gap: space[3], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[3] },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: text.base, color: colors.foreground },
    field: { gap: space[2] },
    label: { ...body, fontFamily: fonts.bodyMedium },
    required: { color: colors.danger },
    hint: { fontFamily: fonts.body, fontSize: text.sm, color: colors.mutedForeground },
    row: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
    check: { ...pill, minWidth: 64, alignItems: "center" },
    chip: pill,
    chipOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: tint(colors.primary, 0.12) },
    text: { fontFamily: fonts.bodyMedium, fontSize: text.sm + 1, color: colors.textSecondary },
    textOn: { fontFamily: fonts.bodyBold, fontSize: text.sm + 1, color: colors.foreground },
    input: { ...body, minHeight: TARGET, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radii.full, paddingHorizontal: space[4], backgroundColor: colors.card },
    textArea: { minHeight: 96, paddingTop: space[3], borderRadius: radii.lg, textAlignVertical: "top" },
    signature: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] },
    button: { ...pill, alignSelf: "flex-start" },
    confirm: { gap: space[2], padding: space[3], borderRadius: radii.md, backgroundColor: colors.card },
    primary: { ...pill, borderColor: colors.primaryFill, backgroundColor: colors.primaryFill },
    primaryText: { fontFamily: fonts.bodySemibold, fontSize: text.sm + 1, color: colors.primaryForeground },
    declaration: { fontFamily: fonts.body, fontSize: text.sm, fontStyle: "italic", color: colors.mutedForeground },
  });
}

export function useFormStyles() {
  const { tokens } = useTheme();
  return useMemo(() => ({ styles: createStyles(tokens), colors: tokens.colors }), [tokens]);
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const { styles } = useFormStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={selected ? styles.textOn : styles.text}>{label}</Text>
    </Pressable>
  );
}

/**
 * One answer control for a template field; the editor and approval/closure signing share it.
 * `signOnly`: approval/closure signatures, where the person can only sign as themselves.
 */
export function FieldInput({
  field,
  value,
  disabled,
  signerName,
  signOnly,
  onChange,
}: {
  field: TemplateField;
  value: FormAnswer | undefined;
  disabled?: boolean;
  signerName: string;
  signOnly?: boolean;
  onChange: (value: FormAnswer | undefined) => void;
}) {
  const { styles, colors } = useFormStyles();
  const checks = [
    { value: "yes", label: "Yes", on: colors.successBg, ink: colors.success },
    { value: "no", label: "No", on: colors.dangerBg, ink: colors.danger },
    { value: "na", label: "N/A", on: colors.muted, ink: colors.foreground },
  ];
  switch (field.type) {
    case "check":
      return (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={field.label}>
          {checks.map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(selected ? undefined : option.value)}
                style={[styles.check, selected && { backgroundColor: option.on, borderColor: option.ink, borderWidth: 2 }]}
              >
                <Text style={selected ? [styles.textOn, { color: option.ink }] : styles.text}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    case "select":
    case "multiselect": {
      const selected = field.type === "multiselect" ? (Array.isArray(value) ? value : []) : [];
      return (
        <View style={styles.row}>
          {(field.options ?? []).map((option) =>
            field.type === "select" ? (
              <Chip key={option} label={option} selected={value === option} disabled={disabled} onPress={() => onChange(value === option ? undefined : option)} />
            ) : (
              <Chip
                key={option}
                label={option}
                selected={selected.includes(option)}
                disabled={disabled}
                onPress={() => {
                  const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
                  onChange(next.length ? next : undefined);
                }}
              />
            ),
          )}
        </View>
      );
    }
    case "signature": {
      const sig = (value as SignatureAnswer | undefined) ?? { name: "" };
      if (signOnly) {
        return sig.name ? (
          <View style={styles.signature}>
            <Text style={styles.label}>{`Signed by ${sig.name}${sig.date ? `, ${sig.date} ${sig.time ?? ""}` : ""}`}</Text>
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(undefined)} style={styles.button}>
              <Text style={styles.text}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(signNow(signerName))} style={styles.button}>
            <Text style={styles.text}>{`Sign as ${signerName || "me"}, now`}</Text>
          </Pressable>
        );
      }
      return (
        <View style={styles.signature}>
          <TextInput
            accessibilityLabel={`${field.label}: name`}
            placeholder="Name"
            placeholderTextColor={colors.mutedForeground}
            editable={!disabled}
            value={sig.name}
            onChangeText={(name) => onChange(name ? { ...sig, name } : undefined)}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(signNow(sig.name || signerName))} style={styles.button}>
            <Text style={styles.text}>{sig.name ? "Now" : "Me, now"}</Text>
          </Pressable>
          {sig.date ? <Text style={styles.hint}>{`${sig.date}${sig.time ? ` ${sig.time}` : ""}`}</Text> : null}
        </View>
      );
    }
    case "number":
      return (
        <TextInput
          accessibilityLabel={field.label}
          keyboardType="decimal-pad"
          editable={!disabled}
          value={value === undefined ? "" : String(value)}
          onChangeText={(v) => onChange(v === "" ? undefined : Number(v))}
          placeholder={field.unit}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { maxWidth: 160 }]}
        />
      );
    default:
      return (
        <TextInput
          accessibilityLabel={field.label}
          editable={!disabled}
          multiline={field.type === "textarea"}
          placeholder={field.type === "date" ? "YYYY-MM-DD" : field.type === "time" ? "HH:MM" : undefined}
          placeholderTextColor={colors.mutedForeground}
          value={(value as string | undefined) ?? ""}
          onChangeText={(v) => onChange(v === "" ? undefined : v)}
          style={[styles.input, field.type === "textarea" && styles.textArea]}
        />
      );
  }
}

const laterStage = (field: TemplateField) => Boolean(field.required && field.requiredAt && field.requiredAt !== "submit");

/**
 * Fill in one permit template. Yes/No/N.A. is one tap. A section's unanswered checks can be
 * confirmed as Yes together after the questions, with a confirmation listing them; answers given
 * are never changed. Approval and closure fields are shown, not filled: that decision's maker signs
 * them at the decision. The server records each answer under the signed-in person.
 */
export function TemplateFormFill({
  name,
  config,
  answers,
  disabled,
  signerName,
  onChange,
}: {
  name: string;
  config: TemplateConfig;
  answers: FormAnswers;
  disabled?: boolean;
  signerName: string;
  onChange: (answers: FormAnswers) => void;
}) {
  const { styles } = useFormStyles();
  const [confirming, setConfirming] = useState<string | null>(null);
  const fields = config.sections.flatMap((s) => s.fields);
  const left = fields.filter((f) => requiredForSubmit(f) && !isAnswered(answers[f.id])).length;
  const set = (id: string, value: FormAnswer | undefined) => {
    const next = { ...answers };
    if (value === undefined) delete next[id];
    else next[id] = value;
    onChange(next);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{name}</Text>
      <Text style={left ? styles.left : styles.done}>{left ? `${left} required left` : "Required done"}</Text>
      {config.sections.map((section) => {
        const open = section.fields.filter((f) => f.type === "check" && !laterStage(f) && !isAnswered(answers[f.id]));
        return (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.fields.map((field) => (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>
                  {field.label}
                  {requiredForSubmit(field) ? <Text style={styles.required}> *</Text> : null}
                </Text>
                {field.help ? <Text style={styles.hint}>{field.help}</Text> : null}
                {laterStage(field) ? (
                  <Text style={styles.hint}>
                    {`${field.requiredAt === "approval" ? "Signed at approval" : "Signed at closure"}: ${
                      !isAnswered(answers[field.id])
                        ? "not yet"
                        : field.type === "signature"
                          ? `by ${(answers[field.id] as SignatureAnswer).name}`
                          : "answered"
                    }`}
                  </Text>
                ) : (
                  <FieldInput field={field} value={answers[field.id]} disabled={disabled} signerName={signerName} onChange={(v) => set(field.id, v)} />
                )}
              </View>
            ))}
            {open.length > 1 && !disabled ? (
              confirming === section.id ? (
                <View style={styles.confirm}>
                  <Text style={styles.label}>{`Confirm these ${open.length} checks are Yes`}</Text>
                  {open.map((f) => (
                    <Text key={f.id} style={styles.hint}>{`• ${f.label}`}</Text>
                  ))}
                  <Text style={styles.hint}>Your answers are recorded under your name.</Text>
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.primary}
                      onPress={() => {
                        onChange({ ...answers, ...Object.fromEntries(open.map((f) => [f.id, "yes"])) });
                        setConfirming(null);
                      }}
                    >
                      <Text style={styles.primaryText}>{`I confirm these ${open.length} checks are Yes`}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(null)}>
                      <Text style={styles.text}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable accessibilityRole="button" style={styles.button} onPress={() => setConfirming(section.id)}>
                  <Text style={styles.text}>{`Confirm ${open.length} unanswered checks as Yes`}</Text>
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
      {config.declaration ? <Text style={styles.declaration}>{config.declaration}</Text> : null}
    </View>
  );
}
