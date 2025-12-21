// src/lib/queries/dailyReports.ts
import { supabaseServer } from "@/lib/supabaseServer";
import type { DailyReportRow, DailyReportDetails } from "@/lib/dto";
import { PERM, can } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/*                               PERMISSION GATE                              */
/* -------------------------------------------------------------------------- */

async function getSnapshot() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) return null;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

async function canReadDailyReports(): Promise<boolean> {
  const snapshot = await getSnapshot();
  return can(snapshot, PERM.DAILY_REPORTS_READ);
}

async function canSeeReportPhotos(): Promise<boolean> {
  const snapshot = await getSnapshot();
  return can(snapshot, PERM.TASKS_UPLOAD_PHOTOS);
}

/* -------------------------------------------------------------------------- */
/*                           LISTA RAPORTÓW DZIENNYCH                          */
/* -------------------------------------------------------------------------- */

export async function fetchDailyReports(): Promise<DailyReportRow[]> {
  // Gate: dzienne raporty
  const allowed = await canReadDailyReports();
  if (!allowed) return [];

  const showPhotos = await canSeeReportPhotos();

  const supabase = await supabaseServer();

  // 1. Bazowe dane z daily_reports
  const { data, error } = await supabase
    .from("daily_reports")
    .select(
      `
      id,
      date,
      crew_id,
      crew_name,
      person,
      location,
      is_completed,
      approved,
      photos_count,
      created_at
    `
    )
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) {
    console.error("[fetchDailyReports] error:", error);
    return [];
  }

  const rows: any[] = data ?? [];
  if (rows.length === 0) {
    return [];
  }

  const reportIds = rows.map((r) => r.id as string);
  const crewIdsFromReports = rows
    .map((r) => r.crew_id as string | null)
    .filter((id): id is string => !!id);

  // 2. Dociągamy:
  //    a) główne brygady z daily_report_crews
  //    b) nazwy brygad z tabeli crews (dla crew_id z daily_reports)
  const [crewLinksRes, crewsRes] = await Promise.all([
    supabase
      .from("daily_report_crews")
      .select(
        `
        report_id,
        crew_id,
        is_primary,
        crews ( name )
      `
      )
      .in("report_id", reportIds)
      .is("deleted_at", null),
    crewIdsFromReports.length > 0
      ? supabase.from("crews").select("id, name").in("id", crewIdsFromReports)
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  if (crewLinksRes.error) {
    console.error(
      "[fetchDailyReports] daily_report_crews error:",
      crewLinksRes.error
    );
  }
  if ((crewsRes as any).error) {
    console.error("[fetchDailyReports] crews error:", (crewsRes as any).error);
  }

  const crewLinks: any[] = crewLinksRes.data ?? [];
  const crews: any[] = (crewsRes as any).data ?? [];

  // report_id -> główna brygada (z daily_report_crews)
  const primaryCrewByReport = new Map<
    string,
    { crewId: string | null; crewName: string | null }
  >();

  crewLinks.forEach((link) => {
    const reportId = link.report_id as string;
    const crewId = (link.crew_id ?? null) as string | null;
    const crewName = (link.crews?.name ?? null) as string | null;
    const isPrimary = !!link.is_primary;

    const existing = primaryCrewByReport.get(reportId);

    // preferujemy is_primary = true, ale jak nie ma, bierzemy cokolwiek
    if (!existing || isPrimary) {
      primaryCrewByReport.set(reportId, { crewId, crewName });
    }
  });

  // crew_id -> name (tabela crews)
  const crewNameById = new Map<string, string>();
  crews.forEach((c) => {
    if (c.id) {
      crewNameById.set(c.id as string, (c.name ?? "") as string);
    }
  });

  // 3. Składamy finalne DTO:
  //    1) daily_reports.crew_name
  //    2) główna brygada z daily_report_crews
  //    3) nazwa z tabeli crews po crew_id
  return rows.map((row) => {
    const reportId = row.id as string;

    const primaryCrew = primaryCrewByReport.get(reportId);
    let crewId = (row.crew_id ?? primaryCrew?.crewId ?? null) as string | null;

    let crewName =
      (row.crew_name as string | null) ??
      (primaryCrew?.crewName as string | null) ??
      (crewId ? crewNameById.get(crewId) ?? null : null) ??
      "";

    return {
      id: reportId,
      date: row.date as string,
      crewId,
      crewName,
      person: row.person as string,
      location: (row.location ?? null) as string | null,
      isCompleted: !!row.is_completed,
      approved: !!row.approved,
      photosCount: showPhotos ? (row.photos_count ?? 0) : 0,
      createdAt: row.created_at as string,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                         SZCZEGÓŁY POJEDYNCZEGO RAPORTU                     */
/* -------------------------------------------------------------------------- */

export async function fetchDailyReportById(
  id: string
): Promise<DailyReportDetails | null> {
  // Gate: dzienne raporty
  const allowed = await canReadDailyReports();
  if (!allowed) return null;

  const showPhotos = await canSeeReportPhotos();

  const supabase = await supabaseServer();

  const { data: report, error } = await supabase
    .from("daily_reports")
    .select(
      `
      id,
      date,
      crew_id,
      crew_name,
      person,
      location,
      place,
      stage_id,
      task_id,
      task_name,
      is_completed,
      approved,
      photos_count,
      images,
      items
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !report) {
    if (error) {
      console.error("[fetchDailyReportById] daily_reports error:", error);
    }
    return null;
  }

  const { data: crews } = await supabase
    .from("daily_report_crews")
    .select(
      `
      crew_id,
      is_primary,
      crews ( name )
    `
    )
    .eq("report_id", id)
    .is("deleted_at", null);

  const { data: members } = await supabase
    .from("daily_report_members")
    .select(
      `
      member_id,
      team_members ( first_name, last_name )
    `
    )
    .eq("report_id", id)
    .is("deleted_at", null);

  const itemsRaw: any[] = report.items ?? [];
  const materialIds = itemsRaw
    .map((i) => i.material_id)
    .filter(Boolean) as string[];

  const materialMap = new Map<
    string,
    { title: string; unit: string; currentQuantity: number }
  >();

  if (materialIds.length > 0) {
    const { data: materials } = await supabase
      .from("materials")
      .select("id, title, unit, current_quantity")
      .in("id", materialIds);

    (materials ?? []).forEach((m: any) => {
      materialMap.set(m.id, {
        title: m.title,
        unit: m.unit,
        currentQuantity: m.current_quantity ?? 0,
      });
    });
  }

  const items = itemsRaw.map((i: any) => {
    const meta =
      materialMap.get(i.material_id) ?? {
        title: "Nieznany materiał",
        unit: "",
        currentQuantity: 0,
      };

    return {
      materialId: i.material_id as string,
      materialTitle: meta.title,
      unit: meta.unit,
      qtyUsed: Number(i.qty_used ?? i.quantity ?? 0),
      currentQuantity: meta.currentQuantity,
    };
  });

  return {
    id: report.id as string,
    date: report.date as string,
    crewId: (report.crew_id ?? null) as string | null,
    crewName: (report.crew_name ?? "") as string,
    person: report.person as string,
    location: (report.location ?? null) as string | null,
    place: (report.place ?? null) as string | null,
    stageId: (report.stage_id ?? null) as string | null,
    taskId: (report.task_id ?? null) as string | null,
    taskName: (report.task_name ?? null) as string | null,
    isCompleted: !!report.is_completed,
    approved: !!report.approved,
    photosCount: showPhotos ? (report.photos_count ?? 0) : 0,
    images: showPhotos ? ((report.images ?? []) as string[]) : [],
    items,
    primaryCrewId:
      crews?.find((c: any) => c.is_primary)?.crew_id ??
      (report.crew_id ?? null),
    crews:
      crews?.map((c: any) => ({
        crewId: c.crew_id as string,
        crewName: c.crews?.name ?? "",
        isPrimary: !!c.is_primary,
      })) ?? [],
    members:
      members?.map((m: any) => ({
        memberId: m.member_id as string,
        firstName: m.team_members?.first_name ?? "",
        lastName: m.team_members?.last_name ?? null,
      })) ?? [],
  };
}
