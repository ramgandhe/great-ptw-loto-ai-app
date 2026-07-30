type CommentPanelProps = {
  label?: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function CommentPanel({
  label = "Comment",
  value,
  required = false,
  placeholder = "Enter your comment...",
  onChange,
}: CommentPanelProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">
        {label}
        {required ? " (required)" : ""}
      </span>
      <textarea
        value={value}
        required={required}
        rows={4}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
