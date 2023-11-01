import React from 'react'
import { cn } from '#app/utils/misc.tsx'

export interface SelectProps
	extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
	({ className, ...props }, ref) => {
		return (
			<select
				className={cn(
					'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid]:border-input-invalid',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)

Select.displayName = 'Select'

export { Select }
