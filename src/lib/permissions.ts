// src/lib/permissions.ts

/**
 * SOURCE OF TRUTH (frontend) = keys + normalizacja zgodna z DB.
 *
 * Prawda o tym "kto może" jest w DB:
 *  - public.has_permission(p_key, account_id)
 *  - public.my_permissions_snapshot()
 *
 * Ten plik trzyma:
 *  - kanoniczne klucze permissions (PERM.*)
 *  - normalizację kluczy (backward-compat) IDENTYCZNĄ jak w DB
 *  - helpery can / canAny / canAll do UI
 *
 * UWAGA:
 * snapshot.permissions pochodzi z DB jako text[]
 * → w TS to jest string[], NIE PermissionKey[]
 */

export const PERM = {
  /* ------------------------------------------------------------------ */
  /* Inventory / Low stock                                               */
  /* ------------------------------------------------------------------ */
  INVENTORY_READ: "inventory.read",
  INVENTORY_MANAGE: "inventory.manage",

  LOW_STOCK_READ: "low_stock.read",
  LOW_STOCK_MANAGE: "low_stock.manage",

  /* ------------------------------------------------------------------ */
  /* Materials                                                           */
  /* ------------------------------------------------------------------ */
  MATERIALS_READ: "materials.read",
  MATERIALS_WRITE: "materials.write",
  MATERIALS_SOFT_DELETE: "materials.soft_delete",

  // tylko owner + manager
  MATERIALS_AUDIT_READ: "materials.audit.read",

  /* ------------------------------------------------------------------ */
  /* Deliveries                                                          */
  /* ------------------------------------------------------------------ */
  DELIVERIES_READ: "deliveries.read",
  DELIVERIES_CREATE: "deliveries.create",
  DELIVERIES_UPDATE_UNAPPROVED: "deliveries.update_unapproved",
  DELIVERIES_DELETE_UNAPPROVED: "deliveries.delete_unapproved",
  DELIVERIES_APPROVE: "deliveries.approve",

  /* ------------------------------------------------------------------ */
  /* Daily reports                                                       */
  /* ------------------------------------------------------------------ */
  DAILY_REPORTS_READ: "daily_reports.read",
  DAILY_REPORTS_CREATE: "daily_reports.create",
  DAILY_REPORTS_UPDATE_UNAPPROVED: "daily_reports.update_unapproved",
  DAILY_REPORTS_APPROVE: "daily_reports.approve",

  // zdjęcia (zgodne z DB + storage policies)
  DAILY_REPORTS_PHOTOS_UPLOAD: "daily_reports.photos.upload",
  DAILY_REPORTS_PHOTOS_DELETE: "daily_reports.photos.delete",

  // UI-ALIASY (nie istnieją jako osobne permissions w DB)
  // → mapowane na DAILY_REPORTS_APPROVE
  DAILY_REPORTS_QUEUE: "daily_reports.queue",
  DAILY_REPORTS_DELETE_UNAPPROVED: "daily_reports.delete_unapproved",

  /* ------------------------------------------------------------------ */
  /* Tasks                                                               */
  /* ------------------------------------------------------------------ */
  TASKS_READ_OWN: "tasks.read.own",
  TASKS_READ_ALL: "tasks.read.all",
  TASKS_UPDATE_OWN: "tasks.update.own",
  TASKS_UPDATE_ALL: "tasks.update.all",
  TASKS_ASSIGN: "tasks.assign",
  TASKS_UPLOAD_PHOTOS: "tasks.upload_photos",

  /* ------------------------------------------------------------------ */
  /* Metrics / Reports                                                   */
  /* ------------------------------------------------------------------ */
  METRICS_READ: "metrics.read",
  METRICS_MANAGE: "metrics.manage",

  REPORTS_DELIVERIES_READ: "reports.deliveries.read",
  REPORTS_DELIVERIES_INVOICES_READ: "reports.deliveries.invoices.read",
  REPORTS_STAGES_READ: "reports.stages.read",
  REPORTS_ITEMS_READ: "reports.items.read",
  REPORTS_INVENTORY_READ: "reports.inventory.read",

  /* ------------------------------------------------------------------ */
  /* Team / Crews                                                        */
  /* ------------------------------------------------------------------ */
  TEAM_READ: "team.read",
  TEAM_MEMBER_READ: "team.member.read",
  TEAM_MEMBER_FORCE_RESET: "team.member.force_reset",
  TEAM_INVITE: "team.invite",
  TEAM_REMOVE: "team.remove",
  TEAM_MANAGE_ROLES: "team.manage_roles",
  TEAM_MANAGE_CREWS: "team.manage_crews",

  CREWS_READ: "crews.read",

  /**
   * Legacy/umbrella:
   * - jeśli ktoś ma crews.manage, traktujemy to jako prawo do crews.*
   * (dopóki DB nie przejdzie w 100% na granularne klucze)
   */
  CREWS_MANAGE: "crews.manage",

  /**
   * Granularne (często to właśnie ich wymaga DB/RPC):
   * - create/update/delete/assign/change_leader
   *
   * Jeśli w DB nie istnieją wszystkie — to nie szkodzi dla UI,
   * ale warto je mieć jako kanon i potem ujednolicić w DB.
   */
  CREWS_CREATE: "crews.create",
  CREWS_UPDATE: "crews.update",
  CREWS_DELETE: "crews.delete",
  CREWS_ASSIGN: "crews.assign",
  CREWS_CHANGE_LEADER: "crews.change_leader",

  /* ------------------------------------------------------------------ */
  /* Project / Settings                                                  */
  /* ------------------------------------------------------------------ */
  PROJECT_MANAGE: "project.manage",
  PROJECT_SETTINGS_MANAGE: "project.settings.manage",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];
export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERM);

/* ------------------------------------------------------------------ */
/* Normalizacja kluczy – MUSI odpowiadać DB                            */
/* ------------------------------------------------------------------ */
/**
 * DB mapuje:
 *  - deliveries.update  -> deliveries.update_unapproved
 *  - deliveries.delete  -> deliveries.delete_unapproved
 *  - materials.delete   -> materials.soft_delete
 *
 * UI-ALIASY:
 *  - daily_reports.queue               -> daily_reports.approve
 *  - daily_reports.delete_unapproved   -> daily_reports.approve
 */
export function normalizePermissionKey(key: string): string {
  const k = String(key || "").trim();

  // legacy / backward compat
  if (k === "deliveries.update") return PERM.DELIVERIES_UPDATE_UNAPPROVED;
  if (k === "deliveries.delete") return PERM.DELIVERIES_DELETE_UNAPPROVED;
  if (k === "materials.delete") return PERM.MATERIALS_SOFT_DELETE;

  // UI-aliasy → approve
  if (k === PERM.DAILY_REPORTS_QUEUE) return PERM.DAILY_REPORTS_APPROVE;
  if (k === PERM.DAILY_REPORTS_DELETE_UNAPPROVED) return PERM.DAILY_REPORTS_APPROVE;

  return k;
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */
export type PermissionSnapshot = {
  account_id: string | null;
  role: "owner" | "manager" | "storeman" | "worker" | "foreman" | string | null;
  permissions: string[]; // text[] z DB
};

/* ------------------------------------------------------------------ */
/* Type-guard                                                          */
/* ------------------------------------------------------------------ */
export function isPermissionKey(x: string): x is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(x);
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */
function normalizeSnapshotPermissions(snapshot: PermissionSnapshot | null | undefined): string[] {
  const permsRaw = Array.isArray((snapshot as any)?.permissions) ? (snapshot as any).permissions : [];
  return permsRaw.map((p: unknown) => String(p ?? "").trim()).filter(Boolean);
}

/**
 * Sprawdza czy user ma daną permisję (po normalizacji).
 *
 * Dodatkowo (ważne dla Twoich bugów):
 * - tasks.read.all => traktujemy jak tasks.read.own (żeby "Moje zadania" nie znikało)
 * - tasks.update.all => traktujemy jak tasks.update.own
 * - crews.manage / team.manage_crews => traktujemy jak crews.* (umbrella)
 */
export function can(snapshot: PermissionSnapshot | null | undefined, key: PermissionKey): boolean {
  if (!snapshot) return false;

  const normalizedKey = normalizePermissionKey(key);
  const perms = normalizeSnapshotPermissions(snapshot);

  // direct
  if (perms.includes(normalizedKey)) return true;

  // tasks: ALL implikuje OWN (to naprawia "Moje zadania" gdy masz tylko tasks.read.all)
  if (normalizedKey === PERM.TASKS_READ_OWN && perms.includes(PERM.TASKS_READ_ALL)) return true;
  if (normalizedKey === PERM.TASKS_UPDATE_OWN && perms.includes(PERM.TASKS_UPDATE_ALL)) return true;

  // crews umbrella:
  // jeśli ktoś ma crews.manage lub team.manage_crews, uznajemy że ma crews.* (create/update/delete/assign/...)
  if (
    normalizedKey.startsWith("crews.") &&
    (perms.includes(PERM.CREWS_MANAGE) || perms.includes(PERM.TEAM_MANAGE_CREWS))
  ) {
    return true;
  }

  return false;
}

export function canAny(snapshot: PermissionSnapshot | null | undefined, keys: PermissionKey[]): boolean {
  if (!snapshot) return false;
  return keys.some((k) => can(snapshot, k));
}

export function canAll(snapshot: PermissionSnapshot | null | undefined, keys: PermissionKey[]): boolean {
  if (!snapshot) return false;
  return keys.every((k) => can(snapshot, k));
}

/* ------------------------------------------------------------------ */
/* Grupy do Sidebar / menu                                             */
/* ------------------------------------------------------------------ */
export const PERM_GROUPS = {
  warehouse: [
    PERM.LOW_STOCK_READ,
    PERM.LOW_STOCK_MANAGE,

    PERM.MATERIALS_READ,
    PERM.MATERIALS_WRITE,
    PERM.MATERIALS_SOFT_DELETE,

    PERM.DELIVERIES_READ,
    PERM.DELIVERIES_CREATE,
    PERM.DELIVERIES_UPDATE_UNAPPROVED,
    PERM.DELIVERIES_DELETE_UNAPPROVED,
    PERM.DELIVERIES_APPROVE,

    PERM.DAILY_REPORTS_READ,
    PERM.DAILY_REPORTS_CREATE,
    PERM.DAILY_REPORTS_UPDATE_UNAPPROVED,
    PERM.DAILY_REPORTS_APPROVE,

    // zdjęcia raportów dziennych
    PERM.DAILY_REPORTS_PHOTOS_UPLOAD,
    PERM.DAILY_REPORTS_PHOTOS_DELETE,

    // aliasy UI (mapowane na approve)
    PERM.DAILY_REPORTS_QUEUE,
    PERM.DAILY_REPORTS_DELETE_UNAPPROVED,

    PERM.INVENTORY_READ,
    PERM.INVENTORY_MANAGE,
  ],

  tasks: [
    PERM.TASKS_READ_OWN,
    PERM.TASKS_READ_ALL,
    PERM.TASKS_UPDATE_OWN,
    PERM.TASKS_UPDATE_ALL,
    PERM.TASKS_ASSIGN,
    PERM.TASKS_UPLOAD_PHOTOS,
  ],

  reports: [
    PERM.METRICS_READ,
    PERM.METRICS_MANAGE,

    PERM.REPORTS_DELIVERIES_READ,
    PERM.REPORTS_DELIVERIES_INVOICES_READ,
    PERM.REPORTS_STAGES_READ,
    PERM.REPORTS_ITEMS_READ,
    PERM.REPORTS_INVENTORY_READ,

    PERM.MATERIALS_AUDIT_READ,
  ],

  team: [
    PERM.TEAM_READ,
    PERM.TEAM_MEMBER_READ,
    PERM.TEAM_MEMBER_FORCE_RESET,
    PERM.TEAM_INVITE,
    PERM.TEAM_REMOVE,
    PERM.TEAM_MANAGE_ROLES,
    PERM.TEAM_MANAGE_CREWS,

    PERM.CREWS_READ,
    PERM.CREWS_MANAGE,

    // granularne (na przyszłość + pod route'y)
    PERM.CREWS_CREATE,
    PERM.CREWS_UPDATE,
    PERM.CREWS_DELETE,
    PERM.CREWS_ASSIGN,
    PERM.CREWS_CHANGE_LEADER,
  ],

  project: [PERM.PROJECT_MANAGE, PERM.PROJECT_SETTINGS_MANAGE],
} as const;
