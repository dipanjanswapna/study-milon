'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface StudyActivityChartProps {
  data: { date: string; minutes: number }[];
}

const chartConfig = {
  minutes: {
    label: 'Minutes',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function StudyActivityChart({ data }: StudyActivityChartProps) {
  return (
    <div className="h-[250px]">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
           <YAxis
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickFormatter={(value) => `${value}m`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Bar dataKey="minutes" fill="var(--color-minutes)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
