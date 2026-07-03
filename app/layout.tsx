import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppStore";
import StoreProvider from "@/lib/redux/StoreProvider";

export const metadata: Metadata = {
  title: "HelpDesk Pro — Smart Ticket Management",
  description: "AI-powered helpdesk and ticket management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css" />
      </head>
      <body className="min-h-screen bg-slate-50">
        <StoreProvider>
          <AppProvider>{children}</AppProvider>
        </StoreProvider>
      </body>
    </html>
  );
}