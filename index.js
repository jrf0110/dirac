var dirac = module.exports = require('./lib/dirac');
var diracSchema = require('./lib/dirac-table');

dirac.tableRef = require('dirac-table-ref');
dirac.castToJSON = require('./middleware/cast-to-json');