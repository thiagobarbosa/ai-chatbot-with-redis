import { compare } from 'bcrypt-ts'
import NextAuth, { Session, User } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

import { authConfig } from '@/app/(auth)/auth.config'
import { getUser } from '@/db/queries'

interface ExtendedSession extends Session {
  user: User;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        let users = await getUser(email)
        if (!users) return null
        let passwordsMatch = await compare(password, users.password!)
        if (passwordsMatch) return users as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      return token
    },
    async session({
      session,
      token,
    }: {
      session: ExtendedSession;
      token: any;
    }) {
      if (session.user) {
        session.user.id = token.id as string
      }

      return session
    },
  },
})
