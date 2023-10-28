import { Prisma } from '@prisma/client'
import {
	type LoaderFunctionArgs,
	json,
	type SerializeFrom,
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { buttonVariants } from '#app/components/ui/button.tsx'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getListingImgSrc, invariant } from '#app/utils/misc.tsx'

export async function loader({ params }: LoaderFunctionArgs) {
	const listingCategories = await prisma.listingCategory.findFirst({
		select: {
			id: true,
			listings: {
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
						where: {
							isThumbnail: true,
						},
						select: {
							id: true,
						},
					},
				},
			},
		},
		where: {
			slug: params.categorySlug,
		},
	})

	invariant(listingCategories, 'Listing Category not found')

	return json({ listings: listingCategories.listings })
}

export default function CategorySlugIndex() {
	const { listings } = useLoaderData<typeof loader>()

	return (
		<div className="col-span-5 flex flex-col gap-8">
			{listings.length === 0 ? (
				<EmptyCard />
			) : (
				<>
					<Listings
						listings={listings.filter(listing => listing.isFeatured)}
						isFeatured
					/>
					<Listings
						listings={listings.filter(listing => !listing.isFeatured)}
					/>
				</>
			)}
		</div>
	)
}

const EmptyCard = () => (
	<Card className=" h-[calc(100vh/2)]">
		<CardContent className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
			<Icon name="value-none" className="text-3xl" />
			<p className="text-2xl">Such empty</p>
		</CardContent>
	</Card>
)

const Listings = ({
	listings,
	isFeatured,
}: {
	listings: ListingPropsType[]
	isFeatured?: boolean
}) => {
	if (listings.length === 0) {
		return null
	}

	return (
		<Card className={isFeatured ? 'bg-blue-500' : ''}>
			<CardHeader>
				<CardTitle>{isFeatured ? 'Featured Listings' : 'Listings'}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-6">
					{listings.map(listing => (
						<Card key={listing.id}>
							<CardContent className="flex items-center px-6 py-8">
								<Link to={listing.id} className="flex-none">
									{listing.listingImages.length > 0 ? (
										<img
											src={getListingImgSrc(listing.listingImages[0].id)}
											alt={listing.title}
											className="h-32 w-32 rounded-full object-cover"
										/>
									) : (
										<div className="h-32 w-32 rounded-full bg-gray-200" />
									)}
								</Link>
								<div className="ml-6">
									<p className="text-slate-300">
										{new Intl.DateTimeFormat('en-US').format(
											new Date(listing.createdAt),
										)}{' '}
										| {listing.owner.name} | {listing.city.name},{' '}
										{listing.city.province}
									</p>
									<Link to={listing.id}>
										<h6 className="mb-3 text-2xl font-bold">{listing.title}</h6>
									</Link>
									<p className="mb-3">
										{listing.description.split(' ').slice(0, 26).join(' ')}
										...
									</p>
									<Link to={listing.id} className={buttonVariants()}>
										See more
									</Link>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

const ListingAsProps = Prisma.validator<Prisma.ListingDefaultArgs>()({
	select: {
		id: true,
		listingImages: {
			select: {
				id: true,
			},
		},
		title: true,
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
		description: true,
		isFeatured: true,
	},
})

type ListingPropsType = SerializeFrom<
	Prisma.ListingGetPayload<typeof ListingAsProps>
>
