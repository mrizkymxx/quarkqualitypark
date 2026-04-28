import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/i18n/I18nProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireAuth>
      <AppLayout>
        <Page />
      </AppLayout>
    </RequireAuth>
  ),
});

function Page() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">{t("nav_settings")}</h1>
      <Tabs defaultValue="div">
        <TabsList>
          <TabsTrigger value="div">{t("settings_divisions")}</TabsTrigger>
          <TabsTrigger value="mac">{t("settings_machines")}</TabsTrigger>
          <TabsTrigger value="usr">{t("settings_users")}</TabsTrigger>
        </TabsList>
        <TabsContent value="div"><DivisionsTab /></TabsContent>
        <TabsContent value="mac"><MachinesTab /></TabsContent>
        <TabsContent value="usr"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function DivisionsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["divs-all"],
    queryFn: async () => (await supabase.from("divisions").select("*").order("name")).data ?? [],
  });
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("divisions").insert({ name: name.trim() });
    if (error) toast.error(error.message);
    else { setName(""); qc.invalidateQueries({ queryKey: ["divs-all"] }); toast.success("OK"); }
  };
  const del = async (id: string) => {
    await supabase.from("divisions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["divs-all"] });
  };
  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama divisi" />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="divide-y">
        {data.map((d) => (
          <li key={d.id} className="flex justify-between items-center py-2 text-sm">
            <span>{d.name}</span>
            <Button size="icon" variant="ghost" onClick={() => del(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MachinesTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [div, setDiv] = useState<string>("none");
  const { data: divs = [] } = useQuery({ queryKey: ["divs-sel"], queryFn: async () => (await supabase.from("divisions").select("*")).data ?? [] });
  const { data = [] } = useQuery({
    queryKey: ["macs-all"],
    queryFn: async () => (await supabase.from("machines").select("*, divisions(name)").order("name")).data ?? [],
  });
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("machines").insert({ name: name.trim(), division_id: div === "none" ? null : div });
    if (error) toast.error(error.message);
    else { setName(""); qc.invalidateQueries({ queryKey: ["macs-all"] }); toast.success("OK"); }
  };
  const del = async (id: string) => {
    await supabase.from("machines").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["macs-all"] });
  };
  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama mesin" />
        <Select value={div} onValueChange={setDiv}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Divisi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Tanpa Divisi —</SelectItem>
            {divs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="divide-y">
        {data.map((m: any) => (
          <li key={m.id} className="flex justify-between items-center py-2 text-sm">
            <span>{m.name} <span className="text-muted-foreground">— {m.divisions?.name ?? "—"}</span></span>
            <Button size="icon" variant="ghost" onClick={() => del(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles-all"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const { data: divs = [] } = useQuery({ queryKey: ["divs-sel2"], queryFn: async () => (await supabase.from("divisions").select("*")).data ?? [] });

  const setRole = async (uid: string, role: "ppic" | "operator" | "manager") => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    await supabase.from("user_roles").insert({ user_id: uid, role });
    qc.invalidateQueries({ queryKey: ["roles-all"] });
    toast.success("Role updated");
  };
  const setDiv = async (uid: string, divId: string) => {
    await supabase.from("profiles").update({ division_id: divId === "none" ? null : divId }).eq("id", uid);
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    toast.success("Divisi updated");
  };

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "operator" as "ppic" | "operator" | "manager",
    division_id: "none",
  });
  const [creating, setCreating] = useState(false);

  const createAccount = async () => {
    if (!form.email || !form.password || !form.full_name) {
      toast.error("Email, kata sandi, dan nama wajib diisi.");
      return;
    }
    setCreating(true);
    try {
      await adminCreateUser({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role,
          division_id: form.division_id === "none" ? null : form.division_id,
        },
      });
      toast.success("Akun dibuat");
      setForm({ email: "", password: "", full_name: "", role: "operator", division_id: "none" });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["roles-all"] });
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat akun");
    } finally {
      setCreating(false);
    }
  };

  const deleteAccount = async (uid: string) => {
    if (!confirm("Hapus akun ini? Tindakan tidak dapat dibatalkan.")) return;
    try {
      await adminDeleteUser({ data: { user_id: uid } });
      toast.success("Akun dihapus");
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["roles-all"] });
    } catch (e: any) {
      toast.error(e?.message || "Gagal menghapus akun");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Buat Akun Baru</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nama Lengkap</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Kata Sandi (min. 6)</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ppic">PPIC (Admin)</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Divisi</Label>
            <Select value={form.division_id} onValueChange={(v) => setForm({ ...form, division_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tanpa Divisi —</SelectItem>
                {divs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={createAccount} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" /> {creating ? "Membuat..." : "Buat Akun"}
        </Button>
      </Card>

      <Card className="p-4">
        <div className="font-semibold text-sm mb-3">Daftar Pengguna</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3">Nama</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Divisi</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const role = roles.find((r) => r.user_id === p.id)?.role ?? "operator";
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{p.full_name || "—"}</td>
                    <td className="py-2 pr-3">{p.email}</td>
                    <td className="py-2 pr-3">
                      <Select value={role} onValueChange={(v) => setRole(p.id, v as any)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ppic">PPIC</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select value={p.division_id ?? "none"} onValueChange={(v) => setDiv(p.id, v)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {divs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => deleteAccount(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
