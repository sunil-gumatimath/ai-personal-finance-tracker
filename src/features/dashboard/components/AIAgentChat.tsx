import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, BotMessageSquare, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { api } from "@/lib/api-client";
import { QUERY_EXAMPLES } from "@/lib/ai-query-examples";
import Markdown from "react-markdown";

interface Message {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	/** Marks failed replies so they can be styled and excluded from history. */
	isError?: boolean;
}

const CHAT_STORAGE_KEY = "financetrack_ai_chat";
const CHAT_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

// Simple per-widget cooldown to prevent rapid API calls (the server also
// rate-limits, but the UI should give feedback instead of silently dropping).
const API_COOLDOWN_MS = 2000;

// Max height of the auto-growing input before it scrolls internally.
const INPUT_MAX_HEIGHT_PX = 96;

export function AIAgentChat() {
	const { user } = useAuth();
	const { preferences } = usePreferences();
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [cooldownUntil, setCooldownUntil] = useState(0);
	const [cooldownHintVisible, setCooldownHintVisible] = useState(false);
	const lastApiCallRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Load messages from localStorage on mount
	useEffect(() => {
		if (!user) return;

		try {
			const stored = localStorage.getItem(`${CHAT_STORAGE_KEY}_${user.id}`);
			if (stored) {
				const { messages: storedMessages, timestamp } = JSON.parse(stored);
				const isExpired = Date.now() - timestamp > CHAT_EXPIRY_MS;

				if (!isExpired && storedMessages.length > 0) {
					setMessages(storedMessages);
					return;
				}
			}
		} catch (e) {
			console.warn("Failed to load chat history:", e);
		}

		// Default welcome message
		setMessages([
			{
				role: "assistant",
				content:
					"Hi! I'm your Financial AI Assistant. Ask me anything about your spending, budgets, or savings goals.",
				timestamp: Date.now(),
			},
		]);
	}, [user]);

	// Save messages to localStorage
	useEffect(() => {
		if (!user || messages.length === 0) return;

		try {
			localStorage.setItem(
				`${CHAT_STORAGE_KEY}_${user.id}`,
				JSON.stringify({
					messages,
					timestamp: Date.now(),
				}),
			);
		} catch (e) {
			console.warn("Failed to save chat history:", e);
		}
	}, [messages, user]);

	// Clear the cooldown flag once it expires so the button re-enables and
	// the inline hint disappears.
	useEffect(() => {
		if (cooldownUntil <= Date.now()) return;
		const timer = setTimeout(() => {
			setCooldownUntil(0);
			setCooldownHintVisible(false);
		}, cooldownUntil - Date.now());
		return () => clearTimeout(timer);
	}, [cooldownUntil]);

	// Listen for open-ai-chat event
	useEffect(() => {
		const handleOpenChat = () => setIsOpen(true);
		window.addEventListener("open-ai-chat", handleOpenChat);
		return () => window.removeEventListener("open-ai-chat", handleOpenChat);
	}, []);

	// Auto-scroll ONLY when the user is already near the bottom — never yank
	// the viewport while they're reading older messages.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (distanceFromBottom < 80) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, isLoading]);

	// Keep the textarea auto-grown to its content (capped) as the user types.
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
	}, [input, isOpen]);

	const isCoolingDown = Date.now() < cooldownUntil || Date.now() - lastApiCallRef.current < API_COOLDOWN_MS;

	const handleSend = useCallback(async () => {
		if (!input.trim() || isLoading || !user) return;

		// Per-widget cooldown: give visible feedback instead of silently dropping.
		const now = Date.now();
		if (now < cooldownUntil || now - lastApiCallRef.current < API_COOLDOWN_MS) {
			setCooldownUntil(now + API_COOLDOWN_MS);
			setCooldownHintVisible(true);
			return;
		}

		const userMessage = input.trim();
		setInput("");

		const newUserMessage: Message = {
			role: "user",
			content: userMessage,
			timestamp: Date.now(),
		};
		setMessages((prev) => [...prev, newUserMessage]);

		setIsLoading(true);
		setCooldownHintVisible(false);
		lastApiCallRef.current = Date.now();
		setCooldownUntil(Date.now() + API_COOLDOWN_MS);

		// Format the last 6 messages as history to provide context for follow-up
		// questions. Failed replies are excluded: new ones carry an isError flag,
		// legacy persisted ones start with "Error:".
		const history = messages
			.filter((m) => !(m.isError || m.content.startsWith("Error:")))
			.slice(-6)
			.map((m) => ({
				role: m.role,
				content: m.content,
			}));

		try {
			const { response } = await api.ai.chat(
				userMessage,
				{
					aiProvider: preferences.aiProvider,
					kilocodeModel: preferences.kilocodeModel,
				},
				history,
			);

			if (response) {
				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: response,
						timestamp: Date.now(),
					},
				]);
			} else {
				throw new Error("No response received. Please check your API key.");
			}
		} catch (error: unknown) {
			console.error("Chat error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: "Something went wrong. Please try again.";

			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: errorMessage,
					isError: true,
					timestamp: Date.now(),
				},
			]);
		} finally {
			setIsLoading(false);
		}
	}, [input, isLoading, user, preferences, cooldownUntil, messages]);

	const clearHistory = useCallback(() => {
		if (!user) return;
		localStorage.removeItem(`${CHAT_STORAGE_KEY}_${user.id}`);
		setMessages([
			{
				role: "assistant",
				content: "Chat cleared. How can I help you today?",
				timestamp: Date.now(),
			},
		]);
	}, [user]);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Enter sends, Shift+Enter inserts a newline (IME composition safe).
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	};

	if (!isOpen) {
		return (
			<div className="fixed bottom-5 right-5 z-50">
				<Button
					onClick={() => setIsOpen(true)}
					size="icon"
					aria-label="Open AI assistant"
					aria-expanded={false}
					className="h-12 w-12 rounded-full shadow-lg active:scale-[0.98]"
				>
					<BotMessageSquare className="h-5 w-5" />
				</Button>
			</div>
		);
	}

	return (
		<div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[380px]">
			<Card className="flex h-[min(520px,calc(100dvh-5rem))] w-full flex-col shadow-xl border-border/50">
				{/* Header - Compact */}
				<CardHeader className="flex flex-row items-center justify-between gap-2 px-3 py-2 border-b shrink-0">
					<div className="flex items-center gap-2 min-w-0">
						<Avatar className="h-6 w-6 shrink-0">
							<AvatarFallback className="bg-primary text-primary-foreground">
								<BotMessageSquare className="h-3 w-3" />
							</AvatarFallback>
						</Avatar>
						<div className="flex items-center gap-2 min-w-0">
							<p className="text-sm font-medium truncate">AI Assistant</p>
							<span
								className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
								aria-hidden="true"
							/>
						</div>
					</div>
					<div className="flex items-center shrink-0">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs text-muted-foreground active:scale-[0.98]"
								>
									Clear
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
									<AlertDialogDescription>
										This removes the current conversation. Conversations are
										stored locally on this device only.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={clearHistory}>
										Clear
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 active:scale-[0.98]"
							aria-label="Close chat"
							onClick={() => setIsOpen(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</CardHeader>

				{/* Messages - Takes remaining space */}
				<CardContent className="flex-1 overflow-hidden p-0 min-h-0">
					<div
						className="h-full overflow-y-auto px-3 py-2 space-y-2"
						ref={scrollRef}
						aria-live="polite"
						aria-label="AI assistant conversation"
					>
						{messages.map((m, i) => (
							<div
								key={i}
								className={cn(
									"flex gap-2 max-w-[88%]",
									m.role === "user" ? "ml-auto flex-row-reverse" : "",
								)}
							>
								<Avatar className="h-6 w-6 shrink-0">
									<AvatarFallback
										className={cn(
											"text-xs",
											m.role === "user"
												? "bg-secondary"
												: "bg-primary text-primary-foreground",
										)}
									>
										{m.role === "user" ? (
											<User className="h-3 w-3" />
										) : (
											<BotMessageSquare className="h-3 w-3" />
										)}
									</AvatarFallback>
								</Avatar>
								<div
									className={cn(
										"rounded-lg px-2.5 py-1.5 text-sm min-w-0",
										m.role === "user"
											? "bg-primary text-primary-foreground"
											: m.isError
												? "bg-destructive/10 text-destructive"
												: "bg-muted prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:font-semibold prose-table:block prose-table:overflow-x-auto prose-table:text-xs prose-th:px-2 prose-th:py-0.5 prose-td:px-2 prose-td:py-0.5 prose-table:border-collapse break-words",
									)}
								>
									{m.role === "assistant" && !m.isError ? (
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
									<AvatarFallback className="bg-primary text-primary-foreground">
										<BotMessageSquare className="h-3 w-3" />
									</AvatarFallback>
								</Avatar>
								{/* Single typing device: three staggered dots */}
								<div
									className="bg-muted rounded-lg px-3 py-2.5 shadow-sm flex items-center gap-1"
									aria-label="Assistant is typing"
									role="status"
								>
									{[0, 1, 2].map((i) => (
										<span
											key={i}
											className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
											style={{ animationDelay: `${i * 120}ms` }}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				</CardContent>

				{/* Input Section */}
				<div className="px-3 py-2 border-t shrink-0">
					{/* Query Examples - Above Input */}
					{messages.length <= 1 && !isLoading && (
						<div className="pb-2">
							<div className="flex items-center gap-2 mb-2">
								<Sparkles className="h-3 w-3 text-muted-foreground" />
								<span className="text-xs text-muted-foreground font-medium">
									Try asking:
								</span>
							</div>
							<div className="flex flex-wrap gap-1">
								{QUERY_EXAMPLES.slice(0, 3).map((example, index) => (
									<Button
										key={index}
										variant="outline"
										size="sm"
										className="h-6 max-w-[220px] px-2 text-xs active:scale-[0.98]"
										onClick={() => setInput(example)}
									>
										<span className="truncate">{example}</span>
									</Button>
								))}
							</div>
						</div>
					)}

					<form
						className="flex w-full items-end gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}
					>
						<label className="sr-only" htmlFor="ai-chat-input">
							Message the AI assistant
						</label>
						<Textarea
							id="ai-chat-input"
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleInputKeyDown}
							placeholder="Ask about your finances… (Shift+Enter for a new line)"
							rows={1}
							className="min-h-[36px] resize-none py-1.5 text-sm"
						/>
						<Button
							type="submit"
							size="icon"
							aria-label="Send message"
							disabled={
								isLoading || !input.trim() || Date.now() < cooldownUntil
							}
							title={
								Date.now() < cooldownUntil
									? "Please wait a moment between messages"
									: "Send"
							}
							className="h-9 w-9 shrink-0 active:scale-[0.98]"
						>
							<Send className="h-3.5 w-3.5" />
						</Button>
					</form>
					{/* Inline cooldown feedback — the disabled button alone isn't enough */}
					{cooldownHintVisible && isCoolingDown && (
						<p role="status" className="pt-1 text-[10px] text-muted-foreground">
							Easy there — please wait a moment between messages.
						</p>
					)}
				</div>
			</Card>
		</div>
	);
}
