// src/lib/uploads/uploadInvoice.ts
"use client";

import { uploadInvoice } from "@/app/actions/upload-invoice";

export async function uploadInvoiceClient(file: File) {
  if (!file || file.size === 0) throw new Error("Brak pliku faktury");

  const fd = new FormData();
  fd.append("file", file);

  return await uploadInvoice(fd);
}
