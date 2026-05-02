
'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface StudyActivityChartProps {
  data: any[];
  showTargetLine?: boolean;
  targetValue?: number;
  isHourly?: boolean;
  subjects?: string[];
}

export function StudyActivityChart({ data, showTargetLine, targetValue = 360, isHourly, subjects = [] }: StudyActivityChartProps) {
  const barCount = data.length;
  // Dynamic width calculation: 60px per bar to ensure scrollability
  const minWidth = barCount > 7 ? barCount * 60 : 0;

  const chartConfig: ChartConfig = {
    minutes: { label: 'Minutes', color: 'hsl(var(--primary))' }
  };

  // Assign distinct colors from theme to each subject
  subjects.forEach((sub, i) => {
    chartConfig[sub] = {
      label: sub,
      color: `hsl(var(--chart-${(i % 5) + 1}))`
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((acc: number, entry: any) => acc + (entry.value || 0), 0);
      return (
        <div className="bg-background/95 backdrop-blur-xl border-2 border-primary/10 rounded-2xl p-4 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-bold">{entry.name}:</span>
                </div>
                <span className="text-xs font-mono font-black">{entry.value}m</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-primary/10 mt-1.5">
               <div className="flex items-center justify-between gap-4 text-primary">
                  <span className="text-[10px] font-black uppercase">Total Hustle:</span>
                  <span className="text-sm font-black">{total}m</span>
               </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

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
                  domain={[0, isHourly ? 60 : 'auto']}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.1)' }} />
                {showTargetLine && (
                  <ReferenceLine 
                    y={isHourly ? targetValue / 24 : targetValue} 
                    stroke="hsl(var(--success))" 
                    strokeDasharray="5 5"
                    label={{ value: 'Target', position: 'right', fill: 'hsl(var(--success))', fontSize: 9, fontWeight: 900 }}
                  />
                )}
                
                {/* Render stacked bars if subjects exist (Daily/Weekly), otherwise single bar */}
                {subjects.length > 0 ? (
                  subjects.map((sub, i) => (
                    <Bar 
                      key={sub}
                      dataKey={sub} 
                      stackId="a"
                      fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                      radius={i === subjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      barSize={barCount > 12 ? 20 : 32}
                    />
                  ))
                ) : (
                  <Bar 
                    dataKey="minutes" 
                    fill="var(--color-minutes)" 
                    radius={[6, 6, 0, 0]} 
                    barSize={barCount > 12 ? 18 : 32}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <ScrollBar orientation="horizontal" className="h-2 bg-secondary/50 rounded-full" />
      </ScrollArea>
    </div>
  );
}
