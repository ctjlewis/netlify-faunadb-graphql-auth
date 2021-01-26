import * as faunadb from 'faunadb'
import { gql } from 'apollo-server-lambda'
import { parse } from 'cookie'
import { Context } from '@apollo/client'

const q = faunadb.query

export const overrideTypeDefs = gql`
  input LoginInput {
    email: String!
    password: String!
  }

  type Mutation {
    login(data: LoginInput): Boolean!
  }
`

export const createOverrideResolvers = (remoteExecutableSchema) => ({
  Mutation: {
    login: async (root, args, context: Context, info) => {
      console.log('*** OVERRIDE mutation login')
      // console.log(context.event);

      const event = context.event || {};
      const headers = event.headers || {};
      /**
       * If there's no cookie header, set an empty cookie
       */
      if (!headers.cookie) {
        // console.log('No cookie header');
        // context.setCookies.push({
        //   name: 'fauna-token',
        //   value: '',
        //   options: {
        //     httpOnly: true,
        //     expires: new Date(),
        //   },
        // })
      }

      // short circuit if cookie exists
      else {
        const parsedCookie = parse(context.event.headers.cookie)
        const cookieSecret = parsedCookie['fauna-token']
        const userClient = new faunadb.Client({
          secret: cookieSecret,
        })
        const alreadyLoggedIn = await userClient
          .query(q.Get(q.CurrentIdentity()))
          .then((response: { message: string; data: { email: string } }) => {
            if (!response.message) {
              if (args.data && args.data.email && response.data.email) {
                // TODO trying to log in as someone else besides cookie holder.
                // should probably log them out first!
                return response.data.email === args.data.email
              } else {
                // did not provide credentials so just use the cookie values
                return true
              }
            }
            return false
          })
          .catch((e) => {
            console.log('error: bad cookie secret')
            console.trace(e)
            return false
          })

        if (alreadyLoggedIn) {
          return true
        } else {
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
        return false
      }

      if (!args.data || !args.data.email) {
        return false
      }

      const result = await info.mergeInfo.delegateToSchema({
        schema: remoteExecutableSchema,
        operation: 'mutation',
        fieldName: 'login',
        args,
        context,
        info,
      })
      if (result) {
        console.log('process.env.NODE_ENV', process.env.NODE_ENV)
        context.setCookies.push({
          name: 'fauna-token',
          value: result,
          options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
          },
        })
        return true
      }
      return false
    },
    logout: async (root, args, context, info) => {
      console.log('*** OVERRIDE mutation logout')

      // short circuit if NO cookie exists
      if (!context.event.headers.cookie) {
        return true
      }

      await info.mergeInfo
        .delegateToSchema({
          schema: remoteExecutableSchema,
          operation: 'mutation',
          fieldName: 'logout',
          args,
          context,
          info,
        })
        .catch((e) => console.trace(e))

      // kill the cookie
      context.setCookies.push({
        name: 'fauna-token',
        value: '',
        options: {
          httpOnly: true,
          expires: new Date(),
        },
      })

      return true
    },
  },
})
