import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

// The API's origin. Anything not addressed to it is a third party as far as the
// bearer token is concerned.
const apiOrigin = resolveOrigin(environment.apiUrl);

/**
 * Attaches the session token — and only to our own API.
 *
 * The previous version added the Authorization header to every outgoing
 * request, whatever its host. That is how a JWT ends up in a third party's
 * access logs: one absolute URL added later (a CDN, an analytics beacon, an
 * avatar fetched through HttpClient) is enough, and the token it hands over is
 * a full session. Scoping the header to the API origin removes that class of
 * mistake entirely rather than relying on nobody making it.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);

  let token: string | null = null;
  try {
    token = localStorage.getItem('token');
  } catch {
    // Storage can throw in private-browsing modes. An anonymous request is a
    // correct outcome here; throwing would break every call in the app.
    token = null;
  }

  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

function isApiRequest(url: string): boolean {
  // Relative URL: same origin as the app, which is where the API lives in the
  // dev-server proxy setup.
  if (!/^https?:\/\//i.test(url)) return true;
  return resolveOrigin(url) === apiOrigin;
}

function resolveOrigin(url: string): string {
  try {
    return new URL(url, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}
