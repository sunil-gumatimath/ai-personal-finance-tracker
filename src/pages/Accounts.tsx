import {
    Plus,
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Eye,
    EyeOff,
    Search,
    Filter,
    ArrowUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { useAccounts } from '@/hooks/useAccounts'
import type { SortOption } from '@/hooks/useAccounts'
import { AccountCard, AccountModal, DeleteConfirmation } from '@/components/accounts'
import { ACCOUNT_TYPES } from '@/components/accounts/AccountCard'

export function Accounts() {
    const {
        loading,
        accounts,
        isDialogOpen,
        setIsDialogOpen,
        editingAccount,
        showBalances,
        setShowBalances,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        sortBy,
        setSortBy,
        deleteDialogOpen,
        setDeleteDialogOpen,
        accountToDelete,
        linkedTransactionsCount,
        isDeleting,
        formData,
        setFormData,
        handleSubmit,
        initiateDelete,
        handleDelete,
        resetForm,
        setEditMode,
        filteredAccounts,
        activeAccounts,
        inactiveAccounts,
        totalBalance,
        totalAssets,
        totalLiabilities,
        formatCurrency,
    } = useAccounts()

    if (loading) {
        return <LoadingSkeleton />
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header with Quick Actions */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Accounts</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Manage your financial accounts
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowBalances(!showBalances)}
                        aria-label={showBalances ? 'Hide balances' : 'Show balances'}
                    >
                        {showBalances ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm()
                            setIsDialogOpen(true)
                        }}
                        className="w-full sm:w-auto"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Account
                    </Button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Net Worth */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80 col-span-2">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Net Worth</span>
                        <Badge variant="outline" className="text-xs font-medium">
                            {activeAccounts.length} active
                        </Badge>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                            {showBalances ? formatCurrency(totalBalance) : '••••••'}
                        </span>
                    </div>
                    <div className={cn(
                        "flex items-center gap-1.5 text-sm font-medium",
                        totalBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                        {totalBalance >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        <span>{totalBalance >= 0 ? 'Positive balance' : 'Needs attention'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">Combined balance across accounts</p>
                    <div className={cn(
                        "absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
                        totalBalance >= 0 ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                </div>

                {/* Total Assets */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Assets</span>
                        <div className="flex items-center gap-1 text-emerald-400">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                            {showBalances ? formatCurrency(totalAssets) : '••••••'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Positive balances</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>

                {/* Liabilities */}
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Liabilities</span>
                        <div className="flex items-center gap-1 text-rose-400">
                            <ArrowDownRight className="h-3.5 w-3.5" />
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                            {showBalances ? formatCurrency(totalLiabilities) : '••••••'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">Negative balances</p>
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-rose-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
                </div>
            </div>

            {/* Search, Filter & Sort Bar */}
            {accounts.length > 0 && (
                <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border hover:bg-card/80">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex flex-col gap-4 sm:flex-row">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search accounts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-10 bg-background/50 border-border/50 rounded-lg"
                                aria-label="Search accounts by name"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[150px]" aria-label="Filter by account type">
                                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {ACCOUNT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                                <SelectTrigger className="w-[140px]" aria-label="Sort accounts">
                                    <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="balance">Balance</SelectItem>
                                    <SelectItem value="type">Type</SelectItem>
                                    <SelectItem value="created">Newest</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}

            {/* No Results State */}
            {accounts.length > 0 && filteredAccounts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">No accounts found</h3>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                        Try adjusting your search or filter criteria
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSearchQuery('')
                            setFilterType('all')
                        }}
                        className="mt-4"
                    >
                        Clear Filters
                    </Button>
                </div>
            )}

            {/* Active Accounts Section */}
            {activeAccounts.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold">Active Accounts</h3>
                        <span className="text-xs text-muted-foreground">{activeAccounts.length} total</span>
                    </div>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {activeAccounts.map((account) => (
                            <AccountCard
                                key={account.id}
                                account={account}
                                showBalances={showBalances}
                                formatCurrency={formatCurrency}
                                onEdit={setEditMode}
                                onDelete={initiateDelete}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Inactive Accounts Section */}
            {inactiveAccounts.length > 0 && (
                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-muted-foreground">Inactive Accounts</h3>
                    </div>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {inactiveAccounts.map((account) => (
                            <AccountCard
                                key={account.id}
                                account={account}
                                showBalances={showBalances}
                                formatCurrency={formatCurrency}
                                onEdit={setEditMode}
                                onDelete={initiateDelete}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State / Add New Account Card */}
            {accounts.length === 0 && (
                <div className="group relative overflow-hidden rounded-xl border-2 border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    <div className="relative flex flex-col items-center justify-center py-20 text-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150" />
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-background/50 text-primary border border-border/50">
                                <Wallet className="h-8 w-8" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight mb-2">Get Started</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-8">
                            Add your first account to start tracking your finances across banks, cards, and more.
                        </p>
                        <Button
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Account
                        </Button>
                    </div>
                </div>
            )}

            {accounts.length > 0 && (
                <button
                    onClick={() => {
                        resetForm()
                        setIsDialogOpen(true)
                    }}
                    className="flex w-full items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/50 bg-card/20 p-12 transition-all hover:border-primary/50 hover:bg-primary/5 group"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border/50 shadow-sm transition-all group-hover:scale-110 group-hover:border-primary/30">
                        <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-[0.2em] text-xs">
                        Add New Account
                    </span>
                </button>
            )}

            {/* Add/Edit Dialog */}
            <AccountModal
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                editingAccount={editingAccount}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onCancel={() => setIsDialogOpen(false)}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmation
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                account={accountToDelete}
                linkedCount={linkedTransactionsCount}
                isDeleting={isDeleting}
                onConfirm={handleDelete}
            />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 rounded-xl" />
                        <Skeleton className="h-11 w-32 rounded-xl" />
                    </div>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-48 rounded-xl sm:col-span-2" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
            </div>

            <div className="space-y-6">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}
