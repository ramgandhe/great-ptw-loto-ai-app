import { useState, type ReactNode } from "react";
import { Platform, Pressable, Switch, TextInput, View, type TextInputProps } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { formatDate, formatDateTime } from "@/lib/format";
import { CalendarClock, Check, Eye, EyeOff, Search } from "@/components/ui/icons";
import { useTheme } from "@/providers/theme-provider";
import type { ThemeTokens } from "@/theme/types";
import { blend, readable, tint } from "@/theme/tokens";
import { AppText } from "./text";

/** The input look shared by text fields and pickers: a pill on the surface, ringed when focused or wrong. */
export function inputBox(tokens: ThemeTokens, { focused = false, invalid = false, multiline = false } = {}) {
  const c = tokens.colors;
  return {
    minHeight: 48,
    borderRadius: multiline ? tokens.radii.lg : tokens.radii.full,
    borderWidth: focused || invalid ? 2 : 1,
    borderColor: invalid ? c.danger : focused ? c.focus : c.inputBorder,
    backgroundColor: c.card,
    paddingHorizontal: focused || invalid ? tokens.space[4] - 1 : tokens.space[4],
    paddingVertical: multiline ? tokens.space[3] : 0,
    color: c.foreground,
    fontFamily: tokens.fonts.body,
    fontSize: tokens.text.base,
  } as const;
}

/** A label above its control, an optional hint, and the error tied to it underneath. */
export function FieldFrame({ label, required, hint, error, children, trailing }: { label: string; required?: boolean; hint?: string; error?: string | null; children: ReactNode; trailing?: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2] }}>
        <AppText variant="label">
          {label}
          {required ? <AppText variant="label" tone="danger">{" *"}</AppText> : null}
        </AppText>
        {trailing}
      </View>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
      {children}
      {error ? (
        <AppText variant="caption" tone="danger" weight="medium" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** A labelled text field. Passwords get a show/hide toggle; errors appear under the field. */
export function TextField({
  label,
  required,
  hint,
  error,
  trailing,
  secureTextEntry,
  multiline,
  style,
  ...input
}: TextInputProps & { label: string; required?: boolean; hint?: string; error?: string | null; trailing?: ReactNode }) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <FieldFrame label={label} required={required} hint={hint} error={error} trailing={trailing}>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={tokens.colors.mutedForeground}
          {...input}
          multiline={multiline}
          secureTextEntry={secureTextEntry && hidden}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[inputBox(tokens, { focused, invalid: Boolean(error), multiline }), multiline ? { minHeight: 96, textAlignVertical: "top" } : null, secureTextEntry ? { paddingRight: 52 } : null, style]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={{ position: "absolute", right: 6, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            {hidden ? <Eye size={18} color={tokens.colors.mutedForeground} /> : <EyeOff size={18} color={tokens.colors.mutedForeground} />}
          </Pressable>
        ) : null}
      </View>
    </FieldFrame>
  );
}

/** The search pill at the top of lists. */
export function SearchField({ value, onChangeText, placeholder, accessibilityLabel, onSubmit }: { value: string; onChangeText: (text: string) => void; placeholder: string; accessibilityLabel?: string; onSubmit?: () => void }) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ justifyContent: "center", borderRadius: tokens.radii.full, backgroundColor: tokens.colors.card, ...tokens.shadow }}>
      <Search size={18} color={tokens.colors.mutedForeground} style={{ position: "absolute", left: 16, zIndex: 1 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        placeholderTextColor={tokens.colors.mutedForeground}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[inputBox(tokens, { focused }), { paddingLeft: 44, borderWidth: focused ? 2 : tokens.borderWidth, borderColor: focused ? tokens.colors.focus : tokens.colors.inputBorder }]}
      />
    </View>
  );
}

/** "2026-07-28T09:00" in local time: the value the permit form keeps (toDateInputValue). */
function toLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * A date and time picked with the phone's own pickers (date, then time), shown as "Mon 10 Aug, 09:00".
 * `dateOnly` picks a calendar day and keeps it as "2026-07-28".
 */
export function DateTimeField({ label, value, onChange, required, error, disabled, hint, dateOnly = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; error?: string | null; disabled?: boolean; hint?: string; dateOnly?: boolean }) {
  const { tokens } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? new Date(dateOnly ? `${value}T12:00` : value) : new Date();
  const emit = (date: Date) => onChange(dateOnly ? toLocalValue(date).slice(0, 10) : toLocalValue(date));
  const shown = value ? (dateOnly ? formatDate(value) : formatDateTime(value)) : null;
  const open = () => {
    if (Platform.OS !== "android") return setIosOpen((o) => !o);
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        if (dateOnly) return emit(date);
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type === "set" && time) emit(time);
          },
        });
      },
    });
  };
  return (
    <FieldFrame label={label} required={required} hint={hint} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown ?? "not set"}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={open}
        style={[inputBox(tokens, { invalid: Boolean(error) }), { flexDirection: "row", alignItems: "center", gap: tokens.space[2], opacity: disabled ? 0.6 : 1 }]}
      >
        <CalendarClock size={18} color={tokens.colors.mutedForeground} />
        <AppText variant="body" tone={value ? "default" : "muted"}>{shown ?? (dateOnly ? "Choose date" : "Choose date and time")}</AppText>
      </Pressable>
      {iosOpen ? <DateTimePicker value={current} mode={dateOnly ? "date" : "datetime"} display="inline" onChange={(_, date) => date && emit(date)} /> : null}
    </FieldFrame>
  );
}

/** An on/off choice with its explanation (the web's switch rows). */
export function ToggleRow({ label, description, value, onChange, disabled }: { label: string; description?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], minHeight: 48, opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="semibold">{label}</AppText>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: tokens.colors.primary, false: tokens.colors.borderStrong }}
        thumbColor={tokens.colors.card}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** A checklist line: a tick box and what it confirms. */
export function CheckRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], minHeight: 48, opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ width: 24, height: 24, borderRadius: Math.min(6, tokens.radii.xs), borderWidth: 2, borderColor: value ? c.primaryFill : c.inputBorder, backgroundColor: value ? c.primaryFill : c.card, alignItems: "center", justifyContent: "center" }}>
        {value ? <Check size={16} color={c.primaryForeground} strokeWidth={3} /> : null}
      </View>
      <AppText variant="body" style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}

/**
 * One choice from a few, as pills side by side: the chosen one ringed and tinted in its colour.
 * `fill` stretches the options across the row (decisions); otherwise they wrap.
 */
export function ChoiceGroup<K extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  fill = false,
}: {
  label?: string;
  options: { key: K; label: string; color?: string; swatch?: string }[];
  value: K | null;
  onChange: (key: K) => void;
  disabled?: boolean;
  fill?: boolean;
}) {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <View style={{ gap: tokens.space[2] }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: fill ? "nowrap" : "wrap", gap: tokens.space[2] }}>
        {options.map((option) => {
          const selected = option.key === value;
          const hue = option.color ?? c.primary;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.key)}
              style={{
                flex: fill ? 1 : undefined,
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.space[2],
                paddingHorizontal: tokens.space[4],
                borderRadius: tokens.radii.full,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? hue : c.inputBorder,
                backgroundColor: selected ? tint(hue, 0.13) : c.card,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {option.swatch ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: option.swatch }} /> : null}
              <AppText variant="label" weight={selected ? "bold" : "semibold"} style={{ color: selected ? (option.color ? readable(option.color, blend(hue, 0.13, c.card)) : c.foreground) : c.textSecondary }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
