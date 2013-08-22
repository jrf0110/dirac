var assert = require('assert');
var dirac = require('../');

var dbConfig = {
  host: 'localhost'
, port: 5432
, database: 'dirac_test'
};

var connString = 'postgres://' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;

describe ('Root API', function(){
  it ('should initialize with a connStr', function(){
    dirac.init( connString );
    assert( dirac.options.connString == connString );
  });

  it ('should initialize with options', function(){
    dirac.init( dbConfig );
    assert( dirac.options.connString == connString );
  });

  it ('should initialize with default options', function(){
    dirac.init({ database: dbConfig.database });
    assert( dirac.options.connString == connString );
  });

  it ('should throw an error because missing connString', function(){
    assert.throws( function(){
      dirac.init();
    }, Error)
  });

  it ('should throw an error because missing host', function(){
    assert.throws( function(){
      dirac.init({});
    }, Error)
  });
});