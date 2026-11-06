// Single switch between mock data and the live Firebase backend.
// .env values are always strings, so compare with the text 'true'.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
