import { useState } from 'react'
import { Pie, PieChart, Cell, Sector, type TooltipProps } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePreferences } from '@/hooks/usePreferences'
import type { SpendingByCategory } from '@/types'
import { 
    PieChartIcon, 
    TrendingDown, 
    TrendingUp, 
    ArrowRight, 
    Plus, 
    Utensils, 
    Lightbulb, 
    Home, 
    Film, 
    Car, 
    ShoppingBag, 
    Heart, 
    GraduationCap, 
    Smartphone, 
    Coffee, 
    Bus, 
    Plane, 
    Gamepad2, 
    Briefcase, 
    HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
} from '@/components/ui/chart'

interface BudgetOverviewProps {
    spendingByCategory: SpendingByCategory[]
    previousMonthData?: SpendingByCategory[]
}

type ChartDatum = {
    category: string
    amount: number
    percentage: number
    fill: string
}

const COLORS = [
    'hsl(346.8 77.2% 49.8%)', // Rose
    'hsl(142.1 76.2% 36.3%)', // Green
    'hsl(221.2 83.2% 53.3%)', // Blue
    'hsl(262.1 83.3% 57.8%)', // Purple
    'hsl(24.6 95% 53.1%)',    // Orange
    'hsl(47.9 95.8% 53.1%)',  // Yellow
    'hsl(173.4 80.4% 40%)',   // Teal
    'hsl(280 65.3% 60%)',     // Violet
    'hsl(340 75.5% 55%)',     // Pink
    'hsl(200 80% 50%)',       // Cyan
    'hsl(15 80% 55%)',        // Coral
    'hsl(60 70% 45%)',        // Olive
]

// Custom helper to map categories to Lucide icons
const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('food') || name.includes('dining') || name.includes('restaurant') || name.includes('eat') || name.includes('grocery')) return Utensils;
    if (name.includes('cafe') || name.includes('coffee') || name.includes('drink')) return Coffee;
    if (name.includes('utility') || name.includes('bill') || name.includes('electricity') || name.includes('water') || name.includes('power')) return Lightbulb;
    if (name.includes('rent') || name.includes('housing') || name.includes('home') || name.includes('house') || name.includes('mortgage')) return Home;
    if (name.includes('movie') || name.includes('entertainment') || name.includes('show') || name.includes('leisure')) return Film;
    if (name.includes('game') || name.includes('play')) return Gamepad2;
    if (name.includes('car') || name.includes('auto') || name.includes('gas') || name.includes('fuel')) return Car;
    if (name.includes('transit') || name.includes('bus') || name.includes('metro') || name.includes('subway') || name.includes('train')) return Bus;
    if (name.includes('travel') || name.includes('flight') || name.includes('plane') || name.includes('hotel')) return Plane;
    if (name.includes('shopping') || name.includes('store') || name.includes('cloth')) return ShoppingBag;
    if (name.includes('health') || name.includes('medical') || name.includes('doctor') || name.includes('pharmacy') || name.includes('fitness') || name.includes('gym')) return Heart;
    if (name.includes('education') || name.includes('school') || name.includes('book') || name.includes('course') || name.includes('class')) return GraduationCap;
    if (name.includes('phone') || name.includes('mobile') || name.includes('internet') || name.includes('wifi')) return Smartphone;
    if (name.includes('saving') || name.includes('invest') || name.includes('stock')) return TrendingUp;
    if (name.includes('work') || name.includes('office') || name.includes('job')) return Briefcase;
    
    return HelpCircle; // Fallback
}

// Custom tooltip component
type CustomTooltipProps = TooltipProps<number, string> & {
    formatCurrency: (amount: number) => string
}

const CustomTooltip = ({ active, payload, formatCurrency }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload as ChartDatum
        return (
            <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
                <div className="flex items-center gap-2 mb-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: data.fill }}
                    />
                    <span className="font-semibold text-sm">{data.category}</span>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Amount</span>
                        <span className="font-semibold text-sm">{formatCurrency(data.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Share</span>
                        <span className="font-medium text-sm">{data.percentage.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        )
    }
    return null
}



// Custom active shape component for the Donut Chart
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            {/* Glowing shadow background sector */}
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 4}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                opacity={0.15}
                style={{ filter: 'blur(4px)' }}
            />
            {/* Main active sector (slightly larger) */}
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 2}
                outerRadius={outerRadius + 4}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke="hsl(var(--background))"
                strokeWidth={2}
            />
        </g>
    );
};

export function BudgetOverview({ spendingByCategory, previousMonthData }: BudgetOverviewProps) {
    const { formatCurrency } = usePreferences()
    const [activeIndex, setActiveIndex] = useState<number | null>(null)

    const totalSpending = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0)

    // Get previous month spending for comparison
    const getPreviousMonthAmount = (category: string): number => {
        if (!previousMonthData) return 0
        const prevCat = previousMonthData.find(c => c.category === category)
        return prevCat?.amount || 0
    }

    // Calculate spending change for a category
    const getSpendingChange = (category: string, currentAmount: number): { percent: number; direction: 'up' | 'down' | 'same' } => {
        const prevAmount = getPreviousMonthAmount(category)
        if (prevAmount === 0) return { percent: 0, direction: 'same' }
        const change = ((currentAmount - prevAmount) / prevAmount) * 100
        return {
            percent: Math.abs(change),
            direction: change > 5 ? 'up' : change < -5 ? 'down' : 'same'
        }
    }

    // Prepare chart data with colors
    const chartData = spendingByCategory.map((cat, index) => ({
        category: cat.category,
        amount: cat.amount,
        percentage: cat.percentage,
        fill: cat.color || COLORS[index % COLORS.length],
    }))

    const chartConfig = {
        amount: { label: 'Amount' },
        ...spendingByCategory.reduce((acc, cat, index) => {
            acc[cat.category] = {
                label: cat.category,
                color: cat.color || COLORS[index % COLORS.length]
            }
            return acc
        }, {} as ChartConfig)
    } satisfies ChartConfig

    // Empty state with enhanced visuals
    if (spendingByCategory.length === 0) {
        return (
            <Card className="h-full flex flex-col overflow-hidden border border-border bg-card">
                <CardHeader className="pb-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                            <PieChartIcon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold tracking-tight">
                                Spending Flow
                            </CardTitle>
                            <CardDescription className="text-xs">Category breakdown</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                        <div className="relative bg-muted/50 rounded-full p-6">
                            <PieChartIcon className="h-12 w-12 text-muted-foreground/60" />
                        </div>
                    </div>
                    <p className="text-sm font-medium mb-1">No spending data yet</p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                        Start tracking your expenses to see your spending patterns visualized here.
                    </p>
                    <Button asChild size="sm" variant="outline" className="gap-2">
                        <Link to="/transactions?action=new">
                            <Plus className="h-4 w-4" />
                            Add First Expense
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col overflow-hidden border border-border bg-card shadow-sm hover:shadow-md/50 transition-shadow duration-300">
            <CardHeader className="pb-3 border-b border-border/10 bg-muted/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                            <PieChartIcon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold tracking-tight">
                                Spending Flow
                            </CardTitle>
                            <CardDescription className="text-[11px] text-muted-foreground">
                                Monthly expense breakdown & trends
                            </CardDescription>
                        </div>
                    </div>
                    <div className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-muted border border-border/40 text-muted-foreground uppercase tracking-wider">
                        {spendingByCategory.length} Sectors
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
                    {/* Pie Chart Section */}
                    <div className="relative flex items-center justify-center w-full aspect-square max-h-[220px] mx-auto">
                        <ChartContainer
                            config={chartConfig}
                            className="w-full h-full"
                        >
                            <PieChart>
                                <ChartTooltip
                                    content={<CustomTooltip formatCurrency={formatCurrency} />}
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="amount"
                                    nameKey="category"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={85}
                                    paddingAngle={2}
                                    activeIndex={activeIndex !== null ? activeIndex : undefined}
                                    activeShape={renderActiveShape}
                                    onMouseEnter={(_, index) => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                    animationBegin={0}
                                    animationDuration={600}
                                    animationEasing="ease-out"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.fill}
                                            stroke="hsl(var(--background))"
                                            strokeWidth={2}
                                            className="transition-all duration-300"
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>

                        {/* Centered Donut Summary */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 text-center p-4">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest max-w-[100px] truncate">
                                {activeIndex !== null ? chartData[activeIndex].category : "Total Spent"}
                            </span>
                            <span className="text-lg font-extrabold tracking-tight mt-0.5 text-foreground transition-all duration-200">
                                {formatCurrency(activeIndex !== null ? chartData[activeIndex].amount : totalSpending)}
                            </span>
                            <span className="text-[9px] font-semibold text-muted-foreground/80 mt-0.5">
                                {activeIndex !== null 
                                    ? `${chartData[activeIndex].percentage.toFixed(1)}%` 
                                    : "All Sectors"}
                            </span>
                        </div>
                    </div>

                    {/* Category Legend Section */}
                    <div className="flex flex-col justify-center space-y-2 py-1">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 px-1.5">
                            Category Breakdown
                        </div>
                        <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                            {chartData.map((cat, index) => {
                                const change = getSpendingChange(cat.category, cat.amount)
                                const color = cat.fill
                                const IconComponent = getCategoryIcon(cat.category)

                                return (
                                    <div
                                        key={cat.category}
                                        className={cn(
                                            "flex items-center gap-3 p-2 rounded-xl border border-transparent transition-all duration-200 cursor-pointer active:scale-[0.98]",
                                            activeIndex === index 
                                                ? "bg-muted/60 border-border/50 shadow-xs" 
                                                : "hover:bg-muted/30"
                                        )}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                    >
                                        {/* Icon indicator with HSL background glow */}
                                        <div 
                                            className="relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200"
                                            style={{ 
                                                backgroundColor: `${color}12`, 
                                                borderColor: `${color}25`,
                                                color: color
                                            }}
                                        >
                                            <IconComponent className="w-4 h-4" />
                                        </div>

                                        {/* Category info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold truncate text-foreground">
                                                    {cat.category}
                                                </span>
                                                <span className="text-xs font-bold tabular-nums text-foreground">
                                                    {formatCurrency(cat.amount)}
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden border border-border/5">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-500 ease-[var(--ease-out-custom)]",
                                                            activeIndex === index ? "brightness-110" : ""
                                                        )}
                                                        style={{
                                                            width: `${cat.percentage}%`,
                                                            backgroundColor: color,
                                                            boxShadow: activeIndex === index ? `0 0 12px ${color}40` : `0 0 6px ${color}15`
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-muted-foreground/75 tabular-nums w-10 text-right">
                                                    {cat.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Trend indicator */}
                                        {change.direction !== 'same' && (
                                            <div className={cn(
                                                "flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors whitespace-nowrap",
                                                change.direction === 'up'
                                                    ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
                                                    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                            )}>
                                                {change.direction === 'up' ? '+' : '-'}
                                                {change.percent.toFixed(0)}%
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </CardContent>

            {/* Premium Footer */}
            <div className="border-t border-border/10 px-5 py-3 bg-muted/5 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-primary/5 border border-primary/10">
                                <TrendingDown className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-foreground">{formatCurrency(totalSpending)}</p>
                                <p className="text-[9px] text-muted-foreground uppercase font-extrabold tracking-wider">Total Spent</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-border/20" />
                        <div>
                            <p className="text-xs font-bold text-foreground">{chartData.length}</p>
                            <p className="text-[9px] text-muted-foreground uppercase font-extrabold tracking-wider">Categories</p>
                        </div>
                    </div>
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="group gap-1 text-xs hover:text-primary active:scale-95 font-semibold rounded-lg transition-all duration-200"
                    >
                        <Link to="/categories" className="flex items-center gap-1">
                            View All
                            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </Card>
    )
}
