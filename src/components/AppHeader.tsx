import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const { user, profile, isAdmin, signOut } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
          <span className="hidden sm:inline">{t.appTitle}</span>
          <span className="sm:hidden">🧽</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user && (
            <>
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded-md text-sm hover:bg-secondary transition"
                activeProps={{ className: "px-3 py-1.5 rounded-md text-sm bg-secondary" }}
              >
                {t.dashboard}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-md text-sm hover:bg-secondary transition"
                  activeProps={{ className: "px-3 py-1.5 rounded-md text-sm bg-secondary" }}
                >
                  {t.admin}
                </Link>
              )}
            </>
          )}
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1.5 ${lang === "en" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("pl")}
              className={`px-2 py-1.5 ${lang === "pl" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              PL
            </button>
          </div>
          {user && (
            <>
              <span className="hidden md:inline text-sm text-muted-foreground max-w-[120px] truncate">
                {profile?.display_name}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  router.navigate({ to: "/auth" });
                }}
                className="px-3 py-1.5 rounded-md text-sm bg-secondary hover:bg-accent transition"
              >
                {t.logout}
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
