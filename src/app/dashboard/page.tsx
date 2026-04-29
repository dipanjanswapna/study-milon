import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { GoalTracker } from '@/components/dashboard/GoalTracker';
import { NotesSection } from '@/components/dashboard/NotesSection';
import { AiPromptGenerator } from '@/components/dashboard/AiPromptGenerator';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8 space-y-8">
          <WelcomeBanner />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <StudyTimer />
            </div>
            <div className="space-y-8">
              <GoalTracker />
              <NotesSection />
            </div>
          </div>

          <div>
            <AiPromptGenerator />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
