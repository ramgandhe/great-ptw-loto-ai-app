module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/../tests'],
  testMatch: ['<rootDir>/../tests/**/*.spec.ts'],
  testTimeout: 30000,
  maxWorkers: process.env.CI ? 1 : '50%',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
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
  },
};
