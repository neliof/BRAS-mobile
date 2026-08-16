module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    // Automock (jest.mock('../storage') sem factory) tem de carregar o
    // módulo real primeiro para gerar o mock, o que arrasta o módulo nativo
    // do AsyncStorage — inexistente fora de um dispositivo. Redireciona
    // sempre para o mock oficial da biblioteca, conforme documentado em
    // https://react-native-async-storage.github.io/async-storage/docs/advanced/jest/
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
