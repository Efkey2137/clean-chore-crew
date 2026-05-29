import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type Notif = { id: string; text: string; tone: "info" | "success" | "warning" };

export function NotificationsModal() {
  const { user, isAdmin, profile } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const notifs: Notif[] = [];

      if (isAdmin) {
        const { data: pendingBuyouts } = await supabase
          .from("buyout_requests")
          .select("id, date, requester_id")
          .eq("status", "pending");
        if (pendingBuyouts && pendingBuyouts.length > 0) {
          const ids = Array.from(new Set(pendingBuyouts.map((b) => b.requester_id)));
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", ids);
          const nameMap = new Map(profs?.map((p) => [p.id, p.display_name]));
          for (const b of pendingBuyouts) {
            notifs.push({
              id: `buy-${b.id}`,
              tone: "warning",
              text: `${nameMap.get(b.requester_id) ?? "?"} → ${t.requestBuyout} (${b.date})`,
            });
          }
        }
      } else {
        // Incoming swap requests from others
        const { data: incoming } = await supabase
          .from("swap_requests")
          .select("id, requester_id, requester_date, target_date")
          .eq("target_id", user.id)
          .eq("status", "pending");
        if (incoming && incoming.length > 0) {
          const ids = Array.from(new Set(incoming.map((r) => r.requester_id)));
          const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
          const nameMap = new Map(profs?.map((p) => [p.id, p.display_name]));
          for (const s of incoming) {
            notifs.push({
              id: `inc-${s.id}`,
              tone: "info",
              text: `${nameMap.get(s.requester_id) ?? "?"} ${t.wants} (${s.requester_date}) ${t.forYour} (${s.target_date})`,
            });
          }
        }

        // Resolved swap requests I made (not yet seen)
        const { data: mySwaps } = await supabase
          .from("swap_requests")
          .select("id, status, target_date, requester_date")
          .eq("requester_id", user.id)
          .in("status", ["accepted", "rejected"])
          .eq("seen_by_requester", false);
        if (mySwaps) {
          for (const s of mySwaps) {
            notifs.push({
              id: `sw-${s.id}`,
              tone: s.status === "accepted" ? "success" : "warning",
              text: s.status === "accepted" ? t.swapAccepted : t.swapRejected,
            });
          }
          if (mySwaps.length > 0) {
            await supabase
              .from("swap_requests")
              .update({ seen_by_requester: true })
              .in("id", mySwaps.map((s) => s.id));
          }
        }

        // Resolved buyout requests
        const { data: myBuyouts } = await supabase
          .from("buyout_requests")
          .select("id, status, date")
          .eq("requester_id", user.id)
          .in("status", ["accepted", "rejected"])
          .eq("seen_by_requester", false);
        if (myBuyouts) {
          for (const b of myBuyouts) {
            notifs.push({
              id: `bo-${b.id}`,
              tone: b.status === "accepted" ? "success" : "warning",
              text: b.status === "accepted" ? `${t.buyoutAccepted} (${b.date})` : t.buyoutRejected,
            });
          }
          if (myBuyouts.length > 0) {
            await supabase
              .from("buyout_requests")
              .update({ seen_by_requester: true })
              .in("id", myBuyouts.map((b) => b.id));
          }
        }
      }

      if (!cancelled) {
        setItems(notifs);
        if (notifs.length > 0) setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, profile?.id]);

  if (!open || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">{t.notifications}</h2>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-md px-3 py-2 text-sm border ${
                n.tone === "success"
                  ? "bg-success/15 border-success/40 text-success"
                  : n.tone === "warning"
                  ? "bg-warning/15 border-warning/40 text-warning"
                  : "bg-accent/30 border-accent/50 text-foreground"
              }`}
            >
              {n.text}
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
