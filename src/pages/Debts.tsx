import {
  Plus,
  TrendingDown,
  Calendar,
  Calculator,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useDebts, debtTypes, debtColors } from "@/hooks/useDebts";
import {
  PayoffProgressRing,
  DebtCard,
  DebtModal,
  PaymentModal,
  StrategyDialog,
} from "@/components/debts";

export function Debts() {
  const {
    loading,
    debts,
    payments,
    isDialogOpen,
    setIsDialogOpen,
    isPaymentDialogOpen,
    setIsPaymentDialogOpen,
    isStrategyDialogOpen,
    setIsStrategyDialogOpen,
    editingDebt,
    selectedDebt,
    setSelectedDebt,
    expandedDebt,
    setExpandedDebt,
    activeTab,
    setActiveTab,
    extraPayment,
    setExtraPayment,
    formData,
    setFormData,
    paymentFormData,
    setPaymentFormData,
    handleSubmit,
    handlePaymentSubmit,
    handleDelete,
    handleMarkPaidOff,
    handleEdit,
    resetForm,
    getProgress,
    calculatePayoffTime,
    calculateTotalInterest,
    snowballStrategy,
    avalancheStrategy,
    activeDebts,
    paidOffDebts,
    totalDebt,
    totalOriginal,
    totalMinPayment,
    avgInterestRate,
    totalPaid,
    simulations,
    formatCurrency,
  } = useDebts();

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Calculate payoff metrics for overall summary
  const payoffProgress = totalOriginal === 0 ? 100 : (totalPaid / totalOriginal) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Debt Payoff</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track and accelerate your debt-free journey.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeDebts.length > 1 && (
            <Button
              variant="outline"
              onClick={() => setIsStrategyDialogOpen(true)}
              className="gap-2"
            >
              <Calculator className="h-4 w-4" />
              Payoff Planner
            </Button>
          )}
          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Debt
          </Button>
        </div>
      </div>

      {debts.length === 0 ? (
        <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          <div className="relative flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                <TrendingDown className="h-8 w-8" />
              </div>
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">No Debts Tracked</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-8">
              Add your credit cards, loans, or other debts to visualize your payoff timeline and save on interest.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Your First Debt
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Payoff Progress Dashboard */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80 col-span-2 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <span className="text-sm font-medium text-muted-foreground">Total Debt Remaining</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatCurrency(totalDebt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    of {formatCurrency(totalOriginal)} original
                  </span>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                    <span>{Math.round(payoffProgress)}% Paid Off</span>
                    <span>{formatCurrency(totalPaid)} Saved</span>
                  </div>
                  <Progress value={payoffProgress} className="h-1.5 bg-secondary/50" />
                </div>
              </div>
              <PayoffProgressRing percentage={payoffProgress} />
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
              <span className="text-sm font-medium text-muted-foreground">Monthly Minimums</span>
              <div className="relative mb-2 mt-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {formatCurrency(totalMinPayment)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Required base payment pool</p>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
              <span className="text-sm font-medium text-muted-foreground">Weighted Average APR</span>
              <div className="relative mb-2 mt-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {avgInterestRate.toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Across {activeDebts.length} active debts</p>
            </div>
          </div>

          {/* Quick Payoff Accelerator Promo */}
          {activeDebts.length > 1 && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                  <Zap className="h-4 w-4" />
                  Accelerate payoff with Rollover Strategy
                </h4>
                <p className="text-xs text-muted-foreground">
                  Save interest by automatically rolling completed minimum payments into the next target debt.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsStrategyDialogOpen(true)}
                className="shrink-0"
              >
                Compare Strategies
              </Button>
            </div>
          )}

          {/* Main Debt Lists Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-1">
              <TabsList className="bg-transparent h-auto p-0 gap-4">
                <TabsTrigger
                  value="active"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 py-2 font-semibold text-sm"
                >
                  Active ({activeDebts.length})
                </TabsTrigger>
                <TabsTrigger
                  value="paid"
                  className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-1 py-2 font-semibold text-sm"
                >
                  Paid Off ({paidOffDebts.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active" className="space-y-4 outline-none">
              {activeDebts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-card/20 rounded-xl border border-dashed">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
                  <h3 className="text-lg font-bold text-foreground">You are debt-free!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All listed debts are paid off. Incredible job!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {activeDebts.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      expandedDebt={expandedDebt}
                      setExpandedDebt={setExpandedDebt}
                      payments={payments}
                      setSelectedDebt={setSelectedDebt}
                      paymentFormData={paymentFormData}
                      setPaymentFormData={setPaymentFormData}
                      setIsPaymentDialogOpen={setIsPaymentDialogOpen}
                      handleEdit={handleEdit}
                      handleMarkPaidOff={handleMarkPaidOff}
                      handleDelete={handleDelete}
                      getProgress={getProgress}
                      calculatePayoffTime={calculatePayoffTime}
                      calculateTotalInterest={calculateTotalInterest}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="paid" className="space-y-4 outline-none">
              {paidOffDebts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-card/20 rounded-xl border border-dashed">
                  <Calendar className="h-10 w-10 text-muted-foreground mb-2" />
                  <h3 className="text-lg font-bold text-foreground">No Paid Off Debts Yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Record payments or mark accounts as paid off to see them here!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {paidOffDebts.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      expandedDebt={expandedDebt}
                      setExpandedDebt={setExpandedDebt}
                      payments={payments}
                      setSelectedDebt={setSelectedDebt}
                      paymentFormData={paymentFormData}
                      setPaymentFormData={setPaymentFormData}
                      setIsPaymentDialogOpen={setIsPaymentDialogOpen}
                      handleEdit={handleEdit}
                      handleMarkPaidOff={handleMarkPaidOff}
                      handleDelete={handleDelete}
                      getProgress={getProgress}
                      calculatePayoffTime={calculatePayoffTime}
                      calculateTotalInterest={calculateTotalInterest}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Forms & Dialog Modals */}
      <DebtModal
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingDebt={editingDebt}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={() => setIsDialogOpen(false)}
      />

      <PaymentModal
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        selectedDebt={selectedDebt}
        formData={paymentFormData}
        setFormData={setPaymentFormData}
        onSubmit={handlePaymentSubmit}
        onCancel={() => setIsPaymentDialogOpen(false)}
      />

      <StrategyDialog
        open={isStrategyDialogOpen}
        onOpenChange={setIsStrategyDialogOpen}
        extraPayment={extraPayment}
        setExtraPayment={setExtraPayment}
        totalMinPayment={totalMinPayment}
        formatCurrency={formatCurrency}
        simulations={simulations}
        avalancheStrategy={avalancheStrategy}
        snowballStrategy={snowballStrategy}
      />
    </div>
  );
}

// Re-export icon and label configurations for subcomponents if needed
export { debtTypes, debtColors };
