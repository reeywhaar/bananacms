import type { ComponentType } from 'react'
import type { Database } from 'sqlite'
import CategoryEdit from '@cms/screens/Manage/EntityEdit/CategoryEdit/CategoryEdit'
import CategoryShow from '@cms/screens/Manage/EntityEdit/CategoryEdit/CategoryShow'
import PostEdit from '@cms/screens/Manage/EntityEdit/PostEdit/PostEdit'
import PageEdit from '@cms/screens/Manage/EntityEdit/PageEdit/PageEdit'
import TagEdit from '@cms/screens/Manage/EntityEdit/TagEdit/TagEdit'
import { CategoryStore } from '@cms/services/CategoryStore'
import { PostStore } from '@cms/services/PostStore'
import { PageStore } from '@cms/services/PageStore'
import { TagStore } from '@cms/services/TagStore'

export type EntityStore = {
  new (db: Database): {
    getAll(): Promise<{ id: string; name: string }[]>
  }
}

export type EntityDescriptor = {
  entityName: string
  displayName: string
  store: EntityStore
  editor: ComponentType<{ id?: string }>
  show?: ComponentType<{ id?: string }>
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
  },
}

export function getEntityDescriptor(name: string): EntityDescriptor | undefined {
  return registry[name]
}

export function getAllEntityDescriptors(): EntityDescriptor[] {
  return Object.values(registry)
}
