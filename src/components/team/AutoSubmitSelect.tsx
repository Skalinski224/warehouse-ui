// src/components/team/AutoSubmitSelect.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string; disabled?: boolean };

type ToastCfg = {
  okTitle?: string;
  okMsg?: string;
  errTitle?: string;
  errMsg?: string;
};

function withToast(pathname: string, search: string, tone: "ok" | "err", title: string, msg?: string) {
  const u = new URL(`${pathname}?${search}`, "http://local");
  u.searchParams.set("toast", tone);
  u.searchParams.set("title", title);
  if (msg) u.searchParams.set("msg", msg);
  return u.pathname + u.search;
}

export default function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  action,
  hidden,
  className = "bg-transparent text-[11px] text-muted-foreground outline-none cursor-pointer",
  disabled,
  toast,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  action: (formData: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  className?: string;
  disabled?: boolean;
  toast?: ToastCfg;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <form
      ref={formRef}
      action={(fd) => {
        startTransition(async () => {
          try {
            await action(fd);

            const url = withToast(
              pathname,
              sp.toString(),
              "ok",
              toast?.okTitle ?? "Zapisano",
              toast?.okMsg
            );
            router.replace(url);
            router.refresh();
          } catch (e) {
            console.error("[AutoSubmitSelect] action error:", e);
            const url = withToast(
              pathname,
              sp.toString(),
              "err",
              toast?.errTitle ?? "Błąd zapisu",
              toast?.errMsg
            );
            router.replace(url);
            router.refresh();
          }
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