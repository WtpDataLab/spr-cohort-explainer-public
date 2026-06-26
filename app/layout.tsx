import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "How a pension fund's return becomes your cohort's return | SPR explainer",
  description:
    "An interactive explainer of the Dutch solidaire premieregeling (SPR): see how one collective investment result is allocated to age cohorts as protection return, excess return and a solidarity reserve. Illustrative, no real data.",
  keywords: [
    "Wtp",
    "solidaire premieregeling",
    "SPR",
    "toedelingsregels",
    "beschermingsrendement",
    "overrendement",
    "solidariteitsreserve",
    "SIVI",
    "pensioen",
    "cohort allocation",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "See how a pension fund's return turns into your cohort's return",
    description:
      "Interactive SPR allocation explainer for fund boards and SIVI implementers. Illustrative model, not a calculation of any specific fund.",
    type: "website",
    url: "/",
    siteName: "WtpDataLab",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
