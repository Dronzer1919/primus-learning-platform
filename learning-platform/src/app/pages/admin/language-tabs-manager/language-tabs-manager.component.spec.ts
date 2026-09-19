import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';
import { LanguageTabsManagerComponent } from './language-tabs-manager.component';
import { ContentService } from '../../../services/content.service';
import { LanguageTab } from '../../../models/content.model';

function makeTab(overrides: Partial<LanguageTab> = {}): LanguageTab {
  return { id: '1', name: 'HTML', code: 'html', order: 1, isActive: true, ...overrides };
}

describe('LanguageTabsManagerComponent', () => {
  let fixture: ComponentFixture<LanguageTabsManagerComponent>;
  let component: LanguageTabsManagerComponent;
  let contentService: jasmine.SpyObj<ContentService>;
  let tabsSubject: BehaviorSubject<LanguageTab[]>;

  beforeEach(async () => {
    tabsSubject = new BehaviorSubject<LanguageTab[]>([]);
    contentService = jasmine.createSpyObj<ContentService>(
      'ContentService',
      ['addLanguageTab', 'updateLanguageTab', 'deleteLanguageTab'],
      { languageTabs$: tabsSubject.asObservable() }
    );

    await TestBed.configureTestingModule({
      imports: [LanguageTabsManagerComponent],
      providers: [{ provide: ContentService, useValue: contentService }]
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageTabsManagerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture?.destroy());

  describe('rendering', () => {
    it('creates', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('shows the empty state with no tabs', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('renders one row per tab, sorted by order', () => {
      fixture.detectChanges();
      tabsSubject.next([makeTab({ id: 'b', order: 2 }), makeTab({ id: 'a', order: 1 })]);
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.tab-item .tab-order');
      expect(Array.from(rows).map((el: any) => el.textContent.trim())).toEqual(['1', '2']);
    });
  });

  describe('loadLanguageTabs()', () => {
    it('sorts tabs by order', () => {
      fixture.detectChanges();
      tabsSubject.next([makeTab({ id: 'b', order: 3 }), makeTab({ id: 'a', order: 1 }), makeTab({ id: 'c', order: 2 })]);
      expect(component.languageTabs.map((t) => t.id)).toEqual(['a', 'c', 'b']);
    });
  });

  describe('openModal() / closeModal()', () => {
    beforeEach(() => fixture.detectChanges());

    it('opens blank, defaulting order to one past the current count', () => {
      tabsSubject.next([makeTab(), makeTab({ id: '2' })]);
      component.openModal();
      expect(component.editingTab).toBeNull();
      expect(component.formData.order).toBe(3);
      expect(component.isModalOpen).toBeTrue();
    });

    it('opens prefilled for an existing tab', () => {
      const tab = makeTab({ name: 'HTML5' });
      component.openModal(tab);
      expect(component.editingTab).toBe(tab);
      expect(component.formData.name).toBe('HTML5');
    });

    it('closeModal() resets all editing state', () => {
      component.openModal(makeTab());
      component.closeModal();
      expect(component.isModalOpen).toBeFalse();
      expect(component.editingTab).toBeNull();
      expect(component.formData).toEqual({});
    });
  });

  // KNOWN BUG (flagged, not silently fixed here): saveTab(), deleteTab(), and
  // toggleTabStatus() all call the corresponding ContentService method but never
  // .subscribe() to the Observable it returns. ContentService's HTTP calls are cold —
  // nothing is sent to the server until something subscribes — so every write this
  // admin screen makes is currently silently dropped: the modal closes as if it saved,
  // but no request ever leaves the browser. This is the exact bug user-notes.component.ts
  // explicitly documents having fixed elsewhere in the app; it evidently was not also
  // fixed here. The tests below assert the ACTUAL (broken) behavior so this is caught
  // immediately if/when it's fixed — flip them at that point rather than deleting them.
  describe('saveTab() / deleteTab() / toggleTabStatus() — KNOWN GAP: writes never fire', () => {
    beforeEach(() => fixture.detectChanges());

    it('KNOWN GAP — creating a tab builds the right request but never subscribes, so no HTTP call would ever fire', () => {
      const response$ = of(makeTab());
      const subscribeSpy = spyOn(response$, 'subscribe').and.callThrough();
      contentService.addLanguageTab.and.returnValue(response$);
      component.openModal();
      component.formData = { name: 'Rust', code: 'html', order: 9, isActive: true };

      component.saveTab();

      // The service method IS invoked (the component built a well-formed request) — but
      // ContentService's HTTP calls are cold, so with nothing ever subscribing to the
      // Observable it returned, the real HttpClient call this stands in for would never
      // actually be dispatched. This is the crux of the bug, not just that a method ran.
      expect(contentService.addLanguageTab).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
      expect(component.isModalOpen).toBeFalse(); // closes regardless of whether it saved
    });

    it('KNOWN GAP — editing a tab builds the right request but never subscribes', () => {
      const response$ = of(makeTab());
      const subscribeSpy = spyOn(response$, 'subscribe').and.callThrough();
      contentService.updateLanguageTab.and.returnValue(response$);
      const tab = makeTab();
      component.openModal(tab);
      component.formData = { ...tab, name: 'Edited' };

      component.saveTab();

      expect(contentService.updateLanguageTab).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — deleting a tab builds the right request but never subscribes', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      const response$ = of(undefined);
      const subscribeSpy = spyOn(response$, 'subscribe').and.callThrough();
      contentService.deleteLanguageTab.and.returnValue(response$);

      component.deleteTab(makeTab());

      expect(contentService.deleteLanguageTab).toHaveBeenCalled();
      expect(subscribeSpy).not.toHaveBeenCalled();
    });

    it('does not call deleteLanguageTab when the confirm dialog is cancelled', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      component.deleteTab(makeTab());
      expect(contentService.deleteLanguageTab).not.toHaveBeenCalled();
    });

    it('KNOWN GAP — toggling active status builds the right request but never subscribes', () => {
      const response$ = of(makeTab());
      const subscribeSpy = spyOn(response$, 'subscribe').and.callThrough();
      contentService.updateLanguageTab.and.returnValue(response$);

      component.toggleTabStatus(makeTab({ isActive: true }));

      expect(contentService.updateLanguageTab).toHaveBeenCalledWith(jasmine.objectContaining({ isActive: false }));
      expect(subscribeSpy).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle / memory leak', () => {
    it('KNOWN GAP — languageTabs$ subscription is still live after the component is destroyed (no ngOnDestroy)', () => {
      fixture.detectChanges();
      fixture.destroy();
      tabsSubject.next([makeTab({ id: 'late' })]);
      expect(component.languageTabs.map((t) => t.id)).toEqual(['late']);
    });
  });
});
