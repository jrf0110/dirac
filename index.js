const Database = require('./lib/database');
const relationships = require('./middleware/relationships');
const Query = require('./lib/query');
const Table = require('./lib/query');

module.exports = options => {
  if ( typeof options === 'string' ){
    options = { connectionString: options };
  }

  return Database
    .create( options )
    .use( relationships() );
};

module.exports.relationships = relationships;
module.exports.query = ( q, options )=> Query.create( q, options );
module.exports.table = options => Table.create( options );