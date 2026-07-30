import { fieldClassName } from "./form-field";
import type { MasterDataRecord } from "@/lib/master-data/api";

type MasterDataSelectProps = {
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
}: MasterDataSelectProps) {
  return (
    <select
      id={id}
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
    </select>
  );
}
