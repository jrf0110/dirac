var dirac     = require('../');
var assert    = require('assert');

describe ('dirac.use tableRef', function(){
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