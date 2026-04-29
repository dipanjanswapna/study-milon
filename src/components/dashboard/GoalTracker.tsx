import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, CalendarCheck } from 'lucide-react';

interface GoalTrackerProps {
  dailyProgress: number;
  weeklyProgress: number;
}

export function GoalTracker({
  dailyProgress,
  weeklyProgress,
}: GoalTrackerProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Your Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium flex items-center gap-2">
              <Target className="text-primary" /> Daily Goal Progress
            </p>
            <p className="text-sm text-muted-foreground">{dailyProgress}%</p>
          </div>
          <Progress
            value={dailyProgress}
            className="h-2"
            aria-label={`${dailyProgress}% of daily study goal complete`}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium flex items-center gap-2">
              <CalendarCheck className="text-primary" /> Weekly Progress
            </p>
            <p className="text-sm text-muted-foreground">4 / 5 days</p>
          </div>
          <Progress
            value={weeklyProgress}
            className="h-2"
            aria-label={`${weeklyProgress}% of weekly progress complete`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
