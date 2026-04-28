import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const InputSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  full_name: z.string().min(1).max(120),
  role: z.enum(["ppic", "operator", "manager"]),
  division_id: z.string().uuid().nullable().optional(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify caller is PPIC via RLS-bound client
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "ppic")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Hanya PPIC yang dapat membuat akun.");

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SERVICE_KEY)
      throw new Error("Missing service role configuration.");

    const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create auth user (auto-confirmed so they can sign in immediately)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr) throw new Error(cErr.message);
    const newId = created.user!.id;

    // Profile is auto-created by handle_new_user trigger, but ensure name/division
    await admin
      .from("profiles")
      .update({
        full_name: data.full_name,
        division_id: data.division_id ?? null,
      })
      .eq("id", newId);

    // Assign role (replace any default)
    await admin.from("user_roles").delete().eq("user_id", newId);
    const { error: rErr } = await admin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { id: newId };
  });

const DeleteSchema = z.object({ user_id: z.string().uuid() });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "ppic")
      .maybeSingle();
    if (!roleRow) throw new Error("Hanya PPIC yang dapat menghapus akun.");
    if (data.user_id === context.userId)
      throw new Error("Tidak dapat menghapus akun sendiri.");

    const admin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
