import {
  Clock,
  Snowflake,
  Zap,
  ArrowDownRight,
} from "lucide-react";
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
import type { Debt } from "@/types";

interface StrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraPayment: number;
  setExtraPayment: (val: number) => void;
  totalMinPayment: number;
  formatCurrency: (val: number) => string;
  simulations: {
    snowball: { months: number; totalInterest: number };
    avalanche: { months: number; totalInterest: number };
    minimums: { months: number; totalInterest: number };
    mergedData: any[];
  };
  avalancheStrategy: Debt[];
  snowballStrategy: Debt[];
}

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
                <span className="text-sm text-muted-foreground">$</span>
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
                max="2000"
                step="50"
                value={extraPayment}
                onChange={(e) => setExtraPayment(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-secondary appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-border/30">
              <div>
                <p className="text-muted-foreground">Base Minimums</p>
                <p className="font-semibold">
                  {formatCurrency(totalMinPayment)}
                </p>
              </div>
              <div className="text-primary font-bold">
                <p className="text-primary/70">Extra Accelerator</p>
                <p>+ {formatCurrency(extraPayment)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Budget</p>
                <p className="font-semibold">
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
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Minimums Only</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold">
                  {simulations.minimums.months >= 360
                    ? "30+ years"
                    : `${simulations.minimums.months} months`}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-red-400 font-semibold">
                    {formatCurrency(simulations.minimums.totalInterest)}
                  </span>
                </p>
              </div>
            </div>

            {/* Snowball Card */}
            <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-bl-lg text-[10px] font-semibold uppercase tracking-wider">
                Momentum
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Snowflake className="h-4 w-4 text-blue-500 animate-pulse" />
                <span className="text-sm font-semibold text-blue-500">
                  Snowball Strategy
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">
                  {simulations.snowball.months} months
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-amber-500 font-semibold">
                    {formatCurrency(simulations.snowball.totalInterest)}
                  </span>
                </p>
                {simulations.minimums.months >
                  simulations.snowball.months && (
                  <p className="text-[10px] text-emerald-500 font-bold mt-1 leading-normal">
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
              <div className="absolute top-0 right-0 bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-bl-lg text-[10px] font-semibold uppercase tracking-wider">
                Max Savings
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-purple-500 animate-pulse" />
                <span className="text-sm font-semibold text-purple-500">
                  Avalanche Strategy
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">
                  {simulations.avalanche.months} months
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Interest:{" "}
                  <span className="text-amber-500 font-semibold">
                    {formatCurrency(simulations.avalanche.totalInterest)}
                  </span>
                </p>
                {simulations.minimums.months >
                  simulations.avalanche.months && (
                  <p className="text-[10px] text-emerald-500 font-bold mt-1 leading-normal">
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
            <div className="h-[250px] w-full">
              <ChartContainer
                config={{
                  snowball: { label: "Snowball Method", color: "#3b82f6" },
                  avalanche: { label: "Avalanche Method", color: "#a855f7" },
                  minimums: { label: "Minimums Only", color: "#64748b" },
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
                        stopColor="#3b82f6"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
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
                        stopColor="#a855f7"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#a855f7"
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
                        stopColor="#64748b"
                        stopOpacity={0.05}
                      />
                      <stop
                        offset="95%"
                        stopColor="#64748b"
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
                    tickFormatter={(val) =>
                      val === 0 ? "$0" : `$${(val / 1000).toFixed(0)}k`
                    }
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
                            <span className="font-bold">
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
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="url(#minimumsGrad)"
                  />
                  <Area
                    name="snowball"
                    dataKey="snowball"
                    type="monotone"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#snowballGrad)"
                  />
                  <Area
                    name="avalanche"
                    dataKey="avalanche"
                    type="monotone"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fill="url(#avalancheGrad)"
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>

          {/* Order Tabs */}
          <Tabs defaultValue="avalanche" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="avalanche" className="gap-2">
                <Zap className="h-3.5 w-3.5" />
                Avalanche Payoff Order
              </TabsTrigger>
              <TabsTrigger value="snowball" className="gap-2">
                <Snowflake className="h-3.5 w-3.5" />
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
                      className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold"
                    >
                      {index + 1}
                    </Badge>
                    <span className="font-semibold">{debt.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {debt.interest_rate}% APR
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(debt.current_balance)}
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
                      className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold"
                    >
                      {index + 1}
                    </Badge>
                    <span className="font-semibold">{debt.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {formatCurrency(debt.current_balance)} balance
                    </span>
                    <span className="text-amber-500">
                      {debt.interest_rate}% APR
                    </span>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          {/* Recommendation */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
            <ArrowDownRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
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
                        {avalancheStrategy[0].interest_rate}% APR)
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
                        {formatCurrency(snowballStrategy[0].current_balance)}{" "}
                        remaining)
                      </strong>
                    )}{" "}
                    extremely quickly.
                  </>
                )}
                {extraPayment === 0 && (
                  <span className="block mt-2 font-semibold text-amber-500">
                    Tip: Try moving the slider to see how even $100 or $200 a
                    month will collapse your payoff timeline by years!
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
