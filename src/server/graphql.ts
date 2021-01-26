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
import chalk from 'chalk'

import { setContext } from 'apollo-link-context'
import { createHttpLink } from 'apollo-link-http'

import { parse } from 'cookie'
import { fetch } from 'cross-fetch'

const httpLink = createHttpLink({
  uri: 'https://graphql.fauna.com/graphql',
  fetch: fetch,
  credentials: 'include'
})

// setContext links runs before any remote request by `delegateToSchema`
/* `setContext` runs before any remote request by `delegateToSchema`,
this is due to `contextlink.concat`.
In other words, it runs before delegating to Fauna.
In general, this function is in charge of deciding which token to use
in the headers, the public one or the one from the user. For example,
during login or signup it will always default to the public token
because it will not find any token in the headers from `previousContext` */
const authLink = setContext((_, previousContext) => {
  console.log(chalk.gray('⚙️  ') + chalk.cyan('schema -- setContext'));
  let token = process.env.FAUNADB_PUBLIC_KEY; // public token
  const headers = {...previousContext.graphqlContext.headers};
  if (headers.cookie) {
    const parsedCookie = parse(headers.cookie);
    const customCookie = parsedCookie['fauna-token'];
    if (customCookie) {
      console.log(
        '   schema -- setContext -- Found custom cookie. Re-setting headers with it.'
      );
      token = customCookie;
    }
  }
  else {
    console.log(
      '   schema -- setContext -- Setting headers with default public token.'
    );
  }
  /**
   * Add token as `Authorization: Bearer abcdef123` header.
   */
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
});

/* Then we finally create the link to use to handle the remote schemas */
const link = authLink.concat(httpLink)

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
  /* `createOverrideResolvers` helps, as it names implies,
  to override UDFs present in Fauna Graphql endpoint.
  These overrides will run before hitting Fauna's servers. 
  Refer back to setContext for the function that sets
  the headers before connecting to Fauna. */
  resolvers: createOverrideResolvers(remoteExecutableSchema),
})

// *****************************************************************************
// 5) Run the server
// *****************************************************************************

console.log('creating server')

const server = new ApolloServer({
  schema,
  plugins: [httpHeadersPlugin],
  context: ({ event, context }) => {
    return {
      event,
      context,
      setCookies: [],
      setHeaders: [],
    }
  },
})

export const handler = server.createHandler()
