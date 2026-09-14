import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/*
 * IBM Plex was drawn for engineering and technical documentation, which is
 * exactly the register of a construction-materials back office — and it holds
 * up at the 13px body size a dense index table needs. Plex Mono carries SKUs,
 * order numbers and barcodes, where a monospace column is genuinely easier to
 * scan and to read aloud over a phone.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'BuildKart Admin',
    template: '%s · BuildKart Admin',
  },
  description: 'Manage the BuildKart catalog, orders, delivery areas and rates.',
  robots: { index: false, follow: false },
  // From BuildKart_Professional_Logo_Pack, in `public/`.
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon-32.png?v=2', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2d333a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
