import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Community Hub · Pocket Network",
  description:
    "The Pocket Network ambassador portal — complete quests, submit proof, earn XP, and climb the leaderboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${syne.variable} h-full antialiased max-w-full overflow-x-clip`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground max-w-full overflow-x-clip">
        {children}
      </body>
    </html>
  );
}
