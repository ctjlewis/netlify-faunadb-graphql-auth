/**
 * Load custom types and module declarations, styles.
 */
import './assets'
import './style.css'

import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

import { client } from '../graphql'
import { ApolloProvider } from '@apollo/client'

const Root = () => (
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
)

ReactDOM.render(<Root />, document.getElementById('root'))
