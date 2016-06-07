const RawQueryExecutor = require('./raw-query-executor');
const Query = require('./query');

class Transaction extends RawQueryExecutor {
  static create( options ){
    return new this( options );
  }

  constructor( options ){
    super( options.connectionString );
    this.results = {};
  }

  begin(){
    return this.getClient().then( client => {
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

    return new Promise( ( resolve, reject )=>{
      console.log('querying', query, values);
      this.client.query( query, values, ( error, result ) => {
        if ( error ){
          client.release();
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