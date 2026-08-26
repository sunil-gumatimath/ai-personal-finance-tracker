import {
  Clock,
  Snowflake,
  Zap,
  ArrowDownRight,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePreferences } from "@/hooks/usePreferences";
import { currencyLocales } from "@/types/preferences";
import { formatCompactCurrency, getCurrencySymbol, toNumber } from "@/lib/number";
import type { DebtSimulations } from "@/lib/debt-calculations";
import type { Debt } from "@/types";

interface StrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraPayment: number;
  setExtraPayment: (val: number) => void;
  totalMinPayment: number;
  formatCurrency: (val: number) => string;
  simulations: Pick<DebtSimulations, "snowball" | "avalanche" | "minimums" | "mergedData">;
  avalancheStrategy: Debt[];
  snowballStrategy: Debt[];
}

const SERIES_COLORS = {
  minimums: "#64748b",
  snowball: "#3b82f6",
  avalanche: "#a855f7",
} as const;

export function StrategyDialog({
  open,
  onOpenChange,
  extraPayment,
  setExtraPayment,
  totalMinPayment,
  formatCurrency,
  simulations,
  avalancheStrategy,
  snowballStrategy,
}: StrategyDialogProps) {
  const { preferences } = usePreferences();
  // Mirror how PreferencesContext derives its formatter locale.
  const locale = currencyLocales[preferences.currency] || "en-US";
  const currencySymbol = getCurrencySymbol(preferences.currency, locale);

  // Currency-aware axis ticks (compact form: $1.2K) using the app's locale.
  const formatAxisTick = (val: number) =>
    formatCompactCurrency(val, preferences.currency || "USD", locale);

  // Slider headroom scales with the actual debt load: twice the minimums,
  // rounded up to the step, never below $1000 so small debts stay adjustable.
  const sliderMax = useMemo(
    () => Math.max(1000, Math.ceil((totalMinPayment * 2) / 50) * 50),
    [totalMinPayment],
  );

  const neverPaysOff = simulations.minimums.neverPayoff === true;

  const projectionSummary = neverPaysOff
    ? `Snowball pays off in ${simulations.snowball.months} months and Avalanche in ${simulations.avalanche.months} months; paying minimums alone never pays off within the horizon.`
    : `Snowball pays off in ${simulations.snowball.months} months, Avalanche in ${simulations.avalanche.months} months, and minimums only in ${simulations.minimums.months} months.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            Interactive Payoff Planner
          </DialogTitle>
          <DialogDescription>
            Simulate and compare payoff strategies by adding extra monthly
            contributions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Interactive Budget Slider */}
          <div className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">
                  Extra Monthly Payment
                </h4>
                <p className="text-xs text-muted-foreground">
                  Accelerate your payoff by adding a monthly budget surplus.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                <Input
                  type="number"
                  className="w-24 text-right font-semibold"
                  value={extraPayment}
                  onChange={(e) =>
                    setExtraPayment(
                      Math.max(0, parseFloat(e.target.value) || 0),
                    )
                  }
                  min="0"
                />
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max={sliderMax}
                step="50"
                value={Math.min(extraPayment, sliderMax)}
                onChange={(e) => setExtraPayment(parseFloat(e.target.value))}
                aria-label="Extra monthly payment"
                aria-valuetext={`${formatCurrency(Math.min(extraPayment, sliderMax))} per month`}
                className="w-full h-2 rounded-lg bg-secondary appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-border/30">
              <div>
                <p className="text-muted-foreground">Base Minimums</p>
                <p className="font-semibold tabular-nums">
                  {formatCurrency(totalMinPayment)}
                </p>
              </div>
              <div className="text-primary font-bold">
                <p className="text-primary/70">Extra Accelerator</p>
                <p className="tabular-nums">+ {formatCurrency(extraPayment)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Budget</p>
                <p className="font-semibold tabular-nums">
                  {formatCurrency(totalMinPayment + extraPayment)}
                </p>
              </div>
            </div>
          </div>

          {/* Comparative Cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Standard Minimums Card */}
            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold">Minimums Only</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold">
                  {neverPaysOff
                    ? "Never pays off at minimums"
                    : simulations.minimums.months >= 360
                      ? "30+ years"
                      : `${simulations.minimums.months} months`}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-[var(--expense)] font-semibold">
                    {neverPaysOff
                      ? "Unbounded"
                      : formatCurrency(simulations.minimums.totalInterest)}
                  </span>
                </p>
              </div>
            </div>

            {/* Snowball Card */}
            <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-bl-lg text-xs font-semibold uppercase tracking-wider">
                Momentum
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Snowflake className="h-4 w-4 text-blue-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-blue-500">
                  Snowball Strategy
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {simulations.snowball.months} months
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-amber-500 font-semibold tabular-nums">
                    {formatCurrency(simulations.snowball.totalInterest)}
                  </span>
                </p>
                {neverPaysOff && (
                  <p className="text-xs text-[var(--expense)] font-bold mt-1 leading-normal">
                    Minimums alone never repay this debt — extra payments are
                    essential.
                  </p>
                )}
                {!neverPaysOff &&
                  simulations.minimums.months >
                    simulations.snowball.months && (
                  <p className="text-xs text-emerald-500 font-bold mt-1 leading-normal">
                    Saved{" "}
                    {simulations.minimums.months -
                      simulations.snowball.months}{" "}
                    months &{" "}
                    {formatCurrency(
                      Math.max(
                        0,
                        simulations.minimums.totalInterest -
                          simulations.snowball.totalInterest,
                      ),
                    )}{" "}
                    interest
                  </p>
                )}
              </div>
            </div>

            {/* Avalanche Card */}
            <div className="relative overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="absolute top-0 right-0 bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-bl-lg text-xs font-semibold uppercase tracking-wider">
                Max Savings
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-purple-500" aria-hidden="true" />
                <span className="text-sm font-semibold text-purple-500">
                  Avalanche Strategy
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {simulations.avalanche.months} months
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-amber-500 font-semibold tabular-nums">
                    {formatCurrency(simulations.avalanche.totalInterest)}
                  </span>
                </p>
                {neverPaysOff && (
                  <p className="text-xs text-[var(--expense)] font-bold mt-1 leading-normal">
                    Minimums alone never repay this debt — extra payments are
                    essential.
                  </p>
                )}
                {!neverPaysOff &&
                  simulations.minimums.months >
                    simulations.avalanche.months && (
                  <p className="text-xs text-emerald-500 font-bold mt-1 leading-normal">
                    Saved{" "}
                    {simulations.minimums.months -
                      simulations.avalanche.months}{" "}
                    months &{" "}
                    {formatCurrency(
                      Math.max(
                        0,
                        simulations.minimums.totalInterest -
                          simulations.avalanche.totalInterest,
                      ),
                    )}{" "}
                    interest
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chart Projections */}
          <div className="p-4 rounded-xl border border-border/50 bg-card/10">
            <h4 className="text-sm font-semibold mb-3">
              Payoff Balance Projection
            </h4>
            <div
              role="img"
              aria-label="Projected remaining balance over time for the minimums-only, snowball, and avalanche strategies"
              className="h-[250px] w-full"
            >
              <ChartContainer
                config={{
                  snowball: { label: "Snowball Method", color: SERIES_COLORS.snowball },
                  avalanche: { label: "Avalanche Method", color: SERIES_COLORS.avalanche },
                  minimums: { label: "Minimums Only", color: SERIES_COLORS.minimums },
                }}
                className="h-full w-full"
              >
                <AreaChart
                  data={simulations.mergedData}
                  margin={{ left: -10, right: 10, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="snowballGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={SERIES_COLORS.snowball}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor={SERIES_COLORS.snowball}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="avalancheGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={SERIES_COLORS.avalanche}
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor={SERIES_COLORS.avalanche}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="minimumsGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={SERIES_COLORS.minimums}
                        stopOpacity={0.05}
                      />
                      <stop
                        offset="95%"
                        stopColor={SERIES_COLORS.minimums}
                        stopOpacity={0.0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    className="stroke-border/40"
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    style={{ fontSize: "10px" }}
                    interval={Math.ceil(simulations.mergedData.length / 6)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    style={{ fontSize: "10px" }}
                    tickFormatter={(val) => formatAxisTick(Number(val))}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        formatter={(value, name) => (
                          <div className="flex items-center justify-between gap-6 text-xs">
                            <span className="text-muted-foreground">
                              {name === "snowball"
                                ? "Snowball"
                                : name === "avalanche"
                                  ? "Avalanche"
                                  : "Minimums"}
                            </span>
                            <span className="font-bold tabular-nums">
                              {formatCurrency(Number(value))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area
                    name="minimums"
                    dataKey="minimums"
                    type="monotone"
                    stroke={SERIES_COLORS.minimums}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="url(#minimumsGrad)"
                  />
                  <Area
                    name="snowball"
                    dataKey="snowball"
                    type="monotone"
                    stroke={SERIES_COLORS.snowball}
                    strokeWidth={2}
                    fill="url(#snowballGrad)"
                  />
                  <Area
                    name="avalanche"
                    dataKey="avalanche"
                    type="monotone"
                    stroke={SERIES_COLORS.avalanche}
                    strokeWidth={2}
                    fill="url(#avalancheGrad)"
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            {/* Legend row — ui/chart exports no ChartLegend component */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to right, ${SERIES_COLORS.minimums} 0 4px, transparent 4px 8px)`,
                  }}
                />
                Minimums Only
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS.snowball }}
                />
                Snowball
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS.avalanche }}
                />
                Avalanche
              </span>
            </div>
            {neverPaysOff && (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Note: the dashed Minimums line holds flat — it never pays off
                within the projection horizon.
              </p>
            )}
            <p className="sr-only">{projectionSummary}</p>
          </div>

          {/* Order Tabs */}
          <Tabs defaultValue="avalanche" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="avalanche" className="gap-2">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Avalanche Payoff Order
              </TabsTrigger>
              <TabsTrigger value="snowball" className="gap-2">
                <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                Snowball Payoff Order
              </TabsTrigger>
            </TabsList>
            <TabsContent value="avalanche" className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground italic mb-2">
                High-interest rates are paid first. Mathematically, this saves
                you the most interest.
              </p>
              {avalancheStrategy.map((debt, index) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between text-sm p-3 rounded-xl border border-border/40 bg-card/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold shrink-0"
                    >
                      {index + 1}
                    </Badge>
                    <span className="font-semibold">{debt.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="shrink-0 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 tabular-nums">
                      {toNumber(debt.interest_rate).toFixed(2)}% APR
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCurrency(toNumber(debt.current_balance))}
                    </span>
                  </div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="snowball" className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground italic mb-2">
                Smallest balances are paid first. This provides psychological
                quick-wins to keep you motivated.
              </p>
              {snowballStrategy.map((debt, index) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between text-sm p-3 rounded-xl border border-border/40 bg-card/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold shrink-0"
                    >
                      {index + 1}
                    </Badge>
                    {/* Same field order as the Avalanche tab — only weight/color differ */}
                    <span className="font-semibold">{debt.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="shrink-0 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 tabular-nums">
                      {toNumber(debt.interest_rate).toFixed(2)}% APR
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCurrency(toNumber(debt.current_balance))}
                    </span>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          {/* Recommendation */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
            <ArrowDownRight className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-primary">
                Strategy Analysis & Recommendation
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {simulations.avalanche.totalInterest <
                simulations.snowball.totalInterest ? (
                  <>
                    The <strong>Avalanche method</strong> is your best option,
                    saving you{" "}
                    <strong>
                      {formatCurrency(
                        simulations.snowball.totalInterest -
                          simulations.avalanche.totalInterest,
                      )}
                    </strong>{" "}
                    in interest charges compared to Snowball. By focusing
                    extra payments on your{" "}
                    {avalancheStrategy[0] && (
                      <strong>
                        {avalancheStrategy[0].name} (
                        {toNumber(avalancheStrategy[0].interest_rate).toFixed(2)}% APR)
                      </strong>
                    )}
                    , you minimize waste.
                  </>
                ) : (
                  <>
                    Both strategies yield similar interest profiles. The{" "}
                    <strong>Snowball method</strong> is recommended for the
                    psychological boost of paying off{" "}
                    {snowballStrategy[0] && (
                      <strong>
                        {snowballStrategy[0].name} (
                        {formatCurrency(
                          toNumber(snowballStrategy[0].current_balance),
                        )}
                        {" "}
                        remaining)
                      </strong>
                    )}{" "}
                    extremely quickly.
                  </>
                )}
                {extraPayment === 0 && (
                  <span className="block mt-2 font-semibold text-amber-500">
                    Tip: Try moving the slider to see how even a small extra
                    payment each month can collapse your payoff timeline by
                    years!
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
