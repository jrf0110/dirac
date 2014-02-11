module.exports = {
  name: 'test_tbl'

, schema: {
    id:         { type: 'int', primaryKey: true }
  , createdAt:  { type: 'timestamp', default: 'now()' }
  }
};