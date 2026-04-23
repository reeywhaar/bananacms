import Link from 'next/link'
import { routing } from '../routing'

export default async function ManagePage() {
  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="flex flex-col gap-2">
        <Link href={routing.entityList('page')} className="text-blue-600 hover:underline">
          Pages
        </Link>
        <Link href={routing.entityList('post')} className="text-blue-600 hover:underline">
          Posts
        </Link>
        <Link href={routing.entityList('category')} className="text-blue-600 hover:underline">
          Categories
        </Link>
        <Link href={routing.entityList('tag')} className="text-blue-600 hover:underline">
          Tags
        </Link>
      </div>
    </main>
  )
}
