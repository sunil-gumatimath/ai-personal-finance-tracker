import { Search, Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPES, SORT_OPTIONS, type SortOption } from "../account-types";
import { ALL_TYPES } from "../useAccountFilters";

export function AccountFiltersBar({
	searchQuery,
	filterType,
	sortBy,
	onSearchChange,
	onFilterChange,
	onSortChange,
}: {
	searchQuery: string;
	filterType: string;
	sortBy: SortOption;
	onSearchChange: (value: string) => void;
	onFilterChange: (value: string) => void;
	onSortChange: (value: SortOption) => void;
}) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card/30 backdrop-blur-sm border border-border/50">
			<div className="relative flex-1 max-w-md">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search accounts..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="pl-10 h-10 bg-background/50 border-border/50 rounded-lg"
					aria-label="Search accounts by name"
				/>
			</div>
			<div className="flex items-center gap-3">
				<Select value={filterType} onValueChange={onFilterChange}>
					<SelectTrigger
						className="w-[150px] h-10 bg-background/50 border-border/50 rounded-lg"
						aria-label="Filter by account type"
					>
						<Filter className="h-4 w-4 mr-2 text-muted-foreground" />
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_TYPES}>All Types</SelectItem>
						{ACCOUNT_TYPES.map((type) => (
							<SelectItem key={type.value} value={type.value}>
								{type.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={sortBy} onValueChange={onSortChange}>
					<SelectTrigger
						className="w-[140px] h-10 bg-background/50 border-border/50 rounded-lg"
						aria-label="Sort accounts"
					>
						<ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
						<SelectValue placeholder="Sort by" />
					</SelectTrigger>
					<SelectContent>
						{SORT_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

/** Shown when a search or filter matches nothing. */
export function NoAccountsFound({ onClearFilters }: { onClearFilters: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
			<h3 className="text-lg font-semibold text-muted-foreground">
				No accounts found
			</h3>
			<p className="text-sm text-muted-foreground/70 mt-1">
				Try adjusting your search or filter criteria
			</p>
			<Button variant="outline" onClick={onClearFilters} className="mt-4">
				Clear Filters
			</Button>
		</div>
	);
}