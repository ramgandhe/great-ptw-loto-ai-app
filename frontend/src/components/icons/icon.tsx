import { cn } from "@/lib/utils";
import type { LucideIcon, LucideProps } from "lucide-react";

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export const iconStrokeWidth = 2;

export type IconProps = LucideProps & {
  icon: LucideIcon;
  size?: keyof typeof iconSizes | number;
};

export function Icon({
  icon: LucideIconComponent,
  size = "md",
  className,
  strokeWidth = iconStrokeWidth,
  ...props
}: IconProps) {
  const resolvedSize = typeof size === "number" ? size : iconSizes[size];

  return (
    <LucideIconComponent
      size={resolvedSize}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    />
  );
}
