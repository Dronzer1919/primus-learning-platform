import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonicModule],
})
export class AppComponent {
  constructor(private themeService: ThemeService) {}
}
