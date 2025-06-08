// Mock for p-limit module
module.exports = function pLimit(concurrency) {
  // Return a function that simply executes the passed function
  // without any concurrency limiting for testing
  return async function(fn) {
    return fn();
  };
};