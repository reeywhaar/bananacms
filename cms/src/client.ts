// Client API for sites ('use client' components). Link works in server components too.
export { Link } from './framework/link.tsx'
export type { ErrorComponent, ErrorPageProps } from './framework/error-boundary.tsx'
export {
  useNavigationPending,
  usePathname,
  useRouter,
  useSearchParams,
  type Router,
} from './framework/navigation.ts'
