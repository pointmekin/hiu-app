interface EmptyStateProps {
	icon: React.ReactNode;
	title: string;
	hint?: string;
	action?: React.ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<div className="rounded-full bg-bone-soft dark:bg-muted p-5 mb-4">
				{icon}
			</div>
			<p className="text-lg font-medium text-foreground mb-1">{title}</p>
			{hint && <p className="text-sm text-muted-foreground mb-6">{hint}</p>}
			{action}
		</div>
	);
}
