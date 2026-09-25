import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import {
	buildSimulations,
	buildStrategies,
	calculatePayoffTime,
	calculateTotalInterest,
	getProgress,
	toNumber,
} from "@/lib/debt-calculations";
import type { Debt, DebtPayment } from "@/types";

/**
 * Canonical debt-type vocabulary. Lives here (not in DebtCard) because both the
 * DebtModal picker and the DebtCard renderer need it — a second copy is how
 * they drifted apart before. Icons stay with the renderer; add new types here.
 */
export const DEBT_TYPES = [
	{ value: "mortgage", label: "Mortgage" },
	{ value: "car_loan", label: "Car Loan" },
	{ value: "student_loan", label: "Student Loan" },
	{ value: "personal_loan", label: "Personal Loan" },
	{ value: "credit_card", label: "Credit Card" },
	{ value: "medical", label: "Medical" },
	{ value: "other", label: "Other" },
] as const satisfies ReadonlyArray<{ value: Debt["type"]; label: string }>;

// Selectable swatches come from the ONE shared palette (@/lib/palette) so the
// Debts picker can never drift from Categories/Accounts. A local copy used to
// live here, which is how `#eab308`/`#64748b` ended up selectable on debts but
// nowhere else. Green is intentionally omitted from the debt subset: it's the
// reserved "Paid Off" status color and a selectable green would collide.

// Pure debt math (payoff time, strategies, simulations) lives in
// @/lib/debt-calculations; this hook owns state, fetching, and actions.

/** PostgreSQL DECIMAL may arrive as string; normalize money fields before math. */
function normalizeDebtRow(debt: Debt): Debt {
	return {
		...debt,
		original_amount: toNumber(debt.original_amount),
		current_balance: toNumber(debt.current_balance),
		interest_rate: toNumber(debt.interest_rate),
		minimum_payment: toNumber(debt.minimum_payment),
	};
}

export function useDebts() {
	const { user } = useAuth();
	const { formatCurrency } = usePreferences();
	const [loading, setLoading] = useState(true);
	const [debts, setDebts] = useState<Debt[]>([]);
	// Set when the debts fetch fails, so the page can render a retryable error
	// rather than a misleading "no debts yet" empty state.
	const [loadError, setLoadError] = useState<string | null>(null);
	// Payment history is fetched per expanded debt and keyed by debt id so one
	// card's history can never render under another card.
	const [paymentsByDebt, setPaymentsByDebt] = useState<
		Record<string, DebtPayment[]>
	>({});
	const [loadingPaymentsId, setLoadingPaymentsId] = useState<string | null>(
		null,
	);
	const [isSaving, setIsSaving] = useState(false);
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
		setLoading(true);
		try {
			const res = await api.debts.list();
			const rows = (res.debts || []) as Debt[];

			setDebts(rows.map(normalizeDebtRow));
			setLoadError(null);
		} catch (error) {
			// Previously this only fired a transient toast, so the page then
			// rendered its "No debts yet" empty state — a failed fetch was
			// indistinguishable from genuinely having no debts. Expose the
			// failure so the page can render a retryable ErrorState instead.
			console.error("Error fetching debts:", error);
			setLoadError(
				error instanceof Error
					? error.message
					: "We couldn't reach your debts. Check your connection and try again.",
			);
			toast.error("Failed to load debts");
		} finally {
			setLoading(false);
		}
	}, [user]);

	const fetchPayments = useCallback(
		async (debtId: string) => {
			if (!user) return;

			setLoadingPaymentsId(debtId);
			try {
				const res = await api.debts.payments.list(debtId);
				const rows = (res.payments || []) as DebtPayment[];

				const typedRows = (rows || []).map((payment) => ({
					...payment,
					amount: toNumber(payment.amount),
					principal_amount: toNumber(payment.principal_amount),
					interest_amount: toNumber(payment.interest_amount),
				}));

				setPaymentsByDebt((prev) => ({ ...prev, [debtId]: typedRows }));
			} catch (error) {
				console.error("Error fetching payments:", error);
			} finally {
				setLoadingPaymentsId(null);
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
		if (!user || isSaving) return;

		// A blank Current Balance is only allowed while CREATING (it means "same
		// as original amount"). On edit, silently resetting to the original
		// would resurrect a paid-down balance.
		if (editingDebt && formData.current_balance.trim() === "") {
			toast.error("Current balance is required when editing a debt");
			return;
		}

		setIsSaving(true);

		try {
			// Explicit empty-string check: a blank field means "same as original
			// amount", but an explicit "0" must stay 0 (`parseFloat || fallback`
			// used to overwrite zero balances with the original amount).
			const currentBalance =
				formData.current_balance.trim() === ""
					? parseFloat(formData.original_amount)
					: parseFloat(formData.current_balance);
			const debtData = {
				name: formData.name,
				type: formData.type,
				original_amount: parseFloat(formData.original_amount),
				current_balance: currentBalance,
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
		} finally {
			setIsSaving(false);
		}
	};

	const handlePaymentSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !selectedDebt || isSaving) return;

		const amount = parseFloat(paymentFormData.amount);
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error("Enter a payment amount greater than 0");
			return;
		}

		setIsSaving(true);

		try {
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

			const res = await api.debts.payments.create(paymentData);
			// Prefer the server-computed updated debt row; fall back to a
			// refetch when the backend doesn't return one.
			const serverDebt = res?.debt ? normalizeDebtRow(res.debt) : null;
			const newBalance =
				serverDebt !== null
					? toNumber(serverDebt.current_balance)
					: Math.max(
							0,
							toNumber(selectedDebt.current_balance) - principalAmount,
						);

			if (newBalance === 0) {
				toast.success("Congratulations! This debt is now paid off!");
				if (serverDebt && serverDebt.is_active !== false) {
					try {
						await api.debts.update(selectedDebt.id, { is_active: false });
						serverDebt.is_active = false;
					} catch (updateError) {
						console.error("Error auto-marking debt as inactive:", updateError);
					}
				}
			} else {
				toast.success(
					`Payment recorded! Remaining: ${formatCurrency(newBalance)}`,
				);
			}

			if (serverDebt) {
				setDebts((prev) =>
					prev.map((d) => (d.id === serverDebt.id ? serverDebt : d)),
				);
			}

			setIsPaymentDialogOpen(false);
			resetPaymentForm();

			if (serverDebt) {
				if (expandedDebt === selectedDebt.id) {
					fetchPayments(selectedDebt.id);
				}
			} else {
				fetchDebts();
				if (expandedDebt === selectedDebt.id) {
					fetchPayments(selectedDebt.id);
				}
			}
		} catch (error) {
			console.error("Error recording payment:", error);
			toast.error("Failed to record payment");
		} finally {
			setIsSaving(false);
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

	const strategies = useMemo(() => buildStrategies(debts), [debts]);

	const simulations = useMemo(
		() => buildSimulations(debts, extraPayment),
		[debts, extraPayment],
	);

	return {
		loading,
		loadError,
		retryLoad: fetchDebts,
		debts,
		paymentsByDebt,
		loadingPaymentsId,
		isSaving,
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
		snowballStrategy: strategies.snowballStrategy,
		avalancheStrategy: strategies.avalancheStrategy,
		activeDebts: strategies.activeDebts,
		paidOffDebts: strategies.paidOffDebts,
		totalDebt: strategies.totalDebt,
		totalOriginal: strategies.totalOriginal,
		totalMinPayment: strategies.totalMinPayment,
		avgInterestRate: strategies.avgInterestRate,
		totalPaid: strategies.totalPaid,
		simulations,
		formatCurrency,
	};
}
