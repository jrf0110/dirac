var dirac = module.exports = require('./lib/dirac');
var utils = require('./lib/utils');
var diracSchema = require('./lib/dirac-table');

// Database Access
dirac.db            = require('./lib/db');

// Middleware
dirac.tableRef      = require('./middleware/table-ref');
dirac.castToJSON    = require('./middleware/cast-to-json');
dirac.embeds        = require('./middleware/embeds');
dirac.dir           = require('./middleware/dir');
dirac.relationships = require('./middleware/relationships');
