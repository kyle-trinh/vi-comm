import { Prisma } from '@prisma/client'
import { json, type ActionFunctionArgs } from '@remix-run/node'

import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { invariant } from '#app/utils/misc.tsx'
import { createToastHeaders } from '#app/utils/toast.server.ts'

export async function action({ request, params }: ActionFunctionArgs) {
	invariant(params.listingId, 'Listing ID is required')
	const userId = await requireUserId(request)

	const formData = await request.formData()
	const isUpvoted = formData.get('isLiked') === 'true'

	try {
		if (isUpvoted) {
			await prisma.listingUpvote.create({
				select: { listingId: true },
				data: {
					ownerId: userId,
					listingId: params.listingId,
				},
			})
		} else {
			await prisma.listingUpvote.delete({
				select: { listingId: true },
				where: {
					listingId_ownerId: { listingId: params.listingId, ownerId: userId },
				},
			})
		}
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === 'P2002') {
				const toastHeaders = await createToastHeaders({
					description: 'You already liked this listing!',
					title: 'Error',
					type: 'error',
				})
				return json({ status: 'error' } as const, { headers: toastHeaders })
			}

			if (error.code === 'P2025') {
				const toastHeaders = await createToastHeaders({
					description: "You haven't liked this listing yet!",
					title: 'Error',
					type: 'error',
				})
				return json({ status: 'error' } as const, { headers: toastHeaders })
			}
		}

		const toastHeaders = await createToastHeaders({
			description:
				'There was some error processing your request! Please try again later!',
			title: 'Error',
			type: 'error',
		})
		return json({ status: 'error' } as const, { headers: toastHeaders })
	}

	return json({ status: 'success' })
}
