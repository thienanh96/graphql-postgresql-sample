const QueryResolver = require('./Query');
const UserResolver = require('./User');
const FolderResolver = require('./Folder');
const MutationResolver = require('./Mutation');
module.exports = {
    ...QueryResolver,
    ...UserResolver,
    ...FolderResolver,
    ...MutationResolver
}