'use client';
import { Header } from '@/components/dashboard/Header';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SubjectHierarchy } from '@/components/subjects/SubjectHierarchy';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SubjectsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>My Study Plan</CardTitle>
                <CardDescription>
                  Organize your learning by adding subjects, chapters, and
                  topics. This is the foundation of your study plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubjectHierarchy />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
