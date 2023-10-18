import { faker } from '@faker-js/faker'
import { promiseHash } from 'remix-utils'
import { prisma } from '#app/utils/db.server.ts'
import {
	cleanupDb,
	createPassword,
	createUser,
	getNoteImages,
	getUserImages,
	img,
} from '#tests/db-utils.ts'
import { insertGitHubUser } from '#tests/mocks/github.ts'

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	await cleanupDb(prisma)
	console.timeEnd('🧹 Cleaned up the database...')

	console.time('🔑 Created permissions...')
	const entities = ['user', 'note']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				await prisma.permission.create({ data: { entity, action, access } })
			}
		}
	}
	console.timeEnd('🔑 Created permissions...')

	console.time('👑 Created roles...')
	await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'any' },
				}),
			},
		},
	})
	await prisma.role.create({
		data: {
			name: 'user',
			permissions: {
				connect: await prisma.permission.findMany({
					select: { id: true },
					where: { access: 'own' },
				}),
			},
		},
	})
	console.timeEnd('👑 Created roles...')

	if (process.env.MINIMAL_SEED) {
		console.log('👍 Minimal seed complete')
		console.timeEnd(`🌱 Database has been seeded`)
		return
	}

	const totalUsers = 5
	console.time(`👤 Created ${totalUsers} users...`)
	const noteImages = await getNoteImages()
	const userImages = await getUserImages()

	for (let index = 0; index < totalUsers; index++) {
		const userData = createUser()
		await prisma.user
			.create({
				select: { id: true },
				data: {
					...userData,
					password: { create: createPassword(userData.username) },
					image: { create: userImages[index % userImages.length] },
					roles: { connect: { name: 'user' } },
					notes: {
						create: Array.from({
							length: faker.number.int({ min: 1, max: 3 }),
						}).map(() => ({
							title: faker.lorem.sentence(),
							content: faker.lorem.paragraphs(),
							images: {
								create: Array.from({
									length: faker.number.int({ min: 1, max: 3 }),
								}).map(() => {
									const imgNumber = faker.number.int({ min: 0, max: 9 })
									return noteImages[imgNumber]
								}),
							},
						})),
					},
				},
			})
			.catch(e => {
				console.error('Error creating a user:', e)
				return null
			})
	}
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	console.time(`🐨 Created admin user "kody"`)

	const kodyImages = await promiseHash({
		kodyUser: img({ filepath: './tests/fixtures/images/user/kody.png' }),
		cuteKoala: img({
			altText: 'an adorable koala cartoon illustration',
			filepath: './tests/fixtures/images/kody-notes/cute-koala.png',
		}),
		koalaEating: img({
			altText: 'a cartoon illustration of a koala in a tree eating',
			filepath: './tests/fixtures/images/kody-notes/koala-eating.png',
		}),
		koalaCuddle: img({
			altText: 'a cartoon illustration of koalas cuddling',
			filepath: './tests/fixtures/images/kody-notes/koala-cuddle.png',
		}),
		mountain: img({
			altText: 'a beautiful mountain covered in snow',
			filepath: './tests/fixtures/images/kody-notes/mountain.png',
		}),
		koalaCoder: img({
			altText: 'a koala coding at the computer',
			filepath: './tests/fixtures/images/kody-notes/koala-coder.png',
		}),
		koalaMentor: img({
			altText:
				'a koala in a friendly and helpful posture. The Koala is standing next to and teaching a woman who is coding on a computer and shows positive signs of learning and understanding what is being explained.',
			filepath: './tests/fixtures/images/kody-notes/koala-mentor.png',
		}),
		koalaSoccer: img({
			altText: 'a cute cartoon koala kicking a soccer ball on a soccer field ',
			filepath: './tests/fixtures/images/kody-notes/koala-soccer.png',
		}),
	})

	const githubUser = await insertGitHubUser('MOCK_CODE_GITHUB_KODY')

	await prisma.user.create({
		select: { id: true },
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			name: 'Kody',
			image: { create: kodyImages.kodyUser },
			password: { create: createPassword('kodylovesyou') },
			connections: {
				create: { providerName: 'github', providerId: githubUser.profile.id },
			},
			roles: { connect: [{ name: 'admin' }, { name: 'user' }] },
			notes: {
				create: [
					{
						id: 'd27a197e',
						title: 'Basic Koala Facts',
						content:
							'Koalas are found in the eucalyptus forests of eastern Australia. They have grey fur with a cream-coloured chest, and strong, clawed feet, perfect for living in the branches of trees!',
						images: { create: [kodyImages.cuteKoala, kodyImages.koalaEating] },
					},
					{
						id: '414f0c09',
						title: 'Koalas like to cuddle',
						content:
							'Cuddly critters, koalas measure about 60cm to 85cm long, and weigh about 14kg.',
						images: {
							create: [kodyImages.koalaCuddle],
						},
					},
					{
						id: '260366b1',
						title: 'Not bears',
						content:
							"Although you may have heard people call them koala 'bears', these awesome animals aren’t bears at all – they are in fact marsupials. A group of mammals, most marsupials have pouches where their newborns develop.",
					},
					{
						id: 'bb79cf45',
						title: 'Snowboarding Adventure',
						content:
							"Today was an epic day on the slopes! Shredded fresh powder with my friends, caught some sick air, and even attempted a backflip. Can't wait for the next snowy adventure!",
						images: {
							create: [kodyImages.mountain],
						},
					},
					{
						id: '9f4308be',
						title: 'Onewheel Tricks',
						content:
							"Mastered a new trick on my Onewheel today called '180 Spin'. It's exhilarating to carve through the streets while pulling off these rad moves. Time to level up and learn more!",
					},
					{
						id: '306021fb',
						title: 'Coding Dilemma',
						content:
							"Stuck on a bug in my latest coding project. Need to figure out why my function isn't returning the expected output. Time to dig deep, debug, and conquer this challenge!",
						images: {
							create: [kodyImages.koalaCoder],
						},
					},
					{
						id: '16d4912a',
						title: 'Coding Mentorship',
						content:
							"Had a fantastic coding mentoring session today with Sarah. Helped her understand the concept of recursion, and she made great progress. It's incredibly fulfilling to help others improve their coding skills.",
						images: {
							create: [kodyImages.koalaMentor],
						},
					},
					{
						id: '3199199e',
						title: 'Koala Fun Facts',
						content:
							"Did you know that koalas sleep for up to 20 hours a day? It's because their diet of eucalyptus leaves doesn't provide much energy. But when I'm awake, I enjoy munching on leaves, chilling in trees, and being the cuddliest koala around!",
					},
					{
						id: '2030ffd3',
						title: 'Skiing Adventure',
						content:
							'Spent the day hitting the slopes on my skis. The fresh powder made for some incredible runs and breathtaking views. Skiing down the mountain at top speed is an adrenaline rush like no other!',
						images: {
							create: [kodyImages.mountain],
						},
					},
					{
						id: 'f375a804',
						title: 'Code Jam Success',
						content:
							'Participated in a coding competition today and secured the first place! The adrenaline, the challenging problems, and the satisfaction of finding optimal solutions—it was an amazing experience. Feeling proud and motivated to keep pushing my coding skills further!',
						images: {
							create: [kodyImages.koalaCoder],
						},
					},
					{
						id: '562c541b',
						title: 'Koala Conservation Efforts',
						content:
							"Joined a local conservation group to protect koalas and their habitats. Together, we're planting more eucalyptus trees, raising awareness about their endangered status, and working towards a sustainable future for these adorable creatures. Every small step counts!",
					},
					// extra long note to test scrolling
					{
						id: 'f67ca40b',
						title: 'Game day',
						content:
							"Just got back from the most amazing game. I've been playing soccer for a long time, but I've not once scored a goal. Well, today all that changed! I finally scored my first ever goal.\n\nI'm in an indoor league, and my team's not the best, but we're pretty good and I have fun, that's all that really matters. Anyway, I found myself at the other end of the field with the ball. It was just me and the goalie. I normally just kick the ball and hope it goes in, but the ball was already rolling toward the goal. The goalie was about to get the ball, so I had to charge. I managed to get possession of the ball just before the goalie got it. I brought it around the goalie and had a perfect shot. I screamed so loud in excitement. After all these years playing, I finally scored a goal!\n\nI know it's not a lot for most folks, but it meant a lot to me. We did end up winning the game by one. It makes me feel great that I had a part to play in that.\n\nIn this team, I'm the captain. I'm constantly cheering my team on. Even after getting injured, I continued to come and watch from the side-lines. I enjoy yelling (encouragingly) at my team mates and helping them be the best they can. I'm definitely not the best player by a long stretch. But I really enjoy the game. It's a great way to get exercise and have good social interactions once a week.\n\nThat said, it can be hard to keep people coming and paying dues and stuff. If people don't show up it can be really hard to find subs. I have a list of people I can text, but sometimes I can't find anyone.\n\nBut yeah, today was awesome. I felt like more than just a player that gets in the way of the opposition, but an actual asset to the team. Really great feeling.\n\nAnyway, I'm rambling at this point and really this is just so we can have a note that's pretty long to test things out. I think it's long enough now... Cheers!",
						images: {
							create: [kodyImages.koalaSoccer],
						},
					},
				],
			},
		},
	})
	console.timeEnd(`🐨 Created admin user "kody"`)

	console.time('Created Listing Categories')
	const listingCategories = [
		{
			title: 'Houses for Rent',
			slug: 'houses-for-rent',
			description:
				'Find a wide selection of houses available for rent. Browse through listings and choose the perfect house for your needs and budget.',
		},
		{
			title: 'Condos for Rent',
			slug: 'condos-for-rent',
			description:
				'Discover condominiums available for rent in your preferred location. Explore a range of options for your next home.',
		},
		{
			title: 'Moving',
			slug: 'moving',
			description:
				'Get assistance for your moving needs, from professional movers to packing services. Make your relocation hassle-free.',
		},
		{
			title: 'Plumbing',
			slug: 'plumbing',
			description:
				"Find reliable plumbers for all your plumbing needs. From repairs to installations, we've got you covered.",
		},
		{
			title: 'Landscaping',
			slug: 'landscaping',
			description:
				'Enhance the beauty of your outdoor space with landscaping services. Create a stunning garden or maintain your existing one.',
		},
		{
			title: 'Rooms to Share',
			slug: 'rooms-to-share',
			description:
				'Explore shared living arrangements with available rooms for rent. Save on housing costs by sharing a space with others.',
		},
		{
			title: 'Houses for Sale',
			slug: 'houses-for-sale',
			description:
				'Search for your dream home among a variety of houses available for sale. Find the perfect property to call your own.',
		},
		{
			title: 'Carpet Cleaning',
			slug: 'carpet-cleaning',
			description:
				'Revitalize your carpets with professional cleaning services. Remove stains and allergens to ensure a clean and healthy home.',
		},
		{
			title: 'Cars for Sale',
			slug: 'cars-for-sale',
			description:
				'Browse a selection of cars for sale from private sellers and dealerships. Find your ideal vehicle within your budget.',
		},
		{
			title: 'Tutorial & Training',
			slug: 'tutorial-training',
			description:
				'Access educational resources and training opportunities in various subjects. Learn and develop new skills for personal and professional growth.',
		},
		{
			title: 'Business Opportunities',
			slug: 'business-opportunities',
			description:
				'Explore business opportunities and investments to start or expand your entrepreneurial journey. Find the right venture for you.',
		},
		{
			title: 'Financing - Investments',
			slug: 'financing-investments',
			description:
				'Discover financial and investment services to help you grow your wealth. Plan for the future and secure your financial well-being.',
		},
		{
			title: 'Employment',
			slug: 'employment',
			description:
				'Find job listings and career opportunities in various industries. Start or advance your career with the right job.',
		},
		{
			title: 'Health & Beauty',
			slug: 'health-beauty',
			description:
				'Access health and beauty services to enhance your well-being. From salons to wellness centers, pamper yourself and stay healthy.',
		},
		{
			title: 'Domestic Assistance',
			slug: 'domestic-assistance',
			description:
				'Get assistance with domestic chores and tasks. Find reliable helpers for cleaning, cooking, and other household needs.',
		},
		{
			title: 'Manufacturing Jobs',
			slug: 'manufacturing-jobs',
			description:
				'Search for manufacturing and production job opportunities. Start or advance your career in the manufacturing industry.',
		},
		{
			title: 'Hair - Nail Jobs',
			slug: 'hair-nail-jobs',
			description:
				'Explore job opportunities in the beauty industry, from hairstyling to nail care. Find your next career in the world of beauty.',
		},
		{
			title: 'Office - Clerical Jobs',
			slug: 'office-clerical-jobs',
			description:
				'Discover administrative and clerical job openings in various office settings. Start your career in an office environment.',
		},
		{
			title: 'Services',
			slug: 'services',
			description:
				'Find a wide range of services for your personal and professional needs. Connect with service providers to get the job done.',
		},
		{
			title: 'Child Care',
			slug: 'child-care',
			description:
				'Find reliable child care services, including babysitters, daycares, and nannies. Ensure the safety and well-being of your children.',
		},
		{
			title: 'Travel',
			slug: 'travel',
			description:
				'Plan your next adventure with travel services and resources. Explore destinations, book flights, and make your travel dreams come true.',
		},
		{
			title: 'Auto Repair',
			slug: 'auto-repair',
			description:
				'Get your vehicle back on the road with professional auto repair services. Address car issues and keep your vehicle in top condition.',
		},
		{
			title: 'Free Stuff',
			slug: 'free-stuff',
			description:
				'Discover free items and giveaways from generous individuals and organizations. Get free stuff and reduce waste.',
		},
	]

	for (const { title, slug, description } of listingCategories) {
		await prisma.listingCategory.create({ data: { title, slug, description } })
	}

	console.timeEnd('Created Listing Categories')

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
