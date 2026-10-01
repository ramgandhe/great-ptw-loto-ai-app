import { useState } from "react";
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

const CHECKS = [
  { value: "yes", label: "Yes", on: "#dcfce7", ink: "#166534" },
  { value: "no", label: "No", on: "#fee2e2", ink: "#b91c1c" },
  { value: "na", label: "N/A", on: "#e5e7eb", ink: "#111827" },
];

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** One answer control for a template field; the same controls serve the editor and approval/closure signing. */
export function FieldInput({
  field,
  value,
  disabled,
  signerName,
  onChange,
}: {
  field: TemplateField;
  value: FormAnswer | undefined;
  disabled?: boolean;
  signerName: string;
  onChange: (value: FormAnswer | undefined) => void;
}) {
  const text = (v: string) => onChange(v === "" ? undefined : v);
  switch (field.type) {
    case "check":
      return (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={field.label}>
          {CHECKS.map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => onChange(selected ? undefined : option.value)}
                style={[styles.check, selected && { backgroundColor: option.on, borderColor: option.ink }]}
              >
                <Text style={{ color: selected ? option.ink : "#111827", fontWeight: selected ? "600" : "400" }}>{option.label}</Text>
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
      return (
        <View style={styles.signature}>
          <TextInput
            accessibilityLabel={`${field.label}: name`}
            placeholder="Name"
            editable={!disabled}
            value={sig.name}
            onChangeText={(name) => onChange(name ? { ...sig, name } : undefined)}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChange({ ...signNow(sig.name || signerName) })}
            style={styles.signButton}
          >
            <Text style={styles.chipText}>{sig.name ? "Now" : "Me, now"}</Text>
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
          value={(value as string | undefined) ?? ""}
          onChangeText={text}
          style={[styles.input, field.type === "textarea" && styles.textArea]}
        />
      );
  }
}

/**
 * Fill in one permit template. Yes/No/N.A. is one tap. A section's unanswered checks can be
 * confirmed as Yes together after the questions, with a confirmation listing them; answers given
 * are never changed. The server records each answer under the signed-in person.
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
        const open = section.fields.filter((f) => f.type === "check" && !isAnswered(answers[f.id]));
        return (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.fields.map((field) => (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>
                  {field.label}
                  {requiredForSubmit(field) ? <Text style={{ color: "#b91c1c" }}> *</Text> : null}
                </Text>
                {field.required && field.requiredAt && field.requiredAt !== "submit" ? (
                  <Text style={styles.hint}>{field.requiredAt === "approval" ? "Signed at approval" : "Signed at closure"}</Text>
                ) : null}
                {field.help ? <Text style={styles.hint}>{field.help}</Text> : null}
                <FieldInput field={field} value={answers[field.id]} disabled={disabled} signerName={signerName} onChange={(v) => set(field.id, v)} />
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
                    <Pressable accessibilityRole="button" style={styles.signButton} onPress={() => setConfirming(null)}>
                      <Text style={styles.chipText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable accessibilityRole="button" style={styles.signButton} onPress={() => setConfirming(section.id)}>
                  <Text style={styles.chipText}>{`Confirm ${open.length} unanswered checks as Yes`}</Text>
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

const styles = StyleSheet.create({
  card: { gap: 10, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  left: { fontSize: 13, color: "#92400e" },
  done: { fontSize: 13, color: "#166534" },
  section: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#d1d5db", paddingTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: 14 },
  hint: { fontSize: 12, color: "#666" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // 44 pt touch targets.
  check: { minHeight: 44, minWidth: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 22 },
  chipOn: { borderColor: "#1f2937", backgroundColor: "#f3f4f6" },
  chipText: { color: "#111827", fontWeight: "500" },
  chipTextOn: { fontWeight: "700" },
  input: { minHeight: 44, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  textArea: { minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
  signature: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  signButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, alignSelf: "flex-start" },
  confirm: { gap: 6, padding: 10, borderRadius: 8, backgroundColor: "#f9fafb" },
  primary: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#1f2937" },
  primaryText: { color: "#fff", fontWeight: "600" },
  declaration: { fontSize: 12, fontStyle: "italic", color: "#444" },
});
