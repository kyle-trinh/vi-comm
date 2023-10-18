import { type MetaFunction, json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { buttonVariants } from '#app/components/ui/button.tsx'
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import { prisma } from '#app/utils/db.server.ts'

export const meta: MetaFunction = () => [{ title: 'Vi Comm' }]

export async function loader() {
	const listingCategories = await prisma.listingCategory.findMany({
		select: {
			id: true,
			slug: true,
			title: true,
			description: true,
			_count: {
				select: {
					listings: true,
				},
			},
		},
	})

	return json({ listingCategories })
}

export default function Index() {
	const { listingCategories } = useLoaderData<typeof loader>()

	if (!listingCategories.length)
		return (
			<div className="container flex h-full items-center justify-center">
				<h2 className="text-6xl">Nothing to show here</h2>
			</div>
		)

	return (
		<div className="container grid grid-cols-3 gap-4">
			{listingCategories.map(({ id, slug, title, description, _count }) => (
				<Card key={id} className="flex flex-col justify-between">
					<div>
						<CardHeader>
							<CardTitle>
								<Link to={`/category/${slug}`}>
									{title} ({_count.listings})
								</Link>
							</CardTitle>
						</CardHeader>
						<CardContent>{description}</CardContent>
					</div>
					<CardFooter>
						<Link
							to={`/category/${slug}`}
							className={buttonVariants({ className: 'w-full' })}
						>
							See More
						</Link>
					</CardFooter>
				</Card>
			))}
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
