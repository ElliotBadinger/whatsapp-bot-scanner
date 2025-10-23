module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  env: {
    jest: true,
  },
  globals: {
    vi: 'readonly',
  },
};
