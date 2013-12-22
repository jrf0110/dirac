var dirac = module.exports = require('./lib/dirac');
var diracSchema = require('./lib/dirac-table');

// Middleware
dirac.tableRef    = require('./middleware/table-ref');
dirac.castToJSON  = require('./middleware/cast-to-json');
dirac.embeds      = require('./middleware/embeds');