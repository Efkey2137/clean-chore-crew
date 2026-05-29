import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kitchen Cleaning Schedule" },
      { name: "description", content: "Shared kitchen cleaning schedule with swaps and admin buyouts." },
      { property: "og:title", content: "Kitchen Cleaning Schedule" },
      { name: "twitter:title", content: "Kitchen Cleaning Schedule" },
      { property: "og:description", content: "Shared kitchen cleaning schedule with swaps and admin buyouts." },
      { name: "twitter:description", content: "Shared kitchen cleaning schedule with swaps and admin buyouts." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/94221160-974f-4a4a-8efd-f542ed47246f/id-preview-184940b1--9260b098-9a56-45b2-b06c-6d23017e1062.lovable.app-1780073160993.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/94221160-974f-4a4a-8efd-f542ed47246f/id-preview-184940b1--9260b098-9a56-45b2-b06c-6d23017e1062.lovable.app-1780073160993.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </I18nProvider>
  );
}
