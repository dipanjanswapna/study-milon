import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { BarChart, Badge, Target, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: <Target className="h-8 w-8 text-primary" />,
    title: 'Smart Tracking',
    description:
      'Get precise tracking of your daily study sessions. Every minute counts towards your goal.',
  },
  {
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
    title: 'Goal Setting',
    description:
      'Set daily, weekly, or monthly goals for subjects and total study time to stay motivated.',
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary" />,
    title: 'Insightful Analytics',
    description:
      'Visualize your progress with beautiful graphs and charts. Understand your study patterns.',
  },
  {
    icon: <Badge className="h-8 w-8 text-primary" />,
    title: 'Gamification',
    description:
      'Earn badges and rewards for achieving study milestones. Make learning a fun adventure.',
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold font-headline md:text-4xl">
            Why Use Study Million?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Everything you need to make your study sessions more productive and
            organized.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center bg-card">
              <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="pt-2">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
