import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BottomNav } from '@/components/navigation/BottomNav';

export const metadata: Metadata = {
  title: 'Study Million',
  description: 'Track your hustle to the first million minutes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased pb-20 md:pb-0">
        <FirebaseClientProvider>
          {children}
          <BottomNav />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
