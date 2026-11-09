import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationProgressService {
  private readonly document = inject(DOCUMENT);
  readonly active = signal(false);

  start(): void {
    this.active.set(true);
    this.document.body.classList.add('navigation-progress');
  }

  stop(): void {
    this.active.set(false);
    this.document.body.classList.remove('navigation-progress');
  }
}
