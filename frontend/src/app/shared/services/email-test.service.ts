import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EmailTestField {
  key: string;
  type: 'text' | 'textarea' | 'url' | 'email' | 'number';
  required: boolean;
}

export interface EmailTestTemplate {
  id: string;
  fields: EmailTestField[];
}

export interface EmailTestForm {
  recipient: string;
  template: string;
  parameters: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class EmailTestService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/email-test`;

  listTemplates(): Observable<{ templates: EmailTestTemplate[] }> {
    return this.http.get<{ templates: EmailTestTemplate[] }>(this.url, {
      withCredentials: true,
    });
  }

  send(form: EmailTestForm): Observable<{ emailSentTo: string }> {
    return this.http.post<{ emailSentTo: string }>(this.url, form, {
      withCredentials: true,
    });
  }
}
