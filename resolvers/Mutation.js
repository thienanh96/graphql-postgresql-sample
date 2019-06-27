const { transformation, validation, response } = require('../utils');
const { getFailureResponse } = response;
const { statusMapping } = transformation
const { isEmptyString, isValidEmail, isNotNullOrUndefined } = validation
module.exports = {
    Mutation: {
        createUser: async (parent, { input = {} }, { dataSources }, info) => {
            const { firstName, lastName, status, email, userName } = input;
            if (isNotNullOrUndefined(firstName) && isEmptyString(firstName)) {
                return getFailureResponse(
                    {
                        message: 'firstName must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'firstName'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(lastName) && isEmptyString(lastName)) {
                return getFailureResponse(
                    {
                        message: 'lastName must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'lastName'
                        }
                    }
                );
            }
            if (isEmptyString(userName)) {
                return getFailureResponse(
                    {
                        message: 'userName must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'userName'
                        }
                    }
                );
            }
            if (!isValidEmail(email)) {
                return getFailureResponse(
                    {
                        message: 'email is not valid',
                        code: 400,
                        properties: {
                            fieldName: 'email'
                        }
                    }
                )
            }
            const statusId = statusMapping(status, 2); // get status integer value from enum string
            const user = await dataSources.user.createUser({ ...input, statusId })
            return user
        },
        updateUser: async (parent, { input = {} }, { dataSources }, info) => {
            const { status, firstName, lastName } = input
            if (isNotNullOrUndefined(firstName) && isEmptyString(firstName)) {
                return getFailureResponse(
                    {
                        message: 'firstName must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'firstName'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(lastName) && isEmptyString(lastName)) {
                return getFailureResponse(
                    {
                        message: 'lastName must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'lastName'
                        }
                    }
                );
            }
            const statusId = statusMapping(status, 2); // get status integer value from enum string
            const user = await dataSources.user.updateUser({ ...input, statusId });
            return user;
        },
        deleteUser: async (parent, { id }, { dataSources }, info) => {
            const deletedUser = await dataSources.user.deleteUser({ userId: id });
            const deletePayload = {
                id: deletedUser.userId,
                message: 'Delete user successfully'
            }
            return deletePayload
        },
        createFolder: async (parent, { input = {} }, { dataSources }, info) => {
            const { name, description, thumbnailUrl, status } = input
            const statusId = statusMapping(status, 2);
            if (isNotNullOrUndefined(name) && isEmptyString(name)) {
                return getFailureResponse(
                    {
                        message: 'name must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'name'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(description) && isEmptyString(description)) {
                return getFailureResponse(
                    {
                        message: 'description must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'description'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(thumbnailUrl) && isEmptyString(thumbnailUrl)) {
                return getFailureResponse(
                    {
                        message: 'thumbnailUrl must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'thumbnailUrl'
                        }
                    }
                );
            }
            const folder = await dataSources.folder.createFolder({ ...input, statusId });
            return folder;
        },
        updateFolder: async (parent, { input = {} }, { dataSources }, info) => {
            const { id, name, description, thumbnailUrl, statusId, modifiedBy } = input
            if (isNotNullOrUndefined(name) && isEmptyString(name)) {
                return getFailureResponse(
                    {
                        message: 'name must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'name'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(description) && isEmptyString(description)) {
                return getFailureResponse(
                    {
                        message: 'description must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'description'
                        }
                    }
                );
            }
            if (isNotNullOrUndefined(thumbnailUrl) && isEmptyString(thumbnailUrl)) {
                return getFailureResponse(
                    {
                        message: 'thumbnailUrl must not be an empty string',
                        code: 400,
                        properties: {
                            fieldName: 'thumbnailUrl'
                        }
                    }
                );
            }
            const folder = await dataSources.folder.updateFolder({ ...input, statusId });
            return folder
        },
        deleteFolder: async (parent, { id }, { dataSources }, info) => {
            const deletedUser = await dataSources.folder.deleteFolder({ id });
            const deletePayload = {
                id: deletedUser.id,
                message: 'Delete folder successfully'
            }
            return deletePayload
        }
    }
}
