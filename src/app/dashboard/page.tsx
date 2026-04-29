'use client';

import Link from 'next/link';
import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { AiPromptGenerator } from '@/components/dashboard/AiPromptGenerator';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 space-y-8">
          <WelcomeBanner />

          <Card>
            <CardHeader>
              <CardTitle>Build Your Study Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Your Focus Hub is ready. Start by organizing your study
                materials. Add subjects, chapters, and topics to create your
                personalized study hierarchy.
              </p>
              <Button asChild>
                <Link href="/subjects">
                  Go to Subjects <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div>
            <AiPromptGenerator />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
