import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import { tint } from "@/theme/tokens";
import { Button } from "./button";
import { FieldFrame, SearchField, inputBox } from "./field";
import { Check, ChevronDown } from "./icons";
import { AppText } from "./text";

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
  error?: string | null;
  onChange: (value: string) => void;
};

/** A labelled picker: the pill shows the choice; tapping opens the options full screen, searchable when long. */
export function SelectField({
  label,
  value,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  hint,
  error,
  onChange,
}: SelectFieldProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const c = tokens.colors;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((option) => option.value === value)?.label;
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? options.filter((option) => option.label.toLowerCase().includes(normalized)) : options;
  }, [options, query]);

  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedLabel ?? "not chosen"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={[inputBox(tokens, { invalid: Boolean(error) }), { flexDirection: "row", alignItems: "center", gap: tokens.space[2], opacity: disabled ? 0.6 : 1 }]}
      >
        <AppText variant="body" tone={selectedLabel ? "default" : "muted"} numberOfLines={1} style={{ flex: 1 }}>
          {selectedLabel ?? placeholder}
        </AppText>
        <ChevronDown size={18} color={c.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + tokens.space[3], paddingHorizontal: tokens.space[4], gap: tokens.space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3] }}>
            <AppText variant="title" style={{ flex: 1 }}>{label}</AppText>
            <Button label="Done" variant="ghost" color={c.primary} onPress={() => setOpen(false)} />
          </View>
          {options.length > 8 ? <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} /> : null}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[6], gap: 4 }}
            ListEmptyComponent={<AppText variant="caption" style={{ textAlign: "center", paddingVertical: tokens.space[6] }}>Nothing matches “{query}”.</AppText>}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: item.disabled }}
                  disabled={item.disabled}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.space[3],
                    paddingHorizontal: tokens.space[4],
                    borderRadius: tokens.radii.md,
                    backgroundColor: selected ? tint(c.primary, 0.12) : pressed ? c.muted : c.card,
                    opacity: item.disabled ? 0.5 : 1,
                  })}
                >
                  <AppText variant="body" weight={selected ? "semibold" : "regular"} style={{ flex: 1 }}>{item.label}</AppText>
                  {selected ? <Check size={18} color={c.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </FieldFrame>
  );
}
