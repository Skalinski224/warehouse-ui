// src/lib/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";

/* -------------------------------------------------------------------------- */
/*                            POMOCNICZE / UTILS                              */
/* -------------------------------------------------------------------------- */

async function db() {
  // zawsze używamy klienta server-side (SERVICE_ROLE)
  return await supabaseServer();
}

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

function isNoSuchFunction(err: any) {
  const msg = String(err?.message || "");
  return (
    err?.code === "42883" ||
    /function .* does not exist/i.test(msg) ||
    /42883/.test(msg)
  );
}

/* -------------------------------------------------------------------------- */
/*                                MATERIAŁY                                   */
/* -------------------------------------------------------------------------- */

/**
 * Tworzy materiał:
 * 1) woła RPC create_material(...)
 * 2) (opcjonalnie) uploaduje obraz do storage i uzupełnia image_url
 * Zwraca id materiału.
 */
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
  const file = (formData.get("image") as File | null) ?? null;

  if (!title || !unit) throw new Error("Brak wymaganych pól (title, unit).");

  // --- 1) RPC create_material ---
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

    throw new Error(
      `create_material RPC error: ${norm.message || "nieznany błąd"}`
    );
  }

  const materialId: string =
    typeof rpcData === "string" ? rpcData : (rpcData as any)?.id;
  if (!materialId) throw new Error("create_material nie zwrócił ID.");

  // --- 2) Upload miniatury do storage (opcjonalny) ---
  if (file && file.size > 0) {
    const { data: userData } = await supabase.auth.getUser();
    const accountId =
      (userData?.user?.app_metadata as any)?.account_id ||
      (userData?.user?.user_metadata as any)?.account_id;

    if (!accountId) {
      console.warn("createMaterial: brak account_id w JWT – pomijam upload");
    } else {
      const ext =
        (file.type && file.type.split("/")[1]) ||
        (file.name.includes(".") ? file.name.split(".").pop() : "jpg");
      const path = `${accountId}/materials/${materialId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("material-images")
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });

      if (upErr) {
        console.warn("createMaterial: upload error", upErr.message);
      } else {
        const { data: pub } = await supabase.storage
          .from("material-images")
          .getPublicUrl(path);
        const imageUrl = pub?.publicUrl ?? null;

        // update_material RPC lub fallback UPDATE
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
            if (updErr)
              console.warn(
                "createMaterial: fallback UPDATE image_url error",
                updErr.message
              );
          } else {
            console.warn(
              "createMaterial: update_material RPC error",
              updRpcErr.message
            );
          }
        }
      }
    }
  }

  refresh(["/materials", "/low-stock"]);
  return materialId;
}

/* -------------------------------------------------------------------------- */
/*                               UPDATE MATERIAL                              */
/* -------------------------------------------------------------------------- */

export async function updateMaterial(
  id: string,
  patch: Record<string, any>
) {
  const supabase = await db();

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
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;

    if (k === "base_quantity" || k === "current_quantity") {
      clean[k] = Number(v);
    } else if (
      v === "" &&
      ["description", "cta_url", "image_url"].includes(k)
    ) {
      clean[k] = null;
    } else {
      clean[k] = v;
    }
  }

  if (Object.keys(clean).length === 0) return;

  const { error } = await supabase
    .from("materials")
    .update(clean)
    .eq("id", id)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  refresh(["/materials", `/materials/${id}`, "/low-stock"]);
}

/* -------------------------------------------------------------------------- */
/*                               DELETE / RESTORE                             */
/* -------------------------------------------------------------------------- */

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
/*                          DOSTAWY – CREATE / DELETE                         */
/* -------------------------------------------------------------------------- */

/**
 * Tworzy nową dostawę "oczekującą" przez RPC create_delivery.
 *
 * FormData – oczekiwane pola:
 * - date           – string (np. "2025-11-19" albo "19.11.2025")
 * - place_label    – miejsce (tekst)
 * - person         – zgłaszający
 * - supplier       – dostawca (opcjonalnie)
 * - delivery_cost  – koszt dostawy (number)
 * - materials_cost – koszt materiałów (number)
 * - invoice        – File (opcjonalnie, input typu "file")
 * - items_json     – string JSON tablicy pozycji:
 *                    [{ material_id, qty, unit_price }, ...]
 */
export async function createDelivery(formData: FormData): Promise<string> {
  const supabase = await db();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Brak sesji. Zaloguj się ponownie.");

  // --- 1) odczyt pól prostych ---
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

  // parsowanie daty – akceptujemy "YYYY-MM-DD" oraz "DD.MM.YYYY"
  let isoDate = rawDate;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDate)) {
    const [dd, mm, yyyy] = rawDate.split(".");
    isoDate = `${yyyy}-${mm}-${dd}`;
  }

  // --- 2) parse items_json ---
  const itemsJson = String(formData.get("items_json") ?? "[]");
  let items: any[] = [];
  try {
    const parsed = JSON.parse(itemsJson);
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      console.warn(
        "createDelivery: items_json nie jest tablicą, pomijam",
        parsed
      );
    }
  } catch (e) {
    console.warn("createDelivery: nie udało się sparsować items_json", e);
  }

  // --- 3) upload faktury (opcjonalny) ---
  const invoiceFile = (formData.get("invoice") as File | null) ?? null;
  let invoicePath: string | null = null;

  if (invoiceFile && invoiceFile.size > 0) {
    const { data: userData } = await supabase.auth.getUser();
    const accountId =
      (userData?.user?.app_metadata as any)?.account_id ||
      (userData?.user?.user_metadata as any)?.account_id;

    if (!accountId) {
      console.warn(
        "createDelivery: brak account_id w JWT – pomijam upload faktury"
      );
    } else {
      const ext =
        (invoiceFile.type && invoiceFile.type.split("/")[1]) ||
        (invoiceFile.name.includes(".")
          ? invoiceFile.name.split(".").pop()
          : "pdf");

      const safeName = invoiceFile.name.replace(/\s+/g, "-");
      const path = `${accountId}/invoices/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("invoices")
        .upload(path, invoiceFile, {
          upsert: true,
          contentType: invoiceFile.type || "application/octet-stream",
        });

      if (upErr) {
        console.warn("createDelivery: upload faktury error", upErr.message);
      } else {
        invoicePath = path;
      }
    }
  }

  // --- 4) RPC create_delivery ---
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

  if (error) {
    const norm = {
      code: error.code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    };
    console.error("create_delivery RPC error:", norm);
    throw new Error(norm.message || "Nie udało się utworzyć dostawy.");
  }

  const deliveryId: string =
    typeof data === "string" ? data : (data as any)?.id;
  if (!deliveryId) {
    console.warn("create_delivery: brak ID w odpowiedzi, data =", data);
  }

  refresh([
    "/deliveries",
    "/reports/deliveries",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);

  return deliveryId || "";
}

/**
 * Soft-delete dostawy (pod "historia usuniętych").
 */
export async function softDeleteDelivery(id: string) {
  const trimmed = id.trim();
  if (!trimmed) {
    console.error("softDeleteDelivery: pusty id");
    return;
  }

  const supabase = await db();
  const { error } = await supabase.rpc("soft_delete_delivery", {
    p_delivery_id: trimmed,
  });

  if (error) {
    console.error("soft_delete_delivery RPC error:", error);
    throw new Error(error.message);
  }

  refresh(["/reports/deliveries", "/deliveries"]);
}

/**
 * Przywraca wcześniej miękko usuniętą dostawę.
 */
export async function restoreDelivery(id: string) {
  const trimmed = id.trim();
  if (!trimmed) {
    console.error("restoreDelivery: pusty id");
    return;
  }

  const supabase = await db();
  const { error } = await supabase.rpc("restore_delivery", {
    p_delivery_id: trimmed,
  });

  if (error) {
    console.error("restore_delivery RPC error:", error);
    throw new Error(error.message);
  }

  refresh(["/reports/deliveries", "/deliveries"]);
}

/* -------------------------------------------------------------------------- */
/*                          DOSTAWY / RAPORTY (RPC)                           */
/* -------------------------------------------------------------------------- */

/**
 * Akceptuje dostawę:
 * 1) woła add_delivery_and_update_stock(p_delivery_id)
 * 2) odświeża widoki
 *
 * Używane jako server action z <form>, więc id bierzemy z FormData.
 */
export async function approveDelivery(formData: FormData): Promise<void> {
  const id = String(formData.get("delivery_id") ?? "").trim();
  if (!id) {
    console.error("approveDelivery: brak delivery_id");
    return;
  }

  const supabase = await db();

  const { error } = await supabase.rpc("add_delivery_and_update_stock", {
    // NAZWA PARAMETRU MUSI BYĆ TAKA JAK W SQL:
    p_delivery_id: id,
  });

  if (error) {
    console.error("approveDelivery RPC error:", {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    // jak chcesz, możesz tu jeszcze rzucić Error, żeby UI pokazał błąd
    // throw new Error("Nie udało się zaakceptować dostawy.");
  }

  refresh([
    "/deliveries",
    "/reports/deliveries",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);
}

/**
 * Akceptuje dzienny raport zużycia:
 * 1) woła subtract_usage_and_update_stock(p_report_id)
 * 2) odświeża widoki
 */
export async function approveDailyReport(formData: FormData): Promise<void> {
  const id = String(formData.get("report_id") ?? "").trim();
  if (!id) {
    console.error("approveDailyReport: brak report_id");
    return;
  }

  const supabase = await db();

  const { error } = await supabase.rpc("subtract_usage_and_update_stock", {
    // analogicznie: dopasuj do SQL, u Ciebie jest p_report_id
    p_report_id: id,
  });

  if (error) {
    console.error("approveDailyReport RPC error:", {
      code: (error as any).code,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
    });
    // opcjonalnie: throw new Error("Nie udało się zaakceptować raportu dziennego.");
  }

  refresh([
    "/reports/daily",
    "/low-stock",
    "/materials",
    "/reports/project-metrics",
    "/reports/plan-vs-reality",
  ]);
}

/* -------------------------------------------------------------------------- */
/*                 DZIENNE RAPORTY – CREATE Z ZADANIAMI (OBIEKT)              */
/* -------------------------------------------------------------------------- */

/**
 * DTO zgodne z naszym kanonem backendu:
 * - daily_reports.items: { material_id, qty_used, note }
 * - task_completions: wiążemy task + report + członka
 * - task_completion_attachments: URL-e zdjęć (upload robimy wyżej, np. w API)
 */

export type DailyReportItemInput = {
  materialId: string;
  qtyUsed: number;
  note?: string | null;
};

export type CompletedTaskMetaInput = {
  taskId: string;
  note?: string | null;
  completedByMemberId?: string | null;
  photoUrls?: string[]; // URL-e plików już wrzuconych do storage
};

export interface CreateDailyReportWithTasksInput {
  date: string; // 'YYYY-MM-DD'
  crewId: string;
  stageId?: string | null;
  items: DailyReportItemInput[];
  completedTasks: CompletedTaskMetaInput[];
}

/**
 * Tworzy dzienny raport zużycia + spina go z zadaniami:
 * 1) INSERT do daily_reports (items -> JSONB)
 * 2) dla każdego completedTasks:
 *    - INSERT do task_completions
 *    - INSERT do task_completion_attachments (po URL-ach)
 *    - UPDATE project_tasks SET status = 'done'
 *
 * Uwaga: to NIE jest transakcja w jednej funkcji SQL – jeśli chcesz full-atomic,
 * przeniesiemy to w przyszłości do RPC. Na MVP świadomie akceptujemy ten poziom.
 */
export async function createDailyReportWithTasks(
  input: CreateDailyReportWithTasksInput
): Promise<string> {
  const supabase = await db();

  // 1. sanity-check
  const trimmedDate = String(input.date || "").trim();
  if (!trimmedDate) {
    throw new Error("Brak daty raportu (date).");
  }
  const crewId = String(input.crewId || "").trim();
  if (!crewId) {
    throw new Error("Brak crewId – raport musi być przypisany do brygady.");
  }

  // 2. Auth user -> created_by w daily_reports
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.warn("createDailyReportWithTasks: getUser error:", userError);
  }

  const createdByUserId = user?.id ?? null;

  // 3. Mapowanie items -> struktura JSONB daily_reports.items
  const itemsPayload =
    input.items?.map((it) => ({
      material_id: it.materialId,
      qty_used: Number(it.qtyUsed),
      note: it.note ?? null,
    })) ?? [];

  // 4. INSERT do daily_reports
  const { data: reportRow, error: reportErr } = await supabase
    .from("daily_reports")
    .insert({
      date: trimmedDate,
      crew_id: crewId,
      stage_id: input.stageId ?? null,
      items: itemsPayload,
      created_by: createdByUserId,
      // account_id ustawia się przez default current_account_id()
    })
    .select("id")
    .single();

  if (reportErr) {
    console.error("createDailyReportWithTasks: daily_reports insert error:", {
      code: (reportErr as any).code,
      message: reportErr.message,
      details: (reportErr as any).details,
      hint: (reportErr as any).hint,
    });
    throw new Error(
      reportErr.message || "Nie udało się zapisać raportu dziennego."
    );
  }

  const reportId: string = (reportRow as any).id;
  if (!reportId) {
    throw new Error("createDailyReportWithTasks: daily_reports nie zwrócił id.");
  }

  // 5. Jeśli nie ma zadań -> kończymy
  const completedTasks = input.completedTasks ?? [];
  if (completedTasks.length === 0) {
    refresh(["/reports/daily"]);
    return reportId;
  }

  // 6. Dla każdego zakończonego zadania:
  for (const task of completedTasks) {
    const taskId = String(task.taskId || "").trim();
    if (!taskId) continue;

    // 6.1 task_completions
    const { data: completionRow, error: compErr } = await supabase
      .from("task_completions")
      .insert({
        task_id: taskId,
        daily_report_id: reportId,
        completed_by_member_id: task.completedByMemberId ?? null,
        note: task.note ?? null,
        // account_id ustawi trigger task_completions_set_account_id()
      })
      .select("id")
      .single();

    if (compErr) {
      console.error(
        "createDailyReportWithTasks: task_completions insert error:",
        {
          code: (compErr as any).code,
          message: compErr.message,
          details: (compErr as any).details,
          hint: (compErr as any).hint,
        }
      );
      // nie przerywamy brutalnie całego procesu – ale informujemy
      throw new Error(
        compErr.message ||
          "Nie udało się zapisać informacji o zakończonym zadaniu."
      );
    }

    const completionId: string = (completionRow as any).id;

    // 6.2 task_completion_attachments – tylko jeśli mamy URL-e
    const photoUrls = task.photoUrls ?? [];
    if (completionId && photoUrls.length > 0) {
      const rows = photoUrls.map((url) => ({
        task_completion_id: completionId,
        url,
      }));

      const { error: attachErr } = await supabase
        .from("task_completion_attachments")
        .insert(rows);

      if (attachErr) {
        console.error(
          "createDailyReportWithTasks: attachments insert error:",
          {
            code: (attachErr as any).code,
            message: attachErr.message,
            details: (attachErr as any).details,
            hint: (attachErr as any).hint,
          }
        );
        // nie zabijamy raportu – ale logujemy
      }
    }

    // 6.3 aktualizacja statusu zadania -> 'done'
    const { error: updErr } = await supabase
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", taskId)
      .neq("status", "done");

    if (updErr) {
      console.error(
        "createDailyReportWithTasks: project_tasks update error:",
        {
          code: (updErr as any).code,
          message: updErr.message,
          details: (updErr as any).details,
          hint: (updErr as any).hint,
        }
      );
      // tutaj też tylko log – status zawsze można poprawić ręcznie z UI
    }
  }

  refresh(["/reports/daily", "/tasks", "/object"]);
  return reportId;
}
