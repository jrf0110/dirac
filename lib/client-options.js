const parseConnectionString = require('pg-connection-string').parse;

class ClientOptions {
  static parseConnectionString( str ){
    return parseConnectionString( str );
  }

  constructor( options = {} ){
    if ( typeof options === 'string' ){
      options = ClientOptions.parseConnectionString( options );
    } else if ( typeof options === 'object' && options.connectionString ){
      options = ClientOptions.parseConnectionString( options.connectionString );
    } else if ( typeof options !== 'object' ){
      throw new InvalidClientOptionsError( typeof options );
    }

    this.host = options.host || 'localhost';
    this.port = options.port || 5432;
    this.user = options.user || process.env.USER;
    this.password = options.password || null;
    this.database = options.database || process.env.USER;
    this.ssl = typeof options.ssl === 'boolean' ? options.ssl : false;
  }

  toString(){
    return 'postgres://' + [
      this.user ? this.user : ''
    , this.password ? `:${this.password}` : ''
    , this.user ? '@' : ''
    , this.host
    , this.port ? `:${this.port}` : ''
    , '/'
    , this.database
    , this.ssl ? '?ssl=true' : ''
    ].reduce( ( result, part ) => result + part, '' );
  }
}

class InvalidClientOptionsError extends Error {
  constructor( type ){
    super(`Invalid options type: \`${type}\` passed to \`ClientOptions\` constructor`);
  }
}

ClientOptions.props = [
  'host', 'port', 'user', 'password', 'database', 'ssl'
];

ClientOptions.InvalidClientOptionsError = InvalidClientOptionsError;

module.exports = ClientOptions;