import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationProgressService {
  private readonly document = inject(DOCUMENT);
  start(): void {
    this.document.body.classList.add('navigation-progress');
  }

  stop(): void {
    this.document.body.classList.remove('navigation-progress');
  }
}
