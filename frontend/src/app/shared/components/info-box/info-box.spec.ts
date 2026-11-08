import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfoBoxComponent } from './info-box';

@Component({
  imports: [InfoBoxComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template:
    '<app-info-box [variant]="variant" [icon]="icon" [title]="title">Content</app-info-box>',
})
class TestHostComponent {
  @Input()
  variant: 'info' | 'warning' | 'error' | 'success' = 'info';
  @Input()
  icon: string | undefined;
  @Input()
  title: string | undefined;
}

describe('InfoBoxComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it.each([
    ['info', 'info'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['success', 'check_circle'],
  ])('uses the default icon for %s', (variant, icon) => {
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.info-box').classList).toContain(
      `info-box--${variant}`,
    );
    expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe(icon);
  });

  it('prefers a custom icon and renders optional title and content', () => {
    fixture.componentRef.setInput('icon', 'campaign');
    fixture.componentRef.setInput('title', 'Notice');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('campaign');
    expect(fixture.nativeElement.querySelector('.info-box__title').textContent).toContain('Notice');
    expect(fixture.nativeElement.querySelector('.info-box__content').textContent).toContain(
      'Content',
    );
  });

  it('omits the title when it is empty', () => {
    fixture.componentRef.setInput('title', '');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.info-box__title')).toBeNull();
  });
});
