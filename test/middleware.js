var _         = require('lodash');
var async     = require('async');
var dirac     = require('../');
var assert    = require('assert');

describe ('Middleware', function(){
  describe('Cast To JSON', function(){
    beforeEach( function( done ){
      dirac.destroy();

      dirac.use( dirac.castToJSON() );

      dirac.register({
        name: 'test_a'
      , schema: {
          test_field: {
            type: 'json'
          }
        }
      });

      dirac.init({ database: 'dirac_cast_to_json_test'});

      done();
    });

    it('should cast before insert', function( done ){
      dirac.dals.test_a.before('insert', function( $query, schema, next ){
        assert.equal(
          typeof $query.values.test_field
        , 'string'
        );

        done();
      });

      dirac.dals.test_a.insert({
        test_field: {}
      });
    });

    it('should cast before update', function( done ){
      dirac.dals.test_a.before('update', function( $query, schema, next ){
        assert.equal(
          typeof $query.updates.test_field
        , 'string'
        );
        
        done();
      });

      dirac.dals.test_a.update({}, {
        test_field: {}
      });
    });
  });

  describe ('Table References', function(){
    beforeEach( function(){
      dirac.destroy();
      dirac.use( dirac.tableRef() );
    });

    it ('should add column refs', function(){
      dirac.register({
        name: 'groups'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , name:  { type: 'text' }
        , uid:   { type: 'integer', references: { table: 'users' } }
        }
      });

      dirac.init({ connString: 'postgres://localhost/db_does_not_matter' });

      assert( dirac.dals.groups.schema.uid.references.column === 'id' );
    });
  });

  describe ('Embeds', function(){
    beforeEach( function(){
      dirac.destroy();
      dirac.use( dirac.embeds() );
    });

    it ('should embed groups', function( done ){
      dirac.register({
        name: 'users'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , email: { type: 'text' }
        }

      , defaultEmbeds: {
          groups: true
        }

      , embeds: {
          groups: function( results, $query, callback ){
            if ( results.length === 0 ) return callback();
            dirac.dals.groups.find({ uid: results[0].id }, callback );
          }
        }
      });

      dirac.register({
        name: 'groups'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'integer', references: { table: 'users' } }
        , name:  { type: 'text' }
        }
      });

      dirac.init({ connString: 'postgres://localhost/dirac_test' });

      dirac.sync({ force: true }, function(){
        async.waterfall([
          function( cb ){
            dirac.dals.users.insert( { email: 'blah' }, cb );
          }
        , function( results, cb ){
            dirac.dals.groups.insert({ name: 'test', uid: results[0].id }, cb );
          }
        ], function( error ){
          assert( !error );

          dirac.dals.users.findOne( 1, function( error, user ){
            assert( !error );
            assert( Array.isArray( user.groups ) );
            assert( user.groups.length === 1 );
            assert( user.groups[0].name === 'test' );
            done();
          });
        });
      });
    });
  });

  describe('Directory', function(){
    beforeEach( function(){
      dirac.destroy();
    });

    it ('should use a directory for dal registration', function(){
      dirac.use( dirac.dir( __dirname + '/test-dals' ) );
      dirac.init({ connString: 'postgres://localhost/dirac_test' });
      assert( dirac.dals.test_tbl instanceof dirac.DAL );
    });
  });

  describe( 'Relationships', function(){
    beforeEach( function(){
      dirac.destroy();
    });

    it( 'Should describe a one-to-many relationship', function( done ){
      dirac.use( dirac.relationships() );

      dirac.register({
        name: 'users'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , email: { type: 'text' }
        }
      });

      dirac.register({
        name: 'groups'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'integer', references: { table: 'users', column: 'id' } }
        , name:  { type: 'text' }
        }
      });

      dirac.init({ connString: 'postgres://localhost/dirac_test' });

      async.waterfall([
        dirac.sync.bind( dirac, { force: true } )
      , function( next ){
          dirac.dals.users.insert( { email: 'poop@poop.com' }, function( error, user ){
            assert( !error, error );

            user = user[0];

            assert( user.id );

            next( null, user );
          });
        }

        // Insert some other users to ensure we're not screwing this up
      , function( user, next ){
          dirac.dals.users.insert( { email: 'poop2@poop.com' }, function( error, user2 ){
            assert( !error, error );

            user2 = user2[0];

            assert( user2.id );

            next( null, user, user2 );
          });
        }

      , function( user, user2, next ){
          var groups = [
            { uid: user.id, name: 'client '}
          , { uid: user.id, name: 'test-123 '}
          ];

          dirac.dals.groups.insert( groups.concat({ uid: user2.id, name: 'client' }), function( error ){
            return next( error, user, groups );
          });
        }

      , function( user, groups, next ){
          dirac.dals.users.findOne( user.id, { many: [{ table: 'groups' }] }, function( error, user ){
            assert( !error, error );

            assert( Array.isArray( user.groups ), 'user.groups is ' + typeof user.groups );
            groups = groups.map( function( g ){
              return g.name;
            });

            user.groups.map( function( g ){
              return g.name;
            }).forEach( function( g ){
              assert( groups.indexOf( g ) > -1, g + ' not in original groups' );
            });

            next();
          });
        }
      ], done );
    });

    it( 'Should describe a one-to-one relationship', function( done ){
      dirac.use( dirac.relationships() );

      dirac.register({
        name: 'users'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , email: { type: 'text' }
        }
      });

      dirac.register({
        name: 'extension'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'integer', references: { table: 'users', column: 'id' } }
        , name:  { type: 'text' }
        }
      });

      var EXTENSION_NAME = 'Blah';

      dirac.init({ connString: 'postgres://localhost/dirac_test' });

      async.waterfall([
        dirac.sync.bind( dirac, { force: true } )
      , function( next ){
          dirac.dals.users.insert( { email: 'poop@poop.com' }, function( error, user ){
            assert( !error, error );

            user = user[0];

            assert( user.id );

            next( null, user );
          });
        }

      , function( user, next ){
          dirac.dals.extension.insert( { uid: user.id, name: EXTENSION_NAME }, function( error ){
            return next( error, user );
          });
        }

      , function( user, next ){
          dirac.dals.users.findOne( user.id, { one: [{ table: 'extension' }] }, function( error, user ){
            assert( !error, error );

            assert.equal( user.extension.name, EXTENSION_NAME );

            next();
          });
        }
      ], done );
    });

    it( 'Should describe a one-to-many relationship, but pluck a column', function( done ){
      dirac.use( dirac.relationships() );

      dirac.register({
        name: 'users'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , email: { type: 'text' }
        }
      });

      dirac.register({
        name: 'groups'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'integer', references: { table: 'users', column: 'id' } }
        , name:  { type: 'text' }
        }
      });

      dirac.init({ connString: 'postgres://localhost/dirac_test' });

      async.waterfall([
        dirac.sync.bind( dirac, { force: true } )
      , function( next ){
          dirac.dals.users.insert( { email: 'poop@poop.com' }, function( error, user ){
            assert( !error, error );

            user = user[0];

            assert( user.id );

            next( null, user );
          });
        }

      , function( user, next ){
          var groups = [
            { uid: user.id, name: 'client-blah '}
          , { uid: user.id, name: 'test-1234'}
          ];

          dirac.dals.groups.insert( groups, function( error ){
            return next( error, user, groups );
          });
        }

      , function( user, groups, next ){
          dirac.dals.users.findOne( user.id, { pluck: [{ table: 'groups', column: 'name' }] }, function( error, user ){
            assert( !error, error );

            assert( Array.isArray( user.groups ), 'user.groups is ' + typeof user.groups );
            groups = groups.map( function( g ){
              return g.name;
            });

            user.groups.forEach( function( g ){
              assert( groups.indexOf( g ) > -1, g + ' not in original groups' );
            });

            next();
          });
        }
      ], done );
    });

    it.only( 'Should describe a mixin relationship', function( done ){
      dirac.use( dirac.relationships() );

      dirac.register({
        name: 'users'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , email: { type: 'text' }
        }
      });

      dirac.register({
        name: 'orders'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'integer', references: { table: 'users', column: 'id' } }
        }
      });

      dirac.register({
        name: 'invoices'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , uid:   { type: 'int', references: { table: 'users', column: 'id' } }
        }
      });

      dirac.register({
        name: 'invoice_orders'
      , schema: {
          id:    { type: 'serial', primaryKey: true }
        , iid:   { type: 'integer', references: { table: 'invoices', column: 'id' } }
        , oid:   { type: 'integer', references: { table: 'orders', column: 'id' } }
        }
      });

      dirac.init({ connString: 'postgres://localhost/dirac_test' });

      async.waterfall([
        dirac.sync.bind( dirac, { force: true } )
        // Insert some noise in our data
      , dirac.dals.users.insert.bind( dirac.dals.users, { email: 'test1@test.com '} )
      , function( user, next ){
          return dirac.dals.orders.insert( { uid: user.id }, next );
        }
      , function( order, next ){
          dirac.dals.users.insert( { email: 'poop@poop.com' }, function( error, user ){
            assert( !error, error );

            user = user[0];

            assert( user.id );

            next( null, user );
          });
        }

      , function( user, next ){
          var orders = new Array(2)
            .join()
            .split(',')
            .map( _.identity.bind( null, { uid: user.id }) );

          dirac.dals.orders.insert( orders, function( error, results ){
            return next( error, user, results );
          });
        }

      , function( user, orders, next ){
          var doc = {
            uid: user.id
          };

          dirac.dals.invoices.insert( doc, function( error, invoice ){
            return next( error, user, orders, invoice[0] );
          });
        }

      , function( user, orders, invoice, next ){
          var uios = orders.map( function( order ){
            return { oid: order.id, iid: invoice.id };
          });

          dirac.dals.invoice_orders.insert( uios, function( error, results ){
            return next( error, user, orders, invoice, results );
          });
        }

      , function( user, orders, invoice, uios, next ){
          dirac.dals.invoices.findOne( invoice.id, {
            many: [ { table: 'invoice_orders'
                    , alias: 'orders' 
                    , mixin: [{ table: 'orders'}]
                    }
                  ]
          }, function( error, result ){
            if ( error ) return next( error );

            assert.equal( result.id, invoice.id );
            assert.equal( result.orders.length, uios.length );

            uios.forEach( function( uio, i ){
              assert.equal( result.orders[ i ].iid, uio.iid );
              assert.equal( result.orders[ i ].oid, uio.oid );
              assert.equal( result.orders[ i ].uid, user.id );
            });

            return next();
          });
        }
      ], done );
    });
  });
});