const Pool = require('pg-pool');
const Query = require('./query');
const Errors = require('./errors');
const QueryDebugger = require('./query-debugger');

class Transaction {
  static create( options ){
    return new this( options );
  }

  constructor( options = {} ){
    if ( !(options.pool instanceof Pool) ){
      throw new Errors.MissingPool();
    }

    this.options = options;
    this.pool = options.pool;
    this.results = {};
  }

  begin(){
    return this.pool.connect().then( client => {
      this.client = client;

      return this.query('BEGIN');
    });
  }

  commit(){
    if ( !this.client ){
      throw new TransactionNotBegunError('commit');
    }

    return this.query('COMMIT').then( tx => {
      tx.client.release();

      return tx;
    });
  }

  abort(){
    if ( !this.client ){
      throw new TransactionNotBegunError('abort');
    }

    return this.query('ABORT').then( tx => {
      tx.client.release();

      return tx;
    });
  }

  save( savepoint ){
    if ( !this.client ){
      throw new TransactionNotBegunError('create savepoint on');
    }

    return this.query( 'SAVEPOINT ' + savepoint );
  }

  rollback( savepoint ){
    if ( !this.client ){
      throw new TransactionNotBegunError('rollback');
    }

    return this.query( 'ROLLBACK TO ' + savepoint );
  }

  query( query, values = [] ){
    if ( !this.client ){
      throw new TransactionNotBegunError('query');
    }

    if ( query instanceof Query ){
      query = query.toStringAndValues();
      values = query.values;
      query = query.toString();
    }

    var qdebugger;

    if ( this.options.debug ){
      qdebugger = new QueryDebugger( query, values );
    }

    return new Promise( ( resolve, reject )=>{
      this.client.query( query, values, ( error, result ) => {
        if ( this.options.debug ){
          qdebugger.log();
          qdebugger.end();
        }

        if ( error ){
          return reject( error );
        }

        resolve( this );
      });
    });
  }
}

class TransactionNotBegunError extends Error {
  constructor( action ){
    super(`Cannot ${action} the transaction because it has not yet begun. Call tx.begin() first.`);
  }
}

Transaction.TransactionNotBegunError = TransactionNotBegunError;

module.exports = Transaction;