import userTypeDefs from "./user/schema/user-schema.js";
import userResolver from "./user/resolvers/user-resolver.js"

const typeDef = [userTypeDefs]
const resolver = [userResolver]
export default {typeDef, resolver};