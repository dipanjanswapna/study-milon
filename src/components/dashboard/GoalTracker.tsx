import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CalendarCheck } from 'lucide-react';

export function GoalTracker() {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Your Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium flex items-center gap-2">
              <Target className="text-primary" /> Daily Study Goal
            </p>
            <p className="text-sm text-muted-foreground">3 / 4 hours</p>
          </div>
          <Progress value={75} className="h-2" aria-label="75% of daily study goal complete" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium flex items-center gap-2">
              <CalendarCheck className="text-primary" /> Weekly Progress
            </p>
            <p className="text-sm text-muted-foreground">4 / 5 days</p>
          </div>
          <Progress value={80} className="h-2" aria-label="80% of weekly progress complete" />
        </div>
      </CardContent>
    </Card>
  );
}
