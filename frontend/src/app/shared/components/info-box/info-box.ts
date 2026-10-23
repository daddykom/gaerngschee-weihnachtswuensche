import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type InfoBoxVariant = 'info' | 'warning' | 'error' | 'success';

@Component({
  selector: 'app-info-box',
  imports: [MatIconModule],
  templateUrl: './info-box.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './info-box.scss',
})
export class InfoBoxComponent {
  variant = input<InfoBoxVariant>('info');
  icon = input<string>();
  title = input<string>();

  defaultIcon = computed(() => {
    switch (this.variant()) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'success':
        return 'check_circle';
    }
  });

  iconToShow = computed(() => this.icon() ?? this.defaultIcon());
}
