module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: ['<rootDir>/../tests/**/*.spec.ts'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/../tests/helpers/global-setup.ts',
  maxWorkers: process.env.CI ? 1 : '50%',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // Web modules are type-checked by the web app's own tsc (browser types); here they only run.
        diagnostics: { exclude: ['**/frontend/src/**'] },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/database/migrate.ts',
    '!src/database/seed.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@ptw/shared$': '<rootDir>/../packages/shared/src/index.ts',
    // Web app modules under test use its "@/" alias (the API itself never does).
    '^@/(.*)$': '<rootDir>/../frontend/src/$1',
  },
};
