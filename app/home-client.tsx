// app/home-client.tsx
"use client";

import { Header } from "@/components/header";
import { LandingDesktop } from "@/components/landing-desktop";
import { LandingMobile } from "@/components/landing-mobile";

export default function HomePageClient() {


  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-white text-slate-900">
      {/* Background Ambient Moving Light Spheres */}
      <div className="pointer-events-none fixed -top-24 -left-20 hidden h-96 w-96 rounded-full bg-gradient-to-br from-blue-200/20 via-indigo-100/15 to-transparent blur-3xl animate-drift md:block" />
      <div
        className="pointer-events-none fixed top-1/3 -right-24 hidden h-[420px] w-[420px] rounded-full bg-gradient-to-bl from-rose-100/15 via-amber-100/15 to-blue-100/15 blur-3xl animate-drift md:block"
        style={{ animationDelay: "-6s" }}
      />

      <Header />

      {/* Desktop landing view */}
      <div className="relative z-10 hidden md:block">
        <LandingDesktop />
      </div>

      {/* Mobile landing view */}
      <div className="relative z-10 block pb-[calc(4rem+env(safe-area-inset-bottom))] md:hidden">
        <LandingMobile />
      </div>
    </div>
  );
}