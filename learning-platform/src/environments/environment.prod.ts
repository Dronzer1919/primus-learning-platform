// Production configuration — used automatically by `ng build` (fileReplacements).
export const environment = {
  production: true,
  // Your backend API base URL (served behind Nginx + SSL on the API subdomain).
  apiUrl: 'https://api.primuscodex.com/api',
  // Same Google OAuth Client ID used in development (or a production one).
  googleClientId: '435199756335-8f8b4hib4beknpjhuqvauvfmqanrbgqu.apps.googleusercontent.com',

  // Guest account, prefilled on the login page so visitors can look around with
  // one click. This password ships in the JavaScript bundle and is therefore
  // PUBLIC by design — never put the admin password here.
  //
  // It must match DEMO_USER_PASSWORD in kodee-deploy.sh, which is what seeds the
  // `testuser` account. Change it in BOTH places, then redeploy with
  // FORCE_USER_SEED=yes so the account is re-created with the new password.
  demoLogin: { username: 'testuser', password: 'GuestDemo123' }
};
