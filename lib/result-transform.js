class ResultTransform {
  static create( handler ){
    return new ResultTransform( handler );
  }

  constructor( handler ){
    this.handler = handler;
  }

  execute( result, query ){
    return this.handler( result, query );
  }
}

ResultTransform.firstRow = ResultTransform.create( ( rows, query )=>{
  return rows[0];
});

module.exports = ResultTransform;