import {
  ApolloServer,

  /* This stuff all comes from graphql-tools
   * Check out these links!
   *   https://www.apollographql.com/docs/graphql-tools/schema-stitching/
   *   https://www.apollographql.com/docs/graphql-tools/remote-schemas/
   * Yes, stitching is depcricated in favor of Federation, but that does not
   * work with FaunaDB yet.
   */
  FilterRootFields,
  mergeSchemas,
  makeExecutableSchema,
  makeRemoteExecutableSchema,
  transformSchema,
} from 'apollo-server-lambda'

import httpHeadersPlugin from 'apollo-server-plugin-http-headers'
import { setContext } from 'apollo-link-context'
import { createHttpLink } from 'apollo-link-http'

import { parse } from 'cookie'
import { fetch } from 'cross-fetch'

const httpLink = createHttpLink({
  uri: 'https://graphql.fauna.com/graphql',
  fetch: fetch,
})

// setContext links runs before any remote request by `delegateToSchema`
const contextlink = setContext((_, previousContext) => {
  let token = process.env.FAUNADB_PUBLIC_KEY // public token
  const event = previousContext.graphqlContext.event
  console.log({ event })

  if (event.headers.cookie) {
    const parsedCookie = parse(event.headers.cookie)
    const cookieSecret = parsedCookie['fauna-token']
    if (cookieSecret) token = cookieSecret
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
})

const link = contextlink.concat(httpLink)

// *****************************************************************************
// 1) Create the remote schema
// *****************************************************************************

/* Having trouble using introspectSchema.  See introspect branch.
 * https://github.com/ptpaterson/netlify-faunadb-graphql-auth/tree/introspect
 * using `netlify dev` to run the local server, the function setup code is run
 * on every request, and I have not confirmed whether or not this is a problem
 * on actual Netlify functions.
 */
// schema was downloaded from fauna and saved to local file.
import { remoteTypeDefs } from './schema/remoteSchema'
const remoteExecutableSchema = makeRemoteExecutableSchema({
  schema: remoteTypeDefs,
  link,
})

// remove root fields that we don't want available to the client
const transformedRemoteSchema = transformSchema(remoteExecutableSchema, [
  new FilterRootFields(
    (operation, rootField) =>
      !['createTodo', 'createUser', 'deleteUser', 'findUserByID'].includes(
        rootField
      )
  ),
])

// *****************************************************************************
// 2) Create a schema for resolvers that are not in the remote schema
// *****************************************************************************

import { localTypeDefs, localResolvers } from './schema/localSchema'
const localExecutableSchema = makeExecutableSchema({
  typeDefs: localTypeDefs,
  resolvers: localResolvers,
})

// *****************************************************************************
// 3) create typedefs and resolvers that override
// *****************************************************************************

import {
  overrideTypeDefs,
  createOverrideResolvers,
} from './schema/overrideSchema'

// *****************************************************************************
// 4) put it all together
// *****************************************************************************

const schema = mergeSchemas({
  schemas: [transformedRemoteSchema, overrideTypeDefs, localExecutableSchema],
  resolvers: createOverrideResolvers(remoteExecutableSchema),
})

// *****************************************************************************
// 5) Run the server
// *****************************************************************************

console.log('creating server')

const server = new ApolloServer({
  schema,
  plugins: [httpHeadersPlugin],
  context: ({ event, context }) => ({
    event,
    context,
    setCookies: [],
    setHeaders: [],
  }),
})

export const handler = server.createHandler()
