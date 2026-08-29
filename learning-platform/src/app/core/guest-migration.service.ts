import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { LocalPlaygroundSessionService } from '../services/local-playground-session.service';
import { LocalFlowchartSessionService } from '../services/local-flowchart-session.service';
import { PlaygroundSessionService } from '../services/playground-session.service';
import { FlowchartSessionService } from '../services/flowchart-session.service';

/**
 * Offers to copy a guest's locally-saved (IndexedDB) playground/flowchart
 * sessions up to the account they just signed into. Runs once per successful
 * login/signup — see AuthService.justAuthenticated and app.component.ts.
 */
@Injectable({ providedIn: 'root' })
export class GuestMigrationService {
  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private localPgSessions: LocalPlaygroundSessionService,
    private localFcSessions: LocalFlowchartSessionService,
    private pgSessions: PlaygroundSessionService,
    private fcSessions: FlowchartSessionService
  ) {}

  async checkAndOfferMigration(): Promise<void> {
    const [pgCount, fcCount] = await Promise.all([
      firstValueFrom(this.localPgSessions.count()),
      firstValueFrom(this.localFcSessions.count())
    ]);
    const total = pgCount + fcCount;
    if (total === 0) return;

    const alert = await this.alertController.create({
      header: 'Save your local work to this account?',
      message: `You have ${total} session${total === 1 ? '' : 's'} saved on this device (${pgCount} playground, ${fcCount} flowchart). Save them to your account too?`,
      cssClass: 'app-confirm-alert',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        { text: 'Save to my account', cssClass: 'alert-save-btn', handler: () => this.migrate() }
      ]
    });
    await alert.present();
  }

  private async migrate(): Promise<void> {
    const [localPg, localFc] = await Promise.all([
      firstValueFrom(this.localPgSessions.getSessions()),
      firstValueFrom(this.localFcSessions.getSessions())
    ]);

    let succeeded = 0;
    const failed: string[] = [];

    for (const session of localPg) {
      try {
        const created = await firstValueFrom(this.pgSessions.createSession(session.title));
        await firstValueFrom(
          this.pgSessions.updateSession(created._id, {
            mode: session.mode,
            htmlCode: session.htmlCode,
            cssCode: session.cssCode,
            jsCode: session.jsCode,
            jsOnlyCode: session.jsOnlyCode,
            tsCode: session.tsCode,
            selectedTab: session.selectedTab
          })
        );
        await firstValueFrom(this.localPgSessions.deleteSession(session._id));
        succeeded++;
      } catch {
        failed.push(session.title);
      }
    }

    for (const session of localFc) {
      try {
        await firstValueFrom(
          this.fcSessions.createSession({
            title: session.title,
            nodes: session.nodes,
            edges: session.edges,
            canvasBg: session.canvasBg
          })
        );
        await firstValueFrom(this.localFcSessions.deleteSession(session._id));
        succeeded++;
      } catch {
        failed.push(session.title);
      }
    }

    const total = localPg.length + localFc.length;
    await this.showResultToast(succeeded, total, failed.length);
  }

  private async showResultToast(succeeded: number, total: number, failedCount: number): Promise<void> {
    let message: string;
    let color: string;

    if (succeeded === total) {
      message = `Saved ${succeeded} session${succeeded === 1 ? '' : 's'} to your account.`;
      color = 'success';
    } else if (succeeded === 0) {
      message = "Couldn't reach the server — your local sessions are safe, try again later.";
      color = 'danger';
    } else {
      message = `Saved ${succeeded} of ${total} to your account. ${failedCount} stayed on this device — try again later.`;
      color = 'warning';
    }

    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'bottom' });
    await toast.present();
  }
}
