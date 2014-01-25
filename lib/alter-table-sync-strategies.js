var strategies = module.exports = {};
strategies.registered = {};

/**
 * Is a strategy registered
 * @param  {string}  strat The strategy in question
 * @return {Boolean}       Whether it's registered
 */
strategies.has = function( strat ){
  return strat in strategies.registered;
};

/**
 * Returns the strategy interface
 * @param  {string} srat The strategy in question
 * @return {Object}      The strategy interface
 */
strategies.get = function( strat ){
  return strategies.registered[ strat ];
};

/**
 * Register a new strategy
 * @param  {string}   name    Name of the strategy
 * @param  {object}   options Optional options to be associated
 * @param  {Function} fn      strategy definition:
 *                            callback( name, newCol, oldCol, newSchema, oldSchema )
 */
strategies.register = function( name, options, fn ){
  if ( typeof options === 'function' ){
    fn = options;
    options = {};
  }

  strategies.registered[ name ] = {
    options: options
  , fn: fn
  };
};

/**
 * Built-in Strategies
 */

strategies.register( 'primaryKey', function( name, newCol, oldCol, newSchema, oldSchema, table ){
  // Column didn't previously have pkey
  // So drop an old one, add the new one
  if ( !('primaryKey' in oldCol) ){
    return [
      { // Drop old pkey
        dropConstraint: {
          name: table + '_pkey'
        , ifExists: true
        , cascade: true
        }
      }
    , { // Add new pkey
        addConstraint: {
          name: table + '_pkey'
        , primaryKey: name
        }
      }
    ];
  }
});

strategies.register( 'default', function( name, newCol, oldCol, newSchema, oldSchema, table ){
  // Was in old, not in new - drop default
  if ( 'default' in oldCol && !('default' in newCol) ){
    return {
      alterColumn: {
        name: name
      , dropDefault: true
      }
    }
  }

  if ( 'default' in newCol && !('default' in oldCol) ){
    return {
      alterColumn: {
        name: name
      , default: newCol.default
      }
    };
  }
});

strategies.register( 'unique', function( name, newCol, oldCol, newSchema, oldSchema, table ){
  if ( 'unique' in oldCol && !('unique' in newCol) ){
    return {
      dropConstraint: {
        name: [ table, name, 'key' ].join('_')
      , ifExists: true
      , cascade: true
      }
    };
  }

  if ( !('unique' in oldCol) && 'unique' in newCol ){
    return {
      addConstraint: {
        name: [ table, name, 'key' ].join('_')
      , unique: [ name ]
      }
    };
  }
});