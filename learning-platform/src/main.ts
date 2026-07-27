import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
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
  // Flowchart builder: header, empty state, and the four directional connect handles.
  gitNetworkOutline, shapesOutline,
  caretUpOutline, caretDownOutline, caretForwardOutline, caretBackOutline,
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
  gitNetworkOutline, shapesOutline,
  caretUpOutline, caretDownOutline, caretForwardOutline, caretBackOutline,
  playBackOutline, playForwardOutline, playSkipForwardOutline, pauseOutline, serverOutline,
  warningOutline,
  chevronDownOutline, eyeOutline, eyeOffOutline, pinOutline, logoYoutube, libraryOutline
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(IonicModule.forRoot()),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
});
