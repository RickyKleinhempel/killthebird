import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kill the Bird – Demo",
  description: "Demo app for the killthebird package",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: "#1d1a14", color: "#f4efe4", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
