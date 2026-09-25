import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, BotMessageSquare, X, Sparkles, Square, Settings } from "lucide-react";
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
import remarkGfm from "remark-gfm";

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
	// Screen-reader announcement: only updated on completion/error so the
	// per-token stream isn't read aloud (M5).
	const [announcement, setAnnouncement] = useState("");
	// Re-render clock for the cooldown countdown. The previous implementation
	// called Date.now() during render, which is not reactive — the Send button
	// could stay disabled for an extra frame (or indefinitely, if nothing else
	// changed state) after the cooldown had actually elapsed.
	const [nowTick, setNowTick] = useState(() => Date.now());
	useEffect(() => {
		if (cooldownUntil <= Date.now()) return;
		const id = window.setInterval(
			() => setNowTick(Date.now()),
			Math.max(250, cooldownUntil - Date.now()),
		);
		return () => window.clearInterval(id);
	}, [cooldownUntil]);
	const lastApiCallRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	// Remembers the last question so the error bubble can offer a Retry (M8).
	const lastUserMessageRef = useRef("");
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

	// Save messages to localStorage. Debounced so token-by-token streaming
	// updates don't serialize the whole transcript on every delta.
	useEffect(() => {
		if (!user || messages.length === 0) return;

		// Cap persisted turns so a very long conversation can't blow the
		// ~5MB localStorage quota (M7). Keeps the most recent 50 messages.
		const MAX_PERSISTED_MESSAGES = 50;
		const toPersist =
			messages.length > MAX_PERSISTED_MESSAGES
				? messages.slice(-MAX_PERSISTED_MESSAGES)
				: messages;

		const timer = setTimeout(() => {
			try {
				localStorage.setItem(
					`${CHAT_STORAGE_KEY}_${user.id}`,
					JSON.stringify({
						messages: toPersist,
						timestamp: Date.now(),
					}),
				);
			} catch (e) {
				console.warn("Failed to save chat history:", e);
			}
		}, 400);
		return () => clearTimeout(timer);
	}, [messages, user]);

	// Clear the cooldown flag once it expires so the button re-enables and
	// the inline hint disappears. This is also the ONLY thing that made the
	// button recover: the disabled/title props read `Date.now()` during render,
	// which is not reactive. Ticking `cooldownUntil` to 0 drives the re-render
	// deterministically instead of relying on an unrelated state change.
	useEffect(() => {
		if (cooldownUntil <= Date.now()) return;
		const timer = setTimeout(() => {
			setCooldownUntil(0);
			setCooldownHintVisible(false);
		}, cooldownUntil - Date.now());
		return () => clearTimeout(timer);
	}, [cooldownUntil]);

	/** Seconds left on the UI cooldown, for the inline hint. */
	const cooldownSeconds = Math.max(
		0,
		Math.ceil(
			(Math.max(cooldownUntil, lastApiCallRef.current + API_COOLDOWN_MS) -
				nowTick) /
				1000,
		),
	);
	const isCoolingDown = cooldownSeconds > 0;

	// Listen for open-ai-chat event (with optional initialPrompt)
	useEffect(() => {
		const handleOpenChat = (e: Event) => {
			const custom = e as CustomEvent<{ initialPrompt?: string }>;
			setIsOpen(true);
			if (custom.detail?.initialPrompt) {
				setInput(custom.detail.initialPrompt);
			}
		};
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

	// A key must exist before the assistant can answer. Previously the widget
	// showed an unconditional green "online" dot and only failed on first send.
	const aiConfigured = preferences.kilocodeApiKeyConfigured;

	// Abort controller for the in-flight chat request; aborted when the
	// component unmounts (or is closed) so a slow generation doesn't outlive
	// the page or keep writing to localStorage in the background.
	const abortRef = useRef<AbortController | null>(null);
	useEffect(() => () => abortRef.current?.abort(), []);

	// Aborting a stream mid-flight must also clear the streaming-ts ref, or a
	// late delta would try to mutate a message that no longer exists.
	const stopStreaming = useCallback(() => {
		abortRef.current?.abort();
		streamingTsRef.current = null;
	}, []);

	// Closing the widget keeps the component mounted (early return below),
	// so the unmount cleanup never fires — abort explicitly on close.
	useEffect(() => {
		if (!isOpen) stopStreaming();
	}, [isOpen, stopStreaming]);

	// Timestamp of the assistant message currently being streamed into.
	const streamingTsRef = useRef<number | null>(null);
	// Accumulates the streamed text so it can be announced to screen readers as
	// a single completed reply (M5), not per-token.
	const streamingContentRef = useRef("");

	// Escape closes the panel, and focus moves into it on open so keyboard
	// users aren't left behind on the launcher button.
	const panelRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!isOpen) return;
		panelRef.current?.focus();
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setIsOpen(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isOpen]);

	// Append one streamed delta, lazily creating the assistant bubble on the
	// first token so the typing dots stay visible until generation starts.
	const appendDelta = useCallback((delta: string) => {
		streamingContentRef.current += delta;
		if (streamingTsRef.current === null) {
			const ts = Date.now();
			streamingTsRef.current = ts;
			setMessages((prev) => [
				...prev,
				{ role: "assistant", content: delta, timestamp: ts },
			]);
		} else {
			const ts = streamingTsRef.current;
			setMessages((prev) =>
				prev.map((m) =>
					m.timestamp === ts ? { ...m, content: m.content + delta } : m,
				),
			);
		}
	}, []);

	const handleSend = useCallback(async (textToSend?: string) => {
		const userMessage = (textToSend ?? input).trim();
		if (!userMessage || isLoading || !user) return;

		// Per-widget cooldown: give visible feedback instead of silently dropping.
		const now = Date.now();
		if (now < cooldownUntil || now - lastApiCallRef.current < API_COOLDOWN_MS) {
			setCooldownUntil(now + API_COOLDOWN_MS);
			setCooldownHintVisible(true);
			return;
		}

		lastUserMessageRef.current = userMessage;
		if (!textToSend) {
			setInput("");
		}

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
		streamingContentRef.current = "";

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
			const controller = new AbortController();
			abortRef.current = controller;
			streamingTsRef.current = null;

			await api.ai.chatStream(
				userMessage,
				{
					aiProvider: preferences.aiProvider,
					kilocodeModel: preferences.kilocodeModel,
				},
				history,
				appendDelta,
				controller.signal,
			);

			if (streamingTsRef.current === null) {
				// Stream ended without a single delta (or an empty reply).
				throw new Error("No response received. Please check your API key.");
			}
			// Announce the completed reply as a single message (M5), not per-token.
			setAnnouncement(streamingContentRef.current.trim() || "Assistant finished replying.");
		} catch (error: unknown) {
			// Aborted (page unmounted/closed): nothing to surface.
			if (error instanceof DOMException && error.name === "AbortError") return;

			console.error("Chat error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: "Something went wrong. Please try again.";

			// Always surface failures as their own error bubble (which is
			// excluded from future history). Any partially-streamed text stays
			// visible above it as regular context.
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: errorMessage,
					isError: true,
					timestamp: Date.now(),
				},
			]);
			// Announce the failure to screen readers (M5).
			setAnnouncement(errorMessage);
		} finally {
			streamingTsRef.current = null;
			abortRef.current = null;
			setIsLoading(false);
		}
	}, [input, isLoading, user, preferences, cooldownUntil, messages, appendDelta]);

	const clearHistory = useCallback(() => {
		if (!user) return;
		stopStreaming();
		streamingTsRef.current = null;
		streamingContentRef.current = "";
		localStorage.removeItem(`${CHAT_STORAGE_KEY}_${user.id}`);
		setMessages([
			{
				role: "assistant",
				content: "Chat cleared. How can I help you today?",
				timestamp: Date.now(),
			},
		]);
	}, [user, stopStreaming]);

	// Re-send the last question that produced an error bubble (M8). Replaces
	// the input rather than replaying history so the existing user bubble
	// isn't duplicated.
	const handleRetry = useCallback(() => {
		const question = lastUserMessageRef.current;
		if (question) {
			handleSend(question);
		}
	}, [handleSend]);

	// Abort an in-flight generation so the user gets a Stop control (H2/M8).
	const handleStop = useCallback(() => {
		stopStreaming();
		setIsLoading(false);
	}, [stopStreaming]);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Enter sends, Shift+Enter inserts a newline (IME composition safe).
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
			e.preventDefault();
			handleSend();
		}
	};

	if (!isOpen) {
		return (
			<div
				className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50"
			>
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
		<div
			// Safe-area insets: the FAB/panel is fixed-positioned, so without these
			// it sat under the iOS home indicator while the rest of the app
			// (header, main layout) already accounted for them.
			className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 w-[calc(100vw-2.5rem)] max-w-[380px]"
			role="dialog"
			aria-label="AI financial assistant"
		>
			<Card
				ref={panelRef}
				tabIndex={-1}
				className="flex h-[min(520px,calc(100dvh-5rem))] w-full flex-col shadow-xl border-border/50 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-200 ease-out origin-bottom-right"
			>
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
							{/* Honest status: green only when a key is configured and
							    something can actually answer. */}
							<span
								className={cn(
									"h-1.5 w-1.5 shrink-0 rounded-full",
									aiConfigured
										? "bg-[var(--success)]"
										: "bg-[var(--warning)]",
								)}
								aria-hidden="true"
							/>
						</div>
						{!aiConfigured && (
							<p className="text-[10px] leading-tight text-[var(--warning)]">
								No API key
							</p>
						)}
					</div>
					<div className="flex items-center shrink-0">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs text-muted-foreground active:scale-[0.98]"
								disabled={isLoading}
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
						aria-label="AI assistant conversation"
					>
						{messages.map((m, i) => (
							<div
								key={`${m.timestamp}-${m.role}-${i}`}
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
												// Tailwind Typography hardcodes its own --tw-prose-* palette, so
												// `prose`/`dark:prose-invert` made AI replies ignore both the
												// light/dark theme and all 7 accents. `prose-neutral` +
												// explicit token colours keeps them on-theme.
												: "bg-muted prose prose-sm prose-neutral max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary prose-li:text-muted-foreground prose-th:text-foreground prose-td:text-muted-foreground prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:font-semibold prose-table:block prose-table:overflow-x-auto prose-table:text-xs prose-th:px-2 prose-th:py-0.5 prose-td:px-2 prose-td:py-0.5 prose-table:border-collapse break-words",
									)}
								>
									{m.role === "assistant" && !m.isError ? (
										<Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
									) : (
										<div className="whitespace-pre-wrap">{m.content}</div>
									)}
									{m.isError && m.role === "assistant" && (
										<Button
											onClick={handleRetry}
											variant="link"
											size="sm"
											className="mt-1 h-auto px-0 text-xs text-muted-foreground"
											>
												Retry
											</Button>
										)}
								</div>
							</div>
						))}
						{/* Typing dots only until the first streamed token lands —
						    once the assistant bubble exists, the text itself is the
						    progress indicator. */}
						{isLoading &&
							messages[messages.length - 1]?.role !== "assistant" && (
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

				{/* Screen-reader announcement node: updated only on completion/error
				    so the per-token stream isn't read aloud (M5). */}
				<div
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
				>
					{announcement}
				</div>

				{/* Input Section */}
				<div className="px-3 py-2 border-t shrink-0">
					{/* No key configured is a setup problem, not a request failure —
					    send the user straight to the fix instead of a dead end. */}
					{!aiConfigured && (
						<div className="mb-2 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2.5 py-2">
							<Settings
								className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]"
								aria-hidden="true"
							/>
							<p className="text-[11px] leading-snug text-foreground">
								Add a Kilo Gateway API key to use the assistant.{" "}
								<a
									href="/settings"
									className="font-medium underline underline-offset-2"
								>
									Open Settings
								</a>
							</p>
						</div>
					)}
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
								{/* Show the first 3 but say how many more exist — a silent
								    slice(0, 3) made the list look exhaustive. */}
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
								{QUERY_EXAMPLES.length > 3 && (
									<span className="self-center text-[10px] text-muted-foreground">
										+{QUERY_EXAMPLES.length - 3} more
									</span>
								)}
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
						{isLoading ? (
							<Button
								type="button"
								size="icon"
								aria-label="Stop generation"
								onClick={handleStop}
								className="h-9 w-9 shrink-0 active:scale-[0.98]"
								>
									<Square className="h-3.5 w-3.5" />
								</Button>
							) : (
							<Button
							type="submit"
							size="icon"
							aria-label="Send message"
							disabled={!aiConfigured || isCoolingDown || !input.trim()}
							title={
								!aiConfigured
									? "Add an API key in Settings first"
								: isCoolingDown
									? `Please wait ${cooldownSeconds}s between messages`
								: "Send"
							}
							className="h-9 w-9 shrink-0 active:scale-[0.98]"
						>
							<Send className="h-3.5 w-3.5" />
						</Button>
						)}
					</form>
					{/* Inline cooldown feedback — the disabled button alone isn't enough */}
					{cooldownHintVisible && isCoolingDown && (
						<p role="status" className="pt-1 text-[10px] text-muted-foreground">
							Easy there - wait {cooldownSeconds}s between messages.
						</p>
					)}
				</div>
			</Card>
		</div>
	);
}
