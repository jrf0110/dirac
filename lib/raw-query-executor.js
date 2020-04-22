const pg = require('pg');
const PGPool = require('pg-pool');

class RawQueryExecutor {
  constructor( options = {} ){
    this.pool = options.pool || new PGPool( options );
  }

  getClient(){
    return this.pool.connect();
  }

  raw( query, values ){
    return this.pool.query( query, values );
  }
}

class MissingConnectionStringError extends Error {
  constructor( method ){
    super(`Cannot call "${method}" without "options.connectionString"`);
  }
}

RawQueryExecutor.MissingConnectionStringError = MissingConnectionStringError;

module.exports = RawQueryExecutor;