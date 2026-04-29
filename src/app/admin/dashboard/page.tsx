import { Header } from '@/components/dashboard/Header';
import { AdminRoute } from '@/components/auth/AdminRoute';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminDashboardPage() {
  return (
    <AdminRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Welcome to the admin dashboard. Here you can manage users and
                view analytics.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </AdminRoute>
  );
}
