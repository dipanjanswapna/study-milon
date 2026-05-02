'use client';

import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { GuildSpotlight } from '@/components/dashboard/GuildSpotlight';
import { PrayerWidget } from '@/components/dashboard/PrayerWidget';
import { PinnedExamTicker } from '@/components/dashboard/PinnedExamTicker';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
          <ProfileSetupGate>
            <WelcomeBanner />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left Column: Timer, Prayers & Guild Activity (5/12) */}
              <div className="lg:col-span-5 space-y-6 order-1">
                <div className="w-full">
                  <PinnedExamTicker />
                  <StudyTimer />
                </div>
                <PrayerWidget />
                <GuildSpotlight />
              </div>

              {/* Right Column: Analytics (7/12) */}
              <div className="lg:col-span-7 order-2">
                <AnalyticsDashboard />
              </div>
            </div>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}