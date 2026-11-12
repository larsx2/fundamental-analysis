import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles/app.css?url";
import { CollectProvider } from "../ui/collect-dialog";
import { Notices } from "../ui/notices";
import { PaletteProvider } from "../ui/palette";
import { TermCard } from "../ui/term";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#0b0b0c" },
      { title: "Follow the money" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <RootDocument>
      <PaletteProvider>
        <Notices>
          <CollectProvider>
            <Outlet />
            <TermCard />
          </CollectProvider>
        </Notices>
      </PaletteProvider>
    </RootDocument>
  );
}

function NotFound() {
  return (
    <main className="page">
      <h1 className="m-0 text-xl font-semibold">Nothing here</h1>
      <p className="text-text-2">
        This address does not open a screen. <a href="/companies">Go to Companies</a>.
      </p>
    </main>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
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
