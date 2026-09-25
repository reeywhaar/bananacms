import type { ReactNode } from 'react'
import type { Context } from '../../framework/context.ts'
import { notFound } from '../../framework/not-found.ts'
import { renderRoute } from '../../framework/render-route.tsx'
import EntityAdd from './EntityEdit/EntityAdd.tsx'
import EntityEdit from './EntityEdit/EntityEdit.tsx'
import EntityList from './EntityList/EntityList.tsx'
import EntityShow from './EntityShow/EntityShow.tsx'
import Layout from './Layout.tsx'
import LoginPage from './LoginPage/LoginPage.tsx'
import MainPage from './MainPage/MainPage.tsx'
import MePage from './MePage/MePage.tsx'
import { NotFound } from './NotFound.tsx'
import PasswordTokenPage from './PasswordTokenPage/PasswordTokenPage.tsx'
import { getUrl } from '../../framework/context.ts'

type Screen = (ctx: Context, params: Record<string, string>) => ReactNode | Promise<ReactNode>

// The admin's screens, by their URLs under /manage.
const routes: [string, Screen][] = [
  ['/manage', () => MainPage()],
  ['/manage/login', () => LoginPage()],
  ['/manage/invite', (ctx) => PasswordTokenPage({ ctx, kind: 'invite' })],
  ['/manage/recover', (ctx) => PasswordTokenPage({ ctx, kind: 'recover' })],
  ['/manage/me', (ctx) => MePage({ ctx })],
  ['/manage/e/:entity', (ctx, params) => EntityList({ ctx, params: entity(params) })],
  ['/manage/e/:entity/add', (ctx, params) => EntityAdd({ ctx, params: entity(params) })],
  ['/manage/e/:entity/edit/:id', (ctx, params) => EntityEdit({ ctx, params: withId(params) })],
  ['/manage/e/:entity/show/:id', (ctx, params) => EntityShow({ ctx, params: withId(params) })],
]
const screens = routes.map(([pathname, screen]) => [new URLPattern({ pathname }), screen] as const)

const entity = (params: Record<string, string>) => Promise.resolve({ entity: params.entity })
const withId = (params: Record<string, string>) =>
  Promise.resolve({ entity: params.entity, id: params.id })

// The whole /manage document: the screen for the URL inside the admin's layout.
// The screen renders by being called (renderRoute), so its notFound() and
// redirect() apply to the response.
export async function ManageApp({ ctx }: { ctx: Context }) {
  const pathname = getUrl(ctx).pathname.replace(/(.)\/+$/, '$1')
  let found: [Screen, Record<string, string>] | undefined
  for (const [pattern, screen] of screens) {
    const match = pattern.exec({ pathname })
    if (match) {
      found = [screen, match.pathname.groups as Record<string, string>]
      break
    }
  }
  const content = await renderRoute(
    ctx,
    () => (found ? found[0](ctx, found[1]) : notFound()),
    () => <NotFound />,
  )
  return <Layout ctx={ctx}>{content}</Layout>
}
