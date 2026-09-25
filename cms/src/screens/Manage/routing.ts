export const routing = {
  manage: '/manage',
  me: '/manage/me',
  entityList: (entity: string) => `/manage/e/${entity}`,
  entityAdd: (entity: string) => `/manage/e/${entity}/add`,
  entityEdit: (entity: string, id: string) => `/manage/e/${entity}/edit/${id}`,
  entityShow: (entity: string, id: string) => `/manage/e/${entity}/show/${id}`,
}
