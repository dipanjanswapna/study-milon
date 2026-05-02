'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface StudyActivityChartProps {
  data: { date: string; minutes: number }[];
  showTargetLine?: boolean;
  targetValue?: number;
}

const chartConfig = {
  minutes: {
    label: 'Minutes',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function StudyActivityChart({ data, showTargetLine, targetValue = 360 }: StudyActivityChartProps) {
  // Determine dynamic width based on data length to enable horizontal scrolling
  // Daily view has 24 bars, weekly 7, monthly 5, yearly 12.
  const barCount = data.length;
  const minWidth = barCount > 7 ? barCount * 50 : 0;

  return (
    <div className="w-full">
      <ScrollArea className="w-full whitespace-nowrap rounded-xl pb-4">
        <div style={{ minWidth: minWidth || '100%' }} className="h-[350px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted)/0.3)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  fontWeight={800}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  fontWeight={800}
                  tickFormatter={(value) => `${value}m`}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.1)' }}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                {showTargetLine && (
                  <ReferenceLine 
                    y={targetValue} 
                    stroke="hsl(var(--success))" 
                    strokeDasharray="5 5"
                    label={{ value: 'Daily Goal', position: 'right', fill: 'hsl(var(--success))', fontSize: 9, fontWeight: 900 }}
                  />
                )}
                <Bar 
                  dataKey="minutes" 
                  fill="var(--color-minutes)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={barCount > 12 ? 14 : 28} 
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <ScrollBar orientation="horizontal" className="h-2 bg-secondary/50 rounded-full" />
      </ScrollArea>
    </div>
  );
}
