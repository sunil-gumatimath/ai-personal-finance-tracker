import { getAuthedUserId } from "../../services/auth.js";
import { query, queryOne } from "../../services/db.js";
import {
  generateWithProvider,
  getProviderLabel,
  MissingApiKeyError,
  type AIProviderPreferences,
} from "../../services/ai-provider.js";
import { decryptPreferences } from "../../utils/crypto.js";
import type { ApiRequest, ApiResponse } from "../../utils/types.js";
import { ensureSystemLogsTable } from "../../services/logger.js";
import { AIQueryProcessor } from "./query-processor.js";

type IntentType =
  | "comparison"
  | "forecast"
  | "income"
  | "debt"
  | "balance"
  | "spending"
  | "budget"
  | "goals"
  | "general";

interface ProcessedIntent {
  type: IntentType;
  timeframe?: string;
  categories?: string[];
  operation?: string;
  comparison?: string;
  amount?: number;
}

interface ProcessedQuery {
  intent: ProcessedIntent;
  originalQuery: string;
  confidence: number;
  suggestedResponse: string;
}

interface AccountRow {
  name: string;
  balance: number | string;
  type: string;
}

interface TransactionRow {
  type: "income" | "expense";
  amount: number | string;
  date: string;
  description: string | null;
  category_name: string | null;
}

interface BudgetRow {
  amount: number | string;
  period: string;
  category_name: string | null;
}

interface GoalRow {
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string | null;
}

interface DebtRow {
  name: string;
  current_balance: number | string;
  interest_rate: number | string;
  minimum_payment: number | string;
}

interface SystemLogEntryRow {
  timestamp: string;
  action: string;
  resource: string;
  severity: string;
  status: string;
}

interface UserProfileRow {
  full_name: string | null;
  currency: string | null;
  preferences: Record<string, unknown> | null;
  created_at: string | null;
}

interface FinancialData {
  accounts: AccountRow[];
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  goals: GoalRow[];
  debts: DebtRow[];
  logs: SystemLogEntryRow[];
  profile: UserProfileRow | null;
}

interface AIQueryProcessorContract {
  processQuery: (query: string) => ProcessedQuery;
}

const queryProcessor = AIQueryProcessor as AIQueryProcessorContract;

// Helper function to fetch relevant financial data based on query intent
async function fetchFinancialData(userId: string, intent: ProcessedIntent, currency: string = "INR") {
  try {
    const timeframeCondition = getTimeframeCondition(intent.timeframe);

    const data: FinancialData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      debts: [],
      logs: [],
      profile: null,
    };

    // Always get basic account info
    const { rows: accounts } = await query<AccountRow>(
      "SELECT name, balance, type FROM accounts WHERE user_id = $1",
      [userId],
    );
    data.accounts = accounts || [];

    // Fetch transactions based on intent (always include recent transactions to keep 360 context)
    const categoryCondition = intent.categories?.length
      ? "AND c.name = ANY($2)"
      : "";
    const transactionQuery = `
      SELECT t.type, t.amount, t.date, t.description, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1 ${timeframeCondition} ${categoryCondition}
      ORDER BY t.date DESC
      LIMIT 30
    `;

    const queryParams: unknown[] = [userId];
    if (intent.categories?.length) {
      queryParams.push(intent.categories);
    }

    const { rows: transactions } = await query<TransactionRow>(
      transactionQuery,
      queryParams,
    );
    data.transactions = transactions || [];

    // Always get budgets for full context
    const { rows: budgets } = await query<BudgetRow>(
      `SELECT b.amount, b.period, c.name as category_name
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = $1`,
      [userId],
    );
    data.budgets = budgets || [];

    // Always get goals
    const { rows: goals } = await query<GoalRow>(
      "SELECT name, target_amount, current_amount, deadline FROM goals WHERE user_id = $1",
      [userId],
    );
    data.goals = goals || [];

    // Always get debts
    const { rows: debts } = await query<DebtRow>(
      "SELECT name, current_balance, interest_rate, minimum_payment FROM debts WHERE user_id = $1 AND is_active = true",
      [userId],
    );
    data.debts = debts || [];

    // Always get recent activity logs
    try {
      await ensureSystemLogsTable();
      const { rows: logs } = await query<SystemLogEntryRow>(
        `SELECT timestamp, action, resource, severity, status 
         FROM system_logs 
         WHERE user_id = $1
         ORDER BY timestamp DESC 
         LIMIT 15`,
        [userId]
      );
      data.logs = logs || [];
    } catch (e) {
      console.warn("Failed to fetch system logs for AI context:", e);
    }

    // Always get profile/settings details
    try {
      const { rows: profiles } = await query<UserProfileRow>(
        "SELECT full_name, currency, preferences, created_at FROM profiles WHERE user_id = $1",
        [userId]
      );
      data.profile = profiles?.[0] || null;
    } catch (e) {
      console.warn("Failed to fetch profile settings for AI context:", e);
    }

    return formatFinancialData(data, intent, currency);
  } catch (error) {
    console.error("Error fetching financial data:", error);
    // Return basic formatted data even if database queries fail
    return formatFinancialData(
      { accounts: [], transactions: [], budgets: [], goals: [], debts: [], logs: [], profile: null },
      intent,
      currency,
    );
  }
}

function getTimeframeCondition(timeframe?: string) {
  switch (timeframe) {
    case "today":
      return "AND DATE(t.date) = CURRENT_DATE";
    case "week":
      return "AND t.date >= CURRENT_DATE - INTERVAL '7 days'";
    case "month":
      return "AND t.date >= DATE_TRUNC('month', CURRENT_DATE)";
    case "last_month":
      return "AND t.date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t.date < DATE_TRUNC('month', CURRENT_DATE)";
    case "quarter":
      return "AND t.date >= CURRENT_DATE - INTERVAL '3 months'";
    case "year":
      return "AND t.date >= DATE_TRUNC('year', CURRENT_DATE)";
    case "all":
    default:
      return "";
  }
}

function formatFinancialData(
  data: FinancialData,
  intent: ProcessedIntent,
  currency: string,
) {
  let formatted = ``;

  // Profile & Settings
  if (data.profile) {
    formatted += `**User Profile & Settings:**\n`;
    formatted += `- Full Name: ${data.profile.full_name || "Not provided"}\n`;
    formatted += `- Account Currency: ${data.profile.currency || "USD"}\n`;
    formatted += `- Member Since: ${data.profile.created_at ? new Date(data.profile.created_at).toISOString().split('T')[0] : "N/A"}\n\n`;
  }

  // Account Balances
  formatted += `**Account Balances:**\n`;
  if (data.accounts.length) {
    const totalBalance = data.accounts.reduce(
      (sum, acc) => sum + Number(acc.balance || 0),
      0,
    );
    formatted += `- Total Balance: ${formatCurrency(totalBalance, currency)}\n`;
    data.accounts.forEach((acc) => {
      formatted += `- ${acc.name}: ${formatCurrency(Number(acc.balance || 0), currency)} (${acc.type})\n`;
    });
  } else {
    formatted += `- No accounts registered.\n`;
  }

  // Transactions
  formatted += `\n**Recent Transactions:**\n`;
  if (data.transactions.length) {
    const recentTx = data.transactions.slice(0, 30);
    recentTx.forEach((t) => {
      const dateStr = t.date ? new Date(t.date).toISOString().split('T')[0] : 'No Date';
      const descStr = t.description ? ` - ${t.description}` : '';
      const catStr = t.category_name ? ` [${t.category_name}]` : '';
      const amountFormatted = formatCurrency(Number(t.amount || 0), currency);
      const typeStr = t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄' : '-';
      formatted += `- ${dateStr}: ${typeStr}${amountFormatted}${catStr}${descStr}\n`;
    });

    formatted += `\n**Recent Transactions Summary:**\n`;
    const income = data.transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses = data.transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    formatted += `- Total Income: ${formatCurrency(income, currency)}\n`;
    formatted += `- Total Expenses: ${formatCurrency(expenses, currency)}\n`;
    formatted += `- Net Savings: ${formatCurrency(income - expenses, currency)}\n`;

    const categorySpending: Record<string, number> = {};
    data.transactions.forEach((t) => {
      if (t.type === "expense" && t.category_name) {
        categorySpending[t.category_name] =
          (categorySpending[t.category_name] || 0) + Number(t.amount || 0);
      }
    });

    if (Object.keys(categorySpending).length > 0) {
      formatted += `\n**Expense Breakdown by Category:**\n`;
      Object.entries(categorySpending).forEach(([cat, amount]) => {
        formatted += `- ${cat}: ${formatCurrency(amount, currency)}\n`;
      });
    }
  } else {
    formatted += `- No transactions registered.\n`;
  }

  // Budgets
  formatted += `\n**Budgets:**\n`;
  if (data.budgets.length) {
    data.budgets.forEach((budget) => {
      formatted += `- ${budget.category_name}: ${formatCurrency(Number(budget.amount || 0), currency)} (${budget.period})\n`;
    });
  } else {
    formatted += `- No budgets configured.\n`;
  }

  // Savings Goals
  formatted += `\n**Savings Goals:**\n`;
  if (data.goals.length) {
    data.goals.forEach((goal) => {
      const progress =
        (Number(goal.current_amount || 0) / Number(goal.target_amount || 1)) *
        100;
      const deadlineStr = goal.deadline ? ` (by ${new Date(goal.deadline).toISOString().split('T')[0]})` : '';
      formatted += `- ${goal.name}: ${formatCurrency(Number(goal.current_amount || 0), currency)} / ${formatCurrency(Number(goal.target_amount || 0), currency)} (${progress.toFixed(1)}% complete)${deadlineStr}\n`;
    });
  } else {
    formatted += `- No savings goals registered.\n`;
  }

  // Debts
  formatted += `\n**Debts:**\n`;
  if (data.debts.length) {
    data.debts.forEach((debt) => {
      formatted += `- ${debt.name}: ${formatCurrency(Number(debt.current_balance || 0), currency)} at ${Number(debt.interest_rate || 0)}% interest (Min payment: ${formatCurrency(Number(debt.minimum_payment || 0), currency)})\n`;
    });
  } else {
    formatted += `- No active debts registered.\n`;
  }

  // Activity Logs
  formatted += `\n**Recent Application Activity Logs:**\n`;
  if (data.logs && data.logs.length) {
    data.logs.forEach((log) => {
      const logDate = log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
      formatted += `- [${logDate}] [${log.severity.toUpperCase()}] ${log.action} on ${log.resource} (${log.status})\n`;
    });
  } else {
    formatted += `- No recent logs recorded.\n`;
  }

  return formatted;
}

function formatCurrency(amount: number, currency: string) {
  const formatters = {
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    EUR: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),
    GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
    INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }),
    JPY: new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }),
  };
  return (
    formatters[currency as keyof typeof formatters]?.format(amount) ||
    `$${amount.toFixed(2)}`
  );
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, aiPreferences, history } = req.body || {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Process the query using advanced NLP
    const processedQuery = queryProcessor.processQuery(message);
    console.log("Processed query:", processedQuery);

    const profile = await queryOne<{
      preferences: Record<string, unknown> | null;
      currency: string | null;
    }>("SELECT preferences, currency FROM profiles WHERE user_id = $1", [
      userId,
    ]);

    const requestPrefs =
      aiPreferences &&
      typeof aiPreferences === "object" &&
      !Array.isArray(aiPreferences)
        ? (aiPreferences as Record<string, unknown>)
        : {};

    const allowedRequestPrefs: Record<string, unknown> = {};
    for (const key of [
      "aiProvider",
      "geminiApiKey",
      "geminiModel",
      "openrouterApiKey",
      "openrouterModel",
    ] as const) {
      if (typeof requestPrefs[key] === "string") {
        allowedRequestPrefs[key] = requestPrefs[key];
      }
    }

    const decryptedProfilePrefs = decryptPreferences(profile?.preferences || {});

    const rawPrefs = {
      ...(decryptedProfilePrefs || {}),
      ...allowedRequestPrefs,
    };
    const prefs = rawPrefs as AIProviderPreferences;
    const currency =
      typeof rawPrefs["currency"] === "string"
        ? (rawPrefs["currency"] as string)
        : profile?.currency || "INR";

    const hasGeminiKey =
      typeof prefs.geminiApiKey === "string" && prefs.geminiApiKey.length > 0;
    const hasOpenRouterKey =
      typeof prefs.openrouterApiKey === "string" &&
      prefs.openrouterApiKey.length > 0;

    // Auto-detect provider: if provider is gemini but key is empty, fallback to openrouter
    if (
      prefs.aiProvider !== "openrouter" &&
      !hasGeminiKey &&
      hasOpenRouterKey
    ) {
      prefs.aiProvider = "openrouter";
    }

    const hasKey =
      prefs.aiProvider === "openrouter" ? hasOpenRouterKey : hasGeminiKey;

    if (!hasKey) {
      const providerLabel = getProviderLabel(prefs.aiProvider || "gemini");
      res.status(400).json({
        error: `${providerLabel} API key not set in preferences. Please add your API key in Settings > Preferences > AI Integration.`,
      });
      return;
    }

    // Fetch comprehensive data based on query intent and preferred currency
    const financialData = await fetchFinancialData(
      userId,
      processedQuery.intent,
      currency,
    );

    const formattedHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && typeof h === "object" && typeof h.content === "string" && (h.role === "user" || h.role === "assistant"))
          .map((h: any) => `- **${h.role === "user" ? "User" : "Assistant"}**: ${h.content}`)
          .join("\n")
      : "";

    const context = `
You are a highly intelligent financial advisor assistant with advanced natural language understanding capabilities.

**Previous Conversation Transcript (for Context/Memory):**
${formattedHistory || "No previous exchanges."}

**Query Analysis:**
- Original Question: "${message}"
- Detected Intent: ${processedQuery.intent.type}
- Timeframe: ${processedQuery.intent.timeframe || "not specified"}
- Categories: ${processedQuery.intent.categories?.join(", ") || "all categories"}
- Operation: ${processedQuery.intent.operation || "general inquiry"}
- Confidence: ${Math.round(processedQuery.confidence * 100)}%

**IMPORTANT: Currency Setting**
The user's preferred currency is: ${currency}
ALWAYS format all monetary values using ${currency} symbol and proper formatting. For example:
- INR: ₹1,00,000 (Indian format with lakhs)
- USD: $100,000
- EUR: €100,000
- GBP: £100,000

**User's Financial Data:**
${financialData}

**Advanced Instructions:**
1. Be conversational and natural - respond like a knowledgeable financial advisor
2. Use the processed intent to provide highly relevant, specific answers
3. Reference actual data points from their financial records
4. If the query is about specific categories, focus your analysis there
5. For comparisons, provide clear before/after insights
6. For forecasts, use historical patterns to make educated predictions
7. Keep responses concise but comprehensive (under 200 words unless detailed analysis is needed)
8. Suggest actionable next steps based on their specific situation
9. If confidence is low (< 60%), ask for clarification
10. Use formatting (bold, lists) to improve readability
11. NEVER use emojis in professional responses
12. You have full 360-degree context of the user's Profile & Settings (e.g., name, currency), as well as recent Audit/Activity Logs showing their latest transaction actions. Reference these log events or user details when relevant to give a fully integrated experience (e.g., "I see you recently created/edited a transaction...").

**User's Question:** ${message}

**Suggested Approach:** ${processedQuery.suggestedResponse}
`;

    const response = await generateWithProvider(context, prefs);
    res.status(200).json({
      response,
      processedQuery: {
        intent: processedQuery.intent.type,
        confidence: processedQuery.confidence,
        suggestedResponse: processedQuery.suggestedResponse,
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);

    if (error instanceof MissingApiKeyError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof Error) {
      if (error.message === "MOCK_MODE") {
        res.status(503).json({
          error:
            "Database not configured. Please set NEON_DATABASE_URL environment variable.",
        });
      } else if (error.message.includes("API key")) {
        res.status(400).json({ error: "Invalid API key configuration." });
      } else if (
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ECONNREFUSED")
      ) {
        res.status(503).json({
          error: "External service unavailable. Please try again later.",
        });
      } else {
        res.status(500).json({
          error: "An internal server error occurred. Please try again later.",
        });
      }
    } else {
      res.status(500).json({ error: "Unknown server error occurred." });
    }
  }
}
