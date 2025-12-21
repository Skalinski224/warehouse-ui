// src/app/invite/[token]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SetPasswordByTokenForm from "../_components/SetPasswordByTokenForm";

type PageProps = {
  params: Promise<{ token: string }>;
};

type TokenRow = {
  kind: "invite" | "reset" | string | null;
  email: string | null;
  account_id: string | null;
};

function InvalidLink() {
  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="card border border-border/70 bg-card/80 backdrop-blur p-5 rounded-2xl shadow-sm text-center">
          <h1 className="mb-2 text-base font-semibold tracking-tight text-foreground">
            Nieprawidłowy link
          </h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Link jest nieaktywny, wygasł albo został już wykorzystany.
            <br />
            Poproś managera o wysłanie nowego.
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function InvitePage(props: PageProps) {
  const { token: tokenParam } = await props.params;

  // twardo: token musi istnieć
  const token = String(tokenParam || "").trim();
  if (!token) return <InvalidLink />;

  const supabase = supabaseAdmin();

  // Jeden token = invite albo reset. Czytamy z RPC (bezpieczniej niż ręczne OR).
  const { data, error } = await supabase.rpc("get_team_member_by_password_token", {
    p_token: token,
  });

  const rowRaw = Array.isArray(data) ? data[0] : data;
  const row = (rowRaw ?? null) as TokenRow | null;

  const kind =
    row?.kind === "invite" || row?.kind === "reset" ? (row.kind as "invite" | "reset") : null;
  const email = row?.email ?? null;
  const accountId = row?.account_id ?? null;

  const isInvalid = !!error || !row || !kind || !email || !accountId;
  if (isInvalid) return <InvalidLink />;

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">
            {kind === "invite" ? "Dołącz do zespołu" : "Reset hasła"}
          </h1>
          <p className="text-sm text-foreground/70 mt-1">
            Ustaw hasło do konta i przejdź dalej.
          </p>
        </div>

        <div className="card border border-border/70 bg-card/80 backdrop-blur p-5 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {kind === "invite" ? "Dołącz do zespołu" : "Reset hasła"}
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Ustaw hasło do Warehouse App</h2>
            <p className="text-xs text-muted-foreground">
              Konto: <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          {/* Logika bez zmian — wszystko dalej robi komponent */}
          <SetPasswordByTokenForm token={token} email={email} accountId={accountId} />
        </div>
      </div>
    </main>
  );
}
