import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "pl";

const dict = {
  en: {
    appTitle: "Kitchen Cleaning Schedule",
    login: "Log In",
    signup: "Sign Up",
    logout: "Log Out",
    email: "Email",
    password: "Password",
    displayName: "Display Name",
    displayNameRequired: "Display name is required",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    dashboard: "Dashboard",
    admin: "Admin",
    calendar: "Calendar",
    prev: "Previous",
    next: "Next",
    today: "Today",
    youAreAssigned: "You're cleaning",
    notAssigned: "No one assigned",
    requestSwap: "Request Swap",
    requestBuyout: "Request Admin Buyout",
    selectSwapTarget: "Select another day to swap with:",
    cancel: "Cancel",
    confirm: "Confirm",
    submit: "Submit",
    accept: "Accept",
    reject: "Reject",
    pendingSwaps: "Pending Swap Requests",
    pendingBuyouts: "Pending Buyout Requests",
    roster: "Cleaning Roster",
    users: "Registered Users",
    addToRoster: "Add to roster",
    removeFromRoster: "Remove",
    moveUp: "↑",
    moveDown: "↓",
    regenerate: "Regenerate Schedule",
    regenerateConfirm: "Regenerate upcoming schedule from roster (next 60 days)?",
    youCleanOn: "You clean on",
    swapWith: "swap with",
    wants: "wants to swap their day",
    forYour: "for your day",
    swapAccepted: "Swap request accepted",
    swapRejected: "Swap request rejected",
    buyoutAccepted: "Shift accepted by Admin. You must pay 10 PLN",
    buyoutRejected: "Buyout request rejected",
    notifications: "Notifications",
    close: "Close",
    noUpcoming: "No upcoming assignments. Admin must build the roster and generate the schedule.",
    notInRoster: "You are not currently on the roster.",
    pleaseLogin: "Please log in to continue.",
    loading: "Loading…",
    yourShifts: "Your upcoming shifts",
    none: "None",
    requestSentSwap: "Swap request sent.",
    requestSentBuyout: "Buyout request sent. Waiting for admin approval.",
    pickADay: "Tap a day in the calendar",
    yourSwapRequests: "Your outgoing requests",
    incomingSwaps: "Incoming swap requests",
    statusPending: "Pending",
    statusAccepted: "Accepted",
    statusRejected: "Rejected",
    role: "Role",
    roleAdmin: "Admin",
    roleUser: "User",
    makeAdmin: "Make Admin",
    makeUser: "Make User",
    me: "You",
    giveShift: "Give shift to…",
    giveShiftHint: "Send a transfer request to any user",
    pickUser: "Pick a user",
    assignAndRotate: "Assign & rotate from this day",
    rosterOnly: "Roster only",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],

  },
  pl: {
    appTitle: "Harmonogram Sprzątania Kuchni",
    login: "Zaloguj się",
    signup: "Zarejestruj się",
    logout: "Wyloguj",
    email: "E-mail",
    password: "Hasło",
    displayName: "Wyświetlana nazwa",
    displayNameRequired: "Wyświetlana nazwa jest wymagana",
    noAccount: "Nie masz konta?",
    haveAccount: "Masz już konto?",
    dashboard: "Panel",
    admin: "Administrator",
    calendar: "Kalendarz",
    prev: "Poprzedni",
    next: "Następny",
    today: "Dziś",
    youAreAssigned: "Sprzątasz",
    notAssigned: "Brak przypisania",
    requestSwap: "Poproś o zamianę",
    requestBuyout: "Poproś o wykup u admina",
    selectSwapTarget: "Wybierz inny dzień do zamiany:",
    cancel: "Anuluj",
    confirm: "Potwierdź",
    submit: "Wyślij",
    accept: "Akceptuj",
    reject: "Odrzuć",
    pendingSwaps: "Oczekujące prośby o zamianę",
    pendingBuyouts: "Oczekujące prośby o wykup",
    roster: "Lista sprzątających",
    users: "Zarejestrowani użytkownicy",
    addToRoster: "Dodaj do listy",
    removeFromRoster: "Usuń",
    moveUp: "↑",
    moveDown: "↓",
    regenerate: "Wygeneruj harmonogram",
    regenerateConfirm: "Wygenerować nowy harmonogram z listy (najbliższe 60 dni)?",
    youCleanOn: "Sprzątasz dnia",
    swapWith: "zamień z",
    wants: "chce zamienić swój dzień",
    forYour: "za Twój dzień",
    swapAccepted: "Prośba o zamianę zaakceptowana",
    swapRejected: "Prośba o zamianę odrzucona",
    buyoutAccepted: "Zmiana zaakceptowana przez admina. Musisz zapłacić 10 zł",
    buyoutRejected: "Prośba o wykup odrzucona",
    notifications: "Powiadomienia",
    close: "Zamknij",
    noUpcoming: "Brak nadchodzących dyżurów. Administrator musi utworzyć listę i wygenerować harmonogram.",
    notInRoster: "Nie jesteś obecnie na liście sprzątających.",
    pleaseLogin: "Zaloguj się, aby kontynuować.",
    loading: "Ładowanie…",
    yourShifts: "Twoje nadchodzące dyżury",
    none: "Brak",
    requestSentSwap: "Prośba o zamianę wysłana.",
    requestSentBuyout: "Prośba o wykup wysłana. Oczekiwanie na zatwierdzenie.",
    pickADay: "Stuknij dzień w kalendarzu",
    yourSwapRequests: "Twoje wysłane prośby",
    incomingSwaps: "Przychodzące prośby o zamianę",
    statusPending: "Oczekujące",
    statusAccepted: "Zaakceptowane",
    statusRejected: "Odrzucone",
    role: "Rola",
    roleAdmin: "Administrator",
    roleUser: "Użytkownik",
    makeAdmin: "Nadaj admina",
    makeUser: "Usuń admina",
    me: "Ty",
    giveShift: "Przekaż dyżur…",
    giveShiftHint: "Wyślij prośbę o przejęcie do dowolnego użytkownika",
    pickUser: "Wybierz osobę",
    assignAndRotate: "Przypisz i przesuń grafik od tego dnia",
    rosterOnly: "Tylko z listy",
    weekdays: ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"],
    months: ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"],

  },
} as const;

type Dict = typeof dict.en;

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (saved === "en" || saved === "pl") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  return <Ctx.Provider value={{ lang, setLang, t: dict[lang] as Dict }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
