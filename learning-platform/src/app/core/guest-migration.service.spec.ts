import { TestBed } from '@angular/core/testing';
import { AlertController, ToastController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { GuestMigrationService } from './guest-migration.service';
import { LocalPlaygroundSessionService } from '../services/local-playground-session.service';
import { LocalFlowchartSessionService } from '../services/local-flowchart-session.service';
import { PlaygroundSessionService } from '../services/playground-session.service';
import { FlowchartSessionService } from '../services/flowchart-session.service';
import { LocalPlaygroundSession, LocalFlowchartSession } from '../models/local-session.model';

function makePgSession(overrides: Partial<LocalPlaygroundSession> = {}): LocalPlaygroundSession {
  return {
    _id: 'pg1', title: 'PG', mode: 'web', htmlCode: '', cssCode: '', jsCode: '',
    jsOnlyCode: '', tsCode: '', selectedTab: 'html',
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

function makeFcSession(overrides: Partial<LocalFlowchartSession> = {}): LocalFlowchartSession {
  return {
    _id: 'fc1', title: 'FC', nodes: [], edges: [], canvasBg: 'dots',
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('GuestMigrationService', () => {
  let service: GuestMigrationService;
  let alertControllerSpy: jasmine.SpyObj<AlertController>;
  let toastControllerSpy: jasmine.SpyObj<ToastController>;
  let localPg: jasmine.SpyObj<LocalPlaygroundSessionService>;
  let localFc: jasmine.SpyObj<LocalFlowchartSessionService>;
  let remotePg: jasmine.SpyObj<PlaygroundSessionService>;
  let remoteFc: jasmine.SpyObj<FlowchartSessionService>;
  let alertConfig: any;
  let toastConfig: any;

  beforeEach(() => {
    alertConfig = undefined;
    toastConfig = undefined;

    alertControllerSpy = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    alertControllerSpy.create.and.callFake((config: any) => {
      alertConfig = config;
      return Promise.resolve({ present: jasmine.createSpy('present').and.resolveTo() } as any);
    });

    toastControllerSpy = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastControllerSpy.create.and.callFake((config: any) => {
      toastConfig = config;
      return Promise.resolve({ present: jasmine.createSpy('present').and.resolveTo() } as any);
    });

    localPg = jasmine.createSpyObj<LocalPlaygroundSessionService>('LocalPlaygroundSessionService', [
      'count', 'getSessions', 'deleteSession'
    ]);
    localFc = jasmine.createSpyObj<LocalFlowchartSessionService>('LocalFlowchartSessionService', [
      'count', 'getSessions', 'deleteSession'
    ]);
    remotePg = jasmine.createSpyObj<PlaygroundSessionService>('PlaygroundSessionService', [
      'createSession', 'updateSession'
    ]);
    remoteFc = jasmine.createSpyObj<FlowchartSessionService>('FlowchartSessionService', ['createSession']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AlertController, useValue: alertControllerSpy },
        { provide: ToastController, useValue: toastControllerSpy },
        { provide: LocalPlaygroundSessionService, useValue: localPg },
        { provide: LocalFlowchartSessionService, useValue: localFc },
        { provide: PlaygroundSessionService, useValue: remotePg },
        { provide: FlowchartSessionService, useValue: remoteFc }
      ]
    });

    service = TestBed.inject(GuestMigrationService);
  });

  describe('checkAndOfferMigration()', () => {
    it('does not prompt when there is nothing local to migrate', async () => {
      localPg.count.and.returnValue(of(0));
      localFc.count.and.returnValue(of(0));

      await service.checkAndOfferMigration();

      expect(alertControllerSpy.create).not.toHaveBeenCalled();
    });

    it('prompts with the correct counts when local sessions exist', async () => {
      localPg.count.and.returnValue(of(2));
      localFc.count.and.returnValue(of(1));

      await service.checkAndOfferMigration();

      expect(alertControllerSpy.create).toHaveBeenCalled();
      expect(alertConfig.message).toContain('3 sessions');
      expect(alertConfig.message).toContain('2 playground');
      expect(alertConfig.message).toContain('1 flowchart');
    });

    it('uses singular phrasing for exactly one total session', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));

      await service.checkAndOfferMigration();

      expect(alertConfig.message).toContain('1 session ');
    });

    it('offers a "Not now" cancel option that takes no action', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));

      await service.checkAndOfferMigration();

      const cancelBtn = alertConfig.buttons.find((b: any) => b.text === 'Not now');
      expect(cancelBtn.role).toBe('cancel');
    });
  });

  describe('migration (triggered via the alert\'s "Save to my account" handler)', () => {
    async function triggerMigration(): Promise<void> {
      await service.checkAndOfferMigration();
      const saveBtn = alertConfig.buttons.find((b: any) => b.text === 'Save to my account');
      await saveBtn.handler();
    }

    it('migrates a playground session: creates remotely, updates its content, then deletes locally', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));
      const localSession = makePgSession({ _id: 'pg1', title: 'My PG' });
      localPg.getSessions.and.returnValue(of([localSession]));
      localFc.getSessions.and.returnValue(of([]));
      remotePg.createSession.and.returnValue(of({ _id: 'remote-1' } as any));
      remotePg.updateSession.and.returnValue(of({} as any));
      localPg.deleteSession.and.returnValue(of(undefined));

      await triggerMigration();

      expect(remotePg.createSession).toHaveBeenCalledWith('My PG');
      expect(remotePg.updateSession).toHaveBeenCalledWith('remote-1', jasmine.objectContaining({
        mode: 'web',
        htmlCode: '',
        selectedTab: 'html'
      }));
      expect(localPg.deleteSession).toHaveBeenCalledWith('pg1');
    });

    it('migrates a flowchart session in one create call (no separate update step)', async () => {
      localPg.count.and.returnValue(of(0));
      localFc.count.and.returnValue(of(1));
      localPg.getSessions.and.returnValue(of([]));
      const localSession = makeFcSession({ _id: 'fc1', title: 'My Flow' });
      localFc.getSessions.and.returnValue(of([localSession]));
      remoteFc.createSession.and.returnValue(of({ _id: 'remote-fc-1' } as any));
      localFc.deleteSession.and.returnValue(of(undefined));

      await triggerMigration();

      expect(remoteFc.createSession).toHaveBeenCalledWith(
        jasmine.objectContaining({ title: 'My Flow', nodes: [], edges: [], canvasBg: 'dots' })
      );
      expect(localFc.deleteSession).toHaveBeenCalledWith('fc1');
    });

    it('shows a success toast when every session migrates', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));
      localPg.getSessions.and.returnValue(of([makePgSession()]));
      localFc.getSessions.and.returnValue(of([]));
      remotePg.createSession.and.returnValue(of({ _id: 'r1' } as any));
      remotePg.updateSession.and.returnValue(of({} as any));
      localPg.deleteSession.and.returnValue(of(undefined));

      await triggerMigration();

      expect(toastConfig.color).toBe('success');
      expect(toastConfig.message).toContain('Saved 1 session');
    });

    it('shows a danger toast and keeps local data when every migration fails', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));
      localPg.getSessions.and.returnValue(of([makePgSession()]));
      localFc.getSessions.and.returnValue(of([]));
      remotePg.createSession.and.returnValue(throwError(() => new Error('offline')));

      await triggerMigration();

      expect(localPg.deleteSession).not.toHaveBeenCalled();
      expect(toastConfig.color).toBe('danger');
      expect(toastConfig.message).toContain("safe");
    });

    it('shows a warning toast and reports the count when some migrations fail and some succeed', async () => {
      localPg.count.and.returnValue(of(2));
      localFc.count.and.returnValue(of(0));
      const ok = makePgSession({ _id: 'ok', title: 'OK Session' });
      const bad = makePgSession({ _id: 'bad', title: 'Bad Session' });
      localPg.getSessions.and.returnValue(of([ok, bad]));
      localFc.getSessions.and.returnValue(of([]));
      remotePg.createSession.and.callFake((title?: string) =>
        title === 'OK Session' ? of({ _id: 'remote-ok' } as any) : throwError(() => new Error('fail'))
      );
      remotePg.updateSession.and.returnValue(of({} as any));
      localPg.deleteSession.and.returnValue(of(undefined));

      await triggerMigration();

      expect(localPg.deleteSession).toHaveBeenCalledWith('ok');
      expect(localPg.deleteSession).not.toHaveBeenCalledWith('bad');
      expect(toastConfig.color).toBe('warning');
      expect(toastConfig.message).toContain('1 of 2');
    });

    it('treats a failed update (after a successful create) as a failed migration for that session', async () => {
      localPg.count.and.returnValue(of(1));
      localFc.count.and.returnValue(of(0));
      localPg.getSessions.and.returnValue(of([makePgSession()]));
      localFc.getSessions.and.returnValue(of([]));
      remotePg.createSession.and.returnValue(of({ _id: 'r1' } as any));
      remotePg.updateSession.and.returnValue(throwError(() => new Error('update failed')));

      await triggerMigration();

      expect(localPg.deleteSession).not.toHaveBeenCalled();
      expect(toastConfig.color).toBe('danger');
    });
  });
});
