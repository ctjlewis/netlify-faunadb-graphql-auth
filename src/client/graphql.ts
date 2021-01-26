import { ApolloClient, ApolloLink, from, HttpLink, InMemoryCache } from '@apollo/client'
import { setContext } from '@apollo/link-context'
import { parse } from 'cookie'

console.log('Initializing Apollo Client')

const cache = new InMemoryCache()
const httpLink = new HttpLink({
  /** Interface with compiled Apollo server. */
  uri: '/.netlify/functions/graphql',
  /** Same-Origin only for Apollo Client. */
  credentials: 'same-origin'
})

const withCookie = setContext((_, previousContext) => {
  let token = process.env.FAUNADB_PUBLIC_KEY // public token
  // const event = previousContext.graphqlContext.event

  console.log('CLIENT', { previousContext })
  return {}
})

// const authMiddleware = new ApolloLink((operation, forward) => {
//   console.log({ operation })
//   operation.setContext({
//     headers: {
//       authorization: localStorage.getItem('token') || null
//     }
//   })

//   return forward(operation)
// })

export const client = new ApolloClient({
  cache,
  link: httpLink,
})
