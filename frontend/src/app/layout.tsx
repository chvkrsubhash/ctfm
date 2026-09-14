import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CTF Platform — Compete. Hack. Conquer.",
    template: "%s | CTF Platform",
  },
  description: "The premier CTF event management platform. Register for competitions, form teams, solve challenges across Web, Crypto, Pwn, Forensics and more.",
  keywords: ["CTF", "Capture The Flag", "cybersecurity", "hacking", "competition", "infosec"],
  openGraph: {
    type: "website",
    siteName: "CTF Platform",
    title: "CTF Platform — Compete. Hack. Conquer.",
    description: "The premier CTF event management platform.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
