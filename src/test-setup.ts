import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without Vitest globals, React Testing Library cannot register this itself.
afterEach(cleanup);
