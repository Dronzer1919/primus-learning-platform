import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

export type SaveDestination = 'local' | 'login' | null;

/**
 * The "you're not logged in" fork shown wherever a guest tries to save.
 * Deliberately stateless — it just returns the visitor's choice; each caller
 * decides what "local" and "login" mean for its own feature (which local
 * service to write to, which returnUrl to send them to).
 */
@Injectable({ providedIn: 'root' })
export class GuestSavePromptService {
  constructor(private alertController: AlertController) {}

  async promptSaveDestination(header = 'Save your work'): Promise<SaveDestination> {
    return new Promise<SaveDestination>(async (resolve) => {
      let resolved = false;
      const settle = (value: SaveDestination) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const alert = await this.alertController.create({
        header,
        message: "You're not logged in. Save on this device only, or log in to save to your account.",
        cssClass: 'app-confirm-alert guest-save-alert',
        buttons: [
          { text: '✕', role: 'cancel', cssClass: 'guest-save-btn guest-save-btn-cancel', handler: () => settle(null) },
          {
            text: 'Save on this device',
            cssClass: 'guest-save-btn guest-save-btn-local',
            handler: () => settle('local')
          },
          {
            text: 'Log in / Sign up',
            cssClass: 'guest-save-btn guest-save-btn-login',
            handler: () => settle('login')
          }
        ]
      });

      alert.onDidDismiss().then(() => settle(null));
      await alert.present();
    });
  }
}
