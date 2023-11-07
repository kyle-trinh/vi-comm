import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { invariantResponse } from '#app/utils/misc.tsx'
import { ListingEditor, action } from './__listing-editor.tsx'

export { action }

export async function loader({ params, request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const listing = await prisma.listing.findFirst({
		select: {
			id: true,
			title: true,
			description: true,
			listingCategoryId: true,
			city: {
				select: {
					id: true,
					province: true,
				},
			},
			listingImages: {
				select: {
					id: true,
					isThumbnail: true,
				},
			},
		},
		where: {
			id: params.listingId,
			ownerId: userId,
		},
	})

	invariantResponse(listing, 'not found', { status: 404 })
	// listing.listingImages[0].isThumbnail = 'on'
	return json({ listing })
}

export default function ListingEdit() {
	const data = useLoaderData<typeof loader>()
	return <ListingEditor listing={data.listing} />
}
