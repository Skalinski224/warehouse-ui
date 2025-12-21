// src/lib/safeQuery.ts
import "server-only";

type PostgrestLike<T> = {
  then: (onfulfilled: (value: any) => any, onrejected?: (reason: any) => any) => any;
} & T;

type SafeQueryResult<T> = {
  data: T | null;
  count: number | null;
  error: any | null;
};

/**
 * Wraps Supabase PostgREST queries so pages don't crash.
 * Returns { data, count, error } instead of throwing.
 */
export async function safeQuery<T = any>(
  q: PostgrestLike<any>
): Promise<SafeQueryResult<T>> {
  try {
    const res: any = await q;
    return {
      data: (res?.data ?? null) as T | null,
      count: (typeof res?.count === "number" ? res.count : null) as number | null,
      error: res?.error ?? null,
    };
  } catch (e: any) {
    return { data: null, count: null, error: e };
  }
}
