// Client API for sites ('use client' components). Link and the asset URLs work in
// server components too.
export { Link } from './framework/link.tsx'
export { getAssetUrl, getOptimizedAssetSrcSet, getOptimizedAssetUrl } from './lib/getAssetUrl.ts'
export type { ErrorComponent, ErrorPageProps } from './framework/error_boundary.tsx'
export {
  useNavigationPending,
  usePathname,
  useRouter,
  useSearchParams,
  type Router,
} from './framework/navigation.ts'
