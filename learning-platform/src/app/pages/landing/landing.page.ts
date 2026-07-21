import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';
import { PlaygroundWorkspaceComponent } from '../../components/playground-workspace/playground-workspace.component';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, ThemeSelectorComponent, PlaygroundWorkspaceComponent]
})
export class LandingPage {}
