"use client";

import * as React from "react";
import { useTransition } from "react";

type Option = { value: string; label: string; disabled?: boolean };

export default function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  action,
  hidden,
  className = "bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer",
  disabled,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  className?: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = React.useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        startTransition(async () => {
          await action(fd);
        });
      }}
      className="inline-flex"
    >
      {hidden
        ? Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}

      <select
        name={name}
        defaultValue={defaultValue}
        disabled={disabled || isPending}
        className={className}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
