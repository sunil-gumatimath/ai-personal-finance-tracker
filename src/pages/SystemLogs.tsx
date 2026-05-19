import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
    ScrollText,
    Activity,
    XCircle,
    CheckCircle2,
    RefreshCw,
    Search,
    Download,
    User,
    X,
    FileText,
    FileEdit,
    Trash2,
    Plus,
    ChevronDown,
    Calendar,
    ArrowUpDown,
    Clock,
    Info,
    AlertTriangle,
    Shield,
    Zap,
    Filter,
    ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import {
    formatAction,
    formatResource,
    formatTimestamp,
    generateHumanDescription,
    getFieldChanges,
    formatMetadata,
    formatFieldValue,
    formatFieldName,
    shouldShowField
} from '@/lib/log-formatter'



export interface LogEntry {
    id: string;
    timestamp: string;
    action: string;
    resource: string;
    oldValue: string | null;
    newValue: string | null;
    userId: string | null;
    userEmail: string | null;
    severity: 'info' | 'warning' | 'error' | 'critical';
    status: 'success' | 'failure';
    metadata: Record<string, any>;
}

export function SystemLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        total: 0,
        created: 0,
        edited: 0,
        deleted: 0,
        today: 0,
        thisWeek: 0
    })
    const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
    
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
    const [selectedAction, setSelectedAction] = useState<string>('all')
    const [dateRange, setDateRange] = useState<string>('all')
    
    const [inspectedLog, setInspectedLog] = useState<LogEntry | null>(null)
    const [drawerVisible, setDrawerVisible] = useState(false)
    
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<number | null>(null)

    const openDrawer = useCallback((log: LogEntry) => {
        setInspectedLog(log)
        // Small delay so the backdrop renders before slide-in
        requestAnimationFrame(() => setDrawerVisible(true))
    }, [])

    const closeDrawer = useCallback(() => {
        setDrawerVisible(false)
        setTimeout(() => setInspectedLog(null), 300)
    }, [])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const logsData = await api.systemLogs.list()
            const fetchedLogs = logsData.logs || []
            setLogs(fetchedLogs)
            updateStats(fetchedLogs)
        } catch (err) {
            console.error('Failed to fetch logs:', err)
            toast.error('Failed to load system logs')
        } finally {
            setLoading(false)
        }
    }

    const updateStats = (currentLogs: LogEntry[]) => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)

        const statsObj = currentLogs.reduce(
            (acc, curr) => {
                acc.total++
                if (curr.action === 'TRANSACTION_CREATED') acc.created++
                if (curr.action === 'TRANSACTION_EDITED') acc.edited++
                if (curr.action === 'TRANSACTION_DELETED') acc.deleted++
                
                const logDate = new Date(curr.timestamp)
                if (logDate >= todayStart) acc.today++
                if (logDate >= weekStart) acc.thisWeek++
                return acc
            },
            { total: 0, created: 0, edited: 0, deleted: 0, today: 0, thisWeek: 0 }
        )
        setStats(statsObj)
    }

    const connectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        const wsHost = isDev ? 'localhost:3001' : window.location.host
        const wsUrl = `${protocol}//${wsHost}/api/ws-logs`
        setWsStatus('reconnecting')

        const socket = new WebSocket(wsUrl)
        wsRef.current = socket

        socket.onopen = () => {
            setWsStatus('connected')
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }

        socket.onmessage = (event) => {
            try {
                const log: LogEntry = JSON.parse(event.data)
                setLogs((prev) => {
                    const newLogs = [log, ...prev]
                    updateStats(newLogs)
                    return newLogs
                })

                if (log.severity === 'critical') {
                    toast.error(`Critical Event: ${formatAction(log.action)}`, {
                        description: generateHumanDescription(log),
                        duration: 8000
                    })
                } else if (log.severity === 'error') {
                    toast.error(`Error: ${formatAction(log.action)}`, {
                        description: generateHumanDescription(log),
                        duration: 6000
                    })
                } else if (log.severity === 'warning') {
                    toast.warning(`Warning: ${formatAction(log.action)}`, {
                        duration: 4000
                    })
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err)
            }
        }

        socket.onclose = () => {
            setWsStatus('reconnecting')
            reconnectTimeoutRef.current = window.setTimeout(() => {
                connectWebSocket()
            }, 3000)
        }

        socket.onerror = () => {
            socket.close()
        }
    }

    useEffect(() => {
        fetchInitialData()
        connectWebSocket()

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [])

    const exportLogs = (format: 'json' | 'csv') => {
        let content = ''
        let filename = `activity-logs-${new Date().toISOString().slice(0, 10)}`
        
        if (format === 'json') {
            const enhancedLogs = logs.map(log => ({
                ...log,
                humanReadable: {
                    action: formatAction(log.action),
                    resource: formatResource(log.resource).short,
                    timestamp: formatTimestamp(log.timestamp),
                    description: generateHumanDescription(log),
                    fieldChanges: getFieldChanges(log.oldValue, log.newValue),
                    metadata: formatMetadata(log.metadata)
                }
            }))
            content = JSON.stringify(enhancedLogs, null, 2)
            filename += '.json'
        } else {
            const headers = ['Timestamp', 'Action', 'User', 'Description', 'Resource', 'Severity', 'Status', 'Changes']
            const rows = logs.map(l => {
                const changes = getFieldChanges(l.oldValue, l.newValue)
                    .map(c => c.summary)
                    .join('; ')
                return [
                    formatTimestamp(l.timestamp).absolute,
                    formatAction(l.action),
                    l.userEmail || 'system',
                    generateHumanDescription(l),
                    formatResource(l.resource).short,
                    l.severity,
                    l.status,
                    changes || 'N/A'
                ]
            })
            content = [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n')
            filename += '.csv'
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${format.toUpperCase()} successfully!`)
    }

    const clearFilters = () => {
        setSearchQuery('')
        setSelectedSeverity('all')
        setSelectedAction('all')
        setDateRange('all')
    }

    const hasActiveFilters = searchQuery || selectedAction !== 'all' || selectedSeverity !== 'all' || dateRange !== 'all'

    const filteredLogs = useMemo(() => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(todayStart)
        weekStart.setDate(weekStart.getDate() - 7)
        const monthStart = new Date(todayStart)
        monthStart.setDate(monthStart.getDate() - 30)

        return logs.filter((log) => {
            const matchesSearch =
                searchQuery === '' ||
                log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                generateHumanDescription(log).toLowerCase().includes(searchQuery.toLowerCase())

            const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity
            const matchesAction = selectedAction === 'all' || log.action === selectedAction
            
            let matchesDate = true
            if (dateRange === 'today') {
                matchesDate = new Date(log.timestamp) >= todayStart
            } else if (dateRange === 'week') {
                matchesDate = new Date(log.timestamp) >= weekStart
            } else if (dateRange === 'month') {
                matchesDate = new Date(log.timestamp) >= monthStart
            }

            return matchesSearch && matchesSeverity && matchesAction && matchesDate
        })
    }, [logs, searchQuery, selectedSeverity, selectedAction, dateRange])

    const actionOptions = useMemo(() => {
        const set = new Set<string>()
        logs.forEach(l => set.add(l.action))
        return Array.from(set)
    }, [logs])

    const getActionColor = (action: string) => {
        if (action === 'TRANSACTION_CREATED') return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600', glow: 'shadow-emerald-500/10' }
        if (action === 'TRANSACTION_EDITED') return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600', glow: 'shadow-blue-500/10' }
        return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-600', glow: 'shadow-rose-500/10' }
    }

    const getSeverityConfig = (severity: string) => {
        switch (severity) {
            case 'critical': return { color: 'bg-red-500/15 text-red-600 border-red-500/25', icon: AlertTriangle, label: 'Critical' }
            case 'error': return { color: 'bg-rose-500/15 text-rose-600 border-rose-500/25', icon: XCircle, label: 'Error' }
            case 'warning': return { color: 'bg-amber-500/15 text-amber-600 border-amber-500/25', icon: AlertTriangle, label: 'Warning' }
            default: return { color: 'bg-sky-500/10 text-sky-600 border-sky-500/20', icon: Info, label: 'Info' }
        }
    }

    const getActionIcon = (action: string) => {
        if (action === 'TRANSACTION_CREATED') return Plus
        if (action === 'TRANSACTION_EDITED') return FileEdit
        if (action === 'TRANSACTION_DELETED') return Trash2
        return Activity
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Activity Logs</h1>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                            wsStatus === 'connected' 
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' 
                                : wsStatus === 'reconnecting' 
                                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-600' 
                                    : 'bg-rose-500/10 border-rose-500/25 text-rose-600'
                        }`}>
                            <span className="relative flex h-2 w-2">
                                {wsStatus === 'connected' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                    wsStatus === 'connected' ? 'bg-emerald-500' :
                                    wsStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                                }`}></span>
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider">
                                {wsStatus === 'connected' ? 'Live' : wsStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        Track and audit all transaction changes in real-time.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={async () => {
                        await fetchInitialData()
                        toast.success('Logs refreshed')
                    }} className="gap-1.5 h-9">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 h-9">
                                <Download className="h-3.5 w-3.5" />
                                Export
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => exportLogs('json')}>
                                <FileText className="h-4 w-4 mr-2" />
                                Export as JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportLogs('csv')}>
                                <Download className="h-4 w-4 mr-2" />
                                Export as CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Events', value: stats.total, icon: ScrollText, color: 'text-foreground', accent: 'from-violet-500/10 to-indigo-500/10', iconColor: 'text-violet-500' },
                    { label: 'Created', value: stats.created, icon: Plus, color: 'text-emerald-600', accent: 'from-emerald-500/10 to-green-500/10', iconColor: 'text-emerald-500' },
                    { label: 'Edited', value: stats.edited, icon: FileEdit, color: 'text-blue-600', accent: 'from-blue-500/10 to-cyan-500/10', iconColor: 'text-blue-500' },
                    { label: 'Deleted', value: stats.deleted, icon: Trash2, color: 'text-rose-600', accent: 'from-rose-500/10 to-pink-500/10', iconColor: 'text-rose-500' },
                    { label: 'Today', value: stats.today, icon: Zap, color: 'text-amber-600', accent: 'from-amber-500/10 to-orange-500/10', iconColor: 'text-amber-500' },
                    { label: 'This Week', value: stats.thisWeek, icon: Calendar, color: 'text-sky-600', accent: 'from-sky-500/10 to-blue-500/10', iconColor: 'text-sky-500' },
                ].map((stat, i) => (
                    <Card key={i} className="group relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        <CardContent className="p-4 relative">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                    <p className={`text-2xl font-bold mt-1 tabular-nums ${stat.color}`}>{stat.value}</p>
                                </div>
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.iconColor} bg-muted/50 group-hover:bg-background/60 transition-colors duration-300`}>
                                    <stat.icon className="h-4 w-4" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by action, description, or user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10"
                            />
                        </div>
                        <Select value={selectedAction} onValueChange={setSelectedAction}>
                            <SelectTrigger className="w-full sm:w-[180px] h-10">
                                <SelectValue placeholder="All Actions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {actionOptions.map(action => (
                                    <SelectItem key={action} value={action}>
                                        {formatAction(action)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                            <SelectTrigger className="w-full sm:w-[160px] h-10">
                                <SelectValue placeholder="All Severities" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="w-full sm:w-[160px] h-10">
                                <SelectValue placeholder="All Time" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="week">Last 7 Days</SelectItem>
                                <SelectItem value="month">Last 30 Days</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 shrink-0 text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4 mr-1.5" />
                                Clear
                            </Button>
                        )}
                    </div>
                    {hasActiveFilters && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                                Showing {filteredLogs.length} of {logs.length} entries
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Activity Timeline</CardTitle>
                            <CardDescription className="mt-0.5">
                                {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'} found
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-1">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                                    <div className="flex-1 space-y-2.5">
                                        <div className="h-4 bg-muted rounded-md w-2/5" />
                                        <div className="h-3.5 bg-muted rounded-md w-3/5" />
                                    </div>
                                    <div className="space-y-2 text-right shrink-0">
                                        <div className="h-3.5 bg-muted rounded-md w-14 ml-auto" />
                                        <div className="h-3 bg-muted rounded-md w-20 ml-auto" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredLogs.length > 0 ? (
                        <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[36px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />

                            {filteredLogs.map((log, index) => {
                                const timeInfo = formatTimestamp(log.timestamp)
                                const description = generateHumanDescription(log)
                                const actionColors = getActionColor(log.action)
                                const severityConfig = getSeverityConfig(log.severity)
                                const IconComponent = getActionIcon(log.action)

                                return (
                                    <div
                                        key={log.id}
                                        onClick={() => openDrawer(log)}
                                        className="group relative flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-all duration-200 hover:bg-muted/40 active:bg-muted/60"
                                        style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                                    >
                                        {/* Icon node */}
                                        <div className={`relative z-10 flex items-center justify-center h-10 w-10 rounded-full border shrink-0 transition-shadow duration-200 group-hover:shadow-md ${actionColors.bg} ${actionColors.border} ${actionColors.text} group-hover:${actionColors.glow}`}>
                                            <IconComponent className="h-4 w-4" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm">{formatAction(log.action)}</span>
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium border ${severityConfig.color}`}>
                                                    {severityConfig.label}
                                                </Badge>
                                                {log.status === 'failure' && (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                                        Failed
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                                {description}
                                            </p>
                                        </div>

                                        {/* Right side info */}
                                        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                                            <span className="text-xs font-medium text-foreground/80">{timeInfo.relative}</span>
                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {log.userEmail?.split('@')[0] || 'system'}
                                            </span>
                                        </div>

                                        {/* Chevron hint */}
                                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 shrink-0" />
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 px-4">
                            <div className="h-20 w-20 mx-auto mb-5 rounded-2xl bg-muted/60 flex items-center justify-center rotate-3 transition-transform hover:rotate-0 hover:scale-105 duration-300">
                                <ScrollText className="h-9 w-9 text-muted-foreground/60" />
                            </div>
                            <h3 className="font-semibold text-lg">No activity logs found</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                                {logs.length === 0
                                    ? "No transaction activity has been recorded yet. Create or edit a transaction to see logs appear here in real-time."
                                    : "No logs match your current filters. Try adjusting your search criteria or clearing filters."}
                            </p>
                            {logs.length === 0 ? (
                                <Button className="mt-5" asChild>
                                    <a href="/transactions">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Transaction
                                    </a>
                                </Button>
                            ) : (
                                <Button variant="outline" className="mt-5" onClick={clearFilters}>
                                    <X className="h-4 w-4 mr-2" />
                                    Clear All Filters
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Drawer — portaled to body to escape overflow-auto clipping */}
            {inspectedLog && createPortal(
                <div
                    className={`fixed inset-0 z-[100] transition-all duration-300 ${drawerVisible ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent pointer-events-none'}`}
                    onClick={closeDrawer}
                >
                    <div
                        className={`pointer-events-auto absolute right-0 top-0 w-full max-w-2xl h-full bg-card border-l shadow-2xl flex flex-col transition-transform duration-300 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-6 border-b bg-muted/30">
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const actionColors = getActionColor(inspectedLog.action)
                                    const IconComp = getActionIcon(inspectedLog.action)
                                    return (
                                        <div className={`flex items-center justify-center h-12 w-12 rounded-xl border ${actionColors.bg} ${actionColors.border} ${actionColors.text}`}>
                                            <IconComp className="h-5 w-5" />
                                        </div>
                                    )
                                })()}
                                <div>
                                    <h2 className="text-lg font-semibold">{formatAction(inspectedLog.action)}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatTimestamp(inspectedLog.timestamp).absolute}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={closeDrawer} className="h-8 w-8 rounded-lg">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Summary Card */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Details</h3>
                                <Card>
                                    <CardContent className="p-0 divide-y">
                                        <div className="flex items-center justify-between p-4">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <User className="h-3.5 w-3.5" />
                                                User
                                            </span>
                                            <span className="text-sm font-medium">{inspectedLog.userEmail || 'System'}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Shield className="h-3.5 w-3.5" />
                                                Status
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {inspectedLog.status === 'success' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-rose-500" />
                                                )}
                                                <span className="text-sm font-medium capitalize">{inspectedLog.status}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Activity className="h-3.5 w-3.5" />
                                                Severity
                                            </span>
                                            {(() => {
                                                const config = getSeverityConfig(inspectedLog.severity)
                                                return (
                                                    <Badge variant="outline" className={`text-xs font-medium border ${config.color}`}>
                                                        {config.label}
                                                    </Badge>
                                                )
                                            })()}
                                        </div>
                                        <div className="flex items-center justify-between p-4">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5" />
                                                Resource
                                            </span>
                                            <span className="text-sm font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{formatResource(inspectedLog.resource).short}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5" />
                                                Time
                                            </span>
                                            <span className="text-sm font-medium">{formatTimestamp(inspectedLog.timestamp).relative}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Changes */}
                            {(inspectedLog.oldValue !== null || inspectedLog.newValue !== null) && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <ArrowUpDown className="h-3.5 w-3.5" />
                                        Changes
                                    </h3>
                                    <Card>
                                        <CardContent className="p-0 divide-y">
                                            {(() => {
                                                const fieldChanges = getFieldChanges(inspectedLog.oldValue, inspectedLog.newValue)
                                                
                                                if (fieldChanges.length === 0) {
                                                    const isDeletion = inspectedLog.oldValue && !inspectedLog.newValue
                                                    const isCreation = !inspectedLog.oldValue && inspectedLog.newValue
                                                    
                                                    if (isDeletion && inspectedLog.oldValue) {
                                                        const oldObj = JSON.parse(inspectedLog.oldValue)
                                                        return Object.entries(oldObj)
                                                            .filter(([key]) => shouldShowField(key))
                                                            .map(([key, value]) => (
                                                                <div key={key} className="flex items-center justify-between p-4 text-sm">
                                                                    <span className="text-muted-foreground">{formatFieldName(key)}</span>
                                                                    <span className="font-mono text-sm bg-rose-500/8 text-rose-600 px-2 py-0.5 rounded line-through decoration-rose-400/50">{formatFieldValue(key, value)}</span>
                                                                </div>
                                                            ))
                                                    }
                                                    
                                                    if (isCreation && inspectedLog.newValue) {
                                                        const newObj = JSON.parse(inspectedLog.newValue)
                                                        return Object.entries(newObj)
                                                            .filter(([key]) => shouldShowField(key))
                                                            .map(([key, value]) => (
                                                                <div key={key} className="flex items-center justify-between p-4 text-sm">
                                                                    <span className="text-muted-foreground">{formatFieldName(key)}</span>
                                                                    <span className="font-mono text-sm bg-emerald-500/8 text-emerald-600 px-2 py-0.5 rounded">{formatFieldValue(key, value)}</span>
                                                                </div>
                                                            ))
                                                    }
                                                    
                                                    return <div className="p-5 text-sm text-muted-foreground text-center">No field-level changes detected</div>
                                                }
                                                
                                                return fieldChanges.map((change, i) => (
                                                    <div key={i} className="p-4 space-y-2.5">
                                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{formatFieldName(change.field)}</span>
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div className="px-3 py-2 rounded-lg bg-rose-500/8 border border-rose-500/15 font-mono text-rose-600 break-words">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500/70 block mb-1">Before</span>
                                                                {formatFieldValue(change.field, change.oldValue)}
                                                            </div>
                                                            <div className="px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 font-mono text-emerald-600 break-words">
                                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70 block mb-1">After</span>
                                                                {formatFieldValue(change.field, change.newValue)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            })()}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Metadata */}
                            {Object.keys(inspectedLog.metadata).length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5" />
                                        Metadata
                                    </h3>
                                    <Card>
                                        <CardContent className="p-0 divide-y">
                                            {formatMetadata(inspectedLog.metadata).map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 text-sm">
                                                    <span className="text-muted-foreground">{item.label}</span>
                                                    <span className="font-mono text-sm bg-muted/50 px-2 py-0.5 rounded">{item.value}</span>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t bg-muted/20">
                            <Button onClick={closeDrawer} variant="outline" className="w-full">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
