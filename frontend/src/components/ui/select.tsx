"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type OptionProps = {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
};

type OptionGroupProps = {
  label?: string;
  disabled?: boolean;
  children?: ReactNode;
};

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type SelectOptionGroup = {
  label?: string;
  options: SelectOption[];
};

type SelectChangeEvent = { target: { value: string } };

type AppSelectProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onChange" | "value"> & {
  children: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
};

function optionText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return optionText(node.props.children);
  return "";
}

function readOptions(children: ReactNode): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = [];
  const read = (node: ReactNode, groupLabel?: string, groupDisabled = false) => {
    Children.forEach(node, (child) => {
      if (!isValidElement<OptionProps>(child)) return;
      if (child.type === Fragment) {
        read(child.props.children, groupLabel, groupDisabled);
        return;
      }
      if (child.type === "optgroup") {
        const optionGroup = child as React.ReactElement<OptionGroupProps>;
        read(
          optionGroup.props.children,
          optionGroup.props.label?.trim() || groupLabel,
          groupDisabled || Boolean(optionGroup.props.disabled),
        );
        return;
      }
      if (child.type !== "option") return;
      const label = optionText(child.props.children).trim();
      const option: SelectOption = {
        value: String(child.props.value ?? label),
        label,
        disabled: groupDisabled || Boolean(child.props.disabled),
      };
      const currentGroup = groups.at(-1);
      if (!currentGroup || currentGroup.label !== groupLabel) {
        groups.push({ label: groupLabel, options: [option] });
      } else {
        currentGroup.options.push(option);
      }
    });
  };
  read(children);
  return groups;
}

function SelectControl({
  children,
  value,
  defaultValue,
  onChange,
  className,
  id,
  name,
  form,
  required,
  disabled,
  ...triggerProps
}: AppSelectProps) {
  const optionGroups = readOptions(children);
  const options = optionGroups.flatMap((group) => group.options);
  const placeholder = options.find((option) => option.value === "")?.label ?? "Choose an option";
  const items = options.map(({ value: optionValue, label }) => ({
    value: optionValue,
    label,
  }));
  const normalizedValue = value == null || value === "" ? null : String(value);
  const normalizedDefault = defaultValue == null || defaultValue === "" ? null : String(defaultValue);

  return (
    <Select.Root
      name={name}
      form={form}
      required={required}
      disabled={disabled}
      value={value === undefined ? undefined : normalizedValue}
      defaultValue={defaultValue === undefined ? undefined : normalizedDefault}
      items={items}
      onValueChange={(next) => onChange?.({ target: { value: next == null ? "" : String(next) } })}
    >
      <Select.Trigger
        id={id}
        type="button"
        className={cn(
          "ptw-select-trigger flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-input bg-input-fill px-3 text-left text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive",
          className,
        )}
        {...triggerProps}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="size-4" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} align="start" className="z-[100] outline-none">
          <Select.Popup className="min-w-(--anchor-width) overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-(--shadow-lg) outline-none data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95">
            <Select.List className="max-h-72 overflow-y-auto">
              {optionGroups.map((group, index) => {
                const items = group.options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="flex min-h-10 cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-primary/8 data-[highlighted]:text-foreground data-[selected]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
                  >
                    <Select.ItemText className="min-w-0 truncate">{option.label}</Select.ItemText>
                    <Select.ItemIndicator className="shrink-0 text-primary">
                      <Check className="size-4" aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                ));
                return group.label ? (
                  <Select.Group key={`${group.label}-${index}`}>
                    <Select.GroupLabel className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </Select.GroupLabel>
                    {items}
                  </Select.Group>
                ) : (
                  <Fragment key={index}>{items}</Fragment>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export { SelectControl as AppSelect };
