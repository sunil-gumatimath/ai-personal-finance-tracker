import { useState, useEffect, useRef, useMemo } from 'react'
import {
    ScrollText,
    Activity,
    XCircle,
    CheckCircle2,
    RefreshCw,
    Search,
    Download,
    User,
    Eye,
    X,
    FileText,
    FileEdit,
    Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'



interface LogEntry {
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
    // ----------------------------------------------------
    // STATE DECLARATIONS
    // ----------------------------------------------------
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [stats, setStats] = useState({
        total: 0,
        created: 0,
        edited: 0,
        deleted: 0
    })
    const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
    
    // Filter State
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
    const [selectedAction, setSelectedAction] = useState<string>('all')
    
    // Inspector State
    const [inspectedLog, setInspectedLog] = useState<LogEntry | null>(null)
    
    // WS Reference
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<number | null>(null)

    // ----------------------------------------------------
    // INITIAL DB LOGS FETCH
    // ----------------------------------------------------
    const fetchInitialData = async () => {
        try {
            // Fetch initial logs from database
            const logsData = await api.systemLogs.list()
            const fetchedLogs = logsData.logs || []
            setLogs(fetchedLogs)
            updateStats(fetchedLogs)
        } catch (err) {
            console.error('Failed to load initial workspace logs:', err)
        }
    }

    const updateStats = (currentLogs: LogEntry[]) => {
        const statsObj = currentLogs.reduce(
            (acc, curr) => {
                acc.total++
                if (curr.action === 'TRANSACTION_CREATED') acc.created++
                if (curr.action === 'TRANSACTION_EDITED') acc.edited++
                if (curr.action === 'TRANSACTION_DELETED') acc.deleted++
                return acc
            },
            { total: 0, created: 0, edited: 0, deleted: 0 }
        )
        setStats(statsObj)
    }

    // ----------------------------------------------------
    // WEBSOCKET BROADCAST SUBSCRIPTION
    // ----------------------------------------------------
    const connectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.close()
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        const wsHost = isDev ? 'localhost:3001' : window.location.host
        const wsUrl = `${protocol}//${wsHost}/api/ws-logs`
        console.log('🔌 Connecting WebSocket to:', wsUrl)
        setWsStatus('reconnecting')

        const socket = new WebSocket(wsUrl)
        wsRef.current = socket

        socket.onopen = () => {
            console.log('🔌 WebSocket connection established')
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

                // Notify User for high severities via Toast banners
                if (log.severity === 'critical') {
                    toast.error(`🚨 CRITICAL SYSTEM EVENT: ${log.action}`, {
                        description: `${log.resource} was affected. Inspect immediately.`,
                        duration: 8000
                    })
                } else if (log.severity === 'error') {
                    toast.error(`❌ System Error: ${log.action}`, {
                        description: log.resource,
                        duration: 6000
                    })
                } else if (log.severity === 'warning') {
                    toast.warning(`⚠️ Warning Alert: ${log.action}`, {
                        description: log.resource,
                        duration: 4000
                    })
                } else if (log.action === 'FILE_EDITED') {
                    toast.info(`📝 Sandbox Document Updated`, {
                        description: `"${log.resource}" was modified.`,
                        duration: 3000
                    })
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err)
            }
        }

        socket.onclose = () => {
            console.log('🔌 WebSocket connection closed, scheduling reconnect...')
            setWsStatus('reconnecting')
            reconnectTimeoutRef.current = window.setTimeout(() => {
                connectWebSocket()
            }, 3000)
        }

        socket.onerror = (error) => {
            console.error('🔌 WebSocket encounter error:', error)
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



    // ----------------------------------------------------
    // IN-Dashboard HIGH FIDELITY DIFF COMPUTATION
    // ----------------------------------------------------
    const computeLineDiff = (oldStr: string | null, newStr: string | null) => {
        const oldLines = oldStr ? oldStr.split('\n') : []
        const newLines = newStr ? newStr.split('\n') : []

        const result: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = []
        let i = 0, j = 0

        while (i < oldLines.length || j < newLines.length) {
            if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
                result.push({ type: 'unchanged', text: oldLines[i] })
                i++
                j++
            } else if (j < newLines.length && (i >= oldLines.length || !oldLines.slice(i).includes(newLines[j]))) {
                result.push({ type: 'added', text: newLines[j] })
                j++
            } else {
                result.push({ type: 'removed', text: oldLines[i] })
                i++
            }
        }
        return result
    }

    // ----------------------------------------------------
    // LOG REPORT EXPORTS (JSON & CSV)
    // ----------------------------------------------------
    const exportLogs = (format: 'json' | 'csv') => {
        let content = ''
        let filename = `audit-logs-${new Date().toISOString().slice(0, 10)}`
        
        if (format === 'json') {
            content = JSON.stringify(logs, null, 2)
            filename += '.json'
        } else {
            const headers = ['ID', 'Timestamp', 'Action', 'Resource', 'Severity', 'Status', 'User', 'OldValue', 'NewValue']
            const rows = logs.map(l => [
                l.id,
                l.timestamp,
                l.action,
                l.resource,
                l.severity,
                l.status,
                l.userEmail || 'system',
                (l.oldValue || '').replace(/"/g, '""'),
                (l.newValue || '').replace(/"/g, '""')
            ])
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

    // ----------------------------------------------------
    // MEMOIZED FILTERS & SORT
    // ----------------------------------------------------
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesSearch =
                log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.newValue || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (log.oldValue || '').toLowerCase().includes(searchQuery.toLowerCase());

            const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
            const matchesAction = selectedAction === 'all' || log.action === selectedAction;

            return matchesSearch && matchesSeverity && matchesAction;
        });
    }, [logs, searchQuery, selectedSeverity, selectedAction])

    const actionOptions = useMemo(() => {
        const set = new Set<string>()
        logs.forEach(l => set.add(l.action))
        return Array.from(set)
    }, [logs])



    return (
        <div className="container mx-auto p-6 space-y-6 max-w-[1600px] animate-fade-in">
            {/* ----------------------------------------------------
                TOP HEADER & WS STATUS PULSE
               ---------------------------------------------------- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                        <ScrollText className="h-8 w-8 text-primary" /> System Logs & Change Tracking
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Audit, analyze, and track physical codebase edits and database transaction pipelines in real time.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Live Heartbeat Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-background/50 backdrop-blur-md shadow-sm">
                        <span className="relative flex h-2 w-2">
                            {wsStatus === 'connected' && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            )}
                            <span
                                className={`relative inline-flex rounded-full h-2 w-2 ${
                                    wsStatus === 'connected'
                                        ? 'bg-emerald-500'
                                        : wsStatus === 'reconnecting'
                                        ? 'bg-amber-500 animate-pulse'
                                        : 'bg-rose-500'
                                }`}
                            ></span>
                        </span>
                        <span className="text-xs font-semibold capitalize tracking-wide">
                            {wsStatus === 'connected'
                                ? 'live streams active'
                                : wsStatus === 'reconnecting'
                                ? 'reconnecting...'
                                : 'disconnected'}
                        </span>
                    </div>

                    {/* Export Dropdown buttons */}
                    <Button variant="outline" size="sm" onClick={async () => {
                        await fetchInitialData();
                        toast.success('Sync Complete', {
                            description: 'System logs successfully fetched from database.',
                            duration: 3000
                        });
                    }} className="gap-1.5 h-9 rounded-lg">
                        <RefreshCw className="h-4 w-4" /> Refresh Logs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportLogs('json')} className="gap-1.5 h-9 rounded-lg">
                        <Download className="h-4 w-4" /> Export JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportLogs('csv')} className="gap-1.5 h-9 rounded-lg">
                        <FileText className="h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* ----------------------------------------------------
                TOP STATISTICS CARDS
               ---------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction Logs</CardTitle>
                        <ScrollText className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats.total}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Audit events recorded</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Creations</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-500">{stats.created}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Transactions added</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edits</CardTitle>
                        <FileEdit className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-blue-500">{stats.edited}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Transactions modified</p>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:border-border transition-all">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deletions</CardTitle>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-rose-500">{stats.deleted}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Transactions removed</p>
                    </CardContent>
                </Card>
            </div>

            {/* ----------------------------------------------------
                MAIN WORKSPACE PANEL (FULL WIDTH)
               ---------------------------------------------------- */}
            <div className="space-y-4">
                    
                    {/* Filters & Control bar */}
                    <div className="flex flex-col sm:flex-row gap-3 bg-card/30 border border-border/50 p-4 rounded-xl backdrop-blur-md">
                        {/* Search keyword input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by action, resource, email or newValue..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 border-border/50 bg-background/50 rounded-lg text-sm"
                            />
                        </div>

                        {/* Severity select list */}
                        <div className="flex gap-2">
                            <select
                                value={selectedSeverity}
                                onChange={(e) => setSelectedSeverity(e.target.value)}
                                className="h-9 border border-border/50 bg-background/50 text-foreground text-xs rounded-lg px-2.5 font-medium focus:outline-none cursor-pointer"
                            >
                                <option value="all">All Severities</option>
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="error">Error</option>
                                <option value="critical">Critical</option>
                            </select>

                            {/* Action select list */}
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="h-9 border border-border/50 bg-background/50 text-foreground text-xs rounded-lg px-2.5 font-medium focus:outline-none cursor-pointer max-w-[150px]"
                            >
                                <option value="all">All Actions</option>
                                {actionOptions.map(action => (
                                    <option key={action} value={action}>{action}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Timeline Log stream */}
                    <Card className="border-border/50 bg-card/30 backdrop-blur-md shadow-lg rounded-xl overflow-hidden">
                        <CardHeader className="border-b border-border/40 bg-accent/10 px-4 py-3 flex flex-row justify-between items-center">
                            <div>
                                <CardTitle className="text-sm font-extrabold flex items-center gap-1.5">
                                    <Activity className="h-4 w-4 text-primary" /> Live Audit Trail Stream
                                </CardTitle>
                                <CardDescription className="text-[11px] mt-0.5">
                                    Showing {filteredLogs.length} events matching query. Newer items slide into view.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="p-0 overflow-y-auto max-h-[500px]">
                            {filteredLogs.length > 0 ? (
                                <div className="divide-y divide-border/30">
                                    {filteredLogs.map((log) => {
                                        const date = new Date(log.timestamp)
                                        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                        
                                        // Colors mapping depending on severity
                                        const severityStyles = {
                                            info: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                                            warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                                            error: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                                            critical: 'bg-red-500/20 text-red-500 border-red-500/30 font-bold border-2'
                                        }
                                        
                                        const isInspected = inspectedLog?.id === log.id

                                        return (
                                            <div
                                                key={log.id}
                                                onClick={() => setInspectedLog(log)}
                                                className={`flex items-start justify-between p-4 cursor-pointer hover:bg-accent/30 transition duration-150 ${
                                                    isInspected ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                                                }`}
                                            >
                                                <div className="flex items-start gap-3 overflow-hidden">
                                                    {/* Badge */}
                                                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${severityStyles[log.severity]}`}>
                                                        {log.severity}
                                                    </span>

                                                    <div className="space-y-1 overflow-hidden">
                                                        <h4 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                                                            {log.action}
                                                            <span className="text-[10px] font-normal text-muted-foreground">
                                                                on "{log.resource}"
                                                            </span>
                                                        </h4>
                                                        
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                            <User className="h-3 w-3 shrink-0" />
                                                            {log.userEmail || 'system'}
                                                            <span className="text-zinc-600 font-light">•</span>
                                                            <span className="font-mono text-[10px] text-zinc-500">{timeStr}</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full hover:bg-background/80 self-center shrink-0"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-16 px-4 text-muted-foreground">
                                    <ScrollText className="h-12 w-12 mx-auto opacity-30 mb-2" />
                                    <h3 className="font-bold text-foreground">No Logs Recoded</h3>
                                    <p className="text-xs mt-1 max-w-[280px] mx-auto text-zinc-500">
                                        No logs were found matching your current filter settings. Try triggering a simulation or clear search.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
            </div>

            {/* ----------------------------------------------------
                SLIDING DRAWER COMPONENT FOR INSPECTING LOG DETAILS
               ---------------------------------------------------- */}
            {inspectedLog && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex justify-end animate-fade-in" onClick={() => setInspectedLog(null)}>
                    <div
                        className="w-full max-w-[700px] h-full bg-card border-l border-border/80 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-6">
                            {/* Drawer Header */}
                            <div className="flex justify-between items-start border-b border-border/40 pb-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                                        Log Record details
                                    </span>
                                    <h2 className="text-xl font-extrabold text-foreground mt-2">{inspectedLog.action}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        ID: <span className="font-mono text-zinc-500">{inspectedLog.id}</span>
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setInspectedLog(null)}
                                    className="h-8 w-8 rounded-full hover:bg-accent"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Detail Fields grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Resource</span>
                                    <div className="text-sm font-semibold">{inspectedLog.resource}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Timestamp</span>
                                    <div className="text-sm font-semibold">
                                        {new Date(inspectedLog.timestamp).toLocaleString()}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Severity Level</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-2 h-2 rounded-full ${
                                            inspectedLog.severity === 'info' ? 'bg-emerald-500' :
                                            inspectedLog.severity === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                                        }`} />
                                        <span className="text-sm font-semibold capitalize">{inspectedLog.severity}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Execution Status</span>
                                    <div className="flex items-center gap-1 text-sm font-semibold mt-0.5">
                                        {inspectedLog.status === 'success' ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        ) : (
                                            <XCircle className="h-4 w-4 text-rose-500" />
                                        )}
                                        <span className="capitalize">{inspectedLog.status}</span>
                                    </div>
                                </div>
                            </div>

                            {/* User details card */}
                            <div className="p-4 rounded-xl border border-border/50 bg-accent/5 space-y-2">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">Audited User Profile</span>
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                                        {inspectedLog.userEmail ? inspectedLog.userEmail[0] : 'S'}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-sm font-semibold truncate">{inspectedLog.userEmail || 'System / Daemon'}</div>
                                        <div className="text-[10px] text-zinc-500 truncate font-mono">UUID: {inspectedLog.userId || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* High fidelity Diff Viewer */}
                            {(inspectedLog.oldValue !== null || inspectedLog.newValue !== null) && (
                                <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">Unified Change Diff Inspector</span>
                                    <div className="border border-border/60 bg-zinc-950 text-zinc-150 rounded-xl overflow-hidden font-mono text-xs max-h-[300px] overflow-y-auto">
                                        {(() => {
                                            // Handle cases where the values are NOT diffable plain-text strings but objects:
                                            const isOldJson = inspectedLog.oldValue?.startsWith('{') || inspectedLog.oldValue?.startsWith('[')
                                            const isNewJson = inspectedLog.newValue?.startsWith('{') || inspectedLog.newValue?.startsWith('[')

                                            let oldFormatted = inspectedLog.oldValue || ''
                                            let newFormatted = inspectedLog.newValue || ''

                                            if (isOldJson) {
                                                try {
                                                    oldFormatted = JSON.stringify(JSON.parse(inspectedLog.oldValue!), null, 2)
                                                } catch {}
                                            }
                                            if (isNewJson) {
                                                try {
                                                    newFormatted = JSON.stringify(JSON.parse(inspectedLog.newValue!), null, 2)
                                                } catch {}
                                            }

                                            // If we only have oldValue, it means it's a deletion
                                            if (oldFormatted && !newFormatted) {
                                                return oldFormatted.split('\n').map((line, i) => (
                                                    <div key={i} className="flex bg-rose-950/40 text-rose-400 border-l-4 border-l-rose-500 px-3 py-0.5 leading-5 h-5">
                                                        <span className="w-5 text-rose-500 select-none">-</span>
                                                        <span className="flex-1 whitespace-pre">{line}</span>
                                                    </div>
                                                ))
                                            }

                                            // If we only have newValue, it means it's a creation
                                            if (!oldFormatted && newFormatted) {
                                                return newFormatted.split('\n').map((line, i) => (
                                                    <div key={i} className="flex bg-emerald-950/40 text-emerald-400 border-l-4 border-l-emerald-500 px-3 py-0.5 leading-5 h-5">
                                                        <span className="w-5 text-emerald-500 select-none">+</span>
                                                        <span className="flex-1 whitespace-pre">{line}</span>
                                                    </div>
                                                ))
                                            }

                                            // Otherwise compute line by line diff
                                            const diffLines = computeLineDiff(oldFormatted, newFormatted)
                                            return diffLines.map((line, i) => {
                                                if (line.type === 'added') {
                                                    return (
                                                        <div key={i} className="flex bg-emerald-950/40 text-emerald-400 border-l-4 border-l-emerald-500 px-3 py-0.5 leading-5 h-5">
                                                            <span className="w-5 text-emerald-500 select-none">+</span>
                                                            <span className="flex-1 whitespace-pre">{line.text}</span>
                                                        </div>
                                                    )
                                                }
                                                if (line.type === 'removed') {
                                                    return (
                                                        <div key={i} className="flex bg-rose-950/40 text-rose-400 border-l-4 border-l-rose-500 px-3 py-0.5 leading-5 h-5">
                                                            <span className="w-5 text-rose-500 select-none">-</span>
                                                            <span className="flex-1 whitespace-pre">{line.text}</span>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <div key={i} className="flex text-zinc-500 px-3 py-0.5 leading-5 h-5 opacity-70">
                                                        <span className="w-5 select-none"> </span>
                                                        <span className="flex-1 whitespace-pre">{line.text}</span>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Metadata Inspector (if any exists) */}
                            {Object.keys(inspectedLog.metadata).length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">Context metadata payload</span>
                                    <pre className="border border-border/60 bg-zinc-950 text-zinc-400 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[220px]">
                                        {JSON.stringify(inspectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border/40 pt-4 mt-6">
                            <Button
                                onClick={() => setInspectedLog(null)}
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/80 font-bold rounded-lg h-10"
                            >
                                Done Inspecting
                            </Button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    )
}
