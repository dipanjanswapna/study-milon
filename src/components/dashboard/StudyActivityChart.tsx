'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
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
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted)/0.3)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={500}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={500}
              tickFormatter={(value) => `${value}m`}
            />
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--muted)/0.1)' }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar 
              dataKey="minutes" 
              fill="var(--color-minutes)" 
              radius={[4, 4, 0, 0]} 
              barSize={data.length > 10 ? 10 : 32} 
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
