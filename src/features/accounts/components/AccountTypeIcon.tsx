import {
	Wallet,
	CreditCard,
	PiggyBank,
	Building,
	LineChart,
	Banknote,
} from "lucide-react";
import type { Account } from "@/types";

/**
 * Render the icon for an account type.
 *
 * This returns JSX rather than a component *reference*, which is the whole
 * point. The earlier form was:
 *
 *     const Icon = getAccountIcon(account.type);
 *     return <Icon className="h-6 w-6" />;
 *
 * Assigning a component to a local inside render builds a fresh component
 * identity each pass, so React unmounts and remounts the subtree on every
 * parent render — the `react-hooks/static-components` rule exists for exactly
 * this. Switching on the type and returning the element directly keeps the
 * element type stable across renders.
 *
 * Lives in a `.tsx` file; `account-types.ts` stays JSX-free pure data.
 */
export function AccountTypeIcon({
	type,
	className,
	style,
}: {
	type: string;
	className?: string;
	style?: React.CSSProperties;
}) {
	const iconProps = { className, style };
	switch (type as Account["type"]) {
		case "checking":
			return <Building {...iconProps} />;
		case "savings":
			return <PiggyBank {...iconProps} />;
		case "credit":
			return <CreditCard {...iconProps} />;
		case "investment":
			return <LineChart {...iconProps} />;
		case "cash":
			return <Banknote {...iconProps} />;
		default:
			// Covers `other` plus any value written before the type enum was
			// constrained — an unknown type should still render a wallet.
			return <Wallet {...iconProps} />;
	}
}