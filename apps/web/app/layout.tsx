import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Rubik } from 'next/font/google';

import './globals.css';

// Self-hosted by next/font: no font CDN, no layout shift. The variables feed
// --font-primary and --font-mono in globals.css.
const rubik = Rubik({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Community Hub | Pocket Network', template: '%s | Pocket Network' },
  description: 'Quests, proof and recognition for Pocket Network ambassadors.',
  applicationName: 'POKT Community Hub',
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#171c1f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${rubik.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
