/**
 * Simple test file for the math functions
 */

const assert = require('assert');
const { add, subtract, multiply, divide } = require('./index');

// Test add function
assert.strictEqual(add(2, 3), 5, 'add(2, 3) should return 5');
assert.strictEqual(add(-1, 1), 0, 'add(-1, 1) should return 0');

// Test subtract function
assert.strictEqual(subtract(5, 3), 2, 'subtract(5, 3) should return 2');
assert.strictEqual(subtract(1, 1), 0, 'subtract(1, 1) should return 0');

// Test multiply function
assert.strictEqual(multiply(2, 3), 6, 'multiply(2, 3) should return 6');
assert.strictEqual(multiply(-1, 1), -1, 'multiply(-1, 1) should return -1');

// Test divide function
assert.strictEqual(divide(6, 3), 2, 'divide(6, 3) should return 2');
assert.strictEqual(divide(1, 1), 1, 'divide(1, 1) should return 1');

try {
  divide(1, 0);
  assert.fail('divide(1, 0) should throw an error');
} catch (error) {
  assert.strictEqual(error.message, 'Cannot divide by zero', 'Error message should be "Cannot divide by zero"');
}

console.log('All tests passed!');