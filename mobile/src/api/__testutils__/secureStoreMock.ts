/// <reference types="jest" />
// In-memory replacement for expo-secure-store, used as:
//   jest.mock("expo-secure-store", () => require("@/api/__testutils__/secureStoreMock").secureStoreMock)
export const mockSecureStoreData = new Map<string, string>();

export const secureStoreMock = {
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreData.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreData.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreData.delete(key);
  }),
};
