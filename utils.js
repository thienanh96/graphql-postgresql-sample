const { ApolloError } = require('apollo-server');
const camelCase = require('camelcase');
const decamelize = require('decamelize');
const EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
module.exports = {
    getSuccessResponse: ({ code = 200, message = 'Success', success = false, data = {} }) => {
        return {
            code,
            message,
            success,
            data
        }
    },
    getFailureResponse: ({ message, code = 500, properties = {} }) => {
        return new ApolloError(message, code, properties);
    },
    convertToCamelcaseObject: (object) => {
        const newObject = {}
        Object.keys(object).forEach(key => {
            let newKey = camelCase(key)
            newObject[newKey] = object[key]
        })
        return newObject
    },
    convertToLowercaseObject: (object) => {
        const newObject = {}
        Object.keys(object).forEach(key => {
            let newKey = decamelize(key)
            newObject[newKey] = object[key]
        })
        return newObject
    },
    statusMapping: (originalStatus, typeMapping = 1) => { //typeMapping is equal to 1 means it converts from integer to enum string, otherwise if it's equal to 2, from enum string to integer
        const mapping = {
            0: null,
            1: 'active',
            2: 'inactive',
            3: 'suspend',
            4: 'deleted'
        }
        if (typeMapping === 1) {
            return mapping[originalStatus]
        }
        if (typeMapping === 2) {
            let statusId = 0
            Object.keys(mapping).forEach(key => {
                if (originalStatus && originalStatus === mapping[key]) {
                    statusId = parseInt(key)
                }
            })
            return statusId
        }
        return null

    },
    validation: {
        isEmptyString: (textToCheck = null) => {
            if (!textToCheck || !(typeof textToCheck == 'string')) return true;
            return textToCheck.length === 0
        },
        isValidEmail: (email = null) => {
            if (!email) return false
            return EMAIL_REGEX.test(email)
        },
        isNotNullOrUndefined: (input) => input !== null && input !== undefined
    },
    sqlQuery: {
        createUpdateQuery: (tableName, fieldsToUpdate, conditions = null) => {
            const newFieldsToUpdate = module.exports.convertToLowercaseObject(fieldsToUpdate);
            const fieldValues = [];
            let query = `UPDATE ${tableName} SET`;
            const listKeys = Object.keys(newFieldsToUpdate);
            if (listKeys.length === 0) return null; //not valid input data
            let accumulatedIndex = 1;
            listKeys.forEach(key => {
                let value = newFieldsToUpdate[key];
                if (value) { // if value of this field is not null, then attach it to sql query
                    query += ` ${key} = $${accumulatedIndex},`;
                    fieldValues.push(value);
                    accumulatedIndex++;
                }
            })
            query = query.replace(/,\s*$/, ""); //remove last comma to assure valid sql query
            if (conditions) {
                query += ` WHERE ${conditions} RETURNING *;` // append conditions string
            }
            return {
                query,
                params: fieldValues
            }
        }
    }


}