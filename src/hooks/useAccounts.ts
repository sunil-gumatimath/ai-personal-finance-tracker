import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { usePreferences } from '@/hooks/usePreferences'
import type { Account } from '@/types'

export const COLORS = [
    { value: '#3b82f6', name: 'Blue', gradient: 'from-blue-500 to-blue-600' },
    { value: '#22c55e', name: 'Green', gradient: 'from-emerald-500 to-emerald-600' },
    { value: '#8b5cf6', name: 'Purple', gradient: 'from-purple-500 to-violet-600' },
    { value: '#f59e0b', name: 'Amber', gradient: 'from-amber-500 to-orange-500' },
    { value: '#ef4444', name: 'Red', gradient: 'from-red-500 to-rose-600' },
    { value: '#ec4899', name: 'Pink', gradient: 'from-pink-500 to-rose-500' },
    { value: '#06b6d4', name: 'Cyan', gradient: 'from-cyan-500 to-teal-500' },
    { value: '#84cc16', name: 'Lime', gradient: 'from-lime-500 to-green-500' },
    { value: '#f97316', name: 'Orange', gradient: 'from-orange-500 to-red-500' },
    { value: '#6366f1', name: 'Indigo', gradient: 'from-indigo-500 to-purple-500' },
]

export type SortOption = 'name' | 'balance' | 'type' | 'created'

export function useAccounts() {
    const { user } = useAuth()
    const { formatCurrency, preferences } = usePreferences()
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<Account[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingAccount, setEditingAccount] = useState<Account | null>(null)
    const [showBalances, setShowBalances] = useState(true)

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [sortBy, setSortBy] = useState<SortOption>('name')

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)
    const [linkedTransactionsCount, setLinkedTransactionsCount] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        type: 'checking' as Account['type'],
        balance: '',
        color: COLORS[0].value,
        is_active: true,
    })

    const fetchAccounts = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }

        try {
            const res = await api.accounts.list()
            setAccounts((res.accounts || []) as Account[])
        } catch (error) {
            console.error('Error fetching accounts:', error)
            toast.error('Failed to load accounts')
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        try {
            const accountData = {
                name: formData.name,
                type: formData.type,
                balance: parseFloat(formData.balance) || 0,
                color: formData.color,
                icon: formData.type,
                is_active: formData.is_active,
                currency: preferences.currency,
            }

            if (editingAccount) {
                await api.accounts.update(editingAccount.id, accountData)
                toast.success('Account updated successfully')
            } else {
                await api.accounts.create(accountData)
                toast.success('Account created successfully')
            }

            setIsDialogOpen(false)
            resetForm()
            fetchAccounts()
        } catch (error) {
            console.error('Error saving account:', error)
            toast.error('Failed to save account')
        }
    }

    const initiateDelete = async (account: Account) => {
        setAccountToDelete(account)

        try {
            const res = await api.accounts.linkedCount(account.id)
            setLinkedTransactionsCount(res.count)
        } catch (error) {
            console.error('Error checking transactions:', error)
            setLinkedTransactionsCount(0)
        }

        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!accountToDelete) return

        setIsDeleting(true)
        try {
            await api.accounts.delete(accountToDelete.id, linkedTransactionsCount > 0)
            toast.success(`"${accountToDelete.name}" deleted successfully`)
            fetchAccounts()
        } catch (error) {
            console.error('Error deleting account:', error)
            toast.error('Failed to delete account. Please try again.')
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
            setAccountToDelete(null)
            setLinkedTransactionsCount(0)
        }
    }

    const resetForm = () => {
        setEditingAccount(null)
        setFormData({
            name: '',
            type: 'checking',
            balance: '',
            color: COLORS[0].value,
            is_active: true,
        })
    }

    const setEditMode = (account: Account) => {
        setEditingAccount(account)
        setFormData({
            name: account.name,
            type: account.type,
            balance: account.balance.toString(),
            color: account.color,
            is_active: account.is_active,
        })
        setIsDialogOpen(true)
    }

    const filteredAccounts = accounts.filter((account) => {
        const matchesSearch = account.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = filterType === 'all' || account.type === filterType
        return matchesSearch && matchesType
    })

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name)
            case 'balance':
                return b.balance - a.balance
            case 'type':
                return a.type.localeCompare(b.type)
            case 'created':
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            default:
                return 0
        }
    })

    const activeAccounts = sortedAccounts.filter((a) => a.is_active)
    const inactiveAccounts = sortedAccounts.filter((a) => !a.is_active)
    const totalBalance = accounts.filter((a) => a.is_active).reduce((sum, a) => sum + Number(a.balance || 0), 0)
    const totalAssets = accounts.filter(a => a.is_active && Number(a.balance || 0) > 0).reduce((sum, a) => sum + Number(a.balance || 0), 0)
    const totalLiabilities = Math.abs(accounts.filter(a => a.is_active && Number(a.balance || 0) < 0).reduce((sum, a) => sum + Number(a.balance || 0), 0))

    return {
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
        sortedAccounts,
        activeAccounts,
        inactiveAccounts,
        totalBalance,
        totalAssets,
        totalLiabilities,
        formatCurrency,
    }
}
