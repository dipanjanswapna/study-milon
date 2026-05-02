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
  // For daily view (24 bars) we want at least 800px width for clarity
  const minWidth = data.length > 7 ? data.length * 50 : 0;

  return (
    <div className="w-full">
      <ScrollArea className="w-full whitespace-nowrap rounded-xl">
        <div style={{ minWidth: minWidth || '100%' }} className="h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
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
                    label={{ value: 'Goal', position: 'right', fill: 'hsl(var(--success))', fontSize: 10, fontWeight: 900 }}
                  />
                )}
                <Bar 
                  dataKey="minutes" 
                  fill="var(--color-minutes)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={data.length > 12 ? 16 : 32} 
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  );
}