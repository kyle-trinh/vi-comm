import { createId as cuid } from '@paralleldrive/cuid2'
import { redirect } from '@remix-run/node'
import { GoogleStrategy } from 'remix-auth-google'
import { connectionSessionStorage } from '../connections.server.ts'
import { type AuthProvider } from './provider.ts'

const shouldMock = process.env.GOOGLE_CLIENT_ID?.startsWith('MOCK_')

export class GoogleProvider implements AuthProvider {
	getAuthStrategy() {
		return new GoogleStrategy(
			{
				clientID: process.env.GOOGLE_CLIENT_ID,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				callbackURL: '/auth/google/callback',
			},
			async ({ profile }) => {
				const email = profile.emails[0].value.trim().toLowerCase()
				const username = profile.displayName
				const imageUrl = profile.photos[0].value
				return {
					email,
					id: profile.id,
					username,
					name: profile.name.givenName,
					imageUrl,
				}
			},
		)
	}
	async resolveConnectionData(providerId: string) {
		// TODO: Make a fetch request to Google to get the user's name
		// Endpoint: https://www.googleapis.com/userinfo/v2/me
		return {
			displayName: providerId,
			link: null,
		} as const
	}

	async handleMockAction(request: Request) {
		if (!shouldMock) return

		const connectionSession = await connectionSessionStorage.getSession(
			request.headers.get('cookie'),
		)
		const state = cuid()
		connectionSession.set('oauth2:state', state)
		const code = 'MOCK_CODE_GOOGLE_KODY'
		const searchParams = new URLSearchParams({ code, state })
		throw redirect(`/auth/google/callback?${searchParams}`, {
			headers: {
				'set-cookie':
					await connectionSessionStorage.commitSession(connectionSession),
			},
		})
	}
}
