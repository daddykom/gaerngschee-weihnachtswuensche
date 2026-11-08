import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LegalPageName, legalPages } from '../../legal-pages';

@Component({
  selector: 'app-legal-page',
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly page = computed(() => {
    const pageName = this.route.snapshot.data['legalPage'] as LegalPageName;
    return legalPages[pageName];
  });
}
