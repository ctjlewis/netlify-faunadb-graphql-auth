import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

console.log('Initializing Apollo Client')

const cache = new InMemoryCache()
const link = new HttpLink({
  uri: '/.netlify/functions/graphql',
  headers: {
    testing1234: 'test',
  },
})

export const client = new ApolloClient({
  cache,
  link,
})
