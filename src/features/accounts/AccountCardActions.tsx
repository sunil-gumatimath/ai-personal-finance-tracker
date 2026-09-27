import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import type { Account } from "@/types";

/**
 * The edit/delete pair rendered on every account card.
 *
 * This markup appeared twice in `pages/Accounts.tsx` — once in the Active grid
 * and once in the Inactive grid — with the handlers inlined both times. The
 * two copies had already drifted in their class strings (the Active pair
 * included `opacity-60 hover:opacity-100` and the Inactive pair did not), which
 * is exactly the failure mode duplication invites: a fix to one card does not
 * reach the other.
 *
 * The card chrome around them genuinely differs (dashed border and reduced
 * opacity for archived accounts, a glow and hover-scale for active ones), so
 * only the shared actions are extracted here.
 */
export function AccountCardActions({
	account,
	onEdit,
	onDelete,
	/** Archived cards use a muted treatment for both actions. */
	muted = false,
}: {
	account: Account;
	onEdit: (account: Account) => void;
	onDelete: (account: Account) => void;
	muted?: boolean;
}) {
	const base = muted
		? "h-8 w-8 text-muted-foreground hover:bg-secondary rounded-lg"
		: "h-8 w-8 opacity-60 hover:opacity-100 hover:bg-secondary rounded-lg";

	return (
		<div className="flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon"
				className={base}
				onClick={() => onEdit(account)}
				title="Edit account"
				aria-label={`Edit ${account.name}`}
			>
				<Pencil className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className={
					muted
						? "h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
						: "h-8 w-8 opacity-60 hover:opacity-100 text-destructive hover:bg-destructive/10 rounded-lg"
				}
				onClick={() => onDelete(account)}
				title="Delete account"
				aria-label={`Delete ${account.name}`}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}
