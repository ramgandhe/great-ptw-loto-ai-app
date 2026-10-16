import { fieldClassName } from "./form-field";
import { AppSelect } from "@/components/ui/select";
import type { MasterDataRecord } from "@/lib/master-data/api";

type MasterDataSelectProps = {
  /** Error wiring from FormField, passed to the select itself. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  id: string;
  value: string;
  options: MasterDataRecord[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function MasterDataSelect({
  id,
  value,
  options,
  disabled,
  placeholder = "Select…",
  onChange,
  ...aria
}: MasterDataSelectProps) {
  return (
    <AppSelect
      id={id}
      {...aria}
      className={fieldClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
          {option.code ? ` (${option.code})` : ""}
        </option>
      ))}
    </AppSelect>
  );
}
