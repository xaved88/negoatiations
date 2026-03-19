/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^shared/(.*)$': '<rootDir>/../shared/src/$1',
    '^shared$': '<rootDir>/../shared/src/index',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          module: 'commonjs',
          paths: {
            shared: ['../shared/src'],
            'shared/*': ['../shared/src/*'],
          },
        },
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};

module.exports = config;
