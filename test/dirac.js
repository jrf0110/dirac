const assert = require('assert')
const dirac = require('../')
const Table = require('../lib/table')

describe('Dirac', () => {
  it('Should allow for tables with middleware', () => {
    let db = dirac()

    const fooTable = new Table({
      name: 'foo'
    , schema: {
        id: { type: 'serial', primaryKey: true }
      }
    })
    .before(function MyQueryTransform( query ){
      return query
    })

    db = db.register( fooTable )

    const query = db.foo.query()

    assert.equal(query.queryTransforms.length, 2)
    assert.equal(query.queryTransforms[0].handler.name, 'MyQueryTransform')
  })
})