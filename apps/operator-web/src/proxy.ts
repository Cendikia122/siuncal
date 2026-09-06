import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

// --- CRIT-03: Next.js 16 proxy.ts auth guard ---
// --- MED-05: Validate JWT token, not just check existence ---

const JWT_SECRET = process.env.JWT_SECRET

const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback
  return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes"
}

const MOCK_MODE = process.env.NODE_ENV === "production"
  ? false
  : parseBooleanEnv(process.env.MOCK_MODE ?? process.env.NEXT_PUBLIC_MOCK_MODE, true)

/**
 * Decode and verify the JWT token at the edge.
 * If JWT_SECRET is not available at edge (build-time), fallback to existence check.
 */
async function isTokenValid(token: string): Promise<boolean> {
  if (!token) return false

  // Basic structure check: JWT must have 3 dot-separated parts
  const parts = token.split(".")
  if (parts.length !== 3) return false

  // If JWT_SECRET is available, do full verification
  if (JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET)
      await jwtVerify(token, secret)
      return true
    } catch {
      return false
    }
  }

  // SECURITY: JWT_SECRET not available at edge — fail closed to prevent forged token bypass
  console.error("[proxy] JWT_SECRET not configured in proxy runtime. Denying request.")
  return false
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("sentra_access")?.value
  const { pathname } = request.nextUrl

  if (MOCK_MODE) {
    return withSecurityHeaders(NextResponse.next())
  }

  // Protected routes: require valid token
  if (pathname.startsWith("/dashboard")) {
    if (!token || !(await isTokenValid(token))) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }
  }

  // Redirect authenticated users away from login
  if (pathname.startsWith("/auth/login") && token && (await isTokenValid(token))) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return withSecurityHeaders(NextResponse.next())
}

function withSecurityHeaders(response: NextResponse) {
  // --- MED-09: Add security headers at edge ---
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")

  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/login"]
}
