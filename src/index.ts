import express from 'express';
import cors from 'cors';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import graphqlDef from './graphql/index.js';
import configLoader from './configs/config-loader.js';

interface IBaseContext {
    token?: string;
}

const PORT = configLoader.config.PORT || 10000;
const app = express();
const httpServer = http.createServer(app);
const server = new ApolloServer<IBaseContext>({
    typeDefs: graphqlDef.typeDef,
    resolvers: graphqlDef.resolver,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
});

await server.start();

app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server),
);

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});