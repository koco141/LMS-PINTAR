import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import CompleteProfileModal from '@/components/CompleteProfileModal';
import { SpeedInsights } from "@vercel/speed-insights/next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'PINTAR — Platform Pintar untuk Training',
  description: 'Platform pembelajaran online yang dinamis dan interaktif untuk pelatihan profesional',
  keywords: 'pelatihan, training, LMS, belajar online, PINTAR',
  openGraph: {
    title: 'PINTAR — Platform Pintar untuk Training',
    description: 'Platform pembelajaran online yang dinamis dan interaktif',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <Navbar />
          <CompleteProfileModal />
          <main>{children}</main>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
