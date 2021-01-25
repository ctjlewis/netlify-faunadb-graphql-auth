import { gql } from 'apollo-server-lambda'
import cookie from 'cookie'
import * as faunadb from 'faunadb'

const q = faunadb.query

export const localTypeDefs = gql`
  type Query {
    loggedIn: Boolean!
  }
`

export const localResolvers = {
  Query: {
    loggedIn: async (root, args, context) => {
      console.log('LOCAL query loggedIn')
      let result = false

      if (context.event.headers.cookie) {
        const parsedCookie = cookie.parse(context.event.headers.cookie)
        const cookieSecret = parsedCookie['fauna-token']
        const userClient = new faunadb.Client({
          secret: cookieSecret,
        })
        result = await userClient
          .query(q.Get(q.Identity()))
          .then((response: { [key: string]: any }) => {
            if (!response.message) return !!response
            return false
          })
          .catch((e) => {
            return false
          })

        if (!result) {
          // kill the cookie
          context.setCookies.push({
            name: 'fauna-token',
            value: '',
            options: {
              httpOnly: true,
              expires: new Date(),
            },
          })
        }
      }

      return new Promise((resolve) => {
        setTimeout(resolve, 800)
      }).then(() => result)
    },
  },
}
