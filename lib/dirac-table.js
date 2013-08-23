module.exports = {
  name: 'dirac_schemas'
, schema: {
    id: {
      type: 'serial'
    , primaryKey: true
    }

  , tableName: {
      type: 'text'
    }

  , schema: {
      type: 'json'
    }

  , version: {
      type: 'int'
    }

  , createdAt: {
      type: 'timestamp'
    , default: 'now()'
    }
  }

, findLatest: function( callback ){
    var $latestVersionQuery = {
      type: 'select'
    , table: 'dirac_schemas'
    , columns: [ 'max(version) as latest' ]
    };

    var $query = {
      type:     'select'
    , table:    ['dirac_schemas', 'versions']
    , columns:  ['dirac_schemas.*']
    , with:     { versions: $latestVersionQuery }
    , where:    { version: '$versions.latest$' }
    };

    return this.query( $query, callback );
  }
};