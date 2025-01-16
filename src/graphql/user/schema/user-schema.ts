import { gql } from 'graphql-tag';

const typeDefs = gql`
  type Message {
    id: ID!
    content: String!
    createdAt: String!
  }

  type Query {
    messages: [Message!]!
  }

  type Mutation {
    addMessage(content: String!): Message!
  }
`;

export default typeDefs;