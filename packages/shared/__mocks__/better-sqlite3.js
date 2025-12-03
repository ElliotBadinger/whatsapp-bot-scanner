// Mock for better-sqlite3 to unblock tests during Node.js v25 compatibility issues
module.exports = class MockDatabase {
  constructor(path) {
    this.path = path;
  }
  
  prepare(sql) {
    return {
      run: (...params) => ({ lastInsertRowid: 1, changes: 1 }),
      get: (...params) => null,
      all: (...params) => [],
      finalize: () => {}
    };
  }
  
  exec(sql) {
    return;
  }
  
  close() {
    return;
  }
  
  transaction(fn) {
    return fn;
  }
  
  pragma(sql) {
    return {};
  }
};
