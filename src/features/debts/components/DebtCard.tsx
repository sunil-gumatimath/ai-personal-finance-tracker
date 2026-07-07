import { format } from "date-fns";
import {
  CreditCard,
  Pencil,
  Trash2,
  MoreHorizontal,
  DollarSign,
  Home,
  Car,
  GraduationCap,
  Heart,
  Banknote,
  Building2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Debt, DebtPayment } from "@/types";

export const debtTypes = [
  { value: "mortgage", label: "Mortgage", icon: Home },
  { value: "car_loan", label: "Car Loan", icon: Car },
  { value: "student_loan", label: "Student Loan", icon: GraduationCap },
  { value: "personal_loan", label: "Personal Loan", icon: Banknote },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "medical", label: "Medical", icon: Heart },
  { value: "other", label: "Other", icon: Building2 },
];

interface DebtCardProps {
  debt: Debt;
  expandedDebt: string | null;
  setExpandedDebt: (id: string | null) => void;
  payments: DebtPayment[];
  setSelectedDebt: (debt: Debt) => void;
  paymentFormData: {
    amount: string;
    principal_amount: string;
    interest_amount: string;
    payment_date: string;
    notes: string;
  };
  setPaymentFormData: React.Dispatch<React.SetStateAction<{
    amount: string;
    principal_amount: string;
    interest_amount: string;
    payment_date: string;
    notes: string;
  }>>;
  setIsPaymentDialogOpen: (open: boolean) => void;
  handleEdit: (debt: Debt) => void;
  handleMarkPaidOff: (debt: Debt) => void;
  handleDelete: (id: string) => void;
  getProgress: (debt: Debt) => number;
  calculatePayoffTime: (debt: Debt) => number | null;
  calculateTotalInterest: (debt: Debt) => number;
  formatCurrency: (val: number) => string;
}

export function DebtCard({
  debt,
  expandedDebt,
  setExpandedDebt,
  payments,
  setSelectedDebt,
  paymentFormData,
  setPaymentFormData,
  setIsPaymentDialogOpen,
  handleEdit,
  handleMarkPaidOff,
  handleDelete,
  getProgress,
  calculatePayoffTime,
  calculateTotalInterest,
  formatCurrency,
}: DebtCardProps) {
  const getDebtIcon = (type: Debt["type"]) => {
    const found = debtTypes.find((t) => t.value === type);
    return found?.icon || CreditCard;
  };

  const DebtIcon = getDebtIcon(debt.type);
  const progress = getProgress(debt);
  const isPaidOff = debt.current_balance === 0;
  const payoffMonths = calculatePayoffTime(debt);
  const totalInterest = calculateTotalInterest(debt);
  const isExpanded = expandedDebt === debt.id;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md p-5 transition-all duration-300 hover:bg-card/70 h-fit",
        isPaidOff
          ? "border-green-500/30 shadow-[0_4px_20px_rgb(34,197,94,0.03)]"
          : "border-border/50",
      )}
      style={
        !isPaidOff
          ? {
              borderColor: isExpanded ? `${debt.color}30` : undefined,
              boxShadow: isExpanded
                ? `0 10px 30px -10px ${debt.color}15, 0 1px 3px 0 ${debt.color}05`
                : "none",
            }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="rounded-xl p-2.5 shrink-0 transition-transform duration-300 group-hover:scale-105"
              style={{ backgroundColor: `${debt.color}15` }}
            >
              <DebtIcon className="h-5 w-5" style={{ color: debt.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold tracking-tight truncate">
                  {debt.name}
                </h3>
                {isPaidOff && (
                  <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 shrink-0">
                    Paid Off
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                <span>
                  {debtTypes.find((t) => t.value === debt.type)?.label}
                </span>
                {debt.lender && (
                  <>
                    <span>•</span>
                    <span>{debt.lender}</span>
                  </>
                )}
                {debt.interest_rate > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-500 font-semibold">
                      {debt.interest_rate}% APR
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isPaidOff && (
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedDebt(debt);
                      setPaymentFormData({
                        ...paymentFormData,
                        amount: debt.minimum_payment.toString(),
                      });
                      setIsPaymentDialogOpen(true);
                    }}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleEdit(debt)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {!isPaidOff && (
                  <DropdownMenuItem onClick={() => handleMarkPaidOff(debt)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark as Paid Off
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(debt.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              Payoff Progress
            </span>
            <span className="font-semibold" style={{ color: debt.color }}>
              {Math.round(progress)}% paid
            </span>
          </div>
          <Progress
            value={progress}
            className="h-2 rounded-full bg-secondary/50"
            style={
              {
                "--progress-color": debt.color,
              } as React.CSSProperties
            }
          />
          <div className="flex justify-between text-xs font-medium">
            <span className="text-foreground font-semibold">
              {formatCurrency(debt.current_balance)} remaining
            </span>
            <span className="text-muted-foreground">
              of {formatCurrency(debt.original_amount)}
            </span>
          </div>
        </div>

        {/* Quick stats */}
        {!isPaidOff && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">
                Min Payment
              </p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {formatCurrency(debt.minimum_payment)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">
                Due Date
              </p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {debt.due_day ? `Day ${debt.due_day}` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">
                Payoff Time
              </p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {payoffMonths === null
                  ? "Never (min too low)"
                  : payoffMonths > 12
                    ? `${Math.floor(payoffMonths / 12)}y ${payoffMonths % 12}m`
                    : `${payoffMonths} months`}
              </p>
            </div>
          </div>
        )}

        {/* Expanded content - Payment history */}
        {isExpanded && (
          <div className="pt-4 border-t border-border/40 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">
                Recent Payments
              </h4>
              {!isPaidOff && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setSelectedDebt(debt);
                    setPaymentFormData({
                      ...paymentFormData,
                      amount: debt.minimum_payment.toString(),
                    });
                    setIsPaymentDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Add Payment
                </Button>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/50">
                No payments recorded yet
              </p>
            ) : (
              <div className="relative pl-6 border-l border-dashed border-border/80 space-y-3 ml-3 py-1">
                {payments.map((payment) => (
                  <div key={payment.id} className="relative group/item">
                    {/* Dotted indicator */}
                    <div
                      className="absolute -left-[31px] top-1.5 h-4.5 w-4.5 rounded-full border-2 border-background bg-card flex items-center justify-center transition-all duration-300 group-hover/item:scale-110"
                      style={{ borderColor: debt.color }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: debt.color }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-border/60 hover:bg-card/90 gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {formatCurrency(payment.amount)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {format(
                              new Date(payment.payment_date),
                              "MMM d, yyyy",
                            )}
                          </span>
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground italic font-medium">
                            "{payment.notes}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                          Principal:{" "}
                          {formatCurrency(payment.principal_amount)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                          Interest: {formatCurrency(payment.interest_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Interest projection */}
            {!isPaidOff && totalInterest > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-amber-500/90 leading-relaxed font-medium">
                  <strong>Interest Warning:</strong> At this minimum payment
                  rate, you'll pay approximately{" "}
                  <strong className="text-amber-500">
                    {formatCurrency(totalInterest)}
                  </strong>{" "}
                  in interest over{" "}
                  {payoffMonths && payoffMonths > 12
                    ? `${Math.floor(payoffMonths / 12)} years and ${payoffMonths % 12} months`
                    : `${payoffMonths} months`}
                  .
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick action for active debts */}
        {!isPaidOff && !isExpanded && (
          <Button
            className="w-full h-9 text-xs"
            variant="outline"
            onClick={() => {
              setSelectedDebt(debt);
              setPaymentFormData({
                ...paymentFormData,
                amount: debt.minimum_payment.toString(),
              });
              setIsPaymentDialogOpen(true);
            }}
          >
            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
            Record Payment
          </Button>
        )}
      </div>
    </div>
  );
}
