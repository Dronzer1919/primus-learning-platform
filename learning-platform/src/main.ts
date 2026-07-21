import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
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
  shieldCheckmarkOutline, todayOutline
} from 'ionicons/icons';
import { authInterceptor } from './app/interceptors/auth.interceptor';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// @ionic/angular/standalone does not auto-load ionicons; each icon used in a template must be
// registered here so <ion-icon> has SVG data to render. addIcons registers both the camelCase
// key and its kebab-case alias (e.g. codeSlashOutline -> "code-slash-outline").
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
  shieldCheckmarkOutline, todayOutline
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
});
