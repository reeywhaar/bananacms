import type { Metadata } from '@reeywhaar/bananacms'
import { AssetLinks } from '../components/AssetLinks.tsx'

// in the root layout's folder, so the layout's template leaves its title alone
export const metadata: Metadata = { title: 'Home' }

export default function HomePage() {
  return (
    <>
      <h1>Home</h1>
      <a href="/api/hello">A route handler</a>
      <AssetLinks assetId="01a0d75d-70c6-75de-bf9b-e42213d15194" />
    </>
  )
}
