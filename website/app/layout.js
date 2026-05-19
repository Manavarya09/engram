import { Geist, Geist_Mono } from "next/font/google";
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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "engram", type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
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
  themeColor: "#050b08",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

function BrandMark({ size = 26 }) {
  return (
    <span className="nav-mark" aria-hidden style={{ width: size, height: size, fontSize: size * 0.58 }}>
      ɘ
    </span>
  );
}

function Nav() {
  return (
    <div className="nav-wrap">
      <header className="nav" role="banner">
        <a href="/" className="nav-brand" aria-label="engram home">
          <BrandMark />
          <span className="nav-wordmark">engram</span>
        </a>

        <span className="nav-spacer" />

        <nav className="nav-links" aria-label="primary">
          <a href="/#primitives">Primitives</a>
          <a href="/#journal">Journal</a>
          <a href="/#compare">vs.</a>
          <a href="/paper">Paper</a>
        </nav>

        <div className="nav-right">
          <a
            href={SITE_REPO}
            target="_blank"
            rel="noreferrer"
            className="nav-ghost"
            aria-label="engram on GitHub"
          >
            GitHub
          </a>
          <a
            href={`${SITE_REPO}#quickstart`}
            target="_blank"
            rel="noreferrer"
            className="nav-cta"
          >
            <span>Install</span>
            <span className="nav-cta-glyph">↗</span>
          </a>
        </div>
      </header>
    </div>
  );
}

function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-grid">
        <div className="ftr-brand">
          <a href="/" className="nav-brand" aria-label="engram">
            <BrandMark size={28} />
            <span style={{ fontSize: 17 }}>engram</span>
          </a>
          <p className="ftr-tag">
            A Recursive Language Model engine for Claude Code. The codebase
            isn't loaded into context. Claude examines it through a logged REPL.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn btn-primary btn-sm" href={SITE_REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn btn-ghost btn-sm" href="/paper">
              Read the paper
            </a>
          </div>
        </div>

        <div className="ftr-col">
          <span className="ftr-title">Product</span>
          <a href="/#primitives">Five primitives</a>
          <a href="/#journal">The journal</a>
          <a href="/#compare">vs. alternatives</a>
          <a href="/#install">Install</a>
        </div>

        <div className="ftr-col">
          <span className="ftr-title">Research</span>
          <a href="/paper">engram paper</a>
          <a href="https://arxiv.org/abs/2512.24601" target="_blank" rel="noreferrer">RLM (Zhang et al. 2025)</a>
          <a href="https://arxiv.org/abs/2310.08560" target="_blank" rel="noreferrer">MemGPT (Packer et al. 2023)</a>
          <a href="https://arxiv.org/abs/2307.03172" target="_blank" rel="noreferrer">Lost in the middle (Liu et al. 2023)</a>
        </div>

        <div className="ftr-col">
          <span className="ftr-title">Source</span>
          <a href={SITE_REPO} target="_blank" rel="noreferrer">GitHub</a>
          <a href={`${SITE_REPO}/releases`} target="_blank" rel="noreferrer">Releases</a>
          <a href={`${SITE_REPO}/issues`} target="_blank" rel="noreferrer">Issues</a>
          <a href={`${SITE_REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT license</a>
        </div>

        <div className="ftr-bottom" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span className="mono">v0.0.1</span>
            <span>·</span>
            <span className="mono" style={{ color: "var(--grn-4)" }}>local-first</span>
            <span>·</span>
            <span>built by <a href={SITE_AUTHOR.url} target="_blank" rel="noreferrer">Manavarya Singh</a></span>
          </div>
          <div>
            <span className="mono">© {new Date().getFullYear()} engram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <div className="bg-canvas" aria-hidden />
        <div className="bg-grid" aria-hidden />
        <div className="bg-noise" aria-hidden />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
