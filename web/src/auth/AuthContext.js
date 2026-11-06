/* The Context object itself.
   Kept in its own plain .js file so AuthProvider.jsx exports only a component
   (required for Vite fast refresh; flagged by the react/only-export-components rule). */

import { createContext } from 'react'

export const AuthContext = createContext(null)
