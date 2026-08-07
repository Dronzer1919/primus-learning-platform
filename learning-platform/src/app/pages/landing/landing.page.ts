import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';
import { PlaygroundWorkspaceComponent } from '../../components/playground-workspace/playground-workspace.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, ThemeSelectorComponent, PlaygroundWorkspaceComponent]
})
export class LandingPage {
  // Public: the header binds to authService.isLoggedIn$ to pick between the
  // signed-in and signed-out actions.
  constructor(public authService: AuthService) {}
}
