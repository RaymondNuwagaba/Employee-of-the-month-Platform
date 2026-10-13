import type { AuthenticationResult, PublicClientApplication } from '@azure/msal-browser'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react'
import { api, ApiError } from './api'
import type { AuthConfig, User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  config: AuthConfig | undefined
  signInWithMicrosoft: () => Promise<void>
  devSignIn: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Drop every cached query except the auth ones. qc.clear() would also detach the
// live ['me'] observer, so a following setQueryData would never reach the UI.
const AUTH_KEYS = new Set(['me', 'auth-config'])
const notAuth = { predicate: (q: { queryKey: readonly unknown[] }) => !AUTH_KEYS.has(q.queryKey[0] as string) }

let msal: PublicClientApplication | null = null

async function getMsal(cfg: AuthConfig) {
  if (!msal) {
    // Loaded lazily: MSAL is large and only needed when signing in
    const { PublicClientApplication } = await import('@azure/msal-browser')
    msal = new PublicClientApplication({
      auth: {
        clientId: cfg.client_id!,
        authority: `https://login.microsoftonline.com/${cfg.tenant_id}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    })
    await msal.initialize()
  }
  return msal
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const config = useQuery({ queryKey: ['auth-config'], queryFn: () => api.get<AuthConfig>('/api/auth/config') })
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<User>('/api/auth/me')
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null
        throw e
      }
    },
    retry: false,
  })

  const establish = useCallback(
    (user: User) => {
      qc.removeQueries(notAuth)
      qc.setQueryData(['me'], user)
    },
    [qc],
  )

  // Warm up MSAL on the sign-in screen so the popup opens straight from the click
  // (browsers block popups that open too long after the user's gesture).
  const signedOut = me.data === null
  useEffect(() => {
    if (signedOut && config.data?.sso_enabled) void getMsal(config.data)
  }, [signedOut, config.data])

  const signInWithMicrosoft = useCallback(async () => {
    const cfg = config.data
    if (!cfg?.sso_enabled) throw new ApiError(400, 'Microsoft sign-in has not been configured yet. Please contact the system administrator.')
    const client = await getMsal(cfg)
    let result: AuthenticationResult
    try {
      result = await client.loginPopup({ scopes: ['openid', 'profile', 'email', 'User.Read'], prompt: 'select_account' })
    } catch {
      throw new ApiError(401, 'We could not authenticate your organizational account. Please try again.')
    }
    // ID token proves who you are; the Graph token lets us read department / job title / employee ID.
    const user = await api.post<User>('/api/auth/microsoft', { id_token: result.idToken, graph_token: result.accessToken })
    establish(user)
  }, [config.data, establish])

  const devSignIn = useCallback(
    async (email: string) => establish(await api.post<User>('/api/auth/dev-login', { email })),
    [establish],
  )

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout')
    qc.removeQueries(notAuth)
    qc.setQueryData(['me'], null)
    if (msal) await msal.clearCache().catch(() => undefined)
  }, [qc])

  return (
    <AuthContext.Provider
      value={{
        user: me.data ?? null,
        loading: me.isLoading || config.isLoading,
        config: config.data,
        signInWithMicrosoft,
        devSignIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const isStaff = (u: User | null) => u?.role === 'hr' || u?.role === 'admin'
export const isAdmin = (u: User | null) => u?.role === 'admin'
