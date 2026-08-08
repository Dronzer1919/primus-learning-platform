// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  googleClientId: '435199756335-8f8b4hib4beknpjhuqvauvfmqanrbgqu.apps.googleusercontent.com',

  // Guest account prefilled on the login page — see environment.prod.ts for the
  // full note. Public by design; never the admin password.
  demoLogin: { username: 'testuser', password: 'GuestDemo123' },

  // Dev-only convenience login for checking the admin panel locally (see the
  // "Login as Admin (Dev)" button on the login page, gated on !production).
  // Deliberately absent from environment.prod.ts, not just hidden behind that
  // check — fileReplacements swaps this whole file out for a production build,
  // so these credentials can never end up in a bundle that ships anywhere.
  // Backed by a dedicated "devadmin" account (backend/ensure-dev-admin.js),
  // separate from any real user's credentials.
  devAdminLogin: { username: 'devadmin', password: 'DevAdmin123!' }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
