'use client';

import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StudyTimer } from '@/components/dashboard/StudyTimer';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 space-y-8">
          <WelcomeBanner />
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <StudyTimer />
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
