module.exports = {
  name: 'dirac_schemas'
, schema: {
    id: {
      type: 'serial'
    , primaryKey: true
    }

  , tableName: {
      type: 'text'
    }

  , schema: {
      type: 'json'
    }

  , version: {
      type: 'int'
    }

  , createdAt: {
      type: 'timestamp'
    , default: 'now()'
    }
  }
};