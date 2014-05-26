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

      dirac.users.find( {}, { many: [{ table: 'groups' }] }, function( error))

      {
        many: [
          { table: 'groups'
          , where: {
              'users.id': '$groups.user_id$'
            }
          , joins: 
          }
        ]
      }
    });
  });
});