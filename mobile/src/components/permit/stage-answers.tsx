import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getProfile } from "@/lib/auth/api";
import { fieldsAtStage, stageAnswersOf, type StageAnswerEdits, type StoredFormResponse } from "@/lib/permit/forms";
import { FieldInput } from "./template-form-fill";

/** The signed-in person's name for "Me, now"; empty until the profile loads. */
export function useSignerName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    getProfile().then(
      (p) => setName([p.firstName, p.lastName].filter(Boolean).join(" ") || p.username),
      () => undefined,
    );
  }, []);
  return name;
}

/** The permit's form fields signed at approval or closure, shown beside that decision. */
export function StageAnswers({
  responses,
  stage,
  edits,
  onChange,
  signerName,
  disabled,
}: {
  responses: StoredFormResponse[];
  stage: "approval" | "closure";
  edits: StageAnswerEdits;
  onChange: (edits: StageAnswerEdits) => void;
  signerName: string;
  disabled?: boolean;
}) {
  const forms = responses.filter((response) => fieldsAtStage(response.config, stage).length > 0);
  if (forms.length === 0) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{`Sign the form for ${stage}`}</Text>
      {forms.map((response) => {
        const answers = stageAnswersOf(response, stage, edits);
        return (
          <View key={response.templateId} style={styles.box}>
            {forms.length > 1 ? <Text style={styles.hint}>{response.name}</Text> : null}
            {fieldsAtStage(response.config, stage).map((field) => (
              <View key={field.id} style={styles.field}>
                <Text style={styles.label}>
                  {field.label}
                  <Text style={{ color: "#b91c1c" }}> *</Text>
                </Text>
                <FieldInput
                  field={field}
                  value={answers[field.id]}
                  disabled={disabled}
                  signerName={signerName}
                  onChange={(value) => {
                    const next = { ...answers };
                    if (value === undefined) delete next[field.id];
                    else next[field.id] = value;
                    onChange({ ...edits, [response.templateId]: next });
                  }}
                />
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  title: { fontSize: 14, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: 14 },
  hint: { fontSize: 12, color: "#666" },
});
