// Database types for Neon
//
// NOTE ON MONEY FIELDS: Postgres DECIMAL/NUMERIC columns are returned by pg
// drivers as STRINGS (to avoid IEEE-754 precision loss), even though they may
// arrive as numbers from JSON APIs or client-side calculations. Every money
// column below is therefore typed `number | string`. Use the shared
// `toNumber()` helper before doing arithmetic on these values.

export interface Profile {
	id: string;
	user_id: string;
	full_name: string | null;
	avatar_url: string | null;
	currency: string;
	preferences?: Record<string, unknown> | null; // JSONB
	created_at: string;
	updated_at: string;
}

export interface Account {
	id: string;
	user_id: string;
	name: string;
	type: "checking" | "savings" | "credit" | "investment" | "cash" | "other";
	balance: number | string; // DECIMAL(15, 2) — arrives as string from pg
	currency: string;
	color: string;
	icon: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface Category {
	id: string;
	user_id: string;
	name: string;
	type: "income" | "expense";
	color: string;
	icon: string;
	parent_id: string | null;
	created_at: string;
}

export interface Transaction {
	id: string;
	user_id: string;
	account_id: string;
	category_id: string | null;
	to_account_id: string | null; // For transfer transactions
	type: "income" | "expense" | "transfer";
	amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	description: string | null;
	notes: string | null;
	date: string;
	is_recurring: boolean;
	recurring_frequency: "daily" | "weekly" | "monthly" | "yearly" | null;
	recurring_end_date: string | null;
	next_due_date: string | null;
	recurring_parent_id: string | null;
	created_at: string;
	updated_at: string;
	// Joined fields
	account?: Account;
	category?: Category;
	to_account?: Account; // For transfer transactions
}

export interface Budget {
	id: string;
	user_id: string;
	category_id: string;
	amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	period: "weekly" | "monthly" | "yearly";
	start_date: string;
	end_date: string | null;
	created_at: string;
	updated_at: string;
	// Joined fields
	category?: Category;
	spent?: number; // App-computed aggregate (already converted to a number)
}

export interface Goal {
	id: string;
	user_id: string;
	name: string;
	target_amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	current_amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	deadline: string | null;
	color: string;
	icon: string;
	created_at: string;
	updated_at: string;
}

// Stats types
export interface DashboardStats {
	totalBalance: number;
	monthlyIncome: number;
	monthlyExpenses: number;
	monthlyNet: number;
	savingsRate: number;
}

export interface SpendingByCategory {
	category: string;
	amount: number;
	color: string;
	percentage: number;
}

export interface MonthlyTrend {
	month: string;
	income: number;
	expenses: number;
}

export interface Debt {
	id: string;
	user_id: string;
	name: string;
	type:
		| "mortgage"
		| "car_loan"
		| "student_loan"
		| "personal_loan"
		| "credit_card"
		| "medical"
		| "other";
	original_amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	current_balance: number | string; // DECIMAL(15, 2) — arrives as string from pg
	interest_rate: number | string; // DECIMAL(5, 2) — arrives as string from pg
	minimum_payment: number | string; // DECIMAL(15, 2) — arrives as string from pg
	due_day: number | null;
	start_date: string;
	end_date: string | null;
	lender: string | null;
	notes: string | null;
	color: string;
	icon: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface DebtPayment {
	id: string;
	debt_id: string;
	user_id: string;
	amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	principal_amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	interest_amount: number | string; // DECIMAL(15, 2) — arrives as string from pg
	payment_date: string;
	notes: string | null;
	created_at: string;
	// Joined fields
	debt?: Debt;
}

