import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { CodePlaygroundComponent } from './code-playground.component';
import { AuthService } from '../../services/auth.service';
import { PlaygroundSessionService } from '../../services/playground-session.service';
import { LocalPlaygroundSessionService } from '../../services/local-playground-session.service';
import { GuestSavePromptService } from '../../core/guest-save-prompt.service';
import { CodeExecutionService } from '../../services/code-execution.service';
import { NavHistoryService } from '../../services/nav-history.service';

describe('CodePlaygroundComponent', () => {
  let fixture: ComponentFixture<CodePlaygroundComponent>;
  let component: CodePlaygroundComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let pgSessionService: jasmine.SpyObj<PlaygroundSessionService>;
  let localPgSessionService: jasmine.SpyObj<LocalPlaygroundSessionService>;
  let savePrompt: jasmine.SpyObj<GuestSavePromptService>;
  let toastController: jasmine.SpyObj<ToastController>;
  let toastConfig: any;
  let router: Router;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    pgSessionService = jasmine.createSpyObj<PlaygroundSessionService>('PlaygroundSessionService', ['createSession', 'updateSession']);
    localPgSessionService = jasmine.createSpyObj<LocalPlaygroundSessionService>('LocalPlaygroundSessionService', ['createSession', 'updateSession']);
    savePrompt = jasmine.createSpyObj<GuestSavePromptService>('GuestSavePromptService', ['promptSaveDestination']);

    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    const codeExecutionSpy = jasmine.createSpyObj<CodeExecutionService>('CodeExecutionService', [
      'runInPage', 'getPendingTimerCount', 'stopCapture', 'buildWebMarkup', 'transpileTypeScript', 'runPython'
    ]);
    codeExecutionSpy.getPendingTimerCount.and.returnValue(0);
    codeExecutionSpy.buildWebMarkup.and.returnValue('' as any);
    const navHistorySpy = jasmine.createSpyObj<NavHistoryService>('NavHistoryService', ['back'], { canGoBack: false });

    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {}
    } as unknown as MediaQueryList);

    await TestBed.configureTestingModule({
      imports: [CodePlaygroundComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: PlaygroundSessionService, useValue: pgSessionService },
        { provide: LocalPlaygroundSessionService, useValue: localPgSessionService },
        { provide: GuestSavePromptService, useValue: savePrompt },
        { provide: ToastController, useValue: toastController },
        { provide: CodeExecutionService, useValue: codeExecutionSpy },
        { provide: NavHistoryService, useValue: navHistorySpy }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(CodePlaygroundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture?.destroy());

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  describe('onSaveClick() — authenticated user', () => {
    beforeEach(() => authService.isAuthenticated.and.returnValue(true));

    it('creates an account session on first save', async () => {
      pgSessionService.createSession.and.returnValue(of({ _id: 'acct-1' } as any));
      pgSessionService.updateSession.and.returnValue(of({} as any));

      await component.onSaveClick();

      expect(pgSessionService.createSession).toHaveBeenCalledTimes(1);
      expect(pgSessionService.updateSession).toHaveBeenCalledWith('acct-1', jasmine.any(Object));
      expect(toastConfig.color).toBe('success');
    });

    it('reuses the same session id on a second save instead of creating another', async () => {
      pgSessionService.createSession.and.returnValue(of({ _id: 'acct-1' } as any));
      pgSessionService.updateSession.and.returnValue(of({} as any));

      await component.onSaveClick();
      await component.onSaveClick();

      expect(pgSessionService.createSession).toHaveBeenCalledTimes(1);
      expect(pgSessionService.updateSession).toHaveBeenCalledTimes(2);
    });

    it('shows a danger toast when saving fails', async () => {
      pgSessionService.createSession.and.returnValue(throwError(() => new Error('down')));

      await component.onSaveClick();

      expect(toastConfig.color).toBe('danger');
    });

    it('never prompts the guest save-destination dialog for an authenticated user', async () => {
      pgSessionService.createSession.and.returnValue(of({ _id: 'acct-1' } as any));
      pgSessionService.updateSession.and.returnValue(of({} as any));

      await component.onSaveClick();

      expect(savePrompt.promptSaveDestination).not.toHaveBeenCalled();
    });
  });

  describe('onSaveClick() — guest', () => {
    beforeEach(() => authService.isAuthenticated.and.returnValue(false));

    it('saves locally when the guest chooses "local"', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('local');
      localPgSessionService.createSession.and.returnValue(of({ _id: 'local-1' } as any));
      localPgSessionService.updateSession.and.returnValue(of({} as any));

      await component.onSaveClick();

      expect(localPgSessionService.createSession).toHaveBeenCalled();
      expect(toastConfig.message).toBe('Saved on this device');
    });

    it('reuses the local session id across repeated local saves', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('local');
      localPgSessionService.createSession.and.returnValue(of({ _id: 'local-1' } as any));
      localPgSessionService.updateSession.and.returnValue(of({} as any));

      await component.onSaveClick();
      await component.onSaveClick();

      expect(localPgSessionService.createSession).toHaveBeenCalledTimes(1);
    });

    it('navigates to /login with a returnUrl when the guest chooses "login"', async () => {
      savePrompt.promptSaveDestination.and.resolveTo('login');

      await component.onSaveClick();

      expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/playground-sessions' } });
      expect(localPgSessionService.createSession).not.toHaveBeenCalled();
    });

    it('does nothing when the guest dismisses the prompt (null)', async () => {
      savePrompt.promptSaveDestination.and.resolveTo(null);

      await component.onSaveClick();

      expect(localPgSessionService.createSession).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('prompts with a playground-specific header', async () => {
      savePrompt.promptSaveDestination.and.resolveTo(null);
      await component.onSaveClick();
      expect(savePrompt.promptSaveDestination).toHaveBeenCalledWith('Save this playground');
    });
  });
});
