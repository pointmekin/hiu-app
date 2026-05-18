import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "#/lib/utils.ts"

function Sheet({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
	...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
		/>
	)
}

function SheetContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
	return (
		<SheetPortal>
			<SheetOverlay />
			<DialogPrimitive.Content
				data-slot="sheet-content"
				className={cn(
					"fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90dvh] w-full rounded-t-2xl border-t bg-background shadow-xl",
					"data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
					"data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
					"duration-300",
					// Desktop: right-side panel
					"md:bottom-0 md:right-0 md:top-0 md:left-auto md:h-full md:max-h-full md:w-[400px] md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l md:slide-in-from-right md:slide-out-to-right",
					className,
				)}
				{...props}
			>
				<DialogPrimitive.Close
					data-slot="sheet-close"
					className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<XIcon className="size-4" />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
				{children}
			</DialogPrimitive.Content>
		</SheetPortal>
	)
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-1.5 px-5 pt-5 pb-4 border-b", className)}
			{...props}
		/>
	)
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn(
				"flex flex-col-reverse gap-2 px-5 py-4 border-t sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	)
}

function SheetTitle({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="sheet-title"
			className={cn("text-base font-semibold leading-none", className)}
			{...props}
		/>
	)
}

function SheetDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	)
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-body"
			className={cn("flex-1 overflow-y-auto px-5 py-4", className)}
			{...props}
		/>
	)
}

export {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetOverlay,
	SheetPortal,
	SheetTitle,
	SheetTrigger,
}
