import { supabase } from "@/integrations/supabase/client";
import { addDays, toISODate } from "./dateUtils";

export async function regenerateSchedule(days = 60, startFrom: Date = new Date()) {
  const { data: roster, error } = await supabase
    .from("roster_members")
    .select("user_id, position, active")
    .eq("active", true)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!roster || roster.length === 0) {
    // Clear future assignments
    await supabase.from("assignments").delete().gte("date", toISODate(startFrom));
    return;
  }

  // Delete future assignments first
  const startIso = toISODate(startFrom);
  await supabase.from("assignments").delete().gte("date", startIso);

  const rows = Array.from({ length: days }, (_, i) => {
    const d = addDays(startFrom, i);
    const u = roster[i % roster.length].user_id;
    return { date: toISODate(d), user_id: u };
  });

  const { error: insErr } = await supabase.from("assignments").upsert(rows, { onConflict: "date" });
  if (insErr) throw insErr;
}

export async function swapAssignments(dateA: string, dateB: string) {
  const { data: rows, error } = await supabase
    .from("assignments")
    .select("date,user_id")
    .in("date", [dateA, dateB]);
  if (error) throw error;
  const a = rows?.find((r) => r.date === dateA);
  const b = rows?.find((r) => r.date === dateB);
  if (!a || !b) throw new Error("Assignments missing");
  // Two updates
  const { error: e1 } = await supabase.from("assignments").update({ user_id: b.user_id }).eq("date", dateA);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from("assignments").update({ user_id: a.user_id }).eq("date", dateB);
  if (e2) throw e2;
}

export async function reassignTo(date: string, userId: string) {
  const { error } = await supabase.from("assignments").update({ user_id: userId }).eq("date", date);
  if (error) throw error;
}
