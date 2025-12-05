// src/app/invite/[token]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import AcceptInviteForm from "../_components/AcceptInviteForm";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage(props: PageProps) {
  // Next.js 15 – params jest Promise, więc trzeba go odczekać
  const { token } = await props.params;

  const supabase = supabaseAdmin();

  const { data: member, error } = await supabase
    .from("team_members")
    .select(
      "id, account_id, first_name, last_name, email, status, invite_expires_at, role"
    )
    .eq("invite_token", token)
    .maybeSingle();

  const now = new Date();

  const isInvalid =
    !!error ||
    !member ||
    member.status !== "invited" ||
    (member.invite_expires_at &&
      new Date(member.invite_expires_at) < now);

  if (isInvalid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border/70 bg-card/80 px-6 py-5 text-center text-sm text-muted-foreground shadow-lg">
          <h1 className="mb-2 text-base font-semibold tracking-tight text-foreground">
            Nieprawidłowy link zaproszenia
          </h1>
          <p className="text-xs leading-relaxed">
            Wygląda na to, że ten link jest nieaktywny, wygasł
            albo został już wykorzystany.
            <br />
            Poproś osobę zapraszającą o wysłanie nowego zaproszenia.
          </p>
        </div>
      </main>
    );
  }

  // Rola z zaproszenia – ograniczamy do dozwolonych ról aplikacji (bez "owner")
  const roleFromInvite =
    member.role === "manager" ||
    member.role === "storeman" ||
    member.role === "worker"
      ? member.role
      : "worker";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/90 px-6 py-6 text-sm text-foreground shadow-lg">
        <div className="mb-4 space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Dołącz do zespołu
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            Załóż hasło do Warehouse App
          </h1>
          <p className="text-xs text-muted-foreground">
            Zaproszenie wysłano na adres{" "}
            <span className="font-medium text-foreground">
              {member.email}
            </span>
            . Ustaw swoje hasło, żeby dokończyć dołączanie.
          </p>
        </div>

        <AcceptInviteForm
          token={token}
          invitedEmail={member.email}
          invitedName={member.first_name || null}
          accountId={member.account_id}
          accountRole={roleFromInvite}
        />
      </div>
    </main>
  );
}
