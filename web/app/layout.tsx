import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SandhiProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "SANDHI — knee OA screening for the North-East",
  description:
    "A ₹3,000 field kit and an offline model that let an ASHA worker screen a village " +
    "for early knee osteoarthritis risk in three minutes. Screening, not diagnosis.",
};

export const viewport: Viewport = {
  themeColor: "#FBFAF8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SandhiProvider>
          <Shell>{children}</Shell>
        </SandhiProvider>
      </body>
    </html>
  );
}
