import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ReactNode } from "react";

// A row of buttons where exactly one is chosen. The arrow keys move between
// them, so the screen's own arrow keys leave it alone.
export function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  readonly label: string;
  readonly value: Value;
  readonly options: ReadonlyArray<{
    readonly value: Value;
    readonly label: string;
    readonly content?: ReactNode;
    readonly hidden?: boolean;
  }>;
  readonly onChange: (value: Value) => void;
  readonly className?: string;
}) {
  if (options.filter((option) => option.hidden !== true).length < 2) return null;
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next[0]);
        if (chosen !== undefined) onChange(chosen.value);
      }}
      className={`segmented ${className}`}
    >
      {options
        .filter((option) => option.hidden !== true)
        .map((option) => (
          <Toggle
            key={option.value}
            value={option.value}
            aria-label={option.content === undefined ? undefined : option.label}
            data-tip={option.content === undefined ? undefined : option.label}
          >
            {option.content ?? option.label}
          </Toggle>
        ))}
    </ToggleGroup>
  );
}
