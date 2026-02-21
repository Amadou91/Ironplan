export function isNavRouteActive(pathname: string, path: string): boolean {
  if (!pathname || !path) return false

  return (
    pathname === path
    || (path !== '/' && pathname.startsWith(`${path}/`))
    || (path === '/exercises' && pathname.startsWith('/workout/'))
  )
}
