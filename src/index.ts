import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { applyMiddleware } from "graphql-middleware";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express from "express";
import http from "http";
import cors from "cors";
import bodyParser from "body-parser";

import shield from "./schema/shield.js";
import resolvers from "./schema/resolvers/mergeResolvers.js";
import typeDefs from "./schema/typeDefs/mergeTypeDefs.js";
import { getUserFromRequest } from "./auth.js";

interface Context {
  isAuthenticated?: boolean;
  token?: string;
  user?: any;
}

// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
// Below, we tell Apollo Server to "drain" this httpServer,
// enabling our servers to shut down gracefully.
const httpServer = http.createServer(app);

// shield the schema
const schema = makeExecutableSchema({ typeDefs, resolvers });
const schemaWithPermissions = applyMiddleware(schema, shield);

// Same ApolloServer initialization as before, plus the drain plugin
// for our httpServer.
const server = new ApolloServer<Context>({
  schema: schemaWithPermissions,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
// Ensure we wait for our server to start
await server.start();

// Set up our Express middleware to handle CORS, body parsing,
// and our expressMiddleware function.
app.use(
  "/graphql",
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  // expressMiddleware accepts the same arguments:
  // an Apollo Server instance and optional configuration options
  expressMiddleware(server, {
    context: async ({ req }) => ({ 
      token: req.headers?.token,
      user: getUserFromRequest(req),
    }),
  })
);

// Modified server startup
await new Promise<void>((resolve) =>
  httpServer.listen({ port: 4000, host: '0.0.0.0' }, resolve)
);
console.log(`🚀 Server ready at http://localhost:4000/graphql`);
