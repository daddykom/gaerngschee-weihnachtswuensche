import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-app-update-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  templateUrl: './app-update-dialog.component.html',
  styleUrl: './app-update-dialog.component.scss',
})
export class AppUpdateDialogComponent {}
