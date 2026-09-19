import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { GuestSavePromptService } from './guest-save-prompt.service';

describe('GuestSavePromptService', () => {
  let service: GuestSavePromptService;
  let alertControllerSpy: jasmine.SpyObj<AlertController>;
  let capturedConfig: any;
  let dismissResolvers: Array<() => void>;

  beforeEach(() => {
    capturedConfig = undefined;
    dismissResolvers = [];

    alertControllerSpy = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertControllerSpy.create.and.callFake((config: any) => {
      capturedConfig = config;
      const dismissPromise = new Promise<void>((resolve) => dismissResolvers.push(() => resolve()));
      return Promise.resolve({
        present: jasmine.createSpy('present').and.resolveTo(),
        onDidDismiss: () => dismissPromise
      } as any);
    });

    TestBed.configureTestingModule({
      providers: [{ provide: AlertController, useValue: alertControllerSpy }]
    });

    service = TestBed.inject(GuestSavePromptService);
  });

  function fireDismiss(): void {
    dismissResolvers.forEach((resolve) => resolve());
  }

  it('creates the alert with the default header when none is given', async () => {
    const promise = service.promptSaveDestination();
    // Let the alert construction microtask settle so capturedConfig is populated.
    await Promise.resolve();
    expect(capturedConfig.header).toBe('Save your work');
    fireDismiss();
    await promise;
  });

  it('uses a custom header when one is provided', async () => {
    const promise = service.promptSaveDestination('Save your flowchart');
    await Promise.resolve();
    expect(capturedConfig.header).toBe('Save your flowchart');
    fireDismiss();
    await promise;
  });

  it('offers three choices: cancel, save locally, and log in', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    const texts = capturedConfig.buttons.map((b: any) => b.text);
    expect(texts).toEqual(['✕', 'Save on this device', 'Log in / Sign up']);
    fireDismiss();
    await promise;
  });

  it('resolves "local" when "Save on this device" is chosen', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    const localBtn = capturedConfig.buttons.find((b: any) => b.text === 'Save on this device');
    localBtn.handler();

    const result = await promise;
    expect(result).toBe('local');
  });

  it('resolves "login" when "Log in / Sign up" is chosen', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    const loginBtn = capturedConfig.buttons.find((b: any) => b.text === 'Log in / Sign up');
    loginBtn.handler();

    const result = await promise;
    expect(result).toBe('login');
  });

  it('resolves null when the ✕ cancel button is chosen', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    const cancelBtn = capturedConfig.buttons.find((b: any) => b.text === '✕');
    cancelBtn.handler();

    const result = await promise;
    expect(result).toBeNull();
  });

  it('resolves null when the alert is dismissed without any button being tapped (e.g. backdrop click)', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    fireDismiss();

    const result = await promise;
    expect(result).toBeNull();
  });

  it('honours the first resolution and ignores a later dismiss firing after a button was already tapped', async () => {
    const promise = service.promptSaveDestination();
    await Promise.resolve();
    const localBtn = capturedConfig.buttons.find((b: any) => b.text === 'Save on this device');
    localBtn.handler();
    fireDismiss(); // fires after the button already settled the promise

    const result = await promise;
    expect(result).toBe('local');
  });
});
