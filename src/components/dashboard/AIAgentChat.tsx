import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, User, BotMessageSquare, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { generateFinancialAdvice } from '@/lib/gemini'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PREFERENCES_KEY } from '@/types/preferences'
import Markdown from 'react-markdown'

interface Message {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
}

const CHAT_STORAGE_KEY = 'financetrack_ai_chat'
const CHAT_EXPIRY_MS = 1000 * 60 * 60 * 24 // 24 hours

// Simple debounce to prevent rapid API calls
let lastApiCall = 0
const API_COOLDOWN_MS = 2000

// Helper to get fresh API key directly from localStorage
const getFreshApiKey = (): string | undefined => {
    try {
        const stored = localStorage.getItem(PREFERENCES_KEY)
        if (stored) {
            const prefs = JSON.parse(stored)
            return prefs.geminiApiKey || undefined
        }
    } catch {
        // Ignore parse errors
    }
    return undefined
}

const getFreshCurrency = (): string => {
    try {
        const stored = localStorage.getItem(PREFERENCES_KEY)
        if (stored) {
            const prefs = JSON.parse(stored)
            return prefs.currency || 'INR'
        }
    } catch {
        // Ignore parse errors
    }
    return 'INR'
}

export function AIAgentChat() {
    const { user } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Load messages from localStorage on mount
    useEffect(() => {
        if (!user) return

        try {
            const stored = localStorage.getItem(`${CHAT_STORAGE_KEY}_${user.id}`)
            if (stored) {
                const { messages: storedMessages, timestamp } = JSON.parse(stored)
                const isExpired = Date.now() - timestamp > CHAT_EXPIRY_MS

                if (!isExpired && storedMessages.length > 0) {
                    // Filter out old API key error messages if key now exists
                    const apiKey = getFreshApiKey() || import.meta.env.VITE_GEMINI_API_KEY
                    const filteredMessages = apiKey
                        ? storedMessages.filter((m: Message) =>
                            !m.content.includes('Please add your Gemini API Key'))
                        : storedMessages

                    if (filteredMessages.length > 0) {
                        setMessages(filteredMessages)
                        return
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load chat history:', e)
        }

        // Default welcome message
        setMessages([{
            role: 'assistant',
            content: "Hi! I'm your Financial AI Assistant. Ask me anything about your spending, budgets, or savings goals.",
            timestamp: Date.now()
        }])
    }, [user])

    // Save messages to localStorage
    useEffect(() => {
        if (!user || messages.length === 0) return

        try {
            localStorage.setItem(`${CHAT_STORAGE_KEY}_${user.id}`, JSON.stringify({
                messages,
                timestamp: Date.now()
            }))
        } catch (e) {
            console.warn('Failed to save chat history:', e)
        }
    }, [messages, user])

    // Listen for open-ai-chat event
    useEffect(() => {
        const handleOpenChat = () => setIsOpen(true)
        window.addEventListener('open-ai-chat', handleOpenChat)
        return () => window.removeEventListener('open-ai-chat', handleOpenChat)
    }, [])

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading || !user) return

        // Rate limiting check
        const now = Date.now()
        if (now - lastApiCall < API_COOLDOWN_MS) {
            return
        }

        const userMessage = input.trim()
        setInput('')

        const newUserMessage: Message = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, newUserMessage])

        // Get fresh API key from localStorage to avoid stale state issues
        const apiKey = getFreshApiKey() || import.meta.env.VITE_GEMINI_API_KEY
        const currency = getFreshCurrency()

        if (!apiKey) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Please add your Gemini API Key in Settings > Preferences to use the AI Assistant.",
                timestamp: Date.now()
            }])
            return
        }

        setIsLoading(true)
        lastApiCall = Date.now()

        try {
            const { data: recentTransactions } = await supabase
                .from('transactions')
                .select('type, amount, date, description, category:categories(name)')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(20)

            const { data: accounts } = await supabase
                .from('accounts')
                .select('name, balance, type')
                .eq('user_id', user.id)

            const { data: budgets } = await supabase
                .from('budgets')
                .select('name, amount, spent, period, category:categories(name)')
                .eq('user_id', user.id)

            const context = `
You are a helpful, friendly financial advisor assistant. The user is asking about their personal finances.

**IMPORTANT: Currency Setting**
The user's preferred currency is: ${currency}
ALWAYS format all monetary values using ${currency} symbol and format. For example:
- INR: ₹1,00,000 (Indian format with lakhs)
- USD: $100,000
- EUR: €100,000
- GBP: £100,000

**User's Financial Data:**
- Accounts: ${JSON.stringify(accounts || [])}
- Recent Transactions (last 20): ${JSON.stringify(recentTransactions || [])}
- Budgets: ${JSON.stringify(budgets || [])}

**User's Question:** ${userMessage}

**Instructions:**
1. Be concise but helpful (keep responses under 150 words unless more detail is needed)
2. Use the actual data provided to give specific, personalized advice
3. ALWAYS format numbers in ${currency} - this is critical!
4. If asked about balance, calculate totals from the accounts data
5. Be encouraging and positive while being honest about financial health
6. Suggest actionable next steps when appropriate
            `

            const response = await generateFinancialAdvice(context, apiKey)

            if (response) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                }])
            } else {
                throw new Error('No response received. Please check your API key.')
            }
        } catch (error: unknown) {
            console.error('Chat error:', error)
            const errorMessage = error instanceof Error && error.message?.includes('API key')
                ? 'Invalid API key. Please check your Gemini API key in Settings.'
                : (error instanceof Error ? error.message : 'Something went wrong. Please try again.')

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${errorMessage}`,
                timestamp: Date.now()
            }])
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, user])

    const clearHistory = useCallback(() => {
        if (!user) return
        localStorage.removeItem(`${CHAT_STORAGE_KEY}_${user.id}`)
        setMessages([{
            role: 'assistant',
            content: "Chat cleared. How can I help you today?",
            timestamp: Date.now()
        }])
    }, [user])

    if (!isOpen) {
        return (
            <div className="fixed bottom-5 right-5 z-50">
                <Button
                    onClick={() => setIsOpen(true)}
                    size="icon"
                    className="h-12 w-12 rounded-full shadow-lg"
                >
                    <BotMessageSquare className="h-5 w-5" />
                </Button>
            </div>
        )
    }

    return (
        <div className="fixed bottom-5 right-5 z-50 w-[380px]">
            <Card className="flex flex-col h-[520px] shadow-xl border-border/50">
                {/* Header - Compact */}
                <CardHeader className="flex flex-row items-center justify-between px-3 py-2 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                <BotMessageSquare className="h-3 w-3" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">AI Assistant</p>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={clearHistory}
                        >
                            Clear
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                {/* Messages - Takes remaining space */}
                <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                    <div className="h-full overflow-y-auto px-3 py-2 space-y-2" ref={scrollRef}>
                        {messages.map((m, i) => (
                            <div key={i} className={cn(
                                "flex gap-2 max-w-[88%]",
                                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                            )}>
                                <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarFallback className={cn(
                                        "text-xs",
                                        m.role === 'user' ? "bg-secondary" : "bg-primary text-primary-foreground"
                                    )}>
                                        {m.role === 'user' ? <User className="h-3 w-3" /> : <BotMessageSquare className="h-3 w-3" />}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                    "rounded-lg px-2.5 py-1.5 text-sm",
                                    m.role === 'user'
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:font-semibold"
                                )}>
                                    {m.role === 'assistant' ? (
                                        <Markdown>{m.content}</Markdown>
                                    ) : (
                                        m.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-2 max-w-[88%]">
                                <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        <BotMessageSquare className="h-3 w-3" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-lg px-2.5 py-1.5 text-sm flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-muted-foreground">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>

                {/* Input - Compact */}
                <CardFooter className="px-3 py-2 border-t shrink-0">
                    <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about your finances..."
                            className="h-8 text-sm"
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-8 w-8 shrink-0">
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    )
}
