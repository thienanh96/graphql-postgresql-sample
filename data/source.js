const { RESTDataSource } = require('apollo-datasource-rest');
const { transformation, sqlQuery, response } = require('../utils');
const { convertToCamelcaseObject } = transformation;
const { getFailureResponse } = response;
const { createUpdateQuery, createGetManyQuery } = sqlQuery;
const initDB = require('../initdb')
const configServer = require('../server.json')
const databaseConnection = initDB({}, configServer, {})

const SQL_QUERY = {
    USER: {
        getOne: `SELECT * FROM sso_user WHERE user_id = $1 AND status_id <> 4 AND status_id <> 0`,
        getMany: `SELECT * FROM sso_user WHERE status_id <> 4 AND status_id <> 0`,
        create: `INSERT INTO sso_user (first_name,last_name, email, user_name, status_id, thumbnail_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;`,
        delete: `UPDATE sso_user SET status_id = 4 WHERE user_id = $1 RETURNING *;`
    },
    FOLDER: {
        getManyByUser: `SELECT * FROM folder WHERE user_id = $1 AND status_id <> 4 AND status_id <> 0`,
        getOne: `SELECT * FROM folder WHERE id = $1 AND status_id <> 4 AND status_id <> 0`,
        getManyByName: `SELECT * FROM folder WHERE name = $1 AND status_id <> 4 AND status_id <> 0`,
        create: `INSERT INTO folder (name, description, thumbnail_url, parent_id, status_id, user_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;`,
        delete: `UPDATE folder SET status_id = 4 WHERE id = $1 RETURNING *;`
    }
}

class UserSource extends RESTDataSource {

    async getUser(userID) {
        if (!userID) { //validate userID
            // const newError = new Error('Require userID.')
            // newError.code = 400
            // throw newError
            return null
        }
        try {
            const user = await databaseConnection.postgres.read.oneOrNone(SQL_QUERY.USER.getOne, [userID]);
            if (user) {
                const convertedUser = convertToCamelcaseObject(user)
                return convertedUser;
            }
            return null
        } catch (error) {
            throw error;
        }

    }

    async createUser({ firstName, lastName, email, userName, statusId, thumbnailUrl }) {
        try {
            const createResult = await databaseConnection.postgres.write.one(SQL_QUERY.USER.create, [firstName, lastName, email, userName, statusId, thumbnailUrl]).catch(err => {
                throw err
            });
            if (createResult) {
                const convertedUser = convertToCamelcaseObject(createResult)
                return convertedUser
            }
            const error = new Error('Create user failure');
            error.code = 500
            throw error
        } catch (error) {
            throw error

        }
    }

    async deleteUser({ userId }) {
        try {
            const deleteResult = await databaseConnection.postgres.write.one(SQL_QUERY.USER.delete, [userId])
                .catch(err => {
                    throw err
                });
            if (deleteResult) {
                const convertedUser = convertToCamelcaseObject(deleteResult)
                return convertedUser
            }
            const error = new Error('Delete user failure');
            error.code = 500
            throw error
        } catch (error) {
            throw error

        }
    }


    async updateUser({ id, firstName, lastName, statusId, details, modifiesBy, password, thumbnailUrl, birthDay }) {
        try {
            const updateQueryObject = createUpdateQuery('sso_user',
                { firstName, lastName, statusId, details, modifiesBy, password, thumbnailUrl, birthDay }, `user_id = '${id}'`)
            if (!updateQueryObject) {
                throw getFailureResponse({
                    message: 'No params to update',
                    code: 400
                })
            }
            const { params, query } = updateQueryObject;
            const updateResult = await databaseConnection.postgres.write.one(query, params)
                .catch(err => {
                    throw err
                })
            if (updateResult) {
                const convertedUser = convertToCamelcaseObject(updateResult)
                return convertedUser
            }
            throw getFailureResponse({
                message: 'Update user failure'
            })
        } catch (error) {
            throw error

        }
    }

    async getUsers() {
        try {
            const users = await databaseConnection.postgres.read.manyOrNone(SQL_QUERY.USER.getMany).catch(err => {
                throw err
            });
            const convertedUsers = [];
            if (Array.isArray(users)) {
                users.forEach(user => {
                    let newUser = convertToCamelcaseObject(user)
                    convertedUsers.push(newUser)
                })

            }
            return convertedUsers;
        } catch (error) {
            throw error;
        }
    }

}

class FolderSource extends RESTDataSource {

    async getFolders({ userId, parentId, name }) { //get list folders by userID
        try {
            const getManyQueryObject = createGetManyQuery('folder', {
                userId,
                parentId,
                name
            });
            const { query, params } = getManyQueryObject
            const folders = await databaseConnection.postgres.read.manyOrNone(query, params);
            const convertedFolders = [];
            if (Array.isArray(folders)) {
                folders.forEach(folder => {
                    let newFolder = convertToCamelcaseObject(folder)
                    convertedFolders.push(newFolder)
                })

            }
            return convertedFolders;
        } catch (error) {
            throw error;
        }

    }


    async getFolderById(folderID) { //get list folders by ID
        if (!folderID) { //validate userID
            return null
        }
        try {
            const folder = await databaseConnection.postgres.read.oneOrNone(SQL_QUERY.FOLDER.getOne, [folderID]);
            if (folder) {
                const convertedFolder = convertToCamelcaseObject(folder)
                return convertedFolder
            }
            return null
        } catch (error) {
            throw error;
        }

    }

    async createFolder({ name, description, thumbnailUrl, parentId, statusId, userId }) {
        try {
            const folder = await databaseConnection.postgres.read.one(SQL_QUERY.FOLDER.create,
                [name, description, thumbnailUrl, parentId, statusId, userId]);
            if (folder) {
                const convertedFolder = convertToCamelcaseObject(folder)
                return convertedFolder
            }
            const error = new Error('Create folder failure');
            error.code = 500
            throw error
        } catch (error) {
            throw error

        }
    }


    async updateFolder({ id, name, description, thumbnailUrl, statusId, modifiedBy }) {
        try {
            const updateQueryObject = createUpdateQuery('folder',
                { name, description, thumbnailUrl, statusId, modifiedBy }, `id = '${id}'`);
            const { query, params } = updateQueryObject;
            const updateResult = await databaseConnection.postgres.write.one(query, params)
                .catch(err => {
                    throw err
                });
            if (updateResult) {
                const convertedFolder = convertToCamelcaseObject(updateResult)
                return convertedFolder
            }
            const error = new Error('Update folder failure');
            error.code = 500
            throw error
        } catch (error) {
            throw error

        }
    }

    async deleteFolder({ id }) {
        try {
            const deleteResult = await databaseConnection.postgres.write.one(SQL_QUERY.FOLDER.delete, [id])
                .catch(err => {
                    throw err
                });
            if (deleteResult) {
                const convertedFolder = convertToCamelcaseObject(deleteResult)
                return convertedFolder
            }
            const error = new Error('Delete folder failure');
            error.code = 500
            throw error
        } catch (error) {
            throw error

        }
    }

}

module.exports = { UserSource, FolderSource }

