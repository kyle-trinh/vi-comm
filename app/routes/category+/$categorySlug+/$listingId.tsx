import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { invariant } from '#app/utils/misc.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const listing = await prisma.listing.findFirst({
		select: {
			id: true,
			title: true,
			description: true,
			isFeatured: true,
			createdAt: true,
			owner: {
				select: {
					name: true,
					id: true,
				},
			},
			city: {
				select: {
					name: true,
					province: true,
				},
			},
			listingImages: {
				select: {
					id: true,
				},
			},
			listingUpvotes: {},
		},
		where: {
			id: params.listingId,
		},
	})

	invariant(listing, 'Listing Category not found')

	return json({ listing })
}

export default function ListingIndex() {
	return <h1>Listing</h1>
}
