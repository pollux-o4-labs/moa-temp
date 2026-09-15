import { APP_ROUTES } from "./app-routes.ts";
import { AUTH_VALIDATION_ORIGIN } from "./auth-contract.ts";

export function authSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${APP_ROUTES.signIn}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignInPath(returnTo: string): string {
  return authSignInPath(returnTo);
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return APP_ROUTES.home;

  let url: URL;
  try {
    url = new URL(value, AUTH_VALIDATION_ORIGIN);
  } catch {
    return APP_ROUTES.home;
  }
  if (url.origin !== AUTH_VALIDATION_ORIGIN) return APP_ROUTES.home;
  if (isReservedAuthPath(url.pathname)) return APP_ROUTES.home;

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === APP_ROUTES.signIn ||
    pathname === APP_ROUTES.signOut ||
    pathname === APP_ROUTES.callback
  );
}
