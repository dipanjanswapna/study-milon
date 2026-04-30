import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BottomNav } from '@/components/navigation/BottomNav';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

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
      <body className="font-body antialiased overflow-hidden">
        <FirebaseClientProvider>
          <SidebarProvider defaultOpen={true}>
            <div className="flex h-screen w-full overflow-hidden bg-background">
              {/* Sidebar stays fixed to the left */}
              <AppSidebar />
              
              {/* Main container for content and bottom nav */}
              <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Content area: the only part that scrolls */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <main className="min-h-full pb-20 md:pb-4">
                    {children}
                  </main>
                </div>
                
                {/* Bottom Navigation: Fixed at the bottom of the flex container */}
                <div className="flex-none">
                  <BottomNav />
                </div>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
