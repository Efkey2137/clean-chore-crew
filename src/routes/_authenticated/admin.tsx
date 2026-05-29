import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { reassignTo, regenerateSchedule } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Profile = { id: string; display_name: string; email: string };
type RosterRow = { id: string; user_id: string; position: number; active: boolean };
type BuyoutRow = { id: string; requester_id: string; date: string; status: string };

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [buyouts, setBuyouts] = useState<BuyoutRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, router]);

  const load = useCallback(async () => {
    const [{ data: profs }, { data: rls }, { data: ros }, { data: bo }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").order("display_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("roster_members").select("id, user_id, position, active").order("position"),
      supabase.from("buyout_requests").select("id, requester_id, date, status").eq("status", "pending"),
    ]);
    setProfiles(profs ?? []);
    setRoles(rls ?? []);
    setRoster(ros ?? []);
    setBuyouts(bo ?? []);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (loading || !isAdmin) {
    return <div className="p-6 text-muted-foreground text-sm">{t.loading}</div>;
  }

  const profMap = new Map(profiles.map((p) => [p.id, p.display_name]));
  const inRoster = new Set(roster.map((r) => r.user_id));

  const addToRoster = async (userId: string) => {
    const maxPos = roster.reduce((m, r) => Math.max(m, r.position), -1);
    const { error } = await supabase.from("roster_members").insert({ user_id: userId, position: maxPos + 1, active: true });
    
    if (error) {
      setMsg(error.message);
    } else {
      setMsg(null);
      await load();
    }
  };

  const removeFromRoster = async (id: string) => {
    const { error } = await supabase.from("roster_members").delete().eq("id", id);
    
    if (error) {
      setMsg(error.message);
    } else {
      setMsg(null);
      await load();
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= roster.length) return;
    const a = roster[idx];
    const b = roster[j];
    
    try {
      // Swap positions via 3-step
      const { error: e1 } = await supabase.from("roster_members").update({ position: -1 }).eq("id", a.id);
      if (e1) throw e1;
      
      const { error: e2 } = await supabase.from("roster_members").update({ position: a.position }).eq("id", b.id);
      if (e2) throw e2;
      
      const { error: e3 } = await supabase.from("roster_members").update({ position: b.position }).eq("id", a.id);
      if (e3) throw e3;
      
      setMsg(null);
      await load();
    } catch (error: any) {
      setMsg(error.message);
    }
  };

  const setRole = async (userId: string, role: "admin" | "user") => {
    let err;
    if (role === "admin") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      err = error;
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      err = error;
    }
    
    if (err) {
      setMsg(err.message);
    } else {
      setMsg(null);
      await load();
    }
  };

  const regenerate = async () => {
    if (!confirm(t.regenerateConfirm)) return;
    setBusy(true);
    try {
      await regenerateSchedule(60);
      setMsg("OK");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };


  const respondBuyout = async (id: string, accept: boolean) => {
    const req = buyouts.find((b) => b.id === id);
    if (!req) return;
    if (accept) {
      try {
        await reassignTo(req.date, user!.id);
      } catch (e: any) {
        setMsg(e.message);
        return;
      }
    }
    await supabase
      .from("buyout_requests")
      .update({
        status: accept ? "accepted" : "rejected",
        resolved_at: new Date().toISOString(),
        resolved_by: user!.id,
      })
      .eq("id", id);
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold">{t.admin}</h1>

      {msg && (
        <div className="text-sm bg-accent/40 border border-accent rounded-md px-3 py-2 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{t.pendingBuyouts}</h2>
            <span className="text-xs text-muted-foreground">{buyouts.length}</span>
          </div>
          {buyouts.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t.none}</div>
          ) : (
            <ul className="space-y-2">
              {buyouts.map((b) => (
                <li key={b.id} className="border border-border rounded-md p-2 flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{profMap.get(b.requester_id) ?? "?"}</div>
                    <div className="text-muted-foreground">{b.date}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondBuyout(b.id, true)}
                      className="px-2 py-1 rounded bg-success text-success-foreground text-xs font-medium"
                    >
                      {t.accept}
                    </button>
                    <button
                      onClick={() => respondBuyout(b.id, false)}
                      className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs font-medium"
                    >
                      {t.reject}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{t.roster}</h2>
            <button
              onClick={regenerate}
              disabled={busy}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
            >
              {t.regenerate}
            </button>
          </div>
          {roster.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t.none}</div>
          ) : (
            <ol className="space-y-1">
              {roster.map((r, idx) => (
                <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1 last:border-0">
                  <span className="text-sm">
                    <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                    {profMap.get(r.user_id) ?? "?"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(idx, -1)} className="px-2 py-0.5 rounded hover:bg-secondary text-sm">↑</button>
                    <button onClick={() => move(idx, 1)} className="px-2 py-0.5 rounded hover:bg-secondary text-sm">↓</button>
                    <button onClick={() => removeFromRoster(r.id)} className="px-2 py-0.5 rounded hover:bg-destructive/30 text-xs text-destructive">
                      {t.removeFromRoster}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-medium mb-3">{t.users}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-2">{t.displayName}</th>
                <th className="py-2 pr-2">{t.email}</th>
                <th className="py-2 pr-2">{t.role}</th>
                <th className="py-2 pr-2">{t.roster}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const userIsAdmin = roles.some((r) => r.user_id === p.id && r.role === "admin");
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2">{p.display_name}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{p.email}</td>
                    <td className="py-2 pr-2">
                      <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 mr-2 ${userIsAdmin ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border"}`}>
                        {userIsAdmin ? t.roleAdmin : t.roleUser}
                      </span>
                      {p.id !== user!.id && (
                        <button
                          onClick={() => setRole(p.id, userIsAdmin ? "user" : "admin")}
                          className="text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          {userIsAdmin ? t.makeUser : t.makeAdmin}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {inRoster.has(p.id) ? (
                        <span className="text-xs text-muted-foreground">✓</span>
                      ) : (
                        <button
                          onClick={() => addToRoster(p.id)}
                          className="text-xs px-2 py-1 rounded bg-secondary hover:bg-accent"
                        >
                          {t.addToRoster}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
