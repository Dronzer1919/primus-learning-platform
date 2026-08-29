import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PlaygroundWorkspaceComponent } from '../playground-workspace/playground-workspace.component';
import { AuthService } from '../../services/auth.service';
import { PlaygroundSessionService } from '../../services/playground-session.service';
import { LocalPlaygroundSessionService } from '../../services/local-playground-session.service';
import { GuestSavePromptService } from '../../core/guest-save-prompt.service';

@Component({
  selector: 'app-code-playground',
  template: `
    <ion-content>
      <app-playground-workspace
        mode="web"
        [showModeTabs]="true"
        [showHeader]="true"
        [showSave]="true"
        (saveClick)="onSaveClick()"
      ></app-playground-workspace>
    </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, PlaygroundWorkspaceComponent]
})
export class CodePlaygroundComponent {
  @ViewChild(PlaygroundWorkspaceComponent) workspace!: PlaygroundWorkspaceComponent;

  // Set once the first Save creates a session, so repeat saves from this same
  // scratch page update it in place instead of piling up duplicates — staying
  // on this page (no more navigating away on save) means a visitor could
  // otherwise click Save several times without ever seeing the list grow.
  private accountSessionId: string | null = null;
  private localSessionId: string | null = null;

  constructor(
    private authService: AuthService,
    private pgSessionService: PlaygroundSessionService,
    private localPgSessionService: LocalPlaygroundSessionService,
    private savePrompt: GuestSavePromptService,
    private toastController: ToastController,
    private router: Router
  ) {}

  async onSaveClick(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      await this.saveToAccount();
      return;
    }

    const destination = await this.savePrompt.promptSaveDestination('Save this playground');
    if (destination === 'local') {
      await this.saveLocally();
    } else if (destination === 'login') {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/playground-sessions' } });
    }
  }

  private workspaceData() {
    return {
      mode: this.workspace.selectedMode,
      htmlCode: this.workspace.htmlCode,
      cssCode: this.workspace.cssCode,
      jsCode: this.workspace.jsCode,
      jsOnlyCode: this.workspace.jsOnlyCode,
      tsCode: this.workspace.tsCode,
      selectedTab: this.workspace.selectedTab
    };
  }

  private async saveLocally(): Promise<void> {
    if (!this.localSessionId) {
      const session = await firstValueFrom(this.localPgSessionService.createSession());
      this.localSessionId = session._id;
    }
    await firstValueFrom(this.localPgSessionService.updateSession(this.localSessionId, this.workspaceData()));
    await this.showToast('Saved on this device', 'success');
  }

  private async saveToAccount(): Promise<void> {
    try {
      if (!this.accountSessionId) {
        const session = await firstValueFrom(this.pgSessionService.createSession());
        this.accountSessionId = session._id;
      }
      await firstValueFrom(this.pgSessionService.updateSession(this.accountSessionId, this.workspaceData()));
      await this.showToast('Saved!', 'success');
    } catch {
      await this.showToast('Could not save. Please try again.', 'danger');
    }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 1800, color, position: 'bottom' });
    await toast.present();
  }
}
