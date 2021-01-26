import { ApolloClient, ApolloLink, from, HttpLink, InMemoryCache } from '@apollo/client'
console.log('Initializing Apollo Client')

const cache = new InMemoryCache()
const httpLink = new HttpLink({
  /** Interface with compiled Apollo server. */
  uri: '/.netlify/functions/graphql',
  /** Same-Origin only for Apollo Client. */
  credentials: 'same-origin'
})

export const client = new ApolloClient({
  cache,
  link: httpLink,
})
