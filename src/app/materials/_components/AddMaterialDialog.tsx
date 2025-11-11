"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AddMaterialDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-add-material", handler);
    return () => document.removeEventListener("open-add-material", handler);
  }, []);

  const [form, setForm] = useState({
    name: "",
    unit: "szt",
    base_quantity: "",
    current_quantity: "",
    image_url: "",
    description: "",
    cta_url: "",
  });

  const base = Number(form.base_quantity || 0);
  const curr = Number(form.current_quantity || 0);
  const disabled = !form.name.trim() || base < 0 || curr < 0;

  async function onSubmit() {
    const payload = {
      name: form.name.trim(),
      unit: form.unit || "szt",
      base_quantity: base,
      current_quantity: curr,
      image_url: form.image_url?.trim() || null,
      description: form.description?.trim() || null,
      cta_url: form.cta_url?.trim() || null,
    };

    const { error } = await supabase.from("materials").insert(payload);
    if (error) {
      alert(error.message);
      return;
    }
    setOpen(false);
    setForm({
      name: "",
      unit: "szt",
      base_quantity: "",
      current_quantity: "",
      image_url: "",
      description: "",
      cta_url: "",
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dodaj materiał</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Nazwa *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="szt">szt</option>
              <option value="m">m</option>
              <option value="kg">kg</option>
              <option value="inne">inne…</option>
            </select>

            <Input
              type="number"
              inputMode="numeric"
              placeholder="Ilość bazowa"
              value={form.base_quantity}
              onChange={(e) => setForm({ ...form, base_quantity: e.target.value })}
            />

            <Input
              type="number"
              inputMode="numeric"
              placeholder="Ilość dostępna"
              value={form.current_quantity}
              onChange={(e) => setForm({ ...form, current_quantity: e.target.value })}
            />
          </div>

          <Input
            placeholder="URL miniatury (opcjonalnie)"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
          <Input
            placeholder="Link CTA (opcjonalnie)"
            value={form.cta_url}
            onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
          />
          <Input
            placeholder="Opis (opcjonalnie)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button onClick={onSubmit} disabled={disabled}>Zapisz</Button>
          </div>

          <p className="text-xs text-foreground/60">
            Tip: finalnie stany aktualizują się przez zatwierdzanie dostaw/zużyć.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
