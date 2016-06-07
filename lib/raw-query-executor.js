const pg = require('pg');

class RawQueryExecutor {
  constructor( connectionString ){
    this.connectionString = connectionString;
  }

  getClient(){
    return new Promise( ( resolve, reject )=>{
      if ( typeof this.connectionString !== 'string' ){
        throw new MissingConnectionStringError('.getClient()');
      }

      pg.connect( this.connectionString, ( error, client, done )=>{
        if ( error ){
          return reject( error );
        }

        client.release = done;

        resolve( client );
      });
    });
  }

  raw( query, values ){
    return this.getClient()
      .then( client => {
        return new Promise( ( resolve, reject )=>{
          client.query( query, values, ( error, result )=>{
            client.release();

            if ( error ){
              return reject( error );
            }

            return resolve( result.rows );
          });
        });
      });
  }
}

class MissingConnectionStringError extends Error {
  constructor( method ){
    super(`Cannot call "${method}" without "options.connectionString"`);
  }
}

RawQueryExecutor.MissingConnectionStringError = MissingConnectionStringError;

module.exports = RawQueryExecutor;