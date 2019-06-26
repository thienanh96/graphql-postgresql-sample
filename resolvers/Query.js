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
            const folderName = input.name ? input.name : null
            const folders = await dataSources.folder.getFoldersByName(folderName);
            return folders
        }
    }
}
