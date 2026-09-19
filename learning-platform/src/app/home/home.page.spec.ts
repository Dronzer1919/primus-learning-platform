import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the welcome heading', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Welcome to Learning Platform');
  });

  it('renders one feature card each for Learn, Practice and Notes', () => {
    const cardHeadings = Array.from(fixture.nativeElement.querySelectorAll('.feature-cards h3')).map(
      (el: any) => el.textContent.trim()
    );
    expect(cardHeadings).toEqual(['Learn', 'Practice', 'Notes']);
  });

  it('renders the quick-start guide as an ordered list', () => {
    const steps = fixture.nativeElement.querySelectorAll('.quick-start ol li');
    expect(steps.length).toBe(4);
  });
});
