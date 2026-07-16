// app/layout.js

import "./globals.css";

export const metadata = {
  title: "Elbi GradeSim: UPLB GWA Calculator & Latin Honor Simulator",
  description:
    "Calculate your GWA and simulate the grades you need for Latin honors at UPLB. Free browser extension for Chrome and Firefox. All data stays on your device.",
  keywords: [
    "UPLB",
    "GWA calculator",
    "Latin honors",
    "Summa Cum Laude",
    "Magna Cum Laude",
    "Cum Laude",
    "browser extension",
    "AMIS",
    "GradeSim",
  ],
  openGraph: {
    title: "Elbi GradeSim: UPLB GWA Calculator",
    description:
      "Calculate your GWA and simulate grades needed for Latin honors at UPLB. Free, private, and open source.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
