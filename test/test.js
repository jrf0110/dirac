var assert = require('assert');
var pg = require('pg');
var async = require('async');
var dirac = require('../');

var dbConfig = {
  host: 'localhost'
, port: 5432
, database: 'dirac_test'
};

var connString = 'postgres://' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database;

var destroyCreateDb = function( callback ){
  // Reset dirac in case someone has already used it
  dirac.destroy();
  dirac.init( connString.substring( 0, connString.lastIndexOf('/') ) + '/postgres' );

  dirac.raw( 'drop database if exists dirac_test', function( error ){
    if ( error ) return callback( error );
    dirac.raw( 'create database dirac_test', function( error ){
      if ( error ) return callback( error );

      // Reset again for future use
      dirac.destroy();
      dirac.init( connString );
      callback();
    });
  });
};

var destroyTables = function( callback ){
  dirac.dropAllTables( { forceDirac: true }, function( error ){
    if ( error ) return callback( error );

    dirac.destroy();
    dirac.init( connString );
    callback();
  });
};

var tableExists = function( table, callback ){
  var query = 'SELECT * FROM pg_catalog.pg_tables where tablename = $1';

  dirac.raw( query, [ table ], function( error, result ){
    if ( error ) return callback( error );
    callback( null, result.rows.length > 0 );
  });
};

var columnExists = function( table, column, callback ){
  var query = 'select column_name from information_schema.columns where table_name = $1 and column_name = $2';

  dirac.raw( query, [ table, column ], function( error, result ){
    if ( error ) return callback( error );
    callback( null, result.rows.length > 0 );
  });
};

before( function( done ){
  this.timeout(3000)
  destroyCreateDb( function( error ){
    if ( error ) throw error;

    done();
  });
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
      destroyTables( function( error ){
        assert( !error )
        dirac.sync( function( error ){
          assert( !error );
          tableExists( 'dirac_schemas', function( error, result ){
            assert( !error );
            assert( result );
            done();
          });
        });
      });
    });

    it ('should register a table and sync it', function( done ){
      destroyTables( function( error ){
        assert( !error )

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

        dirac.sync( function( error ){
          assert( !error );
          tableExists( 'users', function( error, result ){
            assert( !error );
            assert( result );
            done();
          });
        });
      });
    });

    it ('should create tables in correct order', function( done ){
      destroyTables( function( error ){
        assert( !error )

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

        dirac.register({
          name: 'groups'
        , schema: {
            id: {
              type: 'serial'
            , primaryKey: true
            }
          , name: { type: 'text' }
          , user_id: {
              type: 'int'
            , references: { table: 'users', column: 'id' }
            }
          }
        });

        dirac.register({
          name: 'other_thing'
        , schema: {
            id: {
              type: 'serial'
            , primaryKey: true
            }
          , name: { type: 'text' }
          , group_id: {
              type: 'int'
            , references: { table: 'groups', column: 'id' }
            }
          }
        });

        dirac.register({
          name: 'other_thing2'
        , schema: {
            id: {
              type: 'serial'
            , primaryKey: true
            }
          , name: { type: 'text' }
          , user_id: {
              type: 'int'
            , references: { table: 'users', column: 'id' }
            }
          , group_id: {
              type: 'int'
            , references: { table: 'groups', column: 'id' }
            }
          }
        });

        dirac.sync( function( error ){
          assert( !error );

          async.series( Object.keys( dirac.dals ).map( function( table ){
            return function( callback ){
              tableExists( table, function( error, result ){
                assert( !error );
                assert( result );
                callback();
              });
            }
          }), done );
        });
      });
    });

    it ('should add a new field', function( done ){
      destroyTables( function( error ){
        assert( !error )

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

        dirac.sync( function( error ){
          assert( !error );
          tableExists( 'users', function( error, result ){
            assert( !error );
            assert( result );

            dirac.register({
              name: 'users'
            , schema: {
                id: {
                  type: 'serial'
                , primaryKey: true
                }
              , name: { type: 'text' }
              , email: { type: 'text' }
              }
            });

            dirac.sync( function( error ){
              assert( !error );

              columnExists( 'users', 'email', function( error, result ){
                assert( !error );
                assert( result );
                done();
              });
            });
          });
        });
      });
    });

    it ('should forcibly sync', function( done ){
      destroyTables( function( error ){
        assert( !error )

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

        dirac.sync( { force: true }, function( error ){
          assert( !error );
          dirac.dals.users.insert({ name: 'Bob' }, function( error, result ){
            assert( !error );
            assert( result );

            dirac.sync( { force: true }, function( error ){
              assert( !error );
              dirac.dals.users.findOne( {}, function( error, result ){
                assert( !error );
                assert( !result );
                done();
              });
            });
          });
        })
      });
    });

    it ('should register a view', function( done ){
      destroyTables( function( error ){
        assert( !error )

        var view;

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

        dirac.register( view = {
          name: 'bobs'
        , type: 'view'
        , query: {
            type: 'select'
          , table: 'users'
          , where: { name: { $ilike: 'bob' } }
          }
        });

        assert( dirac.views[ view.name ] );
        assert( dirac.dals[ view.name ] );

        dirac.sync( function( error ){
          assert( !error );

          async.series(
            ['Bob', 'Alice'].map( function( name ){
              return function( _done ){
                dirac.dals.users.insert({ name: name }, _done);
              }
            })
          , function( error ){
              assert( !error );

              dirac.dals.bobs.find( {}, function( error, results ){
                assert( !error );

                assert( results.filter( function( u ){
                  return u.name.toLowerCase() == view.query.where.name.$ilike;
                }).length, results.length );

                done();
              });
            }
          );
        });
      });
    });

  });

});

describe ('DAL API', function(){
  describe ('DAL.find', function(){

    var fixtureOptions = {
      users: {
        numToGenerate: 100
      }
    };

    before(function(done){
      destroyTables( function( error ){
        if ( error ) return done( error );

        dirac.destroy();
        dirac.init( connString );

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

        dirac.sync( function( error ){
          if ( error ) return done( error );

          var fns = [];
          for ( var i = 1; i <= fixtureOptions.users.numToGenerate; i++ ){
            fns.push(function( callback ){
              dirac.dals.users.insert({
                name: 'User ' + i
              }, callback );
            });
          }

          async.series( fns, done );
        });
      });
    });

    it ('should return all users', function( done ){
      dirac.dals.users.find( {}, function( error, results ){
        assert( !error );
        assert( results.length == fixtureOptions.users.numToGenerate );
        done();
      });
    });

    it ('add simple where clause', function( done ){
      var $query = {
        id: {
          $gt: parseInt( fixtureOptions.users.numToGenerate / 2 )
        }
      }
      dirac.dals.users.find( $query, function( error, results ){
        assert( !error );
        assert(
          results.filter( function( result ){
            return result.id > $query.id.$gt
          }).length == results.length
        );
        done();
      });
    });
  });

  describe ('DAL.update', function(){

    before(function(done){
      destroyTables( function( error ){
        if ( error ) return done( error );

        dirac.destroy();
        dirac.init( connString );

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

        dirac.sync( function( error ){
          if ( error ) return done( error );

          dirac.dals.users.insert( { name: 'User' }, done );
        });
      });
    });

    it ('should update', function( done ){
      var $update = { name: 'Bob' };
      dirac.dals.users.update( 1, $update, function( error, results ){
        assert( !error );
        dirac.dals.users.findOne( 1, function( error, result ){
          assert( !error );
          assert( result.name, $update.name );
          done();
        });
      });
    });
  });

  describe ('DAL.remove', function(){

    before(function(done){
      destroyTables( function( error ){
        if ( error ) return done( error );

        dirac.destroy();
        dirac.init( connString );

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

        dirac.sync( function( error ){
          if ( error ) return done( error );

          dirac.dals.users.insert( { name: 'User' }, done );
        });
      });
    });

    it ('should remove', function( done ){
      dirac.dals.users.remove( 1, function( error, results ){
        assert( !error );
        dirac.dals.users.findOne( 1, function( error, result ){
          assert( !error );
          assert( !result );
          done();
        });
      });
    });
  });

  describe ('DAL filters', function(){

    var fixtureOptions = {
      users: {
        numToGenerate: 100
      }
    };

    before(function(done){
      destroyTables( function( error ){
        if ( error ) return done( error );

        dirac.destroy();
        dirac.init( connString );

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

        dirac.sync( function( error ){
          if ( error ) return done( error );

          var fns = [];
          for ( var i = 1; i <= fixtureOptions.users.numToGenerate; i++ ){
            fns.push(function( callback ){
              dirac.dals.users.insert({
                name: 'User ' + i
              }, callback );
            });
          }

          async.series( fns, done );
        });
      });
    });

    it ('should add a before filter', function(){
      var gotCalled = false;

      dirac.dals.users.before( 'insert', function( $query, schema, next ){
        gotCalled = true;
        next();
      });

      dirac.dals.users.insert({ name: 'Bob' });
      assert( gotCalled );
    });

    it ('should add an after filter', function( done ){
      var gotCalled = false;

      dirac.dals.users.after( 'find', function( results, $query, schema, next ){
        gotCalled = true;
        next();
      });

      dirac.dals.users.find({ name: 'Bob' }, function( error, result ){
        assert( !error );
        assert( gotCalled );
        done();
      });
    });

  });
});