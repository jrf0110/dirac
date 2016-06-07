class ResultTransform {
  static create( handler ){
    return new ResultTransform( handler );
  }

  constructor( handler ){
    this.handler = handler;
  }

  execute( result ){
    return this.handler( result );
  }
}

ResultTransform.firstRow = ResultTransform.create( ( rows )=>{
  return rows[0];
});

module.exports = ResultTransform;