// src/lib/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM } from "@/lib/permissions";

/* -------------------------------------------------------------------------- */
/*                            POMOCNICZE / UTILS                              */
/* -------------------------------------------------------------------------- */

async function db() {
  return await supabaseServer();
}

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

/**
 * Supabase/PostgREST potrafi zwracać brak RPC jako:
 * - Postgres: 42883 "function does not exist"
 * - PostgREST: PGRST202 "Could not find the function ... in the schema cache"
 * - albo message containing "schema cache" / "does not exist"
 */
function isNoSuchFunction(err: any) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "42883" ||
    code === "PGRST202" ||
    /schema cache/i.test(msg) ||
    /could not find the function/i.test(msg) ||
    /function .* does not exist/i.test(msg) ||
    /42883/.test(msg)
  );
}

/**
 * Permission gate – jedyne źródło prawdy.
 * Obsługuje snapshot w 2 formatach:
 * A) { permissions: string[] } lub [ { permissions: string[] } ]
 * B) [ { key: string, allowed: boolean } ]
 */
async function requirePermission(perm: string) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.rpc("my_permissions_snapshot");
  if (error) {
    console.error("my_permissions_snapshot error:", {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    throw new Error("Brak uprawnień.");
  }
  if (!data) throw new Error("Brak uprawnień.");

  // Format A
  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  const permsA =
    obj && typeof obj === "object" ? (obj as any).permissions : null;

  if (Array.isArray(permsA)) {
    if (!permsA.includes(perm)) {
      console.error("requirePermission denied (format A)", {
        perm,
        perms: permsA,
      });
      throw new Error("Brak uprawnień.");
    }
    return supabase;
  }

  // Format B
  if (Array.isArray(data)) {
    const allowed = new Set(
      (data as any[])
        .filter((r) => r?.allowed)
        .map((r) => String(r.key))
        .filter(Boolean)
    );

    if (!allowed.has(perm)) {
      console.error("requirePermission denied (format B)", {
        perm,
        allowed: [...allowed],
      });
      throw new Error("Brak uprawnień.");
    }
    return supabase;
  }

  console.error("requirePermission: unknown snapshot shape", data);
  throw new Error("Brak uprawnień.");
}

async function getCurrentAccountIdOrThrow(
  supabase: Awaited<ReturnType<typeof db>>
) {
  const { data: accountId, error } = await supabase.rpc("current_account_id");

  if (error) {
    console.error("current_account_id RPC error:", {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
  }

  if (!accountId) throw new Error("Brak wybranego konta (current_account_id).");
  return String(accountId);
}

function getMaterialsImagePermission(): string {
  // Jeśli masz osobny perm na obrazki – użyj go.
  // Jak nie masz – fallback na MATERIALS_WRITE (żeby plik działał bez zmian w permissions.ts)
  return (PERM as any).MATERIALS_UPDATE_IMAGE ?? PERM.MATERIALS_WRITE;
}

/* -------------------------------------------------------------------------- */
/*                                MATERIAŁY                                   */
/* -------------------------------------------------------------------------- */

export async function createMaterial(formData: FormData) {
  const supabase = await db();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Brak sesji. Zaloguj się ponownie.");

  const title = String(formData.get("title") || "").trim();
  const unit = String(formData.get("unit") || "szt").trim();
  const baseQty = Number(formData.get("base_quantity") || 0);

  const currentQty =
    formData.get("current_quantity") === null ||
    formData.get("current_quantity") === ""
      ? baseQty
      : Number(formData.get("current_quantity"));

  const description = String(formData.get("description") || "").trim();
  const ctaUrl = String(formData.get("cta_url") || "").trim() || null;

  if (!title || !unit) throw new Error("Brak wymaganych pól (title, unit).");

  const { data: rpcData, error: e1 } = await supabase.rpc("create_material", {
    p_title: title,
    p_description: description || "",
    p_unit: unit,
    p_base_quantity: baseQty,
    p_current_quantity: currentQty,
    p_image_url: null,
    p_cta_url: ctaUrl,
    p_family_key: null,
  });

  if (e1) {
    const norm = {
      code: e1.code,
      message: e1.message,
      details: (e1 as any).details,
      hint: (e1 as any).hint,
    };
    console.error("create_material RPC error:", norm);

    if (e1.code === "23505") {
      throw new Error(
        "Tytuł już istnieje w aktywnych materiałach. Zmień tytuł lub przywróć z kosza."
      );
    }

    throw new Error(`create_material RPC error: ${norm.message || "błąd"}`);
  }

  const materialId: string =
    typeof rpcData === "string" ? rpcData : (rpcData as any)?.id;

  if (!materialId) throw new Error("create_material nie zwrócił ID.");

  // Jeśli chcesz upload zdjęcia już przy tworzeniu:
  const file = (formData.get("image") as File | null) ?? null;
  if (file && file.size > 0) {
    // tu możesz wymagać osobnego perm, ale create i tak zwykle mają tylko storeman/manager/owner
    const accountId = await getCurrentAccountIdOrThrow(supabase);

    // STAŁA ŚCIEŻKA -> zero śmieci
    const path = `${accountId}/materials/${materialId}.jpg`;

    const { error: upErr } = await supabase.storage
      .from("material-images")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (!upErr) {
      const { data: pub } = await supabase.storage
        .from("material-images")
        .getPublicUrl(path);

      const publicUrl = pub?.publicUrl ?? null;

      if (publicUrl) {
        // cache-bust w DB, żeby stare się nie wyświetlało
        const imageUrl = `${publicUrl}?v=${Date.now()}`;

        const { error: updRpcErr } = await supabase.rpc("update_material", {
          p_id: materialId,
          p_patch: { image_url: imageUrl },
        } as any);

        if (updRpcErr) {
          if (isNoSuchFunction(updRpcErr)) {
            const { error: updErr } = await supabase
              .from("materials")
              .update({ image_url: imageUrl })
              .eq("id", materialId)
              .limit(1);

            if (updErr) {
              console.warn(
                "createMaterial: fallback UPDATE image_url error",
                updErr.message
              );
            }
          } else {
            console.warn(
              "createMaterial: update_material RPC error",
              updRpcErr.message
            );
          }
        }
      }
    } else {
      console.warn("createMaterial: upload error", upErr.message);
    }
  }

  refresh(["/materials", "/low-stock"]);
  return materialId;
}

export async function updateMaterial(id: string, patch: Record<string, any>) {
  // Gate ogólny dla edycji materiału
  const supabase = await requirePermission(PERM.MATERIALS_WRITE);

  // DODATKOWY gate tylko dla obrazka (owner/manager/storeman)
  if (patch && Object.prototype.hasOwnProperty.call(patch, "image_url")) {
    await requirePermission(getMaterialsImagePermission());
  }

  const allowed = new Set([
    "title",
    "description",
    "unit",
    "base_quantity",
    "current_quantity",
    "cta_url",
    "image_url",
  ]);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!allowed.has(k)) continue;

    if (k === "base_quantity" || k === "current_quantity") {
      clean[k] = Number(v);
    } else if (v === "" && ["description", "cta_url", "image_url"].includes(k)) {
      clean[k] = null;
    } else {
      clean[k] = v;
    }
  }

  if (Object.keys(clean).length === 0) return;

  // 1) RPC jeśli istnieje
  const { error: rpcErr } = await supabase.rpc("update_material", {
    p_id: id,
    p_patch: clean,
  } as any);

  if (rpcErr) {
    // 2) brak RPC / schema cache → fallback na direct update
    // UWAGA: to wymaga żeby audit trigger działał poprawnie (SECURITY DEFINER w fn_materials_audit)
    if (isNoSuchFunction(rpcErr)) {
      const { error } = await supabase
        .from("materials")
        .update(clean)
        .eq("id", id)
        .limit(1);

      if (error) throw new Error(error.message);
    } else {
      throw new Error(rpcErr.message);
    }
  }

  refresh(["/materials", `/materials/${id}`, "/low-stock"]);
}

/**
 * Podmiana zdjęcia materiału – tylko dla storeman/manager/owner (przez permissions).
 * Nie śmieci w storage: zawsze nadpisujemy ten sam obiekt.
 *
 * FormData:
 * - material_id: string
 * - file: File
 */
export async function uploadMaterialImage(formData: FormData): Promise<void> {
  // TWARDY gate dla obrazków
  const supabase = await requirePermission(getMaterialsImagePermission());

  const materialId = String(formData.get("material_id") ?? "").trim();
  const file = (formData.get("file") as File | null) ?? null;

  if (!materialId) throw new Error("Brak material_id.");
  if (!file || file.size <= 0) throw new Error("Brak pliku.");

  const accountId = await getCurrentAccountIdOrThrow(supabase);

  // STAŁA ŚCIEŻKA => zero “starych plików”
  const path = `${accountId}/materials/${materialId}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("material-images")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (upErr) {
    console.error("uploadMaterialImage: storage upload error:", upErr);
    throw new Error(upErr.message || "Nie udało się wgrać zdjęcia.");
  }

  const { data: pub } = await supabase.storage
    .from("material-images")
    .getPublicUrl(path);

  const publicUrl = pub?.publicUrl ?? null;
  if (!publicUrl) throw new Error("Nie udało się pobrać publicUrl.");

  // Cache-bust -> UI nie pokaże starego
  const imageUrl = `${publicUrl}?v=${Date.now()}`;

  // Ustawiamy image_url przez updateMaterial (zachowa logikę RPC/fallback + revalidate)
  await updateMaterial(materialId, { image_url: imageUrl });

  refresh(["/materials", `/materials/${materialId}`, "/low-stock"]);
}

export async function softDeleteMaterial(id: string) {
  const supabase = await db();

  const { error: rpcErr } = await supabase.rpc("soft_delete_material", {
    p_id: id,
  });

  if (rpcErr) {
    if (isNoSuchFunction(rpcErr)) {
      const { error } = await supabase
        .from("materials")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .limit(1);

      if (error) throw new Error(error.message);
    } else {
      throw new Error(rpcErr.message);
    }
  }

  refresh(["/materials", `/materials/${id}`, "/low-stock"]);
}

export async function restoreMaterial(id: string) {
  const supabase = await db();

  const { error: rpcErr } = await supabase.rpc("restore_material", {
    p_id: id,
  });

  if (rpcErr) {
    if (isNoSuchFunction(rpcErr)) {
      const { error } = await supabase
        .from("materials")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", id)
        .limit(1);

      if (error) throw new Error(error.message);
    } else {
      throw new Error(rpcErr.message);
    }
  }

  refresh(["/materials", `/materials/${id}`, "/low-stock"]);
}

/* -------------------------------------------------------------------------- */
/*                 DOSTAWY – CREATE / DELETE / PAID / APPROVE                  */
/* -------------------------------------------------------------------------- */

export async function createDelivery(formData: FormData): Promise<string> {
  const supabase = await requirePermission(PERM.DELIVERIES_CREATE);

  const rawDate = String(formData.get("date") ?? "").trim();
  const placeLabel = String(formData.get("place_label") ?? "").trim() || null;
  const person = String(formData.get("person") ?? "").trim() || null;
  const supplier = String(formData.get("supplier") ?? "").trim() || null;

  if (!rawDate) throw new Error("Brak daty dostawy.");

  const deliveryCostRaw = String(formData.get("delivery_cost") ?? "").trim();
  const materialsCostRaw = String(formData.get("materials_cost") ?? "").trim();

  const deliveryCost =
    deliveryCostRaw === "" ? null : Number(deliveryCostRaw.replace(",", "."));
  const materialsCost =
    materialsCostRaw === ""
      ? null
      : Number(materialsCostRaw.replace(",", "."));

  let isoDate = rawDate;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split(".");
    isoDate = `${yyyy}-${mm}-${dd}`;
  }

  const itemsJson = String(formData.get("items_json") ?? "[]");
  let items: any[] = [];
  try {
    const parsed = JSON.parse(itemsJson);
    if (Array.isArray(parsed)) items = parsed;
  } catch {}

  const accountId = await getCurrentAccountIdOrThrow(supabase);

  const invoiceFile = (formData.get("invoice") as File | null) ?? null;
  let invoicePath: string | null = null;

  if (invoiceFile && invoiceFile.size > 0) {
    const safeName = invoiceFile.name.replace(/\s+/g, "-");
    const path = `${accountId}/invoices/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("invoices")
      .upload(path, invoiceFile, {
        upsert: true,
        contentType: invoiceFile.type || "application/octet-stream",
      });

    if (!upErr) invoicePath = path;
  }

  const { data, error } = await supabase.rpc("create_delivery", {
    p_date: isoDate,
    p_place_label: placeLabel,
    p_person: person,
    p_supplier: supplier,
    p_delivery_cost: deliveryCost,
    p_materials_cost: materialsCost,
    p_invoice_url: invoicePath,
    p_items: items,
  });

  if (error) throw new Error(error.message || "Nie udało się utworzyć dostawy.");

  const deliveryId: string =
    typeof data === "string" ? data : (data as any)?.id;
  if (!deliveryId) throw new Error("create_delivery: brak ID w odpowiedzi");

  refresh([
    "/deliveries",
    "/reports/deliveries",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);

  return deliveryId;
}

export async function softDeleteDelivery(id: string) {
  const trimmed = String(id || "").trim();
  if (!trimmed) return;

  const supabase = await requirePermission(PERM.DELIVERIES_DELETE_UNAPPROVED);

  const { error } = await supabase.rpc("soft_delete_delivery", {
    p_delivery_id: trimmed,
  });

  if (error) throw new Error(error.message);

  refresh(["/reports/deliveries", "/deliveries"]);
}

export async function restoreDelivery(id: string) {
  const trimmed = String(id || "").trim();
  if (!trimmed) return;

  const supabase = await requirePermission(PERM.DELIVERIES_DELETE_UNAPPROVED);

  const { error } = await supabase.rpc("restore_delivery", {
    p_delivery_id: trimmed,
  });

  if (error) throw new Error(error.message);

  refresh(["/reports/deliveries", "/deliveries"]);
}

export async function markDeliveryPaid(formData: FormData): Promise<void> {
  const id = String(formData.get("delivery_id") ?? "").trim();
  if (!id) return;

  const supabase = await requirePermission(PERM.DELIVERIES_UPDATE_UNAPPROVED);

  const { error } = await supabase.rpc("mark_delivery_paid", {
    p_delivery_id: id,
  });

  if (error) throw new Error(error.message || "Nie udało się oznaczyć opłacenia.");

  refresh([
    "/reports/deliveries",
    "/low-stock",
    "/deliveries",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);
}

export async function approveDelivery(formData: FormData): Promise<void> {
  const id = String(formData.get("delivery_id") ?? "").trim();
  if (!id) return;

  const supabase = await requirePermission(PERM.DELIVERIES_APPROVE);

  const { error } = await supabase.rpc("add_delivery_and_update_stock", {
    p_delivery_id: id,
  });

  if (error) throw new Error(error.message || "Nie udało się zatwierdzić dostawy.");

  refresh([
    "/deliveries",
    "/reports/deliveries",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);
}

export async function approveDailyReport(formData: FormData): Promise<void> {
  const id = String(formData.get("report_id") ?? "").trim();
  if (!id) return;

  const supabase = await db();

  // 1) zatwierdzenie + aktualizacja stanów
  const { error } = await supabase.rpc("subtract_usage_and_update_stock", {
    p_report_id: id,
  });

  if (error) throw new Error(error.message || "Nie udało się zatwierdzić raportu.");

  // 2) NOWE: jeśli raport ma task_id + is_completed=true -> ustaw task done (SECURITY DEFINER)
  const { error: taskErr } = await supabase.rpc("complete_task_from_daily_report", {
    p_report_id: id,
  });

  if (taskErr) {
    // nie wywracaj całego approve jeśli nie ma RPC (dev) albo cache, ale loguj
    if (!isNoSuchFunction(taskErr)) {
      throw new Error(taskErr.message || "Nie udało się zaktualizować statusu zadania.");
    }
  }

  refresh([
    "/reports/daily",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
    "/tasks",
    "/object",
  ]);
}


/* -------------------------------------------------------------------------- */
/*                 DZIENNE RAPORTY – CREATE Z ZADANIAMI (OBIEKT)              */
/* -------------------------------------------------------------------------- */

export type DailyReportItemInput = {
  materialId: string;
  qtyUsed: number;
  note?: string | null;
};

export type CompletedTaskMetaInput = {
  taskId: string;
  note?: string | null;
  completedByMemberId?: string | null;
  photoUrls?: string[];
};

export interface CreateDailyReportWithTasksInput {
  date: string;
  crewId: string;
  stageId?: string | null;
  items: DailyReportItemInput[];
  completedTasks: CompletedTaskMetaInput[];
}

export async function createDailyReportWithTasks(
  input: CreateDailyReportWithTasksInput
): Promise<string> {
  const supabase = await db();

  const trimmedDate = String(input.date || "").trim();
  if (!trimmedDate) throw new Error("Brak daty raportu (date).");

  const crewId = String(input.crewId || "").trim();
  if (!crewId) throw new Error("Brak crewId.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const createdByUserId = user?.id ?? null;

  const itemsPayload =
    input.items?.map((it) => ({
      material_id: it.materialId,
      qty_used: Number(it.qtyUsed),
      note: it.note ?? null,
    })) ?? [];

  const { data: reportRow, error: reportErr } = await supabase
    .from("daily_reports")
    .insert({
      date: trimmedDate,
      crew_id: crewId,
      stage_id: input.stageId ?? null,
      items: itemsPayload,
      created_by: createdByUserId,
    })
    .select("id")
    .single();

  if (reportErr) throw new Error(reportErr.message || "Nie udało się zapisać raportu.");

  const reportId: string = (reportRow as any).id;
  if (!reportId) throw new Error("Brak id raportu.");

  const completedTasks = input.completedTasks ?? [];
  if (completedTasks.length === 0) {
    refresh(["/reports/daily"]);
    return reportId;
  }

  for (const task of completedTasks) {
    const taskId = String(task.taskId || "").trim();
    if (!taskId) continue;

    const { data: completionRow, error: compErr } = await supabase
      .from("task_completions")
      .insert({
        task_id: taskId,
        daily_report_id: reportId,
        completed_by_member_id: task.completedByMemberId ?? null,
        note: task.note ?? null,
      })
      .select("id")
      .single();

    if (compErr) throw new Error(compErr.message || "Nie udało się zapisać zakończenia zadania.");

    const completionId: string = (completionRow as any).id;

    const photoUrls = task.photoUrls ?? [];
    if (completionId && photoUrls.length > 0) {
      const rows = photoUrls.map((url) => ({
        task_completion_id: completionId,
        url,
      }));

      await supabase.from("task_completion_attachments").insert(rows);
    }

    await supabase
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", taskId)
      .neq("status", "done");
  }

  refresh(["/reports/daily", "/tasks", "/object"]);
  return reportId;
}
