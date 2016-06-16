const assert = require('assert');
const mosql = require('mongo-sql');
const PGPool = require('pg-pool');
const QueryGenerator = require('../lib/query-generator');
const Query = require('../lib/query');
const Immutable = require('../lib/immutable');
const QueryTransform = require('../lib/query-transform');
const ResultTransform = require('../lib/result-transform');

describe('QueryGenerator', ()=>{
  var pool = new PGPool();

  it('constructor()', ()=>{
    var generator = new QueryGenerator({ pool });

    assert( generator instanceof Immutable );

    assert.deepEqual( generator.queryTransforms, [] );
    assert.deepEqual( generator.resultsTransforms, [] );
  });

  it('.getCreateQueryOptions()', ()=>{
    var generator = new QueryGenerator({ pool });
    var options = generator.getCreateQueryOptions();

    assert( 'mosql' in options );
    assert.deepEqual( options.queryTransforms, [] );
    assert.deepEqual( options.resultsTransforms, [] );
  });

  it('.query( query )', ()=>{
    var generator = new QueryGenerator({ pool });
    var query1 = generator.query();

    assert( query1 instanceof Query );

    generator = new QueryGenerator({ pool });
    query1 = generator.query();
    assert.equal( query1.pool, generator.pool );
  });

  it('.clone()', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .before( query => query.where('foo', 'bar') )
      .after( results => results[0] );

    var generator2 = generator1.clone().after( result => 1 );

    // Adding props to gen2 doesn't affect gen1
    assert.equal( generator1.resultsTransforms.length, 1 );

    assert.equal( generator2.queryTransforms.length, 1 );
    assert.equal( generator2.resultsTransforms.length, 2 );
  });

  it('.use( middleware )', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .use( QueryTransform.create( query => query ) );

    assert.equal( generator1.queryTransforms.length, 1 );

    var generator2 = generator1
      .use( QueryTransform.create( query => query ) );

    assert.equal( generator1.queryTransforms.length, 1 );
    assert.equal( generator2.queryTransforms.length, 2 );

    generator1 = generator1.use( ResultTransform.create( results => results ) );

    assert.equal( generator1.resultsTransforms.length, 1 );

    var generator3 = new QueryGenerator({ pool })
      .use( gen => gen.mutate( gen => {
        gen.before( query => query.where('foo', 'bar') );
        gen.after( results => results[0] );
      }));

    assert.equal( generator3.queryTransforms.length, 1 );
    assert.equal( generator3.resultsTransforms.length, 1 );

    assert.throws( ()=>{
      generator1.use({});
    }, QueryGenerator.InvalidTransformError );
  });

  it('.before( transform )', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .before( query => query.where('foo', 'bar') )
      .before( query => query.where('bar.baz', 'foo') );

    var query1 = generator1.query();
    assert.equal( query1.queryTransforms.length, 2 );

    var transformed = query1.getTransformedQuery();

    assert.equal( transformed.queryTransforms.length, 0 );

    assert.deepEqual( transformed.mosqlQuery.where, {
      foo: 'bar'
    , bar: { baz: 'foo' }
    });
  });

  it('.before( transform[] )', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .before([
        query => query.where('foo', 'bar')
      , query => query.where('bar.baz', 'foo')
      ]);

    var query1 = generator1.query();

    assert.equal( query1.queryTransforms.length, 2 );

    var transformed = query1.getTransformedQuery();

    assert.equal( transformed.queryTransforms.length, 0 );

    assert.deepEqual( transformed.mosqlQuery.where, {
      foo: 'bar'
    , bar: { baz: 'foo' }
    });
  });

  it('.after( transform )', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .after( results => results[0] )
      .after( result => {
        return { foo: result };
      });

    var query1 = generator1.query();

    assert.equal( query1.resultsTransforms.length, 2 );

    var result = query1.getTransformedResult([
      { a: 1, b: 2 }
    , { a: 2, b: 3 }
    ]);

    assert.deepEqual( result, {
      foo: { a: 1, b: 2 }
    });
  });

  it('.after( transform[] )', ()=>{
    var generator1 = new QueryGenerator({ pool })
      .after([
        results => results[0]
      , result => { return { foo: result }; }
      ]);

    var query1 = generator1.query();

    assert.equal( query1.resultsTransforms.length, 2 );

    var result = query1.getTransformedResult([
      { a: 1, b: 2 }
    , { a: 2, b: 3 }
    ]);

    assert.deepEqual( result, {
      foo: { a: 1, b: 2 }
    });
  });
});