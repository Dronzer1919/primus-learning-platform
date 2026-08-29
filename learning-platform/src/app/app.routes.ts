import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    // Home page: the Programiz-style compiler workspace (Playground / JavaScript / TypeScript).
    path: '',
    loadComponent: () => import('./components/code-playground/code-playground.component').then((m) => m.CodePlaygroundComponent),
    data: {
      seo: {
        title: 'Online Compiler — Primus Codex',
        description:
          'Free online compiler and learning platform — run HTML/CSS/JS & TypeScript in the browser, visualize code execution, and study interview topics.',
        path: '/',
      },
    },
  },
  {
    // Former marketing landing page, kept reachable but no longer the home page.
    path: 'landing',
    loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
    data: {
      seo: {
        title: 'Primus Codex — Learn to Code Online',
        description: 'Learn HTML, CSS, JavaScript and TypeScript with an in-browser compiler and interview-prep content.',
        path: '/landing',
      },
    },
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
    data: {
      seo: {
        title: 'Log In — Primus Codex',
        description: 'Log in to Primus Codex to save your playground sessions, notes and learning progress.',
        path: '/login',
      },
    },
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignupPage),
    data: {
      seo: {
        title: 'Sign Up — Primus Codex',
        description: 'Create a free Primus Codex account to save your playground sessions, notes and learning progress.',
        path: '/signup',
      },
    },
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
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
      {
        path: 'issues',
        loadComponent: () => import('./pages/admin/issues-manager/issues-manager.component').then((m) => m.IssuesManagerComponent),
      },
    ]
  },
  {
    path: 'user',
    canActivate: [authGuard],
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
        // Ask-AI chat: RAG over the platform's own topic library.
        path: 'rag',
        loadComponent: () => import('./components/rag-assistant/rag-assistant.component').then((m) => m.RagAssistantComponent),
      },
      {
        path: 'playground-sessions',
        loadComponent: () => import('./components/playground-sessions/playground-sessions.component').then((m) => m.PlaygroundSessionsComponent),
      },
      {
        path: 'report-issue',
        loadComponent: () => import('./components/report-issue/report-issue.component').then((m) => m.ReportIssueComponent),
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
    data: {
      seo: {
        title: 'Flowchart Builder — Primus Codex',
        description: 'Build and visualize flowcharts and diagrams online, free, right in your browser.',
        path: '/flowchart',
      },
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
