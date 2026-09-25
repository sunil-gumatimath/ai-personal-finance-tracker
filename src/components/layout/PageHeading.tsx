import type { ReactNode } from "react";
import { ROUTE_SUBTITLES, ROUTE_TITLES } from "@/pages";

interface PageHeadingProps {
	/** Route path — the canonical label and subtitle come from the route tables. */
	path: string;
	/** Overrides the canonical route subtitle when a page needs its own copy. */
	subtitle?: string;
	actions?: ReactNode;
	children?: ReactNode;
}

/**
 * The one heading block every route renders.
 *
 * Previously each page hand-wrote its own `<h1 className="text-2xl sm:text-3xl
 * font-bold tracking-tight">` and its own label, so the H1 text disagreed with
 * the sidebar/breadcrumb/document title on half the routes and the sizing
 * drifted too. Reading the label from ROUTE_TITLES removes that whole class of
 * mismatch by construction.
 */
export function PageHeading({ path, subtitle, actions }: PageHeadingProps) {
	const title = ROUTE_TITLES[path] ?? "Dashboard";
	const description = subtitle ?? ROUTE_SUBTITLES[path];

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
					{title}
				</h1>
				{description && (
					<p className="text-sm sm:text-base text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex flex-wrap items-center justify-end gap-2">
					{actions}
				</div>
			)}
		</div>
	);
}
