// Advanced AI Query Processor for Natural Language Financial Queries

type Timeframe =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "quarter"
  | "year"
  | "all"
  | "custom";
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
type OperationType = "total" | "average" | "count" | "trend" | "breakdown";
type ComparisonType = "last_month" | "last_year" | "budget" | "goal";

interface IntentResult {
  type: IntentType;
  confidence: number;
}

interface ProcessedIntent {
  type: IntentType;
  timeframe: Timeframe | undefined;
  categories: string[];
  operation: OperationType | undefined;
  comparison: ComparisonType | undefined;
  amount: number | undefined;
  /** Explicit date (YYYY-MM-DD) mentioned in the query, when one is detected. */
  customDate: string | undefined;
}

interface ProcessedQuery {
  intent: ProcessedIntent;
  originalQuery: string;
  confidence: number;
  suggestedResponse: string;
}

class AIQueryProcessor {
  static TIMEFRAME_PATTERNS: Record<string, RegExp> = {
    today: /today|now|current/i,
    week: /this week|past week|last 7 days|past 7 days/i,
    month: /this month|past month|last 30 days|past 30 days|monthly/i,
    last_month: /last month|previous month/i,
    quarter: /this quarter|past quarter|last 3 months|past 90 days/i,
    year: /this year|past year|last 12 months|past 365 days|annually|yearly/i,
    all: /all time|ever|total|overall|lifetime/i,
  };

  static CATEGORY_PATTERNS: Record<string, RegExp> = {
    food: /food|dining|restaurant|groceries|eating|meal/i,
    transport: /transport|car|gas|fuel|uber|taxi|bus|train|metro/i,
    shopping: /shopping|clothes|retail|amazon|purchase|buy/i,
    entertainment: /entertainment|movie|netflix|spotify|games|fun/i,
    bills: /bills|utilities|rent|mortgage|insurance|phone|internet/i,
    health: /health|medical|doctor|pharmacy|gym|fitness/i,
    education: /education|school|college|course|books|tuition/i,
  };

  static INTENT_PATTERNS: Record<string, RegExp> = {
    comparison:
      /compare|difference|change|versus|vs|than|income vs expenses|expenses vs income/i,
    forecast: /forecast|predict|expect|project|future/i,
    income: /income|earned|salary|wage|received|deposit|how much.*earn/i,
    debt: /debt|loan|credit|owe|borrow|payment|how much.*debt/i,
    balance: /balance|account|total|worth|net worth|how much.*have/i,
    spending: /spend|spent|expense|cost|paid|bought/i,
    budget: /budget|limit|allowance|cap|allocated/i,
    goals: /goal|target|save|objective|aim/i,
  };

  static OPERATION_PATTERNS: Record<string, RegExp> = {
    total: /total|sum|overall|complete|grand total/i,
    average: /average|mean|typical|usual|normal/i,
    count: /count|number|how many|frequency/i,
    trend: /trend|pattern|change|increase|decrease/i,
    breakdown: /breakdown|split|by category|categor/i,
  };

  static processQuery(query: string): ProcessedQuery {
    const normalizedQuery = query.toLowerCase().trim();

    // Determine intent
    const intent = this.determineIntent(normalizedQuery);

    // Extract timeframe
    const timeframe = this.extractTimeframe(normalizedQuery);

    // Extract an explicit date (e.g. "2024-12-05" or "12/05/2024")
    const customDate = this.extractCustomDate(normalizedQuery);

    // Extract categories
    const categories = this.extractCategories(normalizedQuery);

    // Extract operation
    const operation = this.extractOperation(normalizedQuery);

    // Extract comparison
    const comparison = this.extractComparison(normalizedQuery);

    // Extract amount
    const amount = this.extractAmount(normalizedQuery);

    const processedQuery: ProcessedQuery = {
      intent: {
        type: intent.type,
        timeframe,
        categories,
        operation,
        comparison,
        amount,
        customDate,
      },
      originalQuery: query,
      confidence: intent.confidence,
      suggestedResponse: "",
    };

    // Add suggested response for common patterns
    processedQuery.suggestedResponse =
      this.generateSuggestedResponse(processedQuery);

    return processedQuery;
  }

  static determineIntent(query: string): IntentResult {
    for (const [intentType, pattern] of Object.entries(this.INTENT_PATTERNS)) {
      if (pattern.test(query)) {
        return { type: intentType as IntentType, confidence: 0.9 };
      }
    }
    return { type: "general", confidence: 0.3 };
  }

  static extractTimeframe(query: string): Timeframe | undefined {
    for (const [timeframe, pattern] of Object.entries(
      this.TIMEFRAME_PATTERNS,
    )) {
      if (pattern.test(query)) {
        return timeframe as Timeframe;
      }
    }

    // Check for specific date patterns ("custom" timeframe)
    if (/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/.test(query)) {
      return "custom";
    }

    return undefined;
  }

  /**
   * Parse an explicit date mentioned in the query into YYYY-MM-DD.
   * Accepts ISO (2024-12-05) and slash formats (12/05/2024 = US style, MM/DD/YYYY).
   * Returns undefined for invalid or impossible dates.
   */
  static extractCustomDate(query: string): string | undefined {
    const iso = query.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const [, y, m, d] = iso;
      return this.isValidDateParts(y, m, d) ? `${y}-${m}-${d}` : undefined;
    }

    const slash = query.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (slash) {
      const [, m, d, y] = slash;
      if (!this.isValidDateParts(y, m, d)) return undefined;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    return undefined;
  }

  private static isValidDateParts(y: string, m: string, d: string): boolean {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return false;
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1) return false;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= daysInMonth;
  }

  static extractCategories(query: string): string[] {
    const categories: string[] = [];
    for (const [category, pattern] of Object.entries(this.CATEGORY_PATTERNS)) {
      if (pattern.test(query)) {
        categories.push(category);
      }
    }
    return categories;
  }

  static extractOperation(query: string): OperationType | undefined {
    for (const [operation, pattern] of Object.entries(
      this.OPERATION_PATTERNS,
    )) {
      if (pattern.test(query)) {
        return operation as OperationType;
      }
    }
    return undefined;
  }

  static extractComparison(query: string): ComparisonType | undefined {
    if (/last month|previous month|month over month/i.test(query)) {
      return "last_month";
    }
    if (/last year|previous year|year over year/i.test(query)) {
      return "last_year";
    }
    if (/budget|allocated|limit/i.test(query)) {
      return "budget";
    }
    if (/goal|target|objective/i.test(query)) {
      return "goal";
    }
    return undefined;
  }

  static extractAmount(query: string): number | undefined {
    const amountMatch = query.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      return parseFloat(amountMatch[1].replace(/,/g, ""));
    }
    return undefined;
  }

  static generateSuggestedResponse(processed: ProcessedQuery): string {
    const { intent } = processed;

    // Generate contextual suggestions based on intent
    switch (intent.type) {
      case "balance":
        return "I'll check your current account balances and calculate your total net worth.";

      case "spending":
        if (intent.categories?.length) {
          return `I'll analyze your ${intent.categories.join(" and ")} spending${intent.timeframe ? ` for ${intent.timeframe.replace("_", " ")}` : ""}.`;
        }
        return "I'll break down your spending patterns and show you where your money is going.";

      case "income":
        return "I'll review your income sources and calculate your earnings.";

      case "budget":
        return "I'll check your budget status and show you how you're tracking against your limits.";

      case "comparison":
        if (intent.comparison === "last_month") {
          return "I'll compare this month's spending with last month to show you the changes.";
        }
        return "I'll compare your income and expenses to show your financial picture.";

      case "forecast":
        return "Based on your spending patterns, I'll provide a financial forecast.";

      case "goals":
        return "I'll review your savings goals and show your progress toward each target.";

      case "debt":
        return "I'll analyze your debt situation and show your payment progress.";

      default:
        return "I'll help you with that financial question using your data.";
    }
  }
}

export { AIQueryProcessor };
export type {
  ProcessedQuery,
  ProcessedIntent,
  IntentResult,
  Timeframe,
  IntentType,
  OperationType,
  ComparisonType,
};
