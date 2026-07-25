import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    // Home page: the Programiz-style compiler workspace (Playground / JavaScript / TypeScript).
    path: '',
    loadComponent: () => import('./components/code-playground/code-playground.component').then((m) => m.CodePlaygroundComponent),
  },
  {
    // Former marketing landing page, kept reachable but no longer the home page.
    path: 'landing',
    loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignupPage),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'language-tabs',
        loadComponent: () => import('./pages/admin/language-tabs-manager/language-tabs-manager.component').then((m) => m.LanguageTabsManagerComponent),
      },
      {
        path: 'topics/:level',
        loadComponent: () => import('./pages/admin/topics-manager/topics-manager.component').then((m) => m.TopicsManagerComponent),
      },
    ]
  },
  {
    path: 'user',
    loadComponent: () => import('./pages/user/user.page').then((m) => m.UserPage),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'content/:topicId/:subtopicId',
        loadComponent: () => import('./components/content-viewer/content-viewer.component').then((m) => m.ContentViewerComponent),
      },
      {
        path: 'notes',
        loadComponent: () => import('./components/user-notes/user-notes.component').then((m) => m.UserNotesComponent),
      },
      {
        path: 'sessions',
        loadComponent: () => import('./components/sessions/sessions.component').then((m) => m.SessionsComponent),
      },
      {
        path: 'playground-sessions',
        loadComponent: () => import('./components/playground-sessions/playground-sessions.component').then((m) => m.PlaygroundSessionsComponent),
      },
    ]
  },
  {
    // Standalone route (not nested under 'user') so the compiler page can use its own
    // minimal Programiz-style header instead of the full UserPage shell/sidebar.
    path: 'user/playground',
    loadComponent: () => import('./components/code-playground/code-playground.component').then((m) => m.CodePlaygroundComponent),
  },
  {
    // Standalone flowchart / diagram builder.
    path: 'flowchart',
    loadComponent: () => import('./components/flowchart/flowchart.component').then((m) => m.FlowchartComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
