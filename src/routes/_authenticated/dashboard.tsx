import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  addDays,
  buildCalendarGrid,
  fromISODate,
  isSameDay,
  toISODate,
} from "@/lib/dateUtils";
import { swapAssignments } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Assignment = { date: string; user_id: string; note?: string | null };
type Profile = { id: string; display_name: string };
type Roster = { user_id: string };


function Dashboard() {
  const { user, profile, isAdmin } = useAuth();
  const { t, lang } = useI18n();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pickingSwapFor, setPickingSwapFor] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [mySwapRequests, setMySwapRequests] = useState<any[]>([]);
  const [incomingSwaps, setIncomingSwaps] = useState<any[]>([]);
  const [info, setInfo] = useState<string | null>(null);

  
  // Stany dla notatek
  const [noteInput, setNoteInput] = useState("");
  const [activeNotePopup, setActiveNotePopup] = useState<{ date: string; note: string } | null>(null);

  const grid = useMemo(() => buildCalendarGrid(monthAnchor), [monthAnchor]);
  const rangeStart = grid[0];
  const rangeEnd = grid[grid.length - 1];

  const load = useCallback(async () => {
    const [{ data: assigns }, { data: profs }, { data: ros }, { data: outgoing }, { data: incoming }] = await Promise.all([
      supabase
        .from("assignments")
        .select("date,user_id,note")
        .gte("date", toISODate(rangeStart))
        .lte("date", toISODate(rangeEnd)),
      supabase.from("profiles").select("id, display_name").order("display_name"),
      supabase.from("roster_members").select("user_id").eq("active", true).order("position"),
      supabase
        .from("swap_requests")
        .select("id, target_id, requester_date, target_date, status")
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("swap_requests")
        .select("id, requester_id, requester_date, target_date, status")
        .eq("target_id", user!.id)
        .eq("status", "pending"),
    ]);
    setAssignments(assigns ?? []);
    setProfiles(profs ?? []);
    setRoster(ros ?? []);
    setMySwapRequests(outgoing ?? []);
    setIncomingSwaps(incoming ?? []);
  }, [rangeStart, rangeEnd, user]);


  useEffect(() => {
    load();
  }, [load]);

  const profMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.display_name])), [profiles]);
  const assignMap = useMemo(() => new Map(assignments.map((a) => [a.date, a.user_id])), [assignments]);

  const myUpcoming = useMemo(() => {
    const today = toISODate(new Date());
    return assignments
      .filter((a) => a.user_id === user!.id && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [assignments, user]);

  // Efekt sprawdzający notatki po załadowaniu dyżurów
useEffect(() => {
    const shiftWithNote = myUpcoming.find((s) => s.note && s.note.trim() !== "");
    if (shiftWithNote) {
      setActiveNotePopup({ date: shiftWithNote.date, note: shiftWithNote.note as string });
    }
  }, [myUpcoming]);

  const handleDayClick = (d: Date) => {
    const iso = toISODate(d);
    if (pickingSwapFor) {
      const targetUser = assignMap.get(iso);
      if (!targetUser || targetUser === user!.id) {
        setInfo("Pick a day belonging to another person.");
        return;
      }
      (async () => {
        const { error } = await supabase.from("swap_requests").insert({
          requester_id: user!.id,
          target_id: targetUser,
          requester_date: pickingSwapFor,
          target_date: iso,
        });
        if (error) setInfo(error.message);
        else {
          setInfo(t.requestSentSwap);
          setPickingSwapFor(null);
          setSelectedDate(null);
          load();
        }
      })();
      return;
    }
    setSelectedDate(iso);
    const currentAssign = assignments.find((a) => a.date === iso);
    setNoteInput(currentAssign?.note || "");
  };

  const selectedAssignee = selectedDate ? assignMap.get(selectedDate) : undefined;
  const selectedIsMine = selectedAssignee === user?.id;

  const requestBuyout = async () => {
    if (!selectedDate) return;
    const { error } = await supabase.from("buyout_requests").insert({
      requester_id: user!.id,
      date: selectedDate,
    });
    if (error) setInfo(error.message);
    else {
      setInfo(t.requestSentBuyout);
      setSelectedDate(null);
    }
  };

  const requestTransfer = async () => {
    if (!selectedDate || !transferTarget) return;
    if (transferTarget === user!.id) {
      setInfo("Cannot transfer to yourself.");
      return;
    }
    const { error } = await supabase.from("swap_requests").insert({
      requester_id: user!.id,
      target_id: transferTarget,
      requester_date: selectedDate,
      target_date: null,
    });
    if (error) setInfo(error.message);
    else {
      setInfo(t.requestSentSwap);
      setTransferTarget("");
      setSelectedDate(null);
      load();
    }
  };


  const respondSwap = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.rpc("accept_swap_request", { _swap_id: id });
      if (error) {
        setInfo(error.message);
        return;
      }
    } else {
      await supabase
        .from("swap_requests")
        .update({ status: "rejected", resolved_at: new Date().toISOString() })
        .eq("id", id);
    }
    load();
  };

  const adminForceOverride = async (dateStr: string, newUserId: string) => {
    const { error } = await supabase.rpc("admin_assign_and_rotate", {
      _date: dateStr,
      _user: newUserId,
      _days: 60,
    });

    if (error) {
      setInfo(error.message);
    } else {
      setInfo("Admin: Przypisano i zaktualizowano grafik od tego dnia.");
      load();
    }
  };


  const adminSaveNote = async (dateStr: string, noteText: string) => {
    const { error } = await supabase
      .from("assignments")
      .update({ note: noteText })
      .eq("date", dateStr);

    if (error) {
      setInfo(error.message);
    } else {
      setInfo("Admin: Notatka została pomyślnie zapisana!");
      load();
    }
  };

  const takeOverShift = async (dateStr: string) => {
    if (!user) return; 
    if (!window.confirm("Czy na pewno chcesz przejąć ten dyżur?")) return;

    const { error } = await supabase
      .from("assignments")
      .update({ user_id: user.id }) 
      .eq("date", dateStr);

    if (error) {
      setInfo(error.message);
    } else {
      setInfo("Pomyślnie przejąłeś dyżur!");
      load(); 
    }
  };

  const monthLabel = `${t.months[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;
  const today = new Date();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {t.dashboard} · <span className="text-muted-foreground font-normal">{profile?.display_name}</span>
        </h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
              className="px-2 py-1 rounded-md hover:bg-secondary"
              aria-label={t.prev}
            >
              ‹
            </button>
            <button
              onClick={() => setMonthAnchor(new Date())}
              className="px-3 py-1 text-xs rounded-md hover:bg-secondary"
            >
              {t.today}
            </button>
            <button
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
              className="px-2 py-1 rounded-md hover:bg-secondary"
              aria-label={t.next}
            >
              ›
            </button>
          </div>
          <div className="font-medium">{monthLabel}</div>
          <div className="text-xs text-muted-foreground hidden sm:block">{lang.toUpperCase()}</div>
        </div>

        <div className="grid grid-cols-7 text-xs text-muted-foreground border-b border-border">
          {t.weekdays.map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, i) => {
            const iso = toISODate(d);
            const uid = assignMap.get(iso);
            const isMine = uid === user?.id;
            const isOtherMonth = d.getMonth() !== monthAnchor.getMonth();
            const isToday = isSameDay(d, today);
            const isSelected = iso === selectedDate;
            const isPickTarget = pickingSwapFor && uid && uid !== user!.id;
            const name = uid ? profMap.get(uid) ?? "?" : null;
            return (
              <button
                key={i}
                onClick={() => handleDayClick(d)}
                className={[
                  "h-20 sm:h-24 border-b border-r border-border p-1.5 text-left flex flex-col gap-1 transition relative",
                  isOtherMonth ? "opacity-40" : "",
                  isSelected ? "ring-2 ring-primary ring-inset" : "",
                  isMine ? "bg-mine/25 hover:bg-mine/35" : "hover:bg-secondary/60",
                  isPickTarget ? "outline outline-1 outline-warning/60" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isToday ? "bg-primary text-primary-foreground rounded-full w-5 h-5 inline-flex items-center justify-center" : "text-muted-foreground"}`}>
                    {d.getDate()}
                  </span>
                  {isMine && <span className="text-[10px] uppercase tracking-wide text-mine-foreground bg-mine/70 px-1 rounded">{t.me}</span>}
                </div>
                {name && (
                  <div className="text-xs leading-tight font-medium truncate" title={name}>
                    {name}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {info && (
        <div className="text-sm bg-accent/40 border border-accent rounded-md px-3 py-2 flex items-center justify-between">
          <span>{info}</span>
          <button onClick={() => setInfo(null)} className="text-muted-foreground">×</button>
        </div>
      )}

      {pickingSwapFor && (
        <div className="bg-warning/15 border border-warning/40 text-warning rounded-md px-3 py-2 text-sm flex items-center justify-between">
          <span>{t.selectSwapTarget} ({pickingSwapFor})</span>
          <button onClick={() => setPickingSwapFor(null)} className="underline">{t.cancel}</button>
        </div>
      )}

      {selectedDate && !pickingSwapFor && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">{selectedDate}</div>
          
          {isAdmin ? (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block font-medium mb-1">Przypisana osoba:</label>
                <select
                  value={selectedAssignee ?? ""}
                  onChange={(e) => adminForceOverride(selectedDate, e.target.value)}
                  className="bg-input text-foreground p-2 rounded-md border border-border text-sm w-full focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" disabled>{t.notAssigned}</option>
                  {profiles
                    .filter((p) => roster.some((r) => r.user_id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">{t.assignAndRotate} · {t.rosterOnly}</p>

              </div>

              <div>
                <label className="text-xs text-muted-foreground block font-medium mb-1">Dodatkowe zadania na ten dzień:</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="np. Umyć lodówkę, wyrzucić śmieci..."
                  className="bg-input text-foreground p-2 rounded-md border border-border text-sm w-full min-h-[70px] focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              <button
                onClick={() => adminSaveNote(selectedDate, noteInput)}
                className="w-full py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Zapisz instrukcje
              </button>
            </div>
          ) : (
            <div className="mt-0.5 space-y-2">
              <div className="font-medium">
                {selectedAssignee
                  ? `${selectedIsMine ? t.youAreAssigned : (profMap.get(selectedAssignee) ?? "?")}`
                  : t.notAssigned}
              </div>
              
              {assignments.find(a => a.date === selectedDate)?.note && (
                <div className="text-xs bg-warning/10 border border-warning/30 rounded-md p-2 text-warning mt-1">
                  <strong>Ważne:</strong> {assignments.find(a => a.date === selectedDate)?.note}
                </div>
              )}

              {!selectedIsMine && selectedAssignee && (
                <button
                  onClick={() => takeOverShift(selectedDate)}
                  className="mt-2 w-full bg-secondary hover:bg-accent text-foreground font-medium p-2 rounded-md text-sm transition-colors"
                >
                  Przejmij ten dyżur
                </button>
              )}
            </div>
          )}

          {selectedIsMine && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setPickingSwapFor(selectedDate);
                  setSelectedDate(null);
                }}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                {t.requestSwap}
              </button>
              <button
                onClick={requestBuyout}
                className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-sm"
              >
                {t.requestBuyout}
              </button>
            </div>

          )}

          {selectedIsMine && (
            <div className="mt-3 border-t border-border/60 pt-3">
              <label className="text-xs text-muted-foreground block font-medium mb-1">{t.giveShift}</label>
              <div className="flex gap-2">
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="flex-1 bg-input text-foreground p-2 rounded-md border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t.pickUser}</option>
                  {profiles
                    .filter((p) => p.id !== user!.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.display_name}</option>
                    ))}
                </select>
                <button
                  onClick={requestTransfer}
                  disabled={!transferTarget}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  {t.request}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{t.giveShiftHint}</p>
            </div>
          )}

        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title={t.yourShifts}>
          {myUpcoming.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t.none}</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {myUpcoming.map((a) => (
                <li key={a.date} className="flex items-center justify-between border-b border-border/60 pb-1 last:border-0">
                  <span>{a.date}</span>
                  <span className="text-muted-foreground">{fromISODate(a.date).toLocaleDateString(lang === "pl" ? "pl-PL" : "en-US", { weekday: "long" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.incomingSwaps}>
          {incomingSwaps.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t.none}</div>
          ) : (
            <ul className="space-y-2">
              {incomingSwaps.map((s) => (
                <li key={s.id} className="text-sm border border-border rounded-md p-2">
                  <div>
                    <span className="font-medium">{profMap.get(s.requester_id) ?? "?"}</span>
                    : {s.requester_date} ↔ {s.target_date}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => respondSwap(s.id, true)}
                      className="px-2 py-1 rounded bg-success text-success-foreground text-xs font-medium"
                    >
                      {t.accept}
                    </button>
                    <button
                      onClick={() => respondSwap(s.id, false)}
                      className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs font-medium"
                    >
                      {t.reject}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.yourSwapRequests}>
          {mySwapRequests.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t.none}</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {mySwapRequests.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b border-border/60 pb-1 last:border-0">
                  <span>
                    {s.requester_date} ↔ {s.target_date}
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {activeNotePopup && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-destructive/10 border-2 border-destructive rounded-xl shadow-2xl max-w-md w-full overflow-hidden p-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="text-4xl mb-2">⚠️</div>
            <h2 className="text-xl font-black text-destructive uppercase tracking-wider">
              Dodatkowe zadanie od admina!
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Masz specjalne instrukcje na dzień <span className="font-bold text-foreground">{activeNotePopup.date}</span>:
            </p>
            
            <div className="my-4 p-4 bg-background/90 border border-border rounded-lg text-left font-semibold text-md text-foreground whitespace-pre-wrap shadow-inner">
              {activeNotePopup.note}
            </div>
            
            <button 
              onClick={() => setActiveNotePopup(null)}
              className="w-full py-2.5 rounded-md bg-destructive text-destructive-foreground font-bold text-sm hover:opacity-90 transition active:scale-[0.98]"
            >
              ROZUMIEM, OGARNĘ TO!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { text: string; cls: string }> = {
    pending: { text: t.statusPending, cls: "bg-warning/20 text-warning border-warning/40" },
    accepted: { text: t.statusAccepted, cls: "bg-success/20 text-success border-success/40" },
    rejected: { text: t.statusRejected, cls: "bg-destructive/20 text-destructive border-destructive/40" },
  };
  const v = map[status] ?? map.pending;
  return <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${v.cls}`}>{v.text}</span>;
}

void addDays;