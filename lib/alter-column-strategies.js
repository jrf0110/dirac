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

// TODO: support more use-cases
strategies.register( 'primaryKey', function( name, newCol, oldCol, newSchema, oldSchema ){
  // If previous column didn't have primary key to begin with
  if ( !('primaryKey' in oldCol) ){
    return {
      name:         name
    , primaryKey:   newCol.primarykey
    };
  }
});

strategies.register( 'default', function( name, newCol, oldCol, newSchema, oldSchema ){
  return {
    name:     name
  , default:  newCol.default
  };
});