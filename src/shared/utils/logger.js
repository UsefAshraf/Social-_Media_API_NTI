// Activity logs are noise in test output; errors are always printed
const log = (...args) => {
  if (process.env.NODE_ENV !== 'test') console.log(...args);
};

module.exports = { log };
