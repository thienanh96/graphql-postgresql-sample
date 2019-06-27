const { transformation } = require('../utils');
const { statusMapping } = transformation
module.exports = {
    Folder: {
        id: ({ id = null }) => id,
        description: ({ description = null }) => description,
        name: ({ name = null }) => name,
        thumbnailUrl: ({ thumbnailUrl = null }) => thumbnailUrl,
        parentId: ({ parentId = 0 }) => parentId,
        status: ({ statusId = 0 }) => {
            return statusMapping(statusId)
        },
        createdDate: ({ createdDate = null }) => createdDate,
        modifiedDate: ({ modifiedDate = null }) => modifiedDate,
        modifiedBy: ({ modifiedBy = null }) => modifiedBy,
        deletedDate: ({ deletedDate = null }) => deletedDate,
        user: async ({ userId }, args, { dataSources }, { }) => {
            const user = await dataSources.user.getUser(userId);
            return user
        }
    }
}