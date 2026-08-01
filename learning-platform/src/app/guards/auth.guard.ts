import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

// These guards decide what to *render*. They are not access control: the
// localStorage they read is writable by the client, so anyone can set
// role: 'admin' and reach /admin. What they cannot do is make the API answer —
// every admin endpoint re-checks the token and the role server-side (see
// backend/src/middleware/auth.js), so a forged local role produces an empty
// screen and a wall of 403s, not access. Keep it that way: never let the
// client's own claim about its role gate anything that matters.

export const authGuard = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // isAuthenticated() also rejects (and clears) an expired token, so a stale
  // session lands on the login page instead of a shell whose requests all 401.
  if (authService.isAuthenticated()) return true;

  // Carrying the attempted URL means the user returns to where they were going
  // after signing in, rather than being dumped on the home page.
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard = (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) return true;

  // A signed-in non-admin is not lost, just not allowed: send them to their own
  // area. Only a signed-out visitor gets the login page.
  return authService.isAuthenticated()
    ? router.createUrlTree(['/user'])
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
