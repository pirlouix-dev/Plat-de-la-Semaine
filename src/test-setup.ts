import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { setBaseUrl } from './services/api';

setBaseUrl('http://localhost:5126');
