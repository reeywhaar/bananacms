import { createElement, type ComponentType, type ReactNode } from 'react'
import type { Context } from '../framework/context.ts'
import type { Db } from './db/client.ts'
import CategoryEdit from '../screens/Manage/EntityEdit/CategoryEdit/CategoryEdit.tsx'
import CategoryShow from '../screens/Manage/EntityEdit/CategoryEdit/CategoryShow.tsx'
import PostEdit from '../screens/Manage/EntityEdit/PostEdit/PostEdit.tsx'
import PageEdit from '../screens/Manage/EntityEdit/PageEdit/PageEdit.tsx'
import TagEdit from '../screens/Manage/EntityEdit/TagEdit/TagEdit.tsx'
import TagShow from '../screens/Manage/EntityEdit/TagEdit/TagShow.tsx'
import { CategoryStore } from '../services/CategoryStore.ts'
import { PostStore } from '../services/PostStore.ts'
import { PageStore } from '../services/PageStore.ts'
import { TagStore } from '../services/TagStore.ts'
import type { PostData } from '../services/PostStore.ts'
import { PostReorderList } from '../components/PostReorderList/PostReorderList.tsx'

export type EntityListItem = { id: string; name: string }

export type EntityStore = {
  new (db: Db): {
    query(): { all(): Promise<EntityListItem[]> }
  }
}

export type EntityDescriptor = {
  entityName: string
  displayName: string
  store: EntityStore
  editor: ComponentType<{ ctx: Context; id?: string }>
  show?: ComponentType<{ ctx: Context; id?: string }>
  renderList?: (ctx: Context, items: EntityListItem[]) => ReactNode
}

const registry: Record<string, EntityDescriptor> = {
  category: {
    entityName: 'category',
    displayName: 'Categories',
    store: CategoryStore,
    editor: CategoryEdit,
    show: CategoryShow,
  },
  post: {
    entityName: 'post',
    displayName: 'Posts',
    store: PostStore,
    editor: PostEdit,
    renderList: (ctx: Context, items: EntityListItem[]) =>
      createElement(PostReorderList, { ctx, posts: items as PostData[] }),
  },
  page: {
    entityName: 'page',
    displayName: 'Pages',
    store: PageStore,
    editor: PageEdit,
  },
  tag: {
    entityName: 'tag',
    displayName: 'Tags',
    store: TagStore,
    editor: TagEdit,
    show: TagShow,
  },
}

export function getEntityDescriptor(name: string): EntityDescriptor | undefined {
  return registry[name]
}

export function getAllEntityDescriptors(): EntityDescriptor[] {
  return Object.values(registry)
}
