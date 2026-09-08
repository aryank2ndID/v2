import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import "./globals.css";
import { SandhiProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { ServiceWorker } from "@/components/ServiceWorker";

/* Self-hosted variable fonts — bundled at build time so the offline field kit
   needs no runtime CDN. Applied as CSS variables consumed in globals.css. */
const noto = Noto_Sans({
  subsets: ["latin"],
  variable: "--sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--serif",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SANDHI — knee OA screening for the North-East",
  description:
    "A ₹3,000 field kit and an offline model that let an ASHA worker screen a village " +
    "for early knee osteoarthritis risk in three minutes. Screening, not diagnosis.",
  applicationName: "SANDHI",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E6E56",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${noto.variable} ${notoSerif.variable}`}>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <SandhiProvider>
                <ServiceWorker />
                <Shell>{children}</Shell>
              </SandhiProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
