import type { Metadata } from "next";
import HomePageClient from "./home-client";

const appUrl = "https://www.dareprotocol.com";


export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Dare Protocol - Stake. Dare. Win.",
  description:
    "Decentralized peer-to-peer challenge settlement layer on Base. Turn commitments into matched-stake challenges with verifiable proof paths.",
  openGraph: {
    title: "Dare Protocol - Stake. Dare. Win.",
    description:
      "Decentralized peer-to-peer challenge settlement layer on Base. Turn commitments into matched-stake challenges with verifiable proof paths.",
    url: appUrl,
    siteName: "Dare Protocol",
    images: [
      {
        url: `${appUrl}/images/hero.png`,
        width: 1200,
        height: 630,
        alt: "Dare Protocol",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}