'use client';

import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
          <WelcomeBanner />
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Timer Column */}
            <div className="xl:col-span-5 flex justify-center">
              <div className="w-full max-w-md">
                <StudyTimer />
              </div>
            </div>

            {/* Analytics Column */}
            <div className="xl:col-span-7">
              <AnalyticsDashboard />
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
