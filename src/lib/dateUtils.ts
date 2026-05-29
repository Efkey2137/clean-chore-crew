export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// Monday=0 ... Sunday=6
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function buildCalendarGrid(monthAnchor: Date): Date[] {
  const first = startOfMonth(monthAnchor);
  const last = endOfMonth(monthAnchor);
  const leading = mondayIndex(first);
  const start = addDays(first, -leading);
  const total = leading + last.getDate();
  const cells = Math.ceil(total / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
