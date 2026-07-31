import { FormField, fieldClassName } from "@/components/permit/form-field";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
};

export function SelectField({
  id,
  label,
  hint,
  value,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  onChange,
  className,
}: SelectFieldProps) {
  return (
    <FormField label={label} htmlFor={id} hint={hint} className={className}>
      <select
        id={id}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldClassName, "text-foreground")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function formatOrgOptionLabel(item: { name: string; code?: string | null }): string {
  return item.code ? `${item.name} (${item.code})` : item.name;
}

export function formatWorkforceOptionLabel(person: {
  name: string;
  email?: string | null;
  role?: string | null;
}): string {
  const parts = [person.name];
  if (person.email) {
    parts.push(person.email);
  }
  if (person.role) {
    parts.push(person.role);
  }
  return parts.join(" · ");
}
