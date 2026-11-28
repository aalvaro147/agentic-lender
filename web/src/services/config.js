// Single switch between mock data and the live Firebase backend.
// .env values are always strings, so compare with the text 'true'.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

// WEB-24: live mode against the local Firebase emulators instead of the group project
// (set in .env.emulator, used by npm run dev:emulator).
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true'
