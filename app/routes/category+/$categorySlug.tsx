import { json } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'

export async function loader() {
	const listingCategories = await prisma.listingCategory.findMany({
		select: {
			id: true,
			slug: true,
			title: true,
			_count: {
				select: {
					listings: true,
				},
			},
		},
	})

	return json({ listingCategories })
}

export default function CategorySlugIndex() {
	const { listingCategories } = useLoaderData<typeof loader>()

	return (
		<div className="container grid h-full min-h-[400px] grid-cols-7 items-start gap-6">
			<Card className="col-span-2 inline-block">
				<CardHeader>
					<CardTitle>Category</CardTitle>
				</CardHeader>
				<CardContent className="px-0">
					<ul>
						{listingCategories.map(category => (
							<NavLink key={category.id} to={`/category/${category.slug}`}>
								{({ isActive }) => (
									<li
										key={category.id}
										className={cn(
											'px-6 py-3 hover:bg-slate-300 hover:text-gray-800',
											isActive && ' bg-primary text-primary-foreground',
										)}
									>
										{category.title} ({category._count.listings})
									</li>
								)}
							</NavLink>
						))}
					</ul>
				</CardContent>
			</Card>
			<div className="col-span-5 flex flex-col gap-8">
				<Outlet />
			</div>
		</div>
	)
}
