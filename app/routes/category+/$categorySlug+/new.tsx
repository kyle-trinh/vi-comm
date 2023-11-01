import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { createId } from '@paralleldrive/cuid2'
import {
	unstable_parseMultipartFormData as parseMultipartFormData,
	type DataFunctionArgs,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	type LoaderFunctionArgs,
	redirect,
} from '@remix-run/node'
import { Form, useLoaderData, useParams } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'

import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import {
	ErrorList,
	Field,
	SelectField,
	TextareaField,
} from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '#app/components/ui/card.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const titleMinLength = 1
const titleMaxLength = 100
const descriptionMinLength = 1
const descriptionMaxLength = 10000

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ImageFieldsetSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.optional()
		.refine(file => {
			return !file || file.size <= MAX_UPLOAD_SIZE
		}, 'File size must be less than 3MB'),
	altText: z.string().optional(),
	isThumbnail: z.boolean(),
})

type ImageFieldset = z.infer<typeof ImageFieldsetSchema>

// Assert whether the image has a file inside
// To differentiate if the image is new / updated with new file / updated without new file
function imageHasFile(
	image: ImageFieldset,
): image is ImageFieldset & { file: NonNullable<ImageFieldset['file']> } {
	return Boolean(image.file?.size && image.file?.size > 0)
}

// Assert whether the image has associated id
// To differentiate between new / updated image
// New image doesn't have id, while updated image has one
function imageHasId(
	image: ImageFieldset,
): image is ImageFieldset & { id: NonNullable<ImageFieldset['id']> } {
	return image.id != null
}

const ListingSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(titleMinLength).max(titleMaxLength),
	description: z.string().min(descriptionMinLength).max(descriptionMaxLength),
	listingCategoryId: z.string(),
	listingImages: z.array(ImageFieldsetSchema).optional(),
	cityId: z.string(),
})

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	const listingCategories = await prisma.listingCategory.findMany({
		select: {
			slug: true,
			title: true,
			id: true,
		},
	})

	return json({ listingCategories })
}

export async function action({ request, params }: DataFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)

	const submission = await parse(formData, {
		schema: ListingSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			// Only allow update listing by owner
			const listing = await prisma.listing.findUnique({
				select: { id: true },
				where: {
					id: data.id,
					ownerId: userId,
				},
			})

			if (!listing) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Listing not found!',
				})
			}

			const city = await prisma.listingCity.findUnique({
				select: { id: true },
				where: {
					id: data.cityId,
				},
			})

			if (!city) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `City not found`,
				})
			}
		}).transform(async ({ listingImages = [], ...data }) => {
			return {
				...data,
				imageUpdates: await Promise.all(
					listingImages.filter(imageHasId).map(async i => {
						// Updated image with new file
						if (imageHasFile(i)) {
							return {
								id: i.id,
								altText: i.altText,
								contentType: i.file.type,
								blob: Buffer.from(await i.file.arrayBuffer()),
								isThumbnail: i.isThumbnail,
							}
							// Update image without new file
							// Effectively only update image's other property
						} else {
							return {
								id: i.id,
								altText: i.altText,
								isThumbnail: i.isThumbnail,
							}
						}
					}),
				),
				// New images
				newImages: await Promise.all(
					listingImages
						.filter(imageHasFile)
						.filter(i => !i.id)
						.map(async image => {
							return {
								altText: image.altText,
								contentType: image.file.type,
								blob: Buffer.from(await image.file.arrayBuffer()),
								isThumbnail: image.isThumbnail,
							}
						}),
				),
			}
		}),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const {
		id: listingId,
		title,
		description,
		listingCategoryId,
		cityId,
		imageUpdates = [],
		newImages = [],
	} = submission.value

	const listing = await prisma.listing.upsert({
		select: { id: true },
		where: { id: listingId ?? '__new_listing__' },
		create: {
			ownerId: userId,
			title,
			description,
			listingCategoryId,
			cityId,
			listingImages: { create: newImages },
		},
		update: {
			title,
			description,
			listingCategoryId,
			cityId,
			listingImages: {
				deleteMany: { id: { notIn: imageUpdates.map(i => i.id) } },
				updateMany: imageUpdates.map(updates => ({
					where: { id: updates.id },
					data: { ...updates, id: updates.blob ? createId() : updates.id },
				})),
				create: newImages,
			},
		},
	})

	return redirect(`/category/${params.categorySlug}/${listing.id}`)
}

export default function NewListing() {
	const { listingCategories } = useLoaderData<typeof loader>()
	const params = useParams()
	const [selectedProvince, setSelectedProvince] = useState<
		keyof typeof canadianCities | ''
	>('')

	const ClientSchema = ListingSchema.extend({ province: z.string() })

	const [form, fields] = useForm({
		id: 'listing-editor',
		constraint: getFieldsetConstraint(ClientSchema),
		onValidate({ formData }) {
			return parse(formData, {
				schema: ClientSchema,
			})
		},
		defaultValue: {
			listingCategoryId: listingCategories.find(
				cat => cat.slug === params.categorySlug,
			)!.id,
			title: '',
			description: '',
		},
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle>New Listing</CardTitle>
			</CardHeader>
			<CardContent>
				<CardContent>
					<Form method="post" {...form.props} encType="multipart/form-data">
						{/*
					    This hidden submit button is here to ensure that when the user hits
					    "enter" on an input field, the primary form function is submitted
					    rather than the first button in the form (which is delete/add image).
				        */}
						<button type="submit" className="hidden" />
						<div className="flex flex-col gap-1">
							<SelectField
								labelProps={{ children: 'Listing Category' }}
								selectProps={{
									...conform.select(fields.listingCategoryId, {
										ariaAttributes: true,
									}),
									children: listingCategories.map(({ id, title }) => (
										<option value={id} key={id}>
											{title}
										</option>
									)),
								}}
								errors={fields.description.errors}
							/>
							<div className="flex gap-6">
								<SelectField
									className="flex-1"
									labelProps={{ children: 'Province' }}
									selectProps={{
										...conform.select(fields.province, {
											ariaAttributes: true,
										}),
										children: [
											<option value={''} key={-1}>
												Please make your selection
											</option>,
											...Object.keys(canadianCities).map(p => (
												<option value={p} key={p}>
													{p}
												</option>
											)),
										],
										value: selectedProvince,
										onChange: e =>
											setSelectedProvince(
												e.target.value as keyof typeof canadianCities | '',
											),
									}}
									errors={fields.province.errors}
								/>
								<SelectField
									className="flex-1"
									labelProps={{ children: 'City' }}
									selectProps={{
										...conform.select(fields.cityId, {
											ariaAttributes: true,
										}),
										children: selectedProvince && [
											<option value={''} key={-1}>
												Please make your selection
											</option>,
											...canadianCities[selectedProvince].map(c => (
												<option value={c.id} key={c.id}>
													{c.name}
												</option>
											)),
										],
										disabled: !selectedProvince,
									}}
									errors={fields.cityId.errors}
								/>
							</div>
							<Field
								labelProps={{ children: 'Title' }}
								inputProps={{
									autoFocus: true,
									...conform.input(fields.title, { ariaAttributes: true }),
								}}
								errors={fields.title.errors}
							/>
							<TextareaField
								labelProps={{ children: 'Description' }}
								textareaProps={{
									...conform.textarea(fields.description, {
										ariaAttributes: true,
									}),
								}}
								errors={fields.description.errors}
							/>
						</div>
						<ErrorList id={form.errorId} errors={form.errors} />
						<div className="flex justify-end gap-3">
							<Button form={form.id} variant="destructive" type="reset">
								Reset
							</Button>
							<StatusButton
								form={form.id}
								type="submit"
								disabled={false}
								status={'idle'}
							>
								Submit
							</StatusButton>
						</div>
					</Form>
				</CardContent>
			</CardContent>
		</Card>
	)
}

const canadianCities = {
	Alberta: [
		{
			name: 'Calgary',
			slug: 'calgary--alberta',
			id: 'clodun45p0000puvv2k02jp9v',
		},
		{
			name: 'Edmonton',
			slug: 'edmonton--alberta',
			id: 'clodun45q0001puvvudsjackm',
		},
		{
			name: 'Fort McMurray',
			slug: 'fort-mcmurray--alberta',
			id: 'clodun45u0004puvv0i49jz6b',
		},
		{
			name: 'Red Deer',
			slug: 'red-deer--alberta',
			id: 'clodun45w0006puvv59lis2gs',
		},
		{
			name: 'Lethbridge',
			slug: 'lethbridge--alberta',
			id: 'clodun45z0009puvvhoe0oswy',
		},
	],
	'British Columbia': [
		{
			name: 'Kelowna',
			slug: 'kelowna--british-columbia',
			id: 'clodun45s0002puvv58n0tf52',
		},
		{
			name: 'Victoria',
			slug: 'victoria--british-columbia',
			id: 'clodun45x0007puvv7jjia9he',
		},
		{
			name: 'Vancouver',
			slug: 'vancouver--british-columbia',
			id: 'clodun460000apuvvt338vzlm',
		},
		{
			name: 'Burnaby',
			slug: 'burnaby--british-columbia',
			id: 'clodun462000cpuvvfat9yprd',
		},
		{
			name: 'Surrey',
			slug: 'surrey--british-columbia',
			id: 'clodun468000ipuvvndmzzsx5',
		},
	],
	Manitoba: [
		{
			name: 'Winnipeg',
			slug: 'winnipeg--manitoba',
			id: 'clodun45t0003puvvr6g51zzi',
		},
		{
			name: 'Brandon',
			slug: 'brandon--manitoba',
			id: 'clodun45v0005puvvy5or883f',
		},
		{
			name: 'Thompson',
			slug: 'thompson--manitoba',
			id: 'clodun463000dpuvvh65vxkx2',
		},
		{
			name: 'Selkirk',
			slug: 'selkirk--manitoba',
			id: 'clodun46a000kpuvvdjaj45ox',
		},
	],
	'New Brunswick': [
		{
			name: 'Fredericton',
			slug: 'fredericton--new-brunswick',
			id: 'clodun45y0008puvv525bt6qh',
		},
		{
			name: 'Miramichi',
			slug: 'miramichi--new-brunswick',
			id: 'clodun461000bpuvvb280fzqe',
		},
		{
			name: 'Saint John',
			slug: 'saint-john--new-brunswick',
			id: 'clodun46i000spuvvwdyzzzox',
		},
		{
			name: 'Moncton',
			slug: 'moncton--new-brunswick',
			id: 'clodun46p000zpuvvqms1hiix',
		},
	],
	'Newfoundland and Labrador': [
		{
			name: 'Corner Brook',
			slug: 'corner-brook--newfoundland-and labrador',
			id: 'clodun464000epuvvjzal0git',
		},
		{
			name: "St. John's",
			slug: "st.-john's--newfoundland-and labrador",
			id: 'clodun465000fpuvvp744cc0h',
		},
		{
			name: 'Mount Pearl',
			slug: 'mount-pearl--newfoundland-and labrador',
			id: 'clodun467000hpuvvcjzujtls',
		},
		{
			name: 'Grand Falls-Windsor',
			slug: 'grand-falls-windsor--newfoundland-and labrador',
			id: 'clodun46b000lpuvvxv0iiywe',
		},
	],
	'Nova Scotia': [
		{
			name: 'Sydney',
			slug: 'sydney--nova-scotia',
			id: 'clodun466000gpuvv6btli89d',
		},
		{
			name: 'Truro',
			slug: 'truro--nova-scotia',
			id: 'clodun469000jpuvv4eivd094',
		},
		{
			name: 'Halifax',
			slug: 'halifax--nova-scotia',
			id: 'clodun46g000qpuvvdp5entv2',
		},
		{
			name: 'Dartmouth',
			slug: 'dartmouth--nova-scotia',
			id: 'clodun46l000vpuvvogfb5tdx',
		},
	],
	Ontario: [
		{
			name: 'Ottawa',
			slug: 'ottawa--ontario',
			id: 'clodun46c000mpuvv3wn2qp9c',
		},
		{
			name: 'Toronto',
			slug: 'toronto--ontario',
			id: 'clodun46d000npuvvsyv5ak3o',
		},
		{
			name: 'Hamilton',
			slug: 'hamilton--ontario',
			id: 'clodun46e000opuvvyuywksqz',
		},
		{
			name: 'Mississauga',
			slug: 'mississauga--ontario',
			id: 'clodun46f000ppuvvp0drvhgw',
		},
		{
			name: 'Brampton',
			slug: 'brampton--ontario',
			id: 'clodun46j000tpuvv1h79chwp',
		},
	],
	'Prince Edward Island': [
		{
			name: 'Stratford',
			slug: 'stratford--prince-edward island',
			id: 'clodun46h000rpuvvmw54hwg1',
		},
		{
			name: 'Cornwall',
			slug: 'cornwall--prince-edward island',
			id: 'clodun46k000upuvvoj6dmxdq',
		},
		{
			name: 'Charlottetown',
			slug: 'charlottetown--prince-edward island',
			id: 'clodun46m000wpuvvp5cnqfx1',
		},
		{
			name: 'Summerside',
			slug: 'summerside--prince-edward island',
			id: 'clodun46u0013puvvrhy71uw7',
		},
	],
	Quebec: [
		{
			name: 'Quebec City',
			slug: 'quebec-city--quebec',
			id: 'clodun46n000xpuvvl7xfxa08',
		},
		{
			name: 'Montreal',
			slug: 'montreal--quebec',
			id: 'clodun46o000ypuvvxpmd0ioa',
		},
		{
			name: 'Laval',
			slug: 'laval--quebec',
			id: 'clodun46q0010puvvt07oku7a',
		},
		{
			name: 'Gatineau',
			slug: 'gatineau--quebec',
			id: 'clodun46s0012puvv3iss1x38',
		},
		{
			name: 'Sherbrooke',
			slug: 'sherbrooke--quebec',
			id: 'clodun46y0017puvv9t9vsr8o',
		},
	],
	Saskatchewan: [
		{
			name: 'Regina',
			slug: 'regina--saskatchewan',
			id: 'clodun46r0011puvvvzelfvxv',
		},
		{
			name: 'Swift Current',
			slug: 'swift-current--saskatchewan',
			id: 'clodun46v0014puvvik0qy842',
		},
		{
			name: 'Saskatoon',
			slug: 'saskatoon--saskatchewan',
			id: 'clodun46w0015puvv1bu4faql',
		},
		{
			name: 'Prince Albert',
			slug: 'prince-albert--saskatchewan',
			id: 'clodun46x0016puvvieboe7il',
		},
		{
			name: 'Moose Jaw',
			slug: 'moose-jaw--saskatchewan',
			id: 'clodun474001epuvvc4svq7gh',
		},
	],
	'Northwest Territories': [
		{
			name: 'Yellowknife',
			slug: 'yellowknife--northwest-territories',
			id: 'clodun46z0018puvvb450elym',
		},
		{
			name: 'Inuvik',
			slug: 'inuvik--northwest-territories',
			id: 'clodun4700019puvvgki8mk40',
		},
		{
			name: 'Hay River',
			slug: 'hay-river--northwest-territories',
			id: 'clodun471001apuvvg8jlqgu5',
		},
		{
			name: 'Fort Smith',
			slug: 'fort-smith--northwest-territories',
			id: 'clodun473001dpuvv228mhv2k',
		},
	],
	Nunavut: [
		{
			name: 'Iqaluit',
			slug: 'iqaluit--nunavut',
			id: 'clodun472001bpuvvqiiyv3ef',
		},
		{
			name: 'Rankin Inlet',
			slug: 'rankin-inlet--nunavut',
			id: 'clodun472001cpuvvi12qql5g',
		},
		{
			name: 'Baker Lake',
			slug: 'baker-lake--nunavut',
			id: 'clodun476001gpuvv4hfw8tos',
		},
		{
			name: 'Arviat',
			slug: 'arviat--nunavut',
			id: 'clodun477001hpuvvyvconkr4',
		},
	],
	Yukon: [
		{
			name: 'Whitehorse',
			slug: 'whitehorse--yukon',
			id: 'clodun475001fpuvvyttqvg59',
		},
		{
			name: 'Carcross',
			slug: 'carcross--yukon',
			id: 'clodun478001ipuvvhabknxsf',
		},
		{
			name: 'Dawson City',
			slug: 'dawson-city--yukon',
			id: 'clodun47a001jpuvv7nymba92',
		},
		{
			name: 'Watson Lake',
			slug: 'watson-lake--yukon',
			id: 'clodun47b001kpuvv9c1efy59',
		},
	],
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No nlistign with the id "{params.listingId}" exists</p>
				),
			}}
		/>
	)
}