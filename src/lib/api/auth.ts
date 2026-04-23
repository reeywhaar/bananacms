import { createAction } from './Dispatcher'

export function postAuth(username: string, hash: string) {
  return createAction<void>((dispatch) =>
    dispatch({
      endpoint: '/api/auth',
      method: 'POST',
      body: JSON.stringify({ username, hash }),
    }),
  )
}

export function deleteAuth() {
  return createAction<void>((dispatch) =>
    dispatch({
      endpoint: '/api/auth',
      method: 'DELETE',
    }),
  )
}
