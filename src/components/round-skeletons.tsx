import { Skeleton } from "#/components/ui/skeleton"

// ── Shared primitives ─────────────────────────────────────────────────────────

function FieldSkeleton({ wide }: { wide?: boolean }) {
	return (
		<div className="space-y-1.5">
			<Skeleton className="h-3.5 w-24" />
			<Skeleton className={`h-10 ${wide ? "w-full" : "w-full"}`} />
		</div>
	)
}

// ── Parent layout skeleton (shown while round data loads) ─────────────────────

export function RoundLayoutSkeleton() {
	return (
		<div className="flex flex-col min-h-full">
			<div className="border-b border-border bg-card/80 sticky top-0 md:top-[57px] z-30">
				<div className="max-w-screen-xl mx-auto px-4 pt-2 pb-0">
					<div className="flex items-start justify-between gap-3 mb-3">
						<div className="space-y-1.5">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-3.5 w-64" />
						</div>
						<Skeleton className="h-6 w-20 rounded-full" />
					</div>
					<div className="flex gap-1 pb-[6px]">
						{Array.from({ length: 7 }).map((_, i) => (
							<Skeleton key={i} className="h-9 w-20 rounded-none" />
						))}
					</div>
				</div>
			</div>
			<div className="flex-1 max-w-screen-xl w-full mx-auto px-4 py-6 space-y-4">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-48 w-full" />
			</div>
		</div>
	)
}

// ── Overview (round settings form) ───────────────────────────────────────────

export function RoundOverviewSkeleton() {
	return (
		<div className="max-w-2xl space-y-5">
			<FieldSkeleton />
			<div className="grid grid-cols-2 gap-4">
				<FieldSkeleton />
				<FieldSkeleton />
			</div>
			<FieldSkeleton />
			<div className="grid grid-cols-2 gap-4">
				<FieldSkeleton />
				<FieldSkeleton />
			</div>
			<Skeleton className="h-12 w-full rounded-lg" />
			<div className="grid grid-cols-2 gap-4">
				<FieldSkeleton />
				<FieldSkeleton />
			</div>
			<div className="grid grid-cols-3 gap-4">
				<FieldSkeleton />
				<FieldSkeleton />
				<FieldSkeleton />
			</div>
			<div className="space-y-1.5">
				<Skeleton className="h-3.5 w-16" />
				<Skeleton className="h-20 w-full" />
			</div>
			<Skeleton className="h-10 w-24" />
		</div>
	)
}

// ── Orders list ───────────────────────────────────────────────────────────────

export function OrdersListSkeleton() {
	return (
		<div>
			<div className="flex items-center justify-between mb-3">
				<Skeleton className="h-7 w-32" />
				<Skeleton className="h-8 w-28" />
			</div>
			<Skeleton className="h-8 w-full mb-3" />
			<div className="flex gap-1 mb-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-7 w-16 rounded-full" />
				))}
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} className="h-20 w-full rounded-lg" />
				))}
			</div>
		</div>
	)
}

// ── Products table ────────────────────────────────────────────────────────────

export function RoundProductsSkeleton() {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<Skeleton className="h-4 w-32" />
				<div className="flex gap-2">
					<Skeleton className="h-8 w-28" />
					<Skeleton className="h-8 w-28" />
					<Skeleton className="h-8 w-20" />
				</div>
			</div>
			<Skeleton className="h-8 w-full" />
			{/* Mobile cards */}
			<div className="md:hidden space-y-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-48 w-full rounded-lg" />
				))}
			</div>
			{/* Desktop table */}
			<div className="hidden md:block rounded-lg border border-border overflow-hidden">
				<div className="bg-muted/40 px-4 py-3 flex gap-4">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-20 ml-auto" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-20" />
				</div>
				{Array.from({ length: 5 }).map((_, i) => (
					<div
						key={i}
						className="flex items-center gap-4 px-4 py-3 border-t border-border"
					>
						<Skeleton className="h-12 w-12 shrink-0" />
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-24" />
						</div>
						<Skeleton className="h-10 w-28" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-10 w-24" />
						<Skeleton className="h-5 w-5" />
						<Skeleton className="h-8 w-24" />
					</div>
				))}
			</div>
		</div>
	)
}

// ── Purchase tracker ──────────────────────────────────────────────────────────

export function PurchaseTrackerSkeleton() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-9 w-full" />
			<div className="flex flex-wrap gap-3">
				<Skeleton className="h-8 w-36" />
				<Skeleton className="h-8 w-44" />
				<Skeleton className="h-8 w-32 ml-auto" />
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{Array.from({ length: 2 }).map((_, gi) => (
					<div key={gi} className="rounded-xl border border-border overflow-hidden bg-card">
						<div className="px-4 py-3 flex items-center gap-3">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-12 ml-auto" />
							<Skeleton className="h-1.5 w-16 rounded-full" />
						</div>
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="px-4 py-3 border-t border-border space-y-2.5">
								<Skeleton className="h-4 w-40" />
								<div className="flex items-center gap-3">
									<Skeleton className="h-8 w-10" />
									<Skeleton className="h-8 w-20 flex-1" />
									<Skeleton className="h-8 w-10" />
									<Skeleton className="h-4 w-10 ml-auto" />
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	)
}

// ── Shipping (Kerry export) ───────────────────────────────────────────────────

export function ShippingSkeleton() {
	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-border p-6 space-y-4">
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-3.5 w-72" />
				<Skeleton className="h-10 w-36" />
				<div className="space-y-2 pt-2">
					<div className="flex gap-4 pb-2 border-b border-border">
						{[8, 32, 24, 48, 16].map((w, i) => (
							<Skeleton key={i} className={`h-4 w-${w}`} />
						))}
					</div>
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex gap-4 py-1">
							<Skeleton className="h-4 w-8" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

// ── Stats dashboard ───────────────────────────────────────────────────────────

export function RoundStatsSkeleton() {
	return (
		<div className="space-y-8">
			<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="rounded-lg border border-border p-4 space-y-2">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-7 w-32" />
					</div>
				))}
			</div>
			<div className="rounded-lg border border-border p-6 space-y-3">
				<Skeleton className="h-5 w-40 mb-4" />
				<Skeleton className="h-40 w-full" />
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{Array.from({ length: 2 }).map((_, i) => (
					<div key={i} className="rounded-lg border border-border p-6 space-y-3">
						<Skeleton className="h-5 w-32 mb-4" />
						<Skeleton className="h-52 w-full" />
					</div>
				))}
			</div>
			<div className="rounded-lg border border-border p-6 space-y-3">
				<Skeleton className="h-5 w-28 mb-4" />
				<Skeleton className="h-48 w-full" />
			</div>
		</div>
	)
}
