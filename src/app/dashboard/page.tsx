'use client';

import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
          <ProfileSetupGate>
            <WelcomeBanner />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Timer Column - Occupies full width on mobile/tablet, 5/12 on large screens */}
              <div className="lg:col-span-5 flex justify-center order-1 lg:order-1">
                <div className="w-full max-w-md lg:max-w-none">
                  <StudyTimer />
                </div>
              </div>

              {/* Analytics Column - Occupies full width on mobile/tablet, 7/12 on large screens */}
              <div className="lg:col-span-7 order-2 lg:order-2">
                <AnalyticsDashboard />
              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}
