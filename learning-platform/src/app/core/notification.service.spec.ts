import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ToastController } from '@ionic/angular';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let toastController: jasmine.SpyObj<ToastController>;
  let createCalls: any[];

  beforeEach(() => {
    createCalls = [];
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.callFake((config: any) => {
      createCalls.push(config);
      return Promise.resolve({ present: jasmine.createSpy().and.resolveTo() } as any);
    });

    TestBed.configureTestingModule({
      providers: [{ provide: ToastController, useValue: toastController }]
    });
    service = TestBed.inject(NotificationService);
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  describe('error() / warn() / success()', () => {
    it('error() presents a danger toast with the alert icon', async () => {
      await service.error('Something broke');
      expect(createCalls[0]).toEqual(jasmine.objectContaining({
        message: 'Something broke', color: 'danger', icon: 'alert-circle-outline'
      }));
    });

    it('warn() presents a warning-coloured toast', async () => {
      await service.warn('Careful');
      expect(createCalls[0].color).toBe('warning');
    });

    it('success() presents a success-coloured toast with the check icon', async () => {
      await service.success('Saved!');
      expect(createCalls[0]).toEqual(jasmine.objectContaining({
        color: 'success', icon: 'information-circle-outline'
      }));
    });

    it('error() toasts last longer than success() toasts', async () => {
      await service.error('e');
      const errorDuration = createCalls[0].duration;
      createCalls = [];
      await service.success('s');
      expect(errorDuration).toBeGreaterThan(createCalls[0].duration);
    });
  });

  describe('de-duplication', () => {
    it('suppresses an identical message shown again within the dedupe window', fakeAsync(() => {
      service.error('Duplicate message');
      tick();
      service.error('Duplicate message');
      tick();
      expect(createCalls.length).toBe(1);
    }));

    it('shows the same message again once the dedupe window has passed', fakeAsync(() => {
      service.error('Repeats later');
      tick();
      tick(6000); // DEDUPE_WINDOW_MS
      service.error('Repeats later');
      tick();
      expect(createCalls.length).toBe(2);
    }));

    it('does not suppress two different messages', fakeAsync(() => {
      service.error('Message A');
      tick();
      service.error('Message B');
      tick();
      expect(createCalls.length).toBe(2);
    }));
  });

  describe('presenting guard', () => {
    it('drops a second toast requested before the first has finished presenting', fakeAsync(() => {
      let resolvePresent: () => void = () => {};
      toastController.create.and.callFake((config: any) => {
        createCalls.push(config);
        return Promise.resolve({
          present: () => new Promise<void>((resolve) => (resolvePresent = resolve))
        } as any);
      });

      service.error('First');
      tick();
      service.warn('Second, different message, but still in-flight');
      tick();

      // Only the first toast was ever created — the second call bailed out on the
      // `this.presenting` guard before reaching toastController.create at all.
      expect(createCalls.length).toBe(1);
      resolvePresent();
      tick();
    }));
  });

  describe('resilience', () => {
    it('does not throw when toastController.create() rejects', fakeAsync(() => {
      toastController.create.and.rejectWith(new Error('overlay unavailable'));
      expect(() => {
        service.error('x');
        tick();
      }).not.toThrow();
    }));
  });
});
