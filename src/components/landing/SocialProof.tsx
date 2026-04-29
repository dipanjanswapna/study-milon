import { Users, Clock, TrendingUp } from 'lucide-react';

const stats = [
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    value: '10,000+',
    label: 'Students Joined',
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    value: '1M+',
    label: 'Hours Studied',
  },
  {
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    value: '95%',
    label: 'Productivity Increase',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                {stat.icon}
              </div>
              <p className="text-4xl font-bold font-headline">{stat.value}</p>
              <p className="text-muted-foreground mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
