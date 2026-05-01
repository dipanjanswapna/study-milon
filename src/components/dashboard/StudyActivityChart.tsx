'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface StudyActivityChartProps {
  data: { date: string; minutes: number }[];
  showTargetLine?: boolean;
}

const chartConfig = {
  minutes: {
    label: 'Minutes',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function StudyActivityChart({ data, showTargetLine }: StudyActivityChartProps) {
  // 6 hours = 360 minutes as a daily target
  const DAILY_TARGET = 360;

  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted)/0.3)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={600}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              fontWeight={600}
              tickFormatter={(value) => `${value}m`}
            />
            <ChartTooltip
              cursor={{ fill: 'hsl(var(--muted)/0.1)' }}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            {showTargetLine && (
              <ReferenceLine 
                y={DAILY_TARGET} 
                stroke="hsl(var(--success))" 
                strokeDasharray="5 5"
                label={{ value: 'Target', position: 'right', fill: 'hsl(var(--success))', fontSize: 10, fontWeight: 700 }}
              />
            )}
            <Bar 
              dataKey="minutes" 
              fill="var(--color-minutes)" 
              radius={[6, 6, 0, 0]} 
              barSize={data.length > 15 ? 12 : 36} 
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
