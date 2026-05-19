import Link from "next/link";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_AUTHOR,
  SITE_REPO,
} from "./seo-config";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz"],
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · engram",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [SITE_AUTHOR],
  creator: SITE_AUTHOR.name,
  applicationName: SITE_NAME,
  category: "developer tools",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "engram", type: "image/svg+xml" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.svg"],
    creator: "@manavaryasingh",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export const viewport = {
  themeColor: "#070707",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

function DocTop() {
  return (
    <header className="doc-top">
      <Link href="/" className="doc-top-brand" aria-label="engram">
        <span className="doc-mark" aria-hidden>ɘ</span>
        <span>engram</span>
      </Link>
      <nav className="doc-top-links" aria-label="primary">
        <Link href="/paper">paper</Link>
        <a href={SITE_REPO} target="_blank" rel="noreferrer">source</a>
      </nav>
    </header>
  );
}

function DocFoot() {
  return (
    <footer className="doc-foot">
      <span className="doc-foot-sign">
        — Manav Arya, May 2026
      </span>
      <span>
        MIT licensed ·{" "}
        <a href={SITE_REPO} target="_blank" rel="noreferrer">github</a>{" "}
        ·{" "}
        <Link href="/paper">paper</Link>
      </span>
    </footer>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <DocTop />
        {children}
        <DocFoot />
      </body>
    </html>
  );
}
