import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import {
    Plus,
    CreditCard,
    Pencil,
    Trash2,
    MoreHorizontal,
    TrendingDown,
    Calendar,
    DollarSign,
    Percent,
    Building2,
    Home,
    Car,
    GraduationCap,
    Heart,
    Banknote,
    ArrowDownRight,
    Calculator,
    Zap,
    Snowflake,
    ChevronDown,
    ChevronUp,
    Clock,
    CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import { cn } from '@/lib/utils'
import type { Debt, DebtPayment } from '@/types'

const debtTypes = [
    { value: 'mortgage', label: 'Mortgage', icon: Home },
    { value: 'car_loan', label: 'Car Loan', icon: Car },
    { value: 'student_loan', label: 'Student Loan', icon: GraduationCap },
    { value: 'personal_loan', label: 'Personal Loan', icon: Banknote },
    { value: 'credit_card', label: 'Credit Card', icon: CreditCard },
    { value: 'medical', label: 'Medical', icon: Heart },
    { value: 'other', label: 'Other', icon: Building2 },
]

const debtColors = [
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
]

// Helper to safely convert to number
function toNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return parseFloat(value) || 0
    return 0
}

export function Debts() {
    const { user } = useAuth()
    const { formatCurrency } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [debts, setDebts] = useState<Debt[]>([])
    const [payments, setPayments] = useState<DebtPayment[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
    const [isStrategyDialogOpen, setIsStrategyDialogOpen] = useState(false)
    const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
    const [expandedDebt, setExpandedDebt] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('active')

    const [formData, setFormData] = useState({
        name: '',
        type: 'credit_card' as Debt['type'],
        original_amount: '',
        current_balance: '',
        interest_rate: '',
        minimum_payment: '',
        due_day: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: '',
        lender: '',
        notes: '',
        color: '#ef4444',
    })

    const [paymentFormData, setPaymentFormData] = useState({
        amount: '',
        principal_amount: '',
        interest_amount: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
    })

    const fetchDebts = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const res = await api.debts.list()
            const rows = (res.debts || []) as Debt[]

            // Convert numeric strings to numbers
            const typedRows = (rows || []).map(debt => ({
                ...debt,
                original_amount: toNumber(debt.original_amount),
                current_balance: toNumber(debt.current_balance),
                interest_rate: toNumber(debt.interest_rate),
                minimum_payment: toNumber(debt.minimum_payment),
            }))

            setDebts(typedRows)
        } catch (error) {
            console.error('Error fetching debts:', error)
            toast.error('Failed to load debts')
        } finally {
            setLoading(false)
        }
    }, [user])

    const fetchPayments = useCallback(async (debtId: string) => {
        if (!user) return

        try {
            const res = await api.debts.payments.list(debtId)
            const rows = (res.payments || []) as DebtPayment[]

            // Convert numeric strings to numbers
            const typedRows = (rows || []).map(payment => ({
                ...payment,
                amount: toNumber(payment.amount),
                principal_amount: toNumber(payment.principal_amount),
                interest_amount: toNumber(payment.interest_amount),
            }))

            setPayments(typedRows)
        } catch (error) {
            console.error('Error fetching payments:', error)
        }
    }, [user])

    useEffect(() => {
        fetchDebts()
    }, [fetchDebts])

    useEffect(() => {
        if (expandedDebt) {
            fetchPayments(expandedDebt)
        }
    }, [expandedDebt, fetchPayments])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const debtData = {
                name: formData.name,
                type: formData.type,
                original_amount: parseFloat(formData.original_amount),
                current_balance: parseFloat(formData.current_balance) || parseFloat(formData.original_amount),
                interest_rate: parseFloat(formData.interest_rate) || 0,
                minimum_payment: parseFloat(formData.minimum_payment) || 0,
                due_day: formData.due_day ? parseInt(formData.due_day) : null,
                start_date: formData.start_date || null,
                end_date: formData.end_date || null,
                lender: formData.lender || null,
                notes: formData.notes || null,
                color: formData.color,
                icon: debtTypes.find(t => t.value === formData.type)?.value || 'credit-card',
            }

            if (editingDebt) {
                await api.debts.update(editingDebt.id, debtData)
                toast.success('Debt updated successfully')
            } else {
                await api.debts.create(debtData)
                toast.success('Debt added successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchDebts()
        } catch (error) {
            console.error('Error saving debt:', error)
            toast.error('Failed to save debt')
        }
    }

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !selectedDebt) return

        try {
            const amount = parseFloat(paymentFormData.amount)
            const interestAmount = parseFloat(paymentFormData.interest_amount) || 0
            const principalAmount = parseFloat(paymentFormData.principal_amount) || (amount - interestAmount)

            const paymentData = {
                debt_id: selectedDebt.id,
                amount,
                principal_amount: principalAmount,
                interest_amount: interestAmount,
                payment_date: paymentFormData.payment_date,
                notes: paymentFormData.notes || null,
            }

            await api.debts.payments.create(paymentData)

            const newBalance = Math.max(0, selectedDebt.current_balance - principalAmount)
            if (newBalance === 0) {
                toast.success('Congratulations! This debt is now paid off!')
            } else {
                toast.success(`Payment recorded! Remaining: ${formatCurrency(newBalance)}`)
            }

            setIsPaymentDialogOpen(false)
            resetPaymentForm()
            fetchDebts()
            if (expandedDebt === selectedDebt.id) {
                fetchPayments(selectedDebt.id)
            }
        } catch (error) {
            console.error('Error recording payment:', error)
            toast.error('Failed to record payment')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await api.debts.delete(id)
            toast.success('Debt deleted')
            fetchDebts()
        } catch (error) {
            console.error('Error deleting debt:', error)
            toast.error('Failed to delete debt')
        }
    }

    const handleMarkPaidOff = async (debt: Debt) => {
        try {
            await api.debts.update(debt.id, {
                current_balance: 0,
                is_active: false
            })
            toast.success('Debt marked as paid off!')
            fetchDebts()
        } catch (error) {
            console.error('Error marking debt as paid:', error)
            toast.error('Failed to update debt')
        }
    }

    const handleEdit = (debt: Debt) => {
        setEditingDebt(debt)
        setFormData({
            name: debt.name,
            type: debt.type,
            original_amount: debt.original_amount.toString(),
            current_balance: debt.current_balance.toString(),
            interest_rate: debt.interest_rate.toString(),
            minimum_payment: debt.minimum_payment.toString(),
            due_day: debt.due_day?.toString() || '',
            start_date: debt.start_date || '',
            end_date: debt.end_date || '',
            lender: debt.lender || '',
            notes: debt.notes || '',
            color: debt.color,
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingDebt(null)
        setFormData({
            name: '',
            type: 'credit_card',
            original_amount: '',
            current_balance: '',
            interest_rate: '',
            minimum_payment: '',
            due_day: '',
            start_date: format(new Date(), 'yyyy-MM-dd'),
            end_date: '',
            lender: '',
            notes: '',
            color: '#ef4444',
        })
    }

    const resetPaymentForm = () => {
        setSelectedDebt(null)
        setPaymentFormData({
            amount: '',
            principal_amount: '',
            interest_amount: '',
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            notes: '',
        })
    }

    const getDebtIcon = (type: Debt['type']) => {
        const found = debtTypes.find((t) => t.value === type)
        return found?.icon || CreditCard
    }

    const getProgress = (debt: Debt) => {
        if (debt.original_amount === 0) return 100
        const paid = debt.original_amount - debt.current_balance
        return Math.min((paid / debt.original_amount) * 100, 100)
    }

    const calculatePayoffTime = (debt: Debt) => {
        if (debt.current_balance === 0 || debt.minimum_payment === 0) return null

        const monthlyRate = debt.interest_rate / 100 / 12
        if (monthlyRate === 0) {
            return Math.ceil(debt.current_balance / debt.minimum_payment)
        }

        // Calculate months using amortization formula
        const months = Math.log(debt.minimum_payment / (debt.minimum_payment - debt.current_balance * monthlyRate)) / Math.log(1 + monthlyRate)
        return Math.ceil(months)
    }

    const calculateTotalInterest = (debt: Debt) => {
        const payoffMonths = calculatePayoffTime(debt)
        if (!payoffMonths || payoffMonths <= 0) return 0

        const totalPaid = debt.minimum_payment * payoffMonths
        return Math.max(0, totalPaid - debt.current_balance)
    }

    // Payoff strategies
    const snowballStrategy = useMemo(() => {
        const activeDebts = debts.filter(d => d.is_active && d.current_balance > 0)
        return [...activeDebts].sort((a, b) => a.current_balance - b.current_balance)
    }, [debts])

    const avalancheStrategy = useMemo(() => {
        const activeDebts = debts.filter(d => d.is_active && d.current_balance > 0)
        return [...activeDebts].sort((a, b) => b.interest_rate - a.interest_rate)
    }, [debts])

    // Stats
    const activeDebts = debts.filter(d => d.is_active)
    const paidOffDebts = debts.filter(d => !d.is_active || d.current_balance === 0)
    const totalDebt = activeDebts.reduce((sum, d) => sum + d.current_balance, 0)
    const totalOriginal = activeDebts.reduce((sum, d) => sum + d.original_amount, 0)
    const totalMinPayment = activeDebts.reduce((sum, d) => sum + d.minimum_payment, 0)
    const avgInterestRate = activeDebts.length > 0
        ? activeDebts.reduce((sum, d) => sum + d.interest_rate, 0) / activeDebts.length
        : 0
    const totalPaid = totalOriginal - totalDebt

    const displayedDebts = activeTab === 'active' ? activeDebts : paidOffDebts

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Debts & Loans</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Track and manage your debts with smart payoff strategies
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsStrategyDialogOpen(true)}
                        disabled={activeDebts.length < 2}
                    >
                        <Calculator className="mr-2 h-4 w-4" />
                        Payoff Planner
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm()
                            setIsDialogOpen(true)
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Debt
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Debt</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-red-400">
                            <TrendingDown className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalDebt)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                        <span>Across {activeDebts.length} debts</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Outstanding balance</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Paid</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalPaid)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                        <span>{totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0}% paid off</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Keep going!</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Monthly Payment</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-400">
                            <Calendar className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalMinPayment)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-blue-400">
                        <span>Minimum due</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Combined payments</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Avg Interest</span>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-400">
                            <Percent className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {avgInterestRate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
                        <span>APR</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Average rate</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="active" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Active ({activeDebts.length})
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Paid Off ({paidOffDebts.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {displayedDebts.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="rounded-full bg-muted p-4">
                                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold">
                                    {activeTab === 'active' ? 'No active debts' : 'No paid off debts yet'}
                                </h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {activeTab === 'active'
                                        ? 'Add your debts to start tracking and planning payoffs'
                                        : 'Keep working on your debts - you got this!'
                                    }
                                </p>
                                {activeTab === 'active' && (
                                    <Button
                                        className="mt-4"
                                        onClick={() => {
                                            resetForm()
                                            setIsDialogOpen(true)
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Debt
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {displayedDebts.map((debt) => {
                                const DebtIcon = getDebtIcon(debt.type)
                                const progress = getProgress(debt)
                                const isPaidOff = debt.current_balance === 0
                                const payoffMonths = calculatePayoffTime(debt)
                                const totalInterest = calculateTotalInterest(debt)
                                const isExpanded = expandedDebt === debt.id

                                return (
                                    <Card
                                        key={debt.id}
                                        className={cn(
                                            'relative overflow-hidden transition-all',
                                            isPaidOff && 'ring-2 ring-green-500/50 opacity-75'
                                        )}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div
                                                        className="rounded-full p-2.5 shrink-0"
                                                        style={{ backgroundColor: `${debt.color}20` }}
                                                    >
                                                        <DebtIcon
                                                            className="h-5 w-5"
                                                            style={{ color: debt.color }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <CardTitle className="text-lg truncate">{debt.name}</CardTitle>
                                                            {isPaidOff && (
                                                                <Badge className="bg-green-500 text-white shrink-0">
                                                                    Paid Off
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <CardDescription className="flex items-center gap-2 flex-wrap">
                                                            <span>{debtTypes.find(t => t.value === debt.type)?.label}</span>
                                                            {debt.lender && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>{debt.lender}</span>
                                                                </>
                                                            )}
                                                            {debt.interest_rate > 0 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-amber-500">{debt.interest_rate}% APR</span>
                                                                </>
                                                            )}
                                                        </CardDescription>
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
                                                                <DropdownMenuItem onClick={() => {
                                                                    setSelectedDebt(debt)
                                                                    setPaymentFormData({
                                                                        ...paymentFormData,
                                                                        amount: debt.minimum_payment.toString(),
                                                                    })
                                                                    setIsPaymentDialogOpen(true)
                                                                }}>
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
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Progress bar */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Progress</span>
                                                    <span className="font-medium">{Math.round(progress)}% paid</span>
                                                </div>
                                                <Progress
                                                    value={progress}
                                                    className="h-2"
                                                    style={
                                                        {
                                                            '--progress-color': debt.color,
                                                        } as React.CSSProperties
                                                    }
                                                />
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-semibold text-red-500">
                                                        {formatCurrency(debt.current_balance)} remaining
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        of {formatCurrency(debt.original_amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quick stats */}
                                            {!isPaidOff && (
                                                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground">Min Payment</p>
                                                        <p className="text-sm font-semibold">{formatCurrency(debt.minimum_payment)}</p>
                                                    </div>
                                                    {debt.due_day && (
                                                        <div className="text-center">
                                                            <p className="text-xs text-muted-foreground">Due Date</p>
                                                            <p className="text-sm font-semibold">Day {debt.due_day}</p>
                                                        </div>
                                                    )}
                                                    {payoffMonths && (
                                                        <div className="text-center">
                                                            <p className="text-xs text-muted-foreground">Payoff Time</p>
                                                            <p className="text-sm font-semibold">
                                                                {payoffMonths > 12
                                                                    ? `${Math.floor(payoffMonths / 12)}y ${payoffMonths % 12}m`
                                                                    : `${payoffMonths} months`
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Expanded content - Payment history */}
                                            {isExpanded && (
                                                <div className="pt-4 border-t space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-semibold">Recent Payments</h4>
                                                        {!isPaidOff && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedDebt(debt)
                                                                    setPaymentFormData({
                                                                        ...paymentFormData,
                                                                        amount: debt.minimum_payment.toString(),
                                                                    })
                                                                    setIsPaymentDialogOpen(true)
                                                                }}
                                                            >
                                                                <Plus className="mr-1 h-3 w-3" />
                                                                Add Payment
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {payments.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                            No payments recorded yet
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {payments.map((payment) => (
                                                                <div
                                                                    key={payment.id}
                                                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                                                >
                                                                    <div>
                                                                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                                                                            {payment.notes && ` • ${payment.notes}`}
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right text-xs">
                                                                        <p className="text-emerald-500">Principal: {formatCurrency(payment.principal_amount)}</p>
                                                                        <p className="text-amber-500">Interest: {formatCurrency(payment.interest_amount)}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Interest projection */}
                                                    {!isPaidOff && totalInterest > 0 && (
                                                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                            <p className="text-sm text-amber-500">
                                                                <strong>Interest Alert:</strong> At minimum payments, you'll pay approximately{' '}
                                                                <strong>{formatCurrency(totalInterest)}</strong> in interest over{' '}
                                                                {payoffMonths && payoffMonths > 12
                                                                    ? `${Math.floor(payoffMonths / 12)} years and ${payoffMonths % 12} months`
                                                                    : `${payoffMonths} months`
                                                                }.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quick action for active debts */}
                                            {!isPaidOff && !isExpanded && (
                                                <Button
                                                    className="w-full"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSelectedDebt(debt)
                                                        setPaymentFormData({
                                                            ...paymentFormData,
                                                            amount: debt.minimum_payment.toString(),
                                                        })
                                                        setIsPaymentDialogOpen(true)
                                                    }}
                                                >
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    Record Payment
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Add/Edit Debt Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingDebt ? 'Edit Debt' : 'Add New Debt'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingDebt
                                ? 'Update your debt details.'
                                : 'Add a new debt to track and plan your payoff strategy.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="name">Debt Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Chase Credit Card"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) => setFormData({ ...formData, type: value as Debt['type'] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {debtTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                <div className="flex items-center gap-2">
                                                    <type.icon className="h-4 w-4" />
                                                    {type.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Color</Label>
                                <Select
                                    value={formData.color}
                                    onValueChange={(value) => setFormData({ ...formData, color: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {debtColors.map((color) => (
                                            <SelectItem key={color.value} value={color.value}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-4 w-4 rounded-full"
                                                        style={{ backgroundColor: color.value }}
                                                    />
                                                    {color.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="original">Original Amount</Label>
                                <Input
                                    id="original"
                                    type="number"
                                    step="0.01"
                                    placeholder="10000"
                                    value={formData.original_amount}
                                    onChange={(e) => setFormData({ ...formData, original_amount: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="balance">Current Balance</Label>
                                <Input
                                    id="balance"
                                    type="number"
                                    step="0.01"
                                    placeholder="8500"
                                    value={formData.current_balance}
                                    onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="rate">Interest Rate (%)</Label>
                                <Input
                                    id="rate"
                                    type="number"
                                    step="0.01"
                                    placeholder="18.99"
                                    value={formData.interest_rate}
                                    onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="payment">Minimum Payment</Label>
                                <Input
                                    id="payment"
                                    type="number"
                                    step="0.01"
                                    placeholder="200"
                                    value={formData.minimum_payment}
                                    onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="due_day">Due Day of Month</Label>
                                <Input
                                    id="due_day"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="15"
                                    value={formData.due_day}
                                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lender">Lender (Optional)</Label>
                                <Input
                                    id="lender"
                                    placeholder="Bank name"
                                    value={formData.lender}
                                    onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="start_date">Start Date</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="end_date">Target Payoff Date</Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Any additional notes..."
                                    value={formData.notes}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingDebt ? 'Update Debt' : 'Add Debt'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Record Payment</DialogTitle>
                        <DialogDescription>
                            {selectedDebt && (
                                <>
                                    Recording payment for <strong>{selectedDebt.name}</strong>
                                    <br />
                                    Current balance: {formatCurrency(selectedDebt.current_balance)}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePaymentSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pay-amount">Total Payment Amount</Label>
                            <Input
                                id="pay-amount"
                                type="number"
                                step="0.01"
                                placeholder="200"
                                value={paymentFormData.amount}
                                onChange={(e) => {
                                    const amount = parseFloat(e.target.value) || 0
                                    const interest = parseFloat(paymentFormData.interest_amount) || 0
                                    setPaymentFormData({
                                        ...paymentFormData,
                                        amount: e.target.value,
                                        principal_amount: (amount - interest).toString()
                                    })
                                }}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="principal">Principal Portion</Label>
                                <Input
                                    id="principal"
                                    type="number"
                                    step="0.01"
                                    placeholder="150"
                                    value={paymentFormData.principal_amount}
                                    onChange={(e) => setPaymentFormData({
                                        ...paymentFormData,
                                        principal_amount: e.target.value
                                    })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="interest">Interest Portion</Label>
                                <Input
                                    id="interest"
                                    type="number"
                                    step="0.01"
                                    placeholder="50"
                                    value={paymentFormData.interest_amount}
                                    onChange={(e) => {
                                        const interest = parseFloat(e.target.value) || 0
                                        const total = parseFloat(paymentFormData.amount) || 0
                                        setPaymentFormData({
                                            ...paymentFormData,
                                            interest_amount: e.target.value,
                                            principal_amount: (total - interest).toString()
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pay-date">Payment Date</Label>
                            <Input
                                id="pay-date"
                                type="date"
                                value={paymentFormData.payment_date}
                                onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pay-notes">Notes (Optional)</Label>
                            <Input
                                id="pay-notes"
                                placeholder="e.g., Extra payment"
                                value={paymentFormData.notes}
                                onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Record Payment</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Payoff Strategy Dialog */}
            <Dialog open={isStrategyDialogOpen} onOpenChange={setIsStrategyDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Debt Payoff Strategies</DialogTitle>
                        <DialogDescription>
                            Compare different strategies to pay off your debts faster
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Snowball Method */}
                        <Card className="border-blue-500/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-full bg-blue-500/20 p-2">
                                        <Snowflake className="h-5 w-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Snowball Method</CardTitle>
                                        <CardDescription>Pay smallest balances first for quick wins</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Focus on paying off debts with the smallest balance first while making minimum payments on others.
                                    This builds momentum and motivation.
                                </p>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Payoff Order:</p>
                                    {snowballStrategy.map((debt, index) => (
                                        <div key={debt.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                                    {index + 1}
                                                </Badge>
                                                <span>{debt.name}</span>
                                            </div>
                                            <span className="text-muted-foreground">{formatCurrency(debt.current_balance)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Avalanche Method */}
                        <Card className="border-orange-500/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="rounded-full bg-orange-500/20 p-2">
                                        <Zap className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Avalanche Method</CardTitle>
                                        <CardDescription>Pay highest interest rates first to save money</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Focus on paying off debts with the highest interest rate first.
                                    This saves the most money in interest over time.
                                </p>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Payoff Order:</p>
                                    {avalancheStrategy.map((debt, index) => (
                                        <div key={debt.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                                    {index + 1}
                                                </Badge>
                                                <span>{debt.name}</span>
                                            </div>
                                            <span className="text-amber-500 font-medium">{debt.interest_rate}% APR</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recommendation */}
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-start gap-3">
                                <ArrowDownRight className="h-5 w-5 text-primary mt-0.5" />
                                <div>
                                    <p className="font-medium text-primary">Our Recommendation</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {avgInterestRate > 15
                                            ? 'With high-interest debts, the Avalanche method will save you more money in the long run.'
                                            : 'The Snowball method is great for building momentum, but consider Avalanche if you can stay motivated.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStrategyDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
