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
  const chartConfig: ChartConfig = {
    minutes: { label: 'Minutes', color: 'hsl(var(--primary))' }
  };

  // Map theme chart colors to subjects for stacking
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
          <div className="flex flex-col mb-3">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Session Log</p>
             <p className="text-sm font-black text-primary">{isHourly ? `${label} Slot` : label}</p>
          </div>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-bold text-foreground/80">{entry.name}:</span>
                </div>
                <span className="text-xs font-mono font-black">{entry.value}m</span>
              </div>
            ))}
            <div className="pt-2 border-t border-primary/10 mt-2">
               <div className="flex items-center justify-between gap-6 text-primary">
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Focus:</span>
                  <span className="text-sm font-black">{total} mins</span>
               </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const chartContent = (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--muted)/0.4)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={15}
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
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
          
          {showTargetLine && (
            <ReferenceLine 
              y={isHourly ? targetValue / 24 : targetValue} 
              stroke="hsl(var(--success))" 
              strokeDasharray="6 6"
              strokeWidth={2}
              label={{ 
                value: isHourly ? 'Hourly Avg' : 'Daily Target', 
                position: 'right', 
                fill: 'hsl(var(--success))', 
                fontSize: 10, 
                fontWeight: 900 
              }}
            />
          )}
          
          {subjects.length > 0 ? (
            subjects.map((sub, i) => (
              <Bar 
                key={sub}
                dataKey={sub} 
                stackId="a"
                fill={`hsl(var(--chart-${(i % 5) + 1}))`}
                radius={i === subjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                barSize={isHourly ? 32 : undefined}
                animationDuration={500}
              />
            ))
          ) : (
            <Bar 
              dataKey="minutes" 
              fill="var(--color-minutes)" 
              radius={[6, 6, 0, 0]} 
              barSize={isHourly ? 32 : undefined}
              animationDuration={500}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );

  if (isHourly) {
    return (
      <div className="w-full">
        <ScrollArea className="w-full whitespace-nowrap rounded-3xl pb-6">
          <div style={{ minWidth: 1440 }} className="h-[380px] pt-4">
            {chartContent}
          </div>
          <ScrollBar orientation="horizontal" className="h-2.5 bg-secondary/50 rounded-full" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] pt-4">
      {chartContent}
    </div>
  );
}
