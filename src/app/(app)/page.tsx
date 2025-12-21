// src/app/(app)/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getPermissionSnapshot } from "@/lib/currentUser";

type CTALink = {
  href: string;
  label: string;
  sub?: string;
};

function ctasForRole(role: string | null | undefined): CTALink[] {
  const r = (role ?? "").toLowerCase();

  if (r === "worker" || r === "foreman") {
    return [{ href: "/tasks", label: "Idź do zadań", sub: "Twoje zadania i statusy prac." }];
  }

  if (r === "storeman") {
    return [
      { href: "/daily-reports", label: "Wypełnij raport dzienny", sub: "Zgłoś zużycia i dodaj zdjęcia." },
      { href: "/tasks", label: "Zobacz zadania", sub: "Podgląd i przypisania." },
    ];
  }

  return [{ href: "/analyze", label: "Przejdź do analiz", sub: "Metryki, odchylenia, raporty." }];
}

function messageForRole(role: string | null | undefined): string {
  const r = (role ?? "").toLowerCase();
  if (r === "worker") return "Dzisiaj lecimy konkretnie — sprawdź zadania i wrzuć postęp, jeśli coś domknąłeś.";
  if (r === "foreman") return "Masz podgląd na pracę ekipy — ogarnij zadania i przypisania.";
  if (r === "storeman") return "Masz dziś dwie główne rzeczy: raport dzienny i pilnowanie zadań/stanów.";
  if (r === "manager") return "Najlepszy start to analizy — zobacz, co się dzieje w projekcie i kto zużywa najwięcej.";
  if (r === "owner") return "Startujemy od overview — analizy dadzą Ci szybki obraz kosztów i odchyleń.";
  return "Wybierz, gdzie chcesz wejść dalej.";
}

async function pickFullName(sb: any, user: any, accountId: string | null): Promise<string> {
  // 1) team_members (source of truth)
  if (accountId) {
    const { data: tm } = await sb
      .from("team_members")
      .select("first_name, last_name")
      .eq("account_id", accountId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    const first = (tm?.first_name ?? "").toString().trim();
    const last = (tm?.last_name ?? "").toString().trim();
    const full = [first, last].filter(Boolean).join(" ").trim();
    if (full) return full;
  }

  // 2) fallback: auth metadata
  const metaName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null;

  if (metaName && metaName.trim()) return metaName.trim();

  // 3) fallback: email
  if (typeof user?.email === "string" && user.email.trim()) return user.email.trim();

  return "Użytkowniku";
}

export default async function Dashboard() {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/")}`);
  }

  const snap = await getPermissionSnapshot();
  const role = snap?.role ?? null;
  const accountId = snap?.account_id ?? null;

  const fullName = await pickFullName(sb, user, accountId);
  const ctas = ctasForRole(role);
  const msg = messageForRole(role);

  return (
    <main className="min-h-[calc(100vh-2rem)] bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="card rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Warehouse App
            </div>

            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Witaj z powrotem, <span className="text-foreground">{fullName}</span>
            </h1>

            <p className="text-sm text-foreground/70 leading-relaxed max-w-[70ch]">{msg}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {ctas.map((c, idx) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={[
                    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition border",
                    idx === 0
                      ? "border-border/70 bg-foreground/15 hover:bg-foreground/20"
                      : "border-border/70 bg-background/40 hover:bg-background/60",
                  ].join(" ")}
                >
                  {c.label} <span className="ml-2 text-foreground/70">→</span>
                </Link>
              ))}
            </div>

            {ctas.some((c) => c.sub) ? (
              <div className="mt-2 space-y-1">
                {ctas.map((c) =>
                  c.sub ? (
                    <div key={c.href} className="text-xs text-foreground/55">
                      <span className="font-semibold text-foreground/60">{c.label}:</span> {c.sub}
                    </div>
                  ) : null
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
