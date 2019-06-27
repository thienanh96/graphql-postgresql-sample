module.exports = {
    Query: {
        user: async (parent, { id = null }, { dataSources }, info) => {
            const user = await dataSources.user.getUser(id);
            if (user) {
                return user
            }
            return {}

        },
        users: async (parent, args, { dataSources }, info) => {
            const users = await dataSources.user.getUsers();
            return users
        },
        folder: async (parent, { id = null }, { dataSources }, info) => {
            const folder = await dataSources.folder.getFolderById(id);
            if (folder) {
                return folder
            }
            return {}
        },
        folders: async (parent, { input = {} }, { dataSources }, info) => {
            const { name, parentId, userId } = input
            const folders = await dataSources.folder.getFolders({ name, parentId, userId });
            return folders
        }
    }
}
