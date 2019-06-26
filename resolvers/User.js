const { statusMapping } = require('../utils')
module.exports = {
    User: {
        id: ({ userId = null }) => userId,
        firstName: ({ firstName = null }) => firstName,
        lastName: ({ lastName = null }) => lastName,
        userName: ({ userName = null }) => userName,
        details: ({ details = null }) => details,
        birthDay: ({ birthDay = null }) => birthDay,
        password: ({ password = null }) => password,
        thumbnailUrl: ({ thumbnailUrl = null }) => thumbnailUrl,
        status: ({ statusId = 0 }) => {
            return statusMapping(statusId)
        },
        lastLoggedIn: ({ lastLoggedIn = null }) => lastLoggedIn,
        dateCreated: ({ dateCreated = null }) => dateCreated,
        dateModified: ({ dateModified = null }) => dateModified,
        dateDeleted: ({ dateDeleted = null }) => dateDeleted,
        modifiesBy: ({ modifiesBy = null }) => modifiesBy,
        folders: async ({ userId }, args, { dataSources }, { }) => {
            const folders = await dataSources.folder.getFoldersByUser(userId)
            return folders
        }
    }
}