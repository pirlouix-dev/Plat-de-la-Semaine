import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { setBaseUrl } from './services/api';
import { __resetI18nForTests } from './i18n';

setBaseUrl('http://localhost:5126');

beforeEach(() => {
  // jsdom reports an English browser locale, so pin the default explicitly to
  // keep tests independent from the machine running them.
  __resetI18nForTests('en');
});

const memoryStorage = new Map<string, string>();

const defaultLocalStorage: Storage = {
  get length() {
    return memoryStorage.size;
  },
  clear: () => {
    memoryStorage.clear();
  },
  getItem: (key) => memoryStorage.get(key) ?? null,
  key: (index) => [...memoryStorage.keys()][index] ?? null,
  removeItem: (key) => {
    memoryStorage.delete(key);
  },
  setItem: (key, value) => {
    memoryStorage.set(key, String(value));
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: defaultLocalStorage,
  configurable: true,
  writable: true,
});

if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  });
}

if (!globalThis.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    configurable: true,
    writable: true,
  });
}
