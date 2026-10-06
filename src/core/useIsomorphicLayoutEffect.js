import { useEffect, useLayoutEffect } from 'react';

// useLayoutEffect warns when rendered on the server (React < 19) and does nothing there anyway.
// This picks the right hook per environment without touching `window` during render.
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
