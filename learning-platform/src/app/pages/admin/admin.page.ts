import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { ThemeSelectorComponent } from '../../components/theme-selector/theme-selector.component';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, ThemeSelectorComponent]
})
export class AdminPage implements OnInit {
  currentUser: User | null = null;
  isSidebarOpen = true;
  selectedMenu = 'dashboard';

  menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/admin' },
    { id: 'language-tabs', label: 'Language Tabs', icon: 'pricetags-outline', route: '/admin/language-tabs' },
    { id: 'beginner', label: 'Beginner', icon: 'leaf-outline', route: '/admin/topics/beginner' },
    { id: 'intermediate', label: 'Intermediate', icon: 'fitness-outline', route: '/admin/topics/intermediate' },
    { id: 'advance', label: 'Advance', icon: 'rocket-outline', route: '/admin/topics/advance' },
    { id: 'expert', label: 'Expert', icon: 'trophy-outline', route: '/admin/topics/expert' },
    { id: 'playground', label: 'Playground Settings', icon: 'code-slash-outline', route: '/admin/playground' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    if (!this.currentUser || !this.authService.isAdmin()) {
      this.router.navigate(['/login']);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  selectMenu(menuId: string, route: string) {
    this.selectedMenu = menuId;
    this.router.navigate([route]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
