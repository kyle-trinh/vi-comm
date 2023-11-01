import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'

import { Button } from '#app/components/ui/button.tsx'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from '#app/components/ui/hover-card.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { getUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getListingImgSrc, getUserImgSrc, invariant } from '#app/utils/misc.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)

	const listing = await prisma.listing.findFirst({
		select: {
			id: true,
			title: true,
			description: true,
			createdAt: true,
			owner: {
				select: {
					name: true,
					id: true,
					email: true,
					phoneNumber: true,
					image: true,
					username: true,
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
			_count: {
				select: {
					listingUpvotes: true,
				},
			},
			listingUpvotes: {
				where: {
					ownerId: userId || undefined,
				},
			},
		},
		where: {
			id: params.listingId,
		},
	})

	invariant(listing, 'Listing not found')

	return json({
		hasLiked: listing.listingUpvotes.length === 1,
		isLoggedIn: userId !== null,
		listing,
	})
}

export default function ListingIndex() {
	const { hasLiked, isLoggedIn, listing } = useLoaderData<typeof loader>()
	const favoriteFetcher = useFetcher()

	const renderImages = () => {
		if (listing.listingImages.length === 0) {
			return null
		}

		return (
			<img
				src={getListingImgSrc(listing.listingImages[0].id)}
				alt={listing.title}
				className=" mb-8 h-[40rem] rounded-md object-cover"
			/>
		)
	}

	const renderLikeButton = () => {
		return (
			<div className="flex items-center space-x-2">
				<span className="text-sm text-gray-300">
					{listing._count.listingUpvotes}
				</span>
				<favoriteFetcher.Form method="POST" action="upvote">
					<input type="hidden" name="isLiked" value={(!hasLiked).toString()} />
					<StatusButton
						disabled={!isLoggedIn}
						type="submit"
						status={'idle'}
						className="flex w-full items-center justify-center"
						size="sm"
					>
						<Icon
							name={isLoggedIn && hasLiked ? 'heart-filled' : 'heart-outline'}
							size="sm"
						/>
						<span className="sr-only">{hasLiked ? 'Unlike' : 'Like'}</span>
					</StatusButton>
				</favoriteFetcher.Form>
			</div>
		)
	}

	return (
		<Card className="px-8">
			<CardHeader>
				<CardTitle>
					<div className="flex items-start justify-between">
						<h2 className="mb-2  text-h2 leading-none">{listing.title}</h2>
						{renderLikeButton()}
					</div>

					<p className="text-base font-normal text-slate-300">
						<span>
							{new Intl.DateTimeFormat('en-US').format(
								new Date(listing.createdAt),
							)}
							{' | '}
							{listing.city.name}, {listing.city.province}
						</span>
						<span>
							<HoverCard>
								<HoverCardTrigger asChild>
									<span>
										{' '}
										by{' '}
										<Button variant="link" className="px-0">
											{listing.owner.name}
										</Button>
									</span>
								</HoverCardTrigger>
								<HoverCardContent className="w-auto px-6">
									<div className="flex items-center justify-between space-x-6 whitespace-nowrap">
										{listing.owner.image && (
											<Link to={`/users/${listing.owner.username}`}>
												<img
													src={getUserImgSrc(listing.owner.image.id)}
													alt={listing.owner.name || 'N/A'}
													className=" h-16 w-16  rounded object-cover"
												/>
											</Link>
										)}
										<div>
											<Link
												to={`/users/${listing.owner.username}`}
												className="text-sm font-bold"
											>
												{listing.owner.name}
											</Link>
											<p>Email: {listing.owner.email}</p>
											{listing.owner.phoneNumber && (
												<p>Phone Number: {listing.owner.phoneNumber}</p>
											)}
										</div>
									</div>
								</HoverCardContent>
							</HoverCard>
						</span>
					</p>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{renderImages()}
				<p>{listing.description}</p>
			</CardContent>
		</Card>
	)
}
