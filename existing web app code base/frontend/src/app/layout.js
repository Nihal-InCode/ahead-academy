import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { LoadingProvider } from "@/context/LoadingContext";
import PushNotificationManager from "@/components/PushNotificationManager";
import BottomNav from "@/components/BottomNav";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ahead Academy",
  description: "Ahead Academy — Attendance Management System",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ahead Academy",
  },
};

export const viewport = {
  themeColor: "#082231",
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 min-h-screen`}
      >
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</Script>
        <AuthProvider>
          <LoadingProvider>
            <PushNotificationManager />
            <main className="min-h-screen w-full pb-24 sm:pb-28">
              {children}
            </main>
            <BottomNav />
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
