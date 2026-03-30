// Centralized access to bundled flag SVGs (flag-icons).
// We intentionally bundle the SVGs into the dist zip so flags work on systems
// without emoji flag fonts and without relying on CSS url() paths.

// Vite requires globs to start with '/' or './'.
export const FLAG_URLS = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const extractCode = (k: string): string => {
  const m = String(k || '').match(/\/([a-z]{2})\.svg$/i)
  return m ? m[1].toUpperCase() : ''
}

export const FLAG_CODES: string[] = Object.keys(FLAG_URLS)
  .map(extractCode)
  .filter((x) => !!x)
  .sort((a, b) => a.localeCompare(b))
