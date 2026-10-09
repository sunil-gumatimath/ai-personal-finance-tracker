import { Skeleton } from "@/components/ui/skeleton";

export function AccountsSkeleton() {
	return (
		<div className="space-y-8 animate-in fade-in duration-200">
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="space-y-2">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-4 w-64" />
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Skeleton className="h-11 w-11 rounded-xl" />
						<Skeleton className="h-11 w-32 rounded-xl" />
					</div>
				</div>
			</div>

			<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
				<Skeleton className="h-48 rounded-xl sm:col-span-2" />
				<Skeleton className="h-48 rounded-xl" />
				<Skeleton className="h-48 rounded-xl" />
			</div>

			<div className="space-y-6">
				<Skeleton className="h-6 w-32" />
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-64 rounded-xl" />
					))}
				</div>
			</div>
		</div>
	);
}