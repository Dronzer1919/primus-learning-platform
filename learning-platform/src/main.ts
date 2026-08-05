import { bootstrapApplication } from '@angular/platform-browser';
import { ErrorHandler, importProvidersFrom } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline, logOutOutline, logInOutline, logoHtml5, logoCss3, logoJavascript, logoPython,
  refreshOutline, trashOutline, playOutline, playCircleOutline, terminalOutline, terminal, shareSocialOutline,
  expandOutline, contractOutline, codeSlashOutline, documentOutline, documentTextOutline, menuOutline,
  personCircleOutline, personAddOutline, closeOutline, addOutline, addCircleOutline, createOutline,
  copyOutline, pin, alertCircleOutline, chevronForwardOutline, fileTrayOutline, notificationsOutline,
  schoolOutline, bookOutline, listOutline, pricetagsOutline, leafOutline, fitnessOutline, rocketOutline,
  trophyOutline, hardwareChipOutline,
  colorPaletteOutline, checkmarkCircle, sunnyOutline, moonOutline, waterOutline, partlySunnyOutline,
  albumsOutline, mailOutline, callOutline, personOutline, cloudUploadOutline, imageOutline,
  saveOutline, hourglassOutline, gridOutline, sparklesOutline, flashOutline,
  arrowBackOutline, arrowForwardOutline, businessOutline, checkmarkCircleOutline, checkmarkOutline,
  documentsOutline, earthOutline, informationCircleOutline, keyOutline, keypadOutline, locationOutline,
  logoGoogle, mailUnreadOutline, paperPlaneOutline, pencilOutline, peopleOutline, radioButtonOnOutline,
  shieldCheckmarkOutline, todayOutline,
  // Flowchart builder: header, empty state, the four directional connect handles,
  // and the show/hide controls for the shapes and properties panels.
  gitNetworkOutline, shapesOutline, optionsOutline, chevronBackOutline, downloadOutline,
  clipboardOutline,
  caretUpOutline, caretDownOutline, caretForwardOutline, caretBackOutline,
  // Flowchart saved sessions: the toolbar button, the open-session marker in the
  // header and the empty state inside the sessions modal.
  timeOutline, bookmarkOutline, folderOpenOutline,
  // Step-through visualizer controls and panels.
  playBackOutline, playForwardOutline, playSkipForwardOutline, pauseOutline, serverOutline,
  warningOutline,
  // Accordion chevrons (mobile), password visibility toggles, notes pinning, YouTube cards
  // and the mobile "Topics" shortcut. All of these were rendering blank: an unregistered
  // name makes <ion-icon> fall back to fetching /svg/<name>.svg, which this build does not
  // serve, so the request 404s and nothing paints.
  chevronDownOutline, eyeOutline, eyeOffOutline, pinOutline, logoYoutube, libraryOutline
} from 'ionicons/icons';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { dedupeInterceptor } from './app/interceptors/dedupe.interceptor';
import { errorInterceptor } from './app/interceptors/error.interceptor';
import { GlobalErrorHandler, scheduleStaleBuildFlagClear } from './app/core/global-error-handler';
import { installDevToolsGuard } from './app/core/devtools-guard';
import { logError, silenceConsoleInProduction } from './app/core/logger';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Each icon used in a template is registered here so <ion-icon> has SVG data to render.
// addIcons registers both the camelCase key and its kebab-case alias (e.g. codeSlashOutline
// -> "code-slash-outline"). NOTE: the whole app uses IonicModule (@ionic/angular) — do NOT
// import from @ionic/angular/standalone, or icons render blank in production (two registries).
addIcons({
  // Icons whose names end in a digit need explicit kebab aliases: addIcons'
  // auto-conversion turns `logoHtml5` into `logo-html-5` (with a stray dash),
  // so templates using `logo-html5` / `logo-css3` wouldn't find them otherwise.
  'logo-html5': logoHtml5,
  'logo-css3': logoCss3,
  lockClosedOutline, logOutOutline, logInOutline, logoHtml5, logoCss3, logoJavascript, logoPython,
  refreshOutline, trashOutline, playOutline, playCircleOutline, terminalOutline, terminal, shareSocialOutline,
  expandOutline, contractOutline, codeSlashOutline, documentOutline, documentTextOutline, menuOutline,
  personCircleOutline, personAddOutline, closeOutline, addOutline, addCircleOutline, createOutline,
  copyOutline, pin, alertCircleOutline, chevronForwardOutline, fileTrayOutline, notificationsOutline,
  schoolOutline, bookOutline, listOutline, pricetagsOutline, leafOutline, fitnessOutline, rocketOutline,
  trophyOutline, hardwareChipOutline,
  colorPaletteOutline, checkmarkCircle, sunnyOutline, moonOutline, waterOutline, partlySunnyOutline,
  albumsOutline, mailOutline, callOutline, personOutline, cloudUploadOutline, imageOutline,
  saveOutline, hourglassOutline, gridOutline, sparklesOutline, flashOutline,
  arrowBackOutline, arrowForwardOutline, businessOutline, checkmarkCircleOutline, checkmarkOutline,
  documentsOutline, earthOutline, informationCircleOutline, keyOutline, keypadOutline, locationOutline,
  logoGoogle, mailUnreadOutline, paperPlaneOutline, pencilOutline, peopleOutline, radioButtonOnOutline,
  shieldCheckmarkOutline, todayOutline,
  gitNetworkOutline, shapesOutline, optionsOutline, chevronBackOutline, downloadOutline,
  clipboardOutline,
  caretUpOutline, caretDownOutline, caretForwardOutline, caretBackOutline,
  timeOutline, bookmarkOutline, folderOpenOutline,
  playBackOutline, playForwardOutline, playSkipForwardOutline, pauseOutline, serverOutline,
  warningOutline,
  chevronDownOutline, eyeOutline, eyeOffOutline, pinOutline, logoYoutube, libraryOutline
});

// Production hardening, installed before Angular starts so nothing slips through
// during bootstrap: console noise off, DevTools shortcuts blocked (a deterrent
// only — see devtools-guard.ts), and a catch-all for rejections that happen
// outside Angular's zone.
silenceConsoleInProduction();
installDevToolsGuard();

window.addEventListener('unhandledrejection', (event) => {
  // Logged, not swallowed: GlobalErrorHandler still gets the zone-tracked ones
  // and is what decides whether to tell the user. This exists for the rest —
  // Pyodide's loader, CodeMirror internals, anything started outside Angular.
  logError('Unhandled promise rejection', event.reason);
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(IonicModule.forRoot()),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Order is the request's path outwards: dedupe first so simultaneous callers
    // share one call (and one set of retries), then the token, then the error
    // translator closest to the wire so its retries re-issue the real request.
    provideHttpClient(withInterceptors([dedupeInterceptor, authInterceptor, errorInterceptor])),
    provideAnimations(),
    // Replaces Angular's default handler, which only logs. Ours keeps the app
    // running and surfaces the failure instead of leaving a dead-looking page.
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
})
  .then(() => scheduleStaleBuildFlagClear())
  .catch((error) => {
    // Bootstrap failed, so there is no Angular, no ErrorHandler and no toast —
    // just an empty <app-root> and a user with nothing to click. Anything less
    // than this is a white screen with no explanation and no way forward.
    logError('Application failed to start', error);
    showBootstrapFailure();
  });

function showBootstrapFailure(): void {
  const host = document.querySelector('app-root');
  if (!host) return;
  // textContent throughout: this path can be reached while handling untrusted
  // input, and building it as an HTML string would be an injection point in the
  // one place with no framework left to sanitise it.
  const wrap = document.createElement('div');
  wrap.setAttribute(
    'style',
    'font-family:system-ui,sans-serif;max-width:34rem;margin:20vh auto;padding:0 1.5rem;text-align:center;color:#374151'
  );

  const heading = document.createElement('h1');
  heading.textContent = 'This page could not load';
  heading.setAttribute('style', 'font-size:1.25rem;margin:0 0 .5rem');

  const body = document.createElement('p');
  body.textContent = 'Something went wrong while starting the app. Reloading usually fixes it.';
  body.setAttribute('style', 'margin:0 0 1.25rem;line-height:1.5');

  const button = document.createElement('button');
  button.textContent = 'Reload';
  button.setAttribute(
    'style',
    'padding:.6rem 1.4rem;border:0;border-radius:.5rem;background:#6366f1;color:#fff;font-size:1rem;cursor:pointer'
  );
  button.addEventListener('click', () => window.location.reload());

  wrap.append(heading, body, button);
  host.replaceChildren(wrap);
}
