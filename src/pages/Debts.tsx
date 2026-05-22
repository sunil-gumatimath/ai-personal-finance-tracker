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
import { Progress } from '@/components/ui/progress'
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
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

interface SimulationResult {
    months: number
    totalInterest: number
    monthlyData: { month: number; remainingBalance: number }[]
}

const runSimulation = (
    activeDebtsList: Debt[],
    extraPayment: number,
    strategy: 'snowball' | 'avalanche' | 'minimums'
): SimulationResult => {
    // Make deep copies of active debts
    const simulatedDebts = activeDebtsList.map(d => ({
        id: d.id,
        current_balance: d.current_balance,
        interest_rate: d.interest_rate,
        minimum_payment: d.minimum_payment,
    }))

    let currentMonth = 0
    let totalInterestPaid = 0
    const monthlyData = [{ month: 0, remainingBalance: simulatedDebts.reduce((sum, d) => sum + d.current_balance, 0) }]

    const maxMonths = 360 // 30 years limit
    
    // Sort for rollover strategies
    if (strategy === 'snowball') {
        simulatedDebts.sort((a, b) => a.current_balance - b.current_balance)
    } else if (strategy === 'avalanche') {
        simulatedDebts.sort((a, b) => b.interest_rate - a.interest_rate)
    }

    // Sum of all initial minimum payments
    const baseMinimums = simulatedDebts.reduce((sum, d) => sum + d.minimum_payment, 0)

    while (currentMonth < maxMonths) {
        // Check if all debts are paid off
        const activeCount = simulatedDebts.filter(d => d.current_balance > 0).length
        if (activeCount === 0) break

        currentMonth++

        // 1. Accrue interest first
        simulatedDebts.forEach(d => {
            if (d.current_balance > 0) {
                const interest = d.current_balance * (d.interest_rate / 100 / 12)
                d.current_balance += interest
                totalInterestPaid += interest
            }
        })

        // 2. Distribute payments
        if (strategy === 'minimums') {
            // Pay only minimums, no rollover, no extra
            simulatedDebts.forEach(d => {
                if (d.current_balance > 0) {
                    const pay = Math.min(d.current_balance, d.minimum_payment)
                    d.current_balance -= pay
                }
            })
        } else {
            // Rollover strategy: baseMinimums + extraPayment is the monthly pool
            let monthlyPool = baseMinimums + extraPayment
            let leftoverPool = 0

            // Step 2a: Pay minimums first
            simulatedDebts.forEach(d => {
                if (d.current_balance > 0) {
                    const minDue = d.minimum_payment
                    const pay = Math.min(d.current_balance, minDue)
                    d.current_balance -= pay
                    monthlyPool -= pay
                    
                    // If we paid off the debt and paid less than the minimum due,
                    // the leftover of the minimum payment goes back to the pool
                    if (d.current_balance === 0 && pay < minDue) {
                        leftoverPool += (minDue - pay)
                    }
                }
            })

            // Add leftoverPool to the pool for extra payments
            let extraPool = monthlyPool + leftoverPool

            // Step 2b: Apply the extraPool to the highest priority debt
            for (let i = 0; i < simulatedDebts.length; i++) {
                const d = simulatedDebts[i]
                if (d.current_balance > 0) {
                    const pay = Math.min(d.current_balance, extraPool)
                    d.current_balance -= pay
                    extraPool -= pay
                    if (extraPool <= 0) break
                }
            }
        }

        const remainingBalance = simulatedDebts.reduce((sum, d) => sum + d.current_balance, 0)
        monthlyData.push({
            month: currentMonth,
            remainingBalance: Math.round(remainingBalance),
        })

        if (remainingBalance === 0) break
    }

    return {
        months: currentMonth,
        totalInterest: totalInterestPaid,
        monthlyData,
    }
}

const PayoffProgressRing = ({ percentage, color = 'var(--color-savings)' }: { percentage: number; color?: string }) => {
    const radius = 22
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
        <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    className="stroke-muted"
                    strokeWidth="3.5"
                    fill="transparent"
                />
                <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    stroke={color}
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold">{Math.round(percentage)}%</span>
            </div>
        </div>
    )
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
    const [extraPayment, setExtraPayment] = useState(200)

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
                start_date: formData.start_date || format(new Date(), 'yyyy-MM-dd'),
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
                try {
                    await api.debts.update(selectedDebt.id, { is_active: false })
                } catch (updateError) {
                    console.error('Error auto-marking debt as inactive:', updateError)
                }
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
                is_active: false,
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

        // If minimum payment is less than or equal to monthly interest, it will never be paid off
        if (debt.minimum_payment <= debt.current_balance * monthlyRate) {
            return null
        }

        // Calculate months using amortization formula
        const months = Math.log(debt.minimum_payment / (debt.minimum_payment - debt.current_balance * monthlyRate)) / Math.log(1 + monthlyRate)
        return isNaN(months) || !isFinite(months) ? null : Math.ceil(months)
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
    const activeDebts = debts.filter(d => d.is_active && d.current_balance > 0)
    const paidOffDebts = debts.filter(d => !d.is_active || d.current_balance === 0)
    const totalDebt = activeDebts.reduce((sum, d) => sum + d.current_balance, 0)
    const totalOriginal = debts.reduce((sum, d) => sum + d.original_amount, 0)
    const totalMinPayment = activeDebts.reduce((sum, d) => sum + d.minimum_payment, 0)
    const avgInterestRate = activeDebts.length > 0
        ? activeDebts.reduce((sum, d) => sum + d.interest_rate, 0) / activeDebts.length
        : 0
    const totalPaid = Math.max(0, totalOriginal - totalDebt)

    // Payoff simulations
    const simulations = useMemo(() => {
        const activeDebtsList = debts.filter(d => d.is_active && d.current_balance > 0)
        if (activeDebtsList.length === 0) {
            return {
                snowball: { months: 0, totalInterest: 0, monthlyData: [] },
                avalanche: { months: 0, totalInterest: 0, monthlyData: [] },
                minimums: { months: 0, totalInterest: 0, monthlyData: [] },
                mergedData: [],
            }
        }

        const snowballRes = runSimulation(activeDebtsList, extraPayment, 'snowball')
        const avalancheRes = runSimulation(activeDebtsList, extraPayment, 'avalanche')
        const minOnlyRes = runSimulation(activeDebtsList, 0, 'minimums')

        // Merge data for the Recharts chart
        const mergedData = []
        const maxLen = Math.max(
            snowballRes.monthlyData.length,
            avalancheRes.monthlyData.length,
            minOnlyRes.monthlyData.length
        )

        const now = new Date()
        for (let i = 0; i < maxLen; i++) {
            const dateLabel = format(
                new Date(now.getFullYear(), now.getMonth() + i, 1),
                'MMM yyyy'
            )
            const snowballVal = i < snowballRes.monthlyData.length 
                ? snowballRes.monthlyData[i].remainingBalance 
                : 0
            const avalancheVal = i < avalancheRes.monthlyData.length 
                ? avalancheRes.monthlyData[i].remainingBalance 
                : 0
            const minOnlyVal = i < minOnlyRes.monthlyData.length 
                ? minOnlyRes.monthlyData[i].remainingBalance 
                : 0

            mergedData.push({
                month: i,
                dateLabel,
                snowball: snowballVal,
                avalanche: avalancheVal,
                minimums: minOnlyVal,
            })
        }

        return {
            snowball: snowballRes,
            avalanche: avalancheRes,
            minimums: minOnlyRes,
            mergedData,
        }
    }, [debts, extraPayment])

    const renderDebtCard = (debt: Debt) => {
        const DebtIcon = getDebtIcon(debt.type)
        const progress = getProgress(debt)
        const isPaidOff = debt.current_balance === 0
        const payoffMonths = calculatePayoffTime(debt)
        const totalInterest = calculateTotalInterest(debt)
        const isExpanded = expandedDebt === debt.id

        return (
            <div
                key={debt.id}
                className={cn(
                    'group relative overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md p-5 transition-all duration-300 hover:bg-card/70 h-fit',
                    isPaidOff 
                        ? 'border-green-500/30 shadow-[0_4px_20px_rgb(34,197,94,0.03)]' 
                        : 'border-border/50'
                )}
                style={
                    !isPaidOff 
                        ? {
                            borderColor: isExpanded ? `${debt.color}30` : undefined,
                            boxShadow: isExpanded 
                                ? `0 10px 30px -10px ${debt.color}15, 0 1px 3px 0 ${debt.color}05` 
                                : 'none'
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
                                <DebtIcon
                                    className="h-5 w-5"
                                    style={{ color: debt.color }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-bold tracking-tight truncate">{debt.name}</h3>
                                    {isPaidOff && (
                                        <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 shrink-0">
                                            Paid Off
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
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
                                            <span className="text-amber-500 font-semibold">{debt.interest_rate}% APR</span>
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

                    {/* Progress bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Payoff Progress</span>
                            <span className="font-semibold" style={{ color: debt.color }}>{Math.round(progress)}% paid</span>
                        </div>
                        <Progress
                            value={progress}
                            className="h-2 rounded-full bg-secondary/50"
                            style={
                                {
                                    '--progress-color': debt.color,
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
                                <p className="text-[10px] text-muted-foreground font-medium">Min Payment</p>
                                <p className="text-xs font-bold text-foreground mt-0.5">{formatCurrency(debt.minimum_payment)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium">Due Date</p>
                                <p className="text-xs font-bold text-foreground mt-0.5">
                                    {debt.due_day ? `Day ${debt.due_day}` : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground font-medium">Payoff Time</p>
                                <p className="text-xs font-bold text-foreground mt-0.5">
                                    {payoffMonths === null
                                        ? 'Never (min too low)'
                                        : payoffMonths > 12
                                            ? `${Math.floor(payoffMonths / 12)}y ${payoffMonths % 12}m`
                                            : `${payoffMonths} months`
                                    }
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Expanded content - Payment history */}
                    {isExpanded && (
                        <div className="pt-4 border-t border-border/40 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-foreground">Recent Payments</h4>
                                {!isPaidOff && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => {
                                            setSelectedDebt(debt)
                                            setPaymentFormData({
                                                ...paymentFormData,
                                                amount: debt.minimum_payment.toString(),
                                            })
                                            setIsPaymentDialogOpen(true)
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
                                                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: debt.color }} />
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-border/60 hover:bg-card/90 gap-2">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-foreground">{formatCurrency(payment.amount)}</span>
                                                        <span className="text-[10px] text-muted-foreground font-medium">
                                                            {format(new Date(payment.payment_date), 'MMM d, yyyy')}
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
                                                        Principal: {formatCurrency(payment.principal_amount)}
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
                                        <strong>Interest Warning:</strong> At this minimum payment rate, you'll pay approximately{' '}
                                        <strong className="text-amber-500">{formatCurrency(totalInterest)}</strong> in interest over{' '}
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
                            className="w-full h-9 text-xs"
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
                            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                            Record Payment
                        </Button>
                    )}
                </div>
            </div>
        )
    }

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
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-red-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgb(239,68,68,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Debt</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                            <TrendingDown className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalDebt)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-1">
                        <span>Across {activeDebts.length} debts</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Outstanding liability balance</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgb(16,185,129,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-1">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Total Paid</span>
                            <div className="relative">
                                <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground block">
                                    {formatCurrency(totalPaid)}
                                </span>
                            </div>
                        </div>
                        <PayoffProgressRing
                            percentage={totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0}
                            color="var(--color-income)"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mt-2">
                        <span>{totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0}% paid off</span>
                    </div>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgb(59,130,246,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Monthly Payment</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                            <Calendar className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {formatCurrency(totalMinPayment)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-1">
                        <span>Minimum due monthly</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Combined active payments</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-md p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/20 hover:bg-card/75 hover:shadow-[0_8px_30px_rgb(245,158,11,0.04)]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Avg Interest</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                            <Percent className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {avgInterestRate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
                        <span>Weighted APR</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">Average rate of active loans</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-500 opacity-5 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-10 pointer-events-none" />
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

                <TabsContent value="active" className="mt-6">
                    {activeDebts.length === 0 ? (
                        <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            <div className="relative flex flex-col items-center justify-center py-16 text-center">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
                                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                                        <CreditCard className="h-8 w-8" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold tracking-tight mb-2">
                                    No active debts
                                </h3>
                                <p className="text-sm text-muted-foreground mb-8">
                                    Add your debts to start tracking and planning payoffs
                                </p>
                                <Button
                                    onClick={() => {
                                        resetForm()
                                        setIsDialogOpen(true)
                                    }}
                                    className="gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Debt
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {activeDebts.map(renderDebtCard)}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="paid" className="mt-6">
                    {paidOffDebts.length === 0 ? (
                        <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            <div className="relative flex flex-col items-center justify-center py-16 text-center">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
                                    <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                                        <CreditCard className="h-8 w-8" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold tracking-tight mb-2">
                                    No paid off debts yet
                                </h3>
                                <p className="text-sm text-muted-foreground mb-8">
                                    Keep working on your debts - you got this!
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {paidOffDebts.map(renderDebtCard)}
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
                <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">Interactive Payoff Planner</DialogTitle>
                        <DialogDescription>
                            Simulate and compare payoff strategies by adding extra monthly contributions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Interactive Budget Slider */}
                        <div className="p-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold">Extra Monthly Payment</h4>
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
                                        onChange={(e) => setExtraPayment(Math.max(0, parseFloat(e.target.value) || 0))}
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
                                    <p className="font-semibold">{formatCurrency(totalMinPayment)}</p>
                                </div>
                                <div className="text-primary font-bold">
                                    <p className="text-primary/70">Extra Accelerator</p>
                                    <p>+ {formatCurrency(extraPayment)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Total Budget</p>
                                    <p className="font-semibold">{formatCurrency(totalMinPayment + extraPayment)}</p>
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
                                        {simulations.minimums.months >= 360 ? '30+ years' : `${simulations.minimums.months} months`}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Interest: <span className="text-red-400 font-semibold">{formatCurrency(simulations.minimums.totalInterest)}</span>
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
                                    <span className="text-sm font-semibold text-blue-500">Snowball Strategy</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-bold text-foreground">
                                        {simulations.snowball.months} months
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Interest: <span className="text-amber-500 font-semibold">{formatCurrency(simulations.snowball.totalInterest)}</span>
                                    </p>
                                    {simulations.minimums.months > simulations.snowball.months && (
                                        <p className="text-[10px] text-emerald-500 font-bold mt-1 leading-normal">
                                            Saved {simulations.minimums.months - simulations.snowball.months} months & {formatCurrency(Math.max(0, simulations.minimums.totalInterest - simulations.snowball.totalInterest))} interest
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
                                    <span className="text-sm font-semibold text-purple-500">Avalanche Strategy</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-bold text-foreground">
                                        {simulations.avalanche.months} months
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Interest: <span className="text-amber-500 font-semibold">{formatCurrency(simulations.avalanche.totalInterest)}</span>
                                    </p>
                                    {simulations.minimums.months > simulations.avalanche.months && (
                                        <p className="text-[10px] text-emerald-500 font-bold mt-1 leading-normal">
                                            Saved {simulations.minimums.months - simulations.avalanche.months} months & {formatCurrency(Math.max(0, simulations.minimums.totalInterest - simulations.avalanche.totalInterest))} interest
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Chart Projections */}
                        <div className="p-4 rounded-xl border border-border/50 bg-card/10">
                            <h4 className="text-sm font-semibold mb-3">Payoff Balance Projection</h4>
                            <div className="h-[250px] w-full">
                                <ChartContainer
                                    config={{
                                        snowball: { label: 'Snowball Method', color: '#3b82f6' },
                                        avalanche: { label: 'Avalanche Method', color: '#a855f7' },
                                        minimums: { label: 'Minimums Only', color: '#64748b' }
                                    }}
                                    className="h-full w-full"
                                >
                                    <AreaChart data={simulations.mergedData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="snowballGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                                            </linearGradient>
                                            <linearGradient id="avalancheGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                                            </linearGradient>
                                            <linearGradient id="minimumsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#64748b" stopOpacity={0.05} />
                                                <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                                        <XAxis
                                            dataKey="dateLabel"
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            style={{ fontSize: '10px' }}
                                            interval={Math.ceil(simulations.mergedData.length / 6)}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                            style={{ fontSize: '10px' }}
                                            tickFormatter={(val) => val === 0 ? '$0' : `$${(val / 1000).toFixed(0)}k`}
                                        />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    indicator="dot"
                                                    formatter={(value, name) => (
                                                        <div className="flex items-center justify-between gap-6 text-xs">
                                                            <span className="text-muted-foreground">{name === 'snowball' ? 'Snowball' : name === 'avalanche' ? 'Avalanche' : 'Minimums'}</span>
                                                            <span className="font-bold">{formatCurrency(Number(value))}</span>
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
                                    High-interest rates are paid first. Mathematically, this saves you the most interest.
                                </p>
                                {avalancheStrategy.map((debt, index) => (
                                    <div key={debt.id} className="flex items-center justify-between text-sm p-3 rounded-xl border border-border/40 bg-card/50">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold">
                                                {index + 1}
                                            </Badge>
                                            <span className="font-semibold">{debt.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{debt.interest_rate}% APR</span>
                                            <span className="text-muted-foreground">{formatCurrency(debt.current_balance)}</span>
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>
                            <TabsContent value="snowball" className="mt-3 space-y-2">
                                <p className="text-xs text-muted-foreground italic mb-2">
                                    Smallest balances are paid first. This provides psychological quick-wins to keep you motivated.
                                </p>
                                {snowballStrategy.map((debt, index) => (
                                    <div key={debt.id} className="flex items-center justify-between text-sm p-3 rounded-xl border border-border/40 bg-card/50">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center font-bold">
                                                {index + 1}
                                            </Badge>
                                            <span className="font-semibold">{debt.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            <span className="text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{formatCurrency(debt.current_balance)} balance</span>
                                            <span className="text-amber-500">{debt.interest_rate}% APR</span>
                                        </div>
                                    </div>
                                ))}
                            </TabsContent>
                        </Tabs>

                        {/* Recommendation */}
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex gap-3">
                            <ArrowDownRight className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-primary">Strategy Analysis & Recommendation</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {simulations.avalanche.totalInterest < simulations.snowball.totalInterest ? (
                                        <>
                                            The <strong>Avalanche method</strong> is your best option, saving you{' '}
                                            <strong>{formatCurrency(simulations.snowball.totalInterest - simulations.avalanche.totalInterest)}</strong>{' '}
                                            in interest charges compared to Snowball. By focusing extra payments on your{' '}
                                            {avalancheStrategy[0] && <strong>{avalancheStrategy[0].name} ({avalancheStrategy[0].interest_rate}% APR)</strong>}, you minimize waste.
                                        </>
                                    ) : (
                                        <>
                                            Both strategies yield similar interest profiles. The <strong>Snowball method</strong> is recommended for the psychological boost of paying off{' '}
                                            {snowballStrategy[0] && <strong>{snowballStrategy[0].name} ({formatCurrency(snowballStrategy[0].current_balance)} remaining)</strong>}{' '}
                                            extremely quickly.
                                        </>
                                    )}
                                    {extraPayment === 0 && (
                                        <span className="block mt-2 font-semibold text-amber-500">
                                            Tip: Try moving the slider to see how even $100 or $200 a month will collapse your payoff timeline by years!
                                        </span>
                                    )}
                                </p>
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
