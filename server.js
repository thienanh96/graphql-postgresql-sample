const fs = require('fs');
const { ApolloServer, gql } = require('apollo-server');



const schemaGraphql = fs.readFileSync('schema.graphql').toString()
const indexResolver = require('./resolvers')
const { UserSource, FolderSource } = require('./data/source')


const typeDefs = gql`${schemaGraphql}`;


// In the most basic sense, the ApolloServer can be started
// by passing type definitions (typeDefs) and the resolvers
// responsible for fetching the data for those types.
const server = new ApolloServer(
  {
    typeDefs,
    resolvers: indexResolver,
    dataSources: () => {
      return {
        user: new UserSource(),
        folder: new FolderSource()
      };
    },
  }
);

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});