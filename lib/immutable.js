/**
 * @class  Immutable
 * Creates an object with immutable helper methods. It is
 * expected that implementors of an Immutable class will
 * implement their own `clone()` method as this is usually
 * specific to each object type
 */
class Immutable {
  /**
   * Create an instance of @Immutable
   * @param  {Object} options Options passed to instance
   * @return {Immutable}       
   */
  static create( options ){
    return new this( options );
  }

  /**
   * Create an instance of @Immutable
   * Assumes that you are wanting to create an object with some
   * options and to assign those options to the instance
   * 
   * Relevant Options:
   * {
   *   // Whether or not this instance should behave immutably
   *   immutable: true|false
   * }
   * 
   * @param  {Object} options Options passed to instance
   * @return {Immutable}       
   */
  constructor( options = {} ){
    this.options = options;
    this.options.immutable = typeof this.options.immutable === 'boolean'
      ? this.options.immutable : true;
  }

  /**
   * Gets the current instance. If immutable is on, this returns
   * a clone. Otherwise, it returns `this`
   * @return {Immutable} This or a new instance
   */
  instance(){
    return this.options.immutable ? this.clone() : this;
  }

  /**
   * Clone the current instance. It is expected that consumers
   * of this class override this method
   * @return {Immutable}
   */
  clone(){
    var options = Object.assign( {}, this.options );
    return Immutable.create( options );
  }

  /**
   * Temporarily disables immutability so any changes happen
   * to `this` rather than a new instance
   * @param  {Function} handler(this) The function that mutates
   * @return {Immutable} This instance
   */
  mutate( handler ){
    var prev = this.options.immutable;

    this.options.immutable = false;
    handler( this );
    this.options.immutable = prev;

    return this;
  }
}

module.exports = Immutable;