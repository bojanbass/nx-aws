const { getJestProjects } = require('@nrwl/jest');

module.exports = { projects: [...getJestProjects(), '<rootDir>/e2e/nx-aws-cache-e2e'] };
