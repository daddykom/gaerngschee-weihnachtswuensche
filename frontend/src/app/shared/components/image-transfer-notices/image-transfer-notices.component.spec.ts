import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { ImageTransfer } from '../../../store/image-transfers/image-transfers.state';
import { ImageTransferNoticesComponent } from './image-transfer-notices.component';

describe('ImageTransferNoticesComponent', () => {
  let fixture: ComponentFixture<ImageTransferNoticesComponent>;
  const identity = {
    id: 'transfer-1',
    orderId: 'order-1',
    itemId: 'item-1',
    wishTitle: 'A bicycle',
  };
  const change = {
    operation: 'replace' as const,
    revision: 0,
    file: new File(['gift'], 'gift.png', { type: 'image/png' }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImageTransferNoticesComponent],
      providers: [provideRouter([]), provideTranslateService()],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('de', {
      app: {
        imageTransfers: {
          uploading: 'Bild wird hochgeladen: {{percent}} %',
          success: 'Gespeichert',
        },
      },
    });
    translate.use('de');
    fixture = TestBed.createComponent(ImageTransferNoticesComponent);
    fixture.componentRef.setInput('transfers', []);
    fixture.detectChanges();
  });

  function render(transfer: ImageTransfer): HTMLElement {
    fixture.componentRef.setInput('transfers', [transfer]);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('renders 22 percent and remains uploading at 100 without any processing state', () => {
    for (const percent of [22, 100]) {
      const element = render({ ...identity, status: 'uploading', percent, change });
      expect(element.querySelector('strong')?.textContent?.trim()).toBe(
        `Bild wird hochgeladen: ${percent} %`,
      );
      expect(element.querySelector('[role=status]')).toBeTruthy();
      expect(element.querySelector('button')).toBeNull();
      expect(element.textContent).not.toContain('processing');
      expect(element.querySelector('a')?.getAttribute('href')).toBe(
        '/admin/orders/order-1/edit/item/item-1',
      );
      expect(element.querySelector('a')?.textContent?.trim()).toBe('A bicycle');
    }
    const element = render({
      ...identity,
      status: 'success',
      result: {
        revision: 1,
        image: {
          id: 'image',
          mimeType: 'image/png',
          width: 1,
          height: 1,
          byteSize: 4,
          updatedAt: '',
        },
      },
    });
    expect(element.querySelector('strong')?.textContent?.trim()).toBe('Gespeichert');
    expect(element.textContent).not.toContain('%');
    expect(element.querySelector('a')).toBeNull();
  });

  it('announces failures and emits image-only retry and dismissal events', () => {
    const retry = vi.spyOn(fixture.componentInstance.retryClicked, 'emit');
    const dismiss = vi.spyOn(fixture.componentInstance.dismissClicked, 'emit');
    const element = render({ ...identity, status: 'error', change, errorCode: 'REQUEST_FAILED' });
    expect(element.querySelector('[role=alert]')).toBeTruthy();
    const buttons = element.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();
    expect(retry).toHaveBeenCalledWith(identity.id);
    expect(dismiss).toHaveBeenCalledWith(identity.id);
  });

  it('explains conflicts and invalid files without offering an unchanged retry', () => {
    for (const errorCode of [
      'IMAGE_REVISION_CONFLICT',
      'INVALID_IMAGE',
      'IMAGE_TOO_LARGE',
      'IMAGE_DIMENSIONS_EXCEEDED',
    ]) {
      const element = render({ ...identity, status: 'error', change, errorCode });
      expect(element.querySelectorAll('button')).toHaveLength(1);
      expect(element.querySelector('a')).toBeTruthy();
    }
  });

  it('shows removal and queued requests without a separate processing stage', () => {
    let element = render({ ...identity, status: 'queued', change });
    expect(element.querySelector('strong')?.textContent).toContain('0 %');
    element = render({
      ...identity,
      status: 'uploading',
      percent: 0,
      change: { operation: 'remove', revision: 0 },
    });
    expect(element.querySelector('strong')?.textContent).toContain('app.imageTransfers.removing');
    element = render({ ...identity, status: 'success', result: { revision: 1, image: null } });
    expect(element.querySelector('strong')?.textContent).toContain('app.imageTransfers.removed');
    expect(element.querySelector('a')).toBeNull();
  });
});
