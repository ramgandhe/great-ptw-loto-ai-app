import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/providers/theme-provider";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (value: string) => void;
};

export function SelectField({
  label,
  value,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  hint,
  onChange,
}: SelectFieldProps) {
  const { tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.value === value)?.label;
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: tokens.colors.foreground }]}>
        {label}
        {required ? " *" : ""}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: tokens.colors.mutedForeground }]}>{hint}</Text>
      ) : null}
      <Pressable
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={[
          styles.trigger,
          {
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.background,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Text
          style={{
            color: selectedLabel ? tokens.colors.foreground : tokens.colors.mutedForeground,
          }}
        >
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: tokens.colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: tokens.colors.foreground }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={{ color: tokens.colors.primary, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
            placeholderTextColor={tokens.colors.mutedForeground}
            style={[
              styles.search,
              {
                borderColor: tokens.colors.border,
                color: tokens.colors.foreground,
              },
            ]}
          />
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: tokens.colors.mutedForeground }]}>
                No options found
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                disabled={item.disabled}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  {
                    borderBottomColor: tokens.colors.border,
                    opacity: item.disabled ? 0.5 : 1,
                    backgroundColor:
                      item.value === value ? tokens.colors.muted : tokens.colors.background,
                  },
                ]}
              >
                <Text style={{ color: tokens.colors.foreground }}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { fontSize: 13, fontWeight: "500" },
  hint: { fontSize: 12 },
  trigger: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modal: { flex: 1, paddingTop: 56, paddingHorizontal: 16 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { paddingVertical: 24, textAlign: "center" },
});
