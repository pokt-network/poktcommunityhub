import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Rubik } from 'next/font/google';
import { cookies } from 'next/headers';

import { parseTheme, THEME_COOKIE } from '@/lib/theme';

import './globals.css';
import { SiteHeader } from './site-header';

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={theme} className={`${rubik.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader theme={theme} />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
