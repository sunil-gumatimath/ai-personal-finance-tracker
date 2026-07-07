import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import type { Debt, DebtPayment } from "@/types";

export const debtTypes = [
  { value: "mortgage", label: "Mortgage" },
  { value: "car_loan", label: "Car Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
];

export const debtColors = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
];

// Helper to safely convert to number
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return 0;
}

interface SimulationResult {
  months: number;
  totalInterest: number;
  monthlyData: { month: number; remainingBalance: number }[];
}

const runSimulation = (
  activeDebtsList: Debt[],
  extraPayment: number,
  strategy: "snowball" | "avalanche" | "minimums",
): SimulationResult => {
  const simulatedDebts = activeDebtsList.map((d) => ({
    id: d.id,
    current_balance: d.current_balance,
    interest_rate: d.interest_rate,
    minimum_payment: d.minimum_payment,
  }));

  let currentMonth = 0;
  let totalInterestPaid = 0;
  const monthlyData = [
    {
      month: 0,
      remainingBalance: simulatedDebts.reduce(
        (sum, d) => sum + d.current_balance,
        0,
      ),
    },
  ];

  const maxMonths = 360; // 30 years limit

  if (strategy === "snowball") {
    simulatedDebts.sort((a, b) => a.current_balance - b.current_balance);
  } else if (strategy === "avalanche") {
    simulatedDebts.sort((a, b) => b.interest_rate - a.interest_rate);
  }

  const baseMinimums = simulatedDebts.reduce(
    (sum, d) => sum + d.minimum_payment,
    0,
  );

  while (currentMonth < maxMonths) {
    const activeCount = simulatedDebts.filter(
      (d) => d.current_balance > 0,
    ).length;
    if (activeCount === 0) break;

    currentMonth++;

    simulatedDebts.forEach((d) => {
      if (d.current_balance > 0) {
        const interest = d.current_balance * (d.interest_rate / 100 / 12);
        d.current_balance += interest;
        totalInterestPaid += interest;
      }
    });

    if (strategy === "minimums") {
      simulatedDebts.forEach((d) => {
        if (d.current_balance > 0) {
          const pay = Math.min(d.current_balance, d.minimum_payment);
          d.current_balance -= pay;
        }
      });
    } else {
      let monthlyPool = baseMinimums + extraPayment;
      let leftoverPool = 0;

      simulatedDebts.forEach((d) => {
        if (d.current_balance > 0) {
          const minDue = d.minimum_payment;
          const pay = Math.min(d.current_balance, minDue);
          d.current_balance -= pay;
          monthlyPool -= pay;

          if (d.current_balance === 0 && pay < minDue) {
            leftoverPool += minDue - pay;
          }
        }
      });

      let extraPool = monthlyPool + leftoverPool;

      for (let i = 0; i < simulatedDebts.length; i++) {
        const d = simulatedDebts[i];
        if (d.current_balance > 0) {
          const pay = Math.min(d.current_balance, extraPool);
          d.current_balance -= pay;
          extraPool -= pay;
          if (extraPool <= 0) break;
        }
      }
    }

    const remainingBalance = simulatedDebts.reduce(
      (sum, d) => sum + d.current_balance,
      0,
    );
    monthlyData.push({
      month: currentMonth,
      remainingBalance: Math.round(remainingBalance),
    });

    if (remainingBalance === 0) break;
  }

  return {
    months: currentMonth,
    totalInterest: totalInterestPaid,
    monthlyData,
  };
};

export function useDebts() {
  const { user } = useAuth();
  const { formatCurrency } = usePreferences();
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isStrategyDialogOpen, setIsStrategyDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [extraPayment, setExtraPayment] = useState(200);

  const [formData, setFormData] = useState({
    name: "",
    type: "credit_card" as Debt["type"],
    original_amount: "",
    current_balance: "",
    interest_rate: "",
    minimum_payment: "",
    due_day: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    lender: "",
    notes: "",
    color: "#ef4444",
  });

  const [paymentFormData, setPaymentFormData] = useState({
    amount: "",
    principal_amount: "",
    interest_amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const fetchDebts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.debts.list();
      const rows = (res.debts || []) as Debt[];

      const typedRows = (rows || []).map((debt) => ({
        ...debt,
        original_amount: toNumber(debt.original_amount),
        current_balance: toNumber(debt.current_balance),
        interest_rate: toNumber(debt.interest_rate),
        minimum_payment: toNumber(debt.minimum_payment),
      }));

      setDebts(typedRows);
    } catch (error) {
      console.error("Error fetching debts:", error);
      toast.error("Failed to load debts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPayments = useCallback(
    async (debtId: string) => {
      if (!user) return;

      try {
        const res = await api.debts.payments.list(debtId);
        const rows = (res.payments || []) as DebtPayment[];

        const typedRows = (rows || []).map((payment) => ({
          ...payment,
          amount: toNumber(payment.amount),
          principal_amount: toNumber(payment.principal_amount),
          interest_amount: toNumber(payment.interest_amount),
        }));

        setPayments(typedRows);
      } catch (error) {
        console.error("Error fetching payments:", error);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  useEffect(() => {
    if (expandedDebt) {
      fetchPayments(expandedDebt);
    }
  }, [expandedDebt, fetchPayments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const debtData = {
        name: formData.name,
        type: formData.type,
        original_amount: parseFloat(formData.original_amount),
        current_balance:
          parseFloat(formData.current_balance) ||
          parseFloat(formData.original_amount),
        interest_rate: parseFloat(formData.interest_rate) || 0,
        minimum_payment: parseFloat(formData.minimum_payment) || 0,
        due_day: formData.due_day ? parseInt(formData.due_day) : null,
        start_date: formData.start_date || format(new Date(), "yyyy-MM-dd"),
        end_date: formData.end_date || null,
        lender: formData.lender || null,
        notes: formData.notes || null,
        color: formData.color,
        icon: formData.type,
      };

      if (editingDebt) {
        await api.debts.update(editingDebt.id, debtData);
        toast.success("Debt updated successfully");
      } else {
        await api.debts.create(debtData);
        toast.success("Debt added successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDebts();
    } catch (error) {
      console.error("Error saving debt:", error);
      toast.error("Failed to save debt");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDebt) return;

    try {
      const amount = parseFloat(paymentFormData.amount);
      const interestAmount = parseFloat(paymentFormData.interest_amount) || 0;
      const principalAmount =
        parseFloat(paymentFormData.principal_amount) || amount - interestAmount;

      const paymentData = {
        debt_id: selectedDebt.id,
        amount,
        principal_amount: principalAmount,
        interest_amount: interestAmount,
        payment_date: paymentFormData.payment_date,
        notes: paymentFormData.notes || null,
      };

      await api.debts.payments.create(paymentData);

      const newBalance = Math.max(
        0,
        selectedDebt.current_balance - principalAmount,
      );
      if (newBalance === 0) {
        toast.success("Congratulations! This debt is now paid off!");
        try {
          await api.debts.update(selectedDebt.id, { is_active: false });
        } catch (updateError) {
          console.error("Error auto-marking debt as inactive:", updateError);
        }
      } else {
        toast.success(
          `Payment recorded! Remaining: ${formatCurrency(newBalance)}`,
        );
      }

      setIsPaymentDialogOpen(false);
      resetPaymentForm();
      fetchDebts();
      if (expandedDebt === selectedDebt.id) {
        fetchPayments(selectedDebt.id);
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.debts.delete(id);
      toast.success("Debt deleted");
      fetchDebts();
    } catch (error) {
      console.error("Error deleting debt:", error);
      toast.error("Failed to delete debt");
    }
  };

  const handleMarkPaidOff = async (debt: Debt) => {
    try {
      await api.debts.update(debt.id, {
        current_balance: 0,
        is_active: false,
      });
      toast.success("Debt marked as paid off!");
      fetchDebts();
    } catch (error) {
      console.error("Error marking debt as paid:", error);
      toast.error("Failed to update debt");
    }
  };

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      name: debt.name,
      type: debt.type,
      original_amount: debt.original_amount.toString(),
      current_balance: debt.current_balance.toString(),
      interest_rate: debt.interest_rate.toString(),
      minimum_payment: debt.minimum_payment.toString(),
      due_day: debt.due_day?.toString() || "",
      start_date: debt.start_date || "",
      end_date: debt.end_date || "",
      lender: debt.lender || "",
      notes: debt.notes || "",
      color: debt.color,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingDebt(null);
    setFormData({
      name: "",
      type: "credit_card",
      original_amount: "",
      current_balance: "",
      interest_rate: "",
      minimum_payment: "",
      due_day: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      lender: "",
      notes: "",
      color: "#ef4444",
    });
  };

  const resetPaymentForm = () => {
    setSelectedDebt(null);
    setPaymentFormData({
      amount: "",
      principal_amount: "",
      interest_amount: "",
      payment_date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
  };

  const getProgress = (debt: Debt) => {
    if (debt.original_amount === 0) return 100;
    const paid = debt.original_amount - debt.current_balance;
    return Math.min((paid / debt.original_amount) * 100, 100);
  };

  const calculatePayoffTime = (debt: Debt) => {
    if (debt.current_balance === 0 || debt.minimum_payment === 0) return null;

    const monthlyRate = debt.interest_rate / 100 / 12;
    if (monthlyRate === 0) {
      return Math.ceil(debt.current_balance / debt.minimum_payment);
    }

    if (debt.minimum_payment <= debt.current_balance * monthlyRate) {
      return null;
    }

    const months =
      Math.log(
        debt.minimum_payment /
          (debt.minimum_payment - debt.current_balance * monthlyRate),
      ) / Math.log(1 + monthlyRate);
    return isNaN(months) || !isFinite(months) ? null : Math.ceil(months);
  };

  const calculateTotalInterest = (debt: Debt) => {
    const payoffMonths = calculatePayoffTime(debt);
    if (!payoffMonths || payoffMonths <= 0) return 0;

    const totalPaid = debt.minimum_payment * payoffMonths;
    return Math.max(0, totalPaid - debt.current_balance);
  };

  const snowballStrategy = useMemo(() => {
    const activeDebts = debts.filter(
      (d) => d.is_active && d.current_balance > 0,
    );
    return [...activeDebts].sort(
      (a, b) => a.current_balance - b.current_balance,
    );
  }, [debts]);

  const avalancheStrategy = useMemo(() => {
    const activeDebts = debts.filter(
      (d) => d.is_active && d.current_balance > 0,
    );
    return [...activeDebts].sort((a, b) => b.interest_rate - a.interest_rate);
  }, [debts]);

  const activeDebts = debts.filter((d) => d.is_active && d.current_balance > 0);
  const paidOffDebts = debts.filter(
    (d) => !d.is_active || d.current_balance === 0,
  );
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.current_balance, 0);
  const totalOriginal = debts.reduce((sum, d) => sum + d.original_amount, 0);
  const totalMinPayment = activeDebts.reduce(
    (sum, d) => sum + d.minimum_payment,
    0,
  );
  const avgInterestRate =
    activeDebts.length > 0
      ? activeDebts.reduce((sum, d) => sum + d.interest_rate, 0) /
        activeDebts.length
      : 0;
  const totalPaid = Math.max(0, totalOriginal - totalDebt);

  const simulations = useMemo(() => {
    const activeDebtsList = debts.filter(
      (d) => d.is_active && d.current_balance > 0,
    );
    if (activeDebtsList.length === 0) {
      return {
        snowball: { months: 0, totalInterest: 0, monthlyData: [] },
        avalanche: { months: 0, totalInterest: 0, monthlyData: [] },
        minimums: { months: 0, totalInterest: 0, monthlyData: [] },
        mergedData: [],
      };
    }

    const snowballRes = runSimulation(
      activeDebtsList,
      extraPayment,
      "snowball",
    );
    const avalancheRes = runSimulation(
      activeDebtsList,
      extraPayment,
      "avalanche",
    );
    const minOnlyRes = runSimulation(activeDebtsList, 0, "minimums");

    const mergedData = [];
    const maxLen = Math.max(
      snowballRes.monthlyData.length,
      avalancheRes.monthlyData.length,
      minOnlyRes.monthlyData.length,
    );

    const now = new Date();
    for (let i = 0; i < maxLen; i++) {
      const dateLabel = format(
        new Date(now.getFullYear(), now.getMonth() + i, 1),
        "MMM yyyy",
      );
      const snowballVal =
        i < snowballRes.monthlyData.length
          ? snowballRes.monthlyData[i].remainingBalance
          : 0;
      const avalancheVal =
        i < avalancheRes.monthlyData.length
          ? avalancheRes.monthlyData[i].remainingBalance
          : 0;
      const minOnlyVal =
        i < minOnlyRes.monthlyData.length
          ? minOnlyRes.monthlyData[i].remainingBalance
          : 0;

      mergedData.push({
        month: i,
        dateLabel,
        snowball: snowballVal,
        avalanche: avalancheVal,
        minimums: minOnlyVal,
      });
    }

    return {
      snowball: snowballRes,
      avalanche: avalancheRes,
      minimums: minOnlyRes,
      mergedData,
    };
  }, [debts, extraPayment]);

  return {
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
    resetPaymentForm,
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
  };
}
