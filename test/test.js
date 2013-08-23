var assert = require('assert');
var pg = require('pg');
var dirac = require('../');

var dbConfig = {
  host: 'localhost'
, port: 5432
, database: 'dirac_test'
};

var connString = 'postgres://' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;

before( function( done ){
  dirac.init( connString.substring( 0, connString.indexOf('/') ) + '/postgres' );
  dirac.query( 'drop database if exists dirac_test', function(error){
    if ( error ) throw error;
    dirac.query( 'create database dirac_test', function( error ){
      if ( error ) throw error;
      dirac.destroy();
      done();
    });
  })
});

describe ('Root API', function(){

  describe ('dirac.init', function(){

    it ('should initialize with a connStr', function(){
      dirac.init( connString );
      assert( dirac.options.connString == connString );
      assert( dirac.dals.dirac_schemas instanceof dirac.DAL );
    });

    it ('should initialize with options', function(){
      dirac.init( dbConfig );
      assert( dirac.options.connString == connString );
      assert( dirac.dals.dirac_schemas instanceof dirac.DAL );
    });

    it ('should initialize with default options', function(){
      dirac.init({ database: dbConfig.database });
      assert( dirac.options.connString == connString );
      assert( dirac.dals.dirac_schemas instanceof dirac.DAL );
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

  describe ('dirac.register', function(){

    it ('should register a new table', function(){
      dirac.register({
        name: 'users'
      , schema: {
          id: {
            type: 'serial'
          , primaryKey: true
          }
        , name: { type: 'text' }
        }
      });

      assert( dirac.dals.users instanceof dirac.DAL );
      dirac.unregister( 'users' );
    });

    it ('should throw an error because the definition is missing', function(){
      assert.throws( function(){
        dirac.register({
          name: 'users'
        });
      });
    });

  });

  describe ('dirac.unregister', function(){

    it ('should register a new table', function(){
      dirac.register({
        name: 'users'
      , schema: {
          id: {
            type: 'serial'
          , primaryKey: true
          }
        , name: { type: 'text' }
        }
      });

      assert( dirac.dals.users instanceof dirac.DAL );
      dirac.unregister( 'users' );
      assert( !dirac.users );
    });

  });

  describe ('dirac.sync', function(){

    it ('should at least create the dirac_schemas table', function( done ){
      dirac.sync( function( error ){
        assert( !error );
        done();
      });
    });

  });

});