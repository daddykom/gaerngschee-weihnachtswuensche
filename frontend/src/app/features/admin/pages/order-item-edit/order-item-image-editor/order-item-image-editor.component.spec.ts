import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { provideTranslateService } from '@ngx-translate/core';
import { OrderItemImageChange } from '../../../../../shared/models/order-item-image.model';
import { OrderItemImageEditorComponent } from './order-item-image-editor.component';

describe('OrderItemImageEditorComponent', () => {
  let fixture: ComponentFixture<OrderItemImageEditorComponent>;
  const createObjectURL = vi.fn(() => 'blob:preview');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = revokeObjectURL;
      },
    );
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    TestBed.configureTestingModule({
      imports: [OrderItemImageEditorComponent],
      providers: [provideTranslateService()],
    });
    fixture = TestBed.createComponent(OrderItemImageEditorComponent);
    const fields = TestBed.runInInjectionContext(() =>
      form(signal({ selection: null as OrderItemImageChange | null })),
    );
    fixture.componentRef.setInput('control', fields.selection());
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.unstubAllGlobals();
  });

  it('releases preview object URLs on replacement, removal and destruction', () => {
    const file = new File(['gift'], 'gift.png', { type: 'image/png' });
    fixture.componentRef.setInput('change', { operation: 'replace', revision: 0, file });
    fixture.detectChanges();
    expect(createObjectURL).toHaveBeenLastCalledWith(file);
    expect(fixture.nativeElement.querySelector('img').src).toContain('blob:preview');
    fixture.componentRef.setInput('change', { operation: 'remove', revision: 0 });
    fixture.detectChanges();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    fixture.componentRef.setInput('change', null);
    fixture.componentRef.setInput('storedImage', new Blob(['stored'], { type: 'image/png' }));
    fixture.detectChanges();
    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('emits one dropped file and prevents browser navigation, but ignores disabled drops', () => {
    const emit = vi.spyOn(fixture.componentInstance.fileSelected, 'emit');
    const file = new File(['gift'], 'gift.webp', { type: 'image/webp' });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as DragEvent;
    fixture.componentInstance.drop(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledExactlyOnceWith(file);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentInstance.drop(event);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
