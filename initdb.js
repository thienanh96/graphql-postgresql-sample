const promise = require('bluebird');
const validator = require('validator');
const parse = require('pg-connection-string').parse;
const ip = require('ip');
const moment = require('moment');
const os = require('os');
const _ = require('lodash');

module.exports = function createDbMap(logger, config, metricsCounters) {
  const connCount = {};
  const maxConns = {};
  const waitingSince = {};
  // this is the maximum time a given operation will wait for an active
  // connection before triggering the warning metric.
  // the operation will continue to wait after this point until
  // the query timeout cuts it off.
  const maxWaitTimeMs = _.get(config, 'db.maxConnectTotalWaitTimeMs', 5000);

  // set pg-promise's connect and disconnect callbacks so we can track some stats
  const pgp = require('pg-promise')({
    promiseLib: promise,
    connect: function (client, dc, useCount) {
      const cp = client.connectionParameters;
      const key = cp.database + ':' + cp.user + ':' + cp.host;
      if (!connCount[key]) connCount[key] = 1;
      else connCount[key] = connCount[key] + 1;
    },
    disconnect: function (client, dc) {
      const cp = client.connectionParameters;
      const key = cp.database + ':' + cp.user + ':' + cp.host;
      if (connCount[key]) connCount[key] = connCount[key] - 1;
    }
  });

  const dbConnections = {};
  const dbConfigs = config.db;
  const dbByUri = {};
  const appName = config.appName || 'core-graphql-server';
  const ERR = 'error';
  const OK = 'ok';
  const metrics = require('./metrics.js');
  const serverIp = ip.address();
  const serverHostname = os.hostname();
  const logSqlAll = _.get(config, 'log.sql.all', false) === true;
  const logSqlError = _.get(config, 'log.sql.error', true) === true;

  // these values are configurable. note that
  // total time elapsed for all retries, accounting for query timeout,
  // should be below the core-graphql-server hard limit on request duration
  // (1min by default).
  // TODO a better way would be to pass in the request completion "deadline"
  // time and retry only if the time has not passed.
  const maxRetries = _.get(config, 'db.maxRetries', 2);
  const retryIntervalMultipleSec = _.get(
    config,
    'db.retryIntervalMultipleSec',
    5
  );

  const circuitOpenErrorTag = '__core-graphql-server_db_circuit_open';
  const retryableErrorText = _.get(config, 'db.retryableErrorText', [
    circuitOpenErrorTag,
    'terminating connection due to administrator command',
    'the database system is shutting down',
    'the database system is starting up',
    'read ECONNRESET',
    'connect ECONNREFUSED ',
    'sorry, too many clients already',
    'EAI_AGAIN',
    'emaining connection slots are reserved for non-replication superuser'
  ]);

  const queryTimeoutsByDb = {};

  /**
   * single functional wrapper for all wrapped db calls.
   * abstracts out logging, timeout, error handling, etc.
   *
   * @param fun a function that calls the pg db client.
   *   should return a promise
   * @param dbname The database name (key in the config object)
   * @param sql The SQL query
   * @param args The SQL arguments (can be empty/null)
   **/
  function wrap(fun, dbname, sql, args, uri, connKey) {
    if (!sql) {
      throw new Error('invalid function call -- null sql to db ' + dbname);
    }
    return wrapOneTry(fun, dbname, sql, args, uri, 0, connKey);
  }

  function wrapOneTry(fun, dbname, sql, args, uri, numRetries, connKey) {
    checkMax(connKey, dbname, uri);
    const startTime = startQuery(dbname);
    const queryTimeoutMillis = queryTimeoutsByDb[dbname] || 30000;
    console.log("TCL: wrapOneTry -> queryTimeoutMillis", queryTimeoutMillis)
    // here's where we invoke the function

    return fun
      .call()
      .timeout(queryTimeoutMillis) // apply our timeout
      .then(res => {
        log(dbname, sql, args, startTime, OK, null, numRetries, uri);
        return res;
      })
      .catch(error => {
        // determine if a) error is retryable and b) we have retries left
        const retry = isRetryable(error) && numRetries < maxRetries;

        if (retry) {
          // increment metric for dashboards/alerting
          metrics.incrementCounter('sqlQueryRetry', { db: dbname });
          // decrement concurrent queries gauge since the first one
          // actually finished
          metrics.decrementGauge('sqlConcurrentQueries', { db: dbname });
          // const newCount = numRetries + 1;
          // logger.warn(
          //   'sql_retry ' +
          //     newCount +
          //     ' of ' +
          //     maxRetries +
          //     ' on ' +
          //     dbname +
          //     ' ' +
          //     error.message
          // );
          // sleep. this will be numRetries+1 * interval.
          // so on first retry, 5s. then 10s. etc.
          // return (
          //   util
          //     .sleep(retryIntervalMultipleSec * 1000 * newCount)
          //     // do the retry. increment numRetries counter.
          //     .then(() => wrapOneTry(fun, dbname, sql, args, uri, newCount))
          // );
          // // last retry will throw a wrapped error all the way out
        }

        // didn't retry. wrap error and throw out.
        const e = wrapError(error, dbname, sql, args, startTime);
        log(dbname, sql, args, startTime, ERR, e, numRetries, uri);
        throw e;
      });
  }

  function checkMax(connKey, dbname, uri) {
    const ct = connCount[connKey] || 0;
    if (ct >= maxConns[connKey]) {
      if (!waitingSince[connKey]) {
        // if "waiting since" timestamp has not been set, set it now
        waitingSince[connKey] = moment().valueOf();
      } else {
        // otherwise see how long we've been waiting for new connections
        const timeElapsedMs = moment().valueOf() - waitingSince[connKey];
        if (timeElapsedMs > maxWaitTimeMs) {
          // if all connections on this db have been waiting past the max
          // time allowed...
          metrics.incrementCounter('sqlConnectionMax', { db: dbname });
        }
      }
      metrics.incrementCounter('sqlConnectionWaited', { db: dbname });
    } else {
      // make sure "waiting since" timestamp is clear
      waitingSince[connKey] = null;
    }
  }
  // we wrap each pg connection object so that we can wrap
  // its query functions and add our own global logging,
  // metrics, and error handling.
  // see http://vitaly-t.github.io/pg-promise/Database.html for the
  // pgp API function definitions. we do not change them here.
  function wrapConnection(conn, dbname, uri, connKey) {
    const wrappers = {
      map: function (sql, args, mapfun) {
        return wrap(
          () => conn.map(sql, args, mapfun),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      query: function (sql, args) {
        return wrap(
          () => conn.query(sql, args),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      any: function (sql, args) {
        return wrap(() => conn.any(sql, args), dbname, sql, args, uri, connKey);
      },
      one: function (sql, args, mapfun) {
        return wrap(
          () => conn.one(sql, args, mapfun),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      oneOrNone: function (sql, args, mapfun) {
        return wrap(
          () => conn.oneOrNone(sql, args, mapfun),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      many: function (sql, args) {
        return wrap(
          () => conn.many(sql, args),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      manyOrNone: function (sql, args) {
        return wrap(
          () => conn.manyOrNone(sql, args),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      none: function (sql, args) {
        return wrap(
          () => conn.none(sql, args),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      },
      each: function (sql, args, mapfun) {
        return wrap(
          () => conn.each(sql, args, mapfun),
          dbname,
          sql,
          args,
          uri,
          connKey
        );
      }
    };
    Object.keys(conn).forEach(functionName => {
      if (!Object.keys(wrappers).includes(functionName)) {
        wrappers[functionName] = conn[functionName];
      }
    });

    return wrappers;
  }

  function isRetryable(error) {
    for (let i = 0; i < retryableErrorText.length; i++) {
      const text = retryableErrorText[i];
      if (
        (error.message && error.message.includes(text)) ||
        (error.stack && error.stack.includes(text))
      ) {
        return true;
      }
    }
    return false;
  }

  function wrapError(error, dbname, sql, args, startTime) {
    const internalData = {
      type: 'sql',
      message: error.message,
      sql,
      sqlArgs: getArgs(args),
      db: dbname,
      startTime: moment(startTime).toISOString(),
      timeElapsedMs: Date.now() - startTime,
      originalStack: error.stack
    };

    // special handling for timeout errors
    const text = _.get(error, 'stack', _.get(error, 'message'));
    if (text.includes('TimeoutError') || text.includes('ETIMEDOUT')) {
      // increment metric
      metrics.incrementCounter('sqlQueryTimeout', { db: dbname });
      // throw distinctive error type
      throw new Error('A required service was not able to respond in time. ' +
        'This condition can occur under heavy platform load or might indicate ' +
        'an overly expensive request. If it continues, contact Veritone support.');
    }

    if (
      error.message &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      return new Error('The object could not be created because a duplicate already exists.');
    }
    if (error.message && error.message.includes('invalid input syntax')) {
      return new Error('The requested object could not be retrieved because an ' +
        'ID value provided was not valid. Provide a valid object ID to continue.');
    }
    if (
      error.message &&
      error.message.includes('violates foreign key constraint')
    ) {
      throw new Error('The object could not be created because the input references ' +
        'an object ID that does not exist. Verify all IDs in the request input ' +
        'to continue.');
    }
    return new Error('An internal server error occurred: ' + error.message)
  }

  function startQuery(dbname) {
    metrics.incrementGauge('sqlConcurrentQueries', { db: dbname });
    return Date.now();
  }

  // truncates a long arguments list to avoid generate over-long log entries
  function getArgs(args) {
    if (!args) return args;
    return args.length > 10 ? args.slice(0, 10) : args;
  }

  function log(dbname, sql, args, startTime, status, error, numRetries, uri) {
    const timeElapsedMs = Date.now() - startTime;
    const startTimeStr = moment(startTime).toISOString();
    const data = {
      event: 'sql',
      type: 'api',
      serverIp,
      serverHostname,
      serviceName: 'core-graphql-server',
      db: dbname,
      url: uri,
      sql: _.isString(sql)
        ? sql
          .substring(0, 600)
          .replace(/\n/g, ' ')
          .replace(/\t/g, ' ')
          .trim()
        : '',
      sqlArgs: getArgs(args),
      elapsedMs: timeElapsedMs,
      startTime: startTimeStr,
      numRetries,
      success: status === OK
    };
    if (error) {
      data.error = error;
      data.errorData = _.get(error, 'data.internalData');
    }
    // logger adds extra junk so this isn't
    // parsed into cloudwatch as an object
    //logger.info(data);
    const logIt = logSqlAll || (logSqlError && (error || status === ERR));
    if (logIt) {
      console.log(JSON.stringify(data));
    }
    metrics.incrementCounter('sqlQuery', { db: dbname });
    metrics.observeHistogram('sqlQueryTimeElapsedMs', timeElapsedMs, {
      db: dbname
    });
    if (error || status === ERR) {
      metrics.incrementCounter('sqlError', { db: dbname });
    }
    metrics.decrementGauge('sqlConcurrentQueries', { db: dbname });
  }

  Object.keys(dbConfigs).forEach(key => {
    // first get the uri
    const readUri = dbConfigs[key].read;
    const writeUri = dbConfigs[key].write;
    const conn = {};

    // check if we already have connections for them
    // and, if not, create and add to map by URI
    if (readUri) {
      if (!dbByUri[readUri]) {
        dbByUri[readUri] = setupConnection(key, readUri);
      }
      conn.read = dbByUri[readUri];
    }

    if (writeUri) {
      if (!dbByUri[writeUri]) {
        dbByUri[writeUri] = setupConnection(key, writeUri);
      }
      conn.write = dbByUri[writeUri];
    }
    // finally, set up the object for this db key
    dbConnections[key] = conn;
  });

  function setupConnection(key, uri) {
    const dbConfigs = config.db;
    // built-in default from https://github.com/brianc/node-postgres/blob/master/lib/defaults.js
    // is max 10 connections.
    const max = dbConfigs[key].max || dbConfigs.max || 30;
    const min = dbConfigs[key].min || dbConfigs.min || 1;
    const idleTimeoutMillis =
      dbConfigs[key].idleTimeoutMillis || dbConfigs.idleTimeoutMillis || 5000;
    // set up max query duration timeout. this does not prevent the db from
    // continuing to process the query, but does prevent slow requests from
    // accumulating and strongly discourages expensive queries.
    // this value should match the value configured for the query monitor
    // "kill" setting so that queries that time out here are killed on the db
    // at the same time or soon after.
    const queryTimeoutMillis =
      dbConfigs[key].queryTimeoutMillis ||
      dbConfigs.queryTimeoutMillis ||
      30000;
    if (_.isNil(queryTimeoutsByDb[key]))
      queryTimeoutsByDb[key] = queryTimeoutMillis;

    const parsed = parse(uri);
    const connKey = parsed.database + ':' + parsed.user + ':' + parsed.host;
    maxConns[connKey] = max;
    parsed.application_name = appName;
    parsed.keepAlive = true;
    parsed.idleTimeoutMillis = idleTimeoutMillis;
    parsed.max = max;
    parsed.min = min;
    const conn = pgp(parsed);

    return wrapConnection(conn, key, uri, connKey);
  }

  return dbConnections;
};