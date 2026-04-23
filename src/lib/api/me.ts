import { createAction } from './Dispatcher'

export function changePassword(currentHash: string, newHash: string) {
  return createAction<void>((dispatch) =>
    dispatch({
      endpoint: '/api/me/password',
      method: 'PUT',
      body: JSON.stringify({ currentHash, newHash }),
    }),
  )
}

export function revokeOtherSessions() {
  return createAction<{ revoked: number }>((dispatch) =>
    dispatch({
      endpoint: '/api/me/sessions',
      method: 'DELETE',
    }),
  )
}
