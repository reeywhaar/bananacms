import { createElement, type ComponentType } from 'react'
import type { Db } from '@cms/lib/db/client'
import CategoryEdit from '@cms/screens/Manage/EntityEdit/CategoryEdit/CategoryEdit'
import CategoryShow from '@cms/screens/Manage/EntityEdit/CategoryEdit/CategoryShow'
import PostEdit from '@cms/screens/Manage/EntityEdit/PostEdit/PostEdit'
import PageEdit from '@cms/screens/Manage/EntityEdit/PageEdit/PageEdit'
import TagEdit from '@cms/screens/Manage/EntityEdit/TagEdit/TagEdit'
import TagShow from '@cms/screens/Manage/EntityEdit/TagEdit/TagShow'
import { CategoryStore } from '@cms/services/CategoryStore'
import { PostStore } from '@cms/services/PostStore'
import { PageStore } from '@cms/services/PageStore'
import { TagStore } from '@cms/services/TagStore'
import { PostData } from '@cms/services/PostStore'
import { PostReorderList } from '@cms/components/PostReorderList/PostReorderList'

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
  editor: ComponentType<{ id?: string }>
  show?: ComponentType<{ id?: string }>
  renderList?: (items: EntityListItem[]) => React.ReactNode
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
    renderList: (items: EntityListItem[]) =>
      createElement(PostReorderList, { posts: items as PostData[] }),
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
