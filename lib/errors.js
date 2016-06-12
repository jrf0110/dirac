module.exports.MissingPool = class MissingPoolError extends Error {
  constructor(){
    super('Must supply an instance of Pool');
  }
}