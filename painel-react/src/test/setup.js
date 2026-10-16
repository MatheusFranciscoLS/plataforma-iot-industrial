import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem isso, a tela de um teste continuaria montada no seguinte.
afterEach(() => cleanup());
