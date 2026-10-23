import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { type Mock } from 'vitest';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRef: { close: Mock };
  const data: ConfirmDialogData = {
    title: 'dialog.title',
    message: 'dialog.message',
    confirmLabel: 'dialog.confirm',
    cancelLabel: 'dialog.cancel',
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  });

  it('renders all supplied dialog text and actions', () => {
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain(data.title);
    expect(fixture.nativeElement.querySelector('mat-dialog-content').textContent).toContain(
      data.message,
    );
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(2);
  });

  it('closes with true when confirmed', () => {
    fixture.nativeElement.querySelector('button[color="primary"]').click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with false when cancelled', () => {
    fixture.nativeElement.querySelector('mat-dialog-actions button').click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
