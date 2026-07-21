import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { PlaygroundWorkspaceComponent } from '../playground-workspace/playground-workspace.component';

@Component({
  selector: 'app-code-playground',
  template: `
    <ion-content>
      <app-playground-workspace mode="web" [showModeTabs]="true" [showHeader]="true"></app-playground-workspace>
    </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, PlaygroundWorkspaceComponent]
})
export class CodePlaygroundComponent {}
