import { UserPlus, Goal, LineChart } from 'lucide-react';

const steps = [
  {
    icon: <UserPlus className="h-10 w-10 text-primary" />,
    title: '1. Create Account',
    description:
      'Sign up in seconds and create your personalized study profile.',
  },
  {
    icon: <Goal className="h-10 w-10 text-primary" />,
    title: '2. Set Your Goals',
    description:
      'Define your study subjects and set achievable daily or weekly targets.',
  },
  {
    icon: <LineChart className="h-10 w-10 text-primary" />,
    title: '3. Track & Grow',
    description:
      'Start your study sessions and watch your progress unfold on your dashboard.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold font-headline md:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Get started on your journey to a million study minutes in just three
            simple steps.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative">
          <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2">
            <svg
              className="w-full h-full text-border"
              preserveAspectRatio="none"
              viewBox="0 0 100 1"
            >
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 8"
                className="hidden md:block"
              />
            </svg>
          </div>
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-background px-4">
              <div className="mb-4 bg-secondary p-4 rounded-full">{step.icon}</div>
              <h3 className="text-xl font-bold mb-2 font-headline">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
