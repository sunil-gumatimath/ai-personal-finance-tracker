import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SORT_OPTIONS, type SortOption } from "./account-types";

export const ALL_TYPES = "all";

function isSortOption(value: string | null): value is SortOption {
	return SORT_OPTIONS.some((o) => o.value === value);
}

/**
 * Search / filter / sort, held in the URL.
 *
 * Living in search params is what makes the view shareable and
 * refresh-safe. Each setter writes a single key and deletes it when it equals
 * the default, so a pristine page has a clean `?`-less URL instead of a
 * permanent `?type=all&sort=name`.
 */
export function useAccountFilters() {
	const [searchParams, setSearchParams] = useSearchParams();

	const searchQuery = searchParams.get("q") ?? "";
	const filterType = searchParams.get("type") ?? ALL_TYPES;
	const sortParam = searchParams.get("sort");
	const sortBy: SortOption = isSortOption(sortParam) ? sortParam : "name";

	const setParam = useCallback(
		(key: string, value: string | null) => {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					if (value) next.set(key, value);
					else next.delete(key);
					return next;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	const setSearchQuery = useCallback(
		(value: string) => setParam("q", value || null),
		[setParam],
	);

	const setFilterType = useCallback(
		(value: string) => setParam("type", value === ALL_TYPES ? null : value),
		[setParam],
	);

	const setSortBy = useCallback(
		(value: string) => setParam("sort", isSortOption(value) ? value : null),
		[setParam],
	);

	const clearFilters = useCallback(() => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.delete("q");
				next.delete("type");
				return next;
			},
			{ replace: true },
		);
	}, [setSearchParams]);

	return useMemo(
		() => ({
			searchQuery,
			filterType,
			sortBy,
			setSearchQuery,
			setFilterType,
			setSortBy,
			clearFilters,
		}),
		[
			searchQuery,
			filterType,
			sortBy,
			setSearchQuery,
			setFilterType,
			setSortBy,
			clearFilters,
		],
	);
}