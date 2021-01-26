import * as faunadb from 'faunadb'
import { gql } from 'apollo-server-lambda'
import { parse } from 'cookie'

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
        console.log('Cookie found. Connecting to FaunaDB.')
        const parsedCookie = parse(context.event.headers.cookie)
        const cookieSecret = parsedCookie['fauna-token']
        const userClient = new faunadb.Client({
          secret: cookieSecret,
        })
        result = await userClient
          .query(q.Get(q.CurrentIdentity()))
          .then((response: { message: any }) => {
            if (!response.message) return !!response
            return false
          })
          .catch((e) => {
            return false
          })

        if (!result) {
          console.log('No result found. Clearing cookie.')
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

      return result
    },
  },
}
