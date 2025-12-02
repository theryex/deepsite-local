/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata, Viewport } from "next";
import { Inter, PT_Sans } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import "@/assets/globals.css";
import { Toaster } from "@/components/ui/sonner";
import IframeDetector from "@/components/iframe-detector";
import AppContext from "@/components/contexts/app-context";
import TanstackContext from "@/components/contexts/tanstack-query-context";
import { LoginProvider } from "@/components/contexts/login-context";
import { ProProvider } from "@/components/contexts/pro-context";
import { generateSEO, generateStructuredData } from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const ptSans = PT_Sans({
  variable: "--font-ptSans-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  ...generateSEO({
    title: "DeepSite | Build with AI ✨",
    description:
      "DeepSite is a web development tool that helps you build websites with AI, no code required. Let's deploy your website with DeepSite and enjoy the magic of AI.",
    path: "/",
  }),
  appleWebApp: {
    capable: true,
    title: "DeepSite",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Domain redirect check
  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host");
  const host = headersList.get("host");
  const hostname = (forwardedHost || host || "").split(":")[0];

  // 🛠️ PATCHED: Check for local dev IPs AND your specific 100.104.x.x network.
  const isLocalDev =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("100.104.") || // 👈 Added your subnet range
    hostname.startsWith("host.docker.internal"); // 👈 Added docker host IP

  const isHuggingFace =
    hostname === "huggingface.co" || hostname.endsWith(".huggingface.co");

  if (!isHuggingFace && !isLocalDev) {
    const pathname = headersList.get("x-invoke-path") || "/deepsite";
    // 🛑 Redirect line is still here but the condition is now fixed
    redirect(`https://huggingface.co${pathname}`);
  }

  // 🛠️ PATCHED: Structured data URL is now set to use the environment variable
  // or a generic local path, removing the hardcoded HF URL.

  const structuredData = generateStructuredData("WebApplication", {
    name: "DeepSite",
    description: "Build websites with AI, no code required",
    // 🛑 Changed to use the local host URL from headers
    url: `http://${hostname}`,
  });

  const organizationData = generateStructuredData("Organization", {
    name: "DeepSite",
    // 🛑 Changed to use the local host URL from headers
    url: `http://${hostname}`, 
  });

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${ptSans.variable} antialiased bg-black dark h-[100dvh] overflow-hidden`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationData),
          }}
        />
        <Script
          defer
          data-domain="deepsite.hf.co"
          src="https://plausible.io/js/script.js"
        />
        <IframeDetector />
        <Toaster richColors position="bottom-center" />
        <TanstackContext>
          <AppContext>
            <LoginProvider>
              <ProProvider>{children}</ProProvider>
            </LoginProvider>
          </AppContext>
        </TanstackContext>
      </body>
    </html>
  );
}