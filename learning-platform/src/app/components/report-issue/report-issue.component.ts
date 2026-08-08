import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { IssueService } from '../../services/issue.service';
import { AuthService } from '../../services/auth.service';
import { IssueReport, IssueStatus } from '../../models/issue.model';

type ReportSegment = 'report' | 'my-reports';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STATUS_COLOR: Record<IssueStatus, string> = {
  pending: 'medium',
  'in-progress': 'warning',
  resolved: 'success',
  rejected: 'danger'
};

const STATUS_LABEL: Record<IssueStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected'
};

@Component({
  selector: 'app-report-issue',
  templateUrl: './report-issue.component.html',
  styleUrls: ['./report-issue.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ReportIssueComponent implements OnInit, OnDestroy {
  segment: ReportSegment = 'report';

  // --- Form state --------------------------------------------------------
  name = '';
  email = '';
  description = '';
  imageFile: File | null = null;
  imagePreviewUrl: string | null = null;
  saving = false;

  // --- My reports ----------------------------------------------------------
  myIssues: IssueReport[] = [];
  error: string | null = null;

  lightboxUrl: string | null = null;

  private issuesSub?: Subscription;

  constructor(
    private issueService: IssueService,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    const user = this.authService.currentUserValue;
    this.name = user?.displayName || user?.username || '';
    this.email = user?.email || '';

    this.issuesSub = this.issueService.myIssues$.subscribe(issues => {
      this.myIssues = issues;
    });

    this.reload();
  }

  ngOnDestroy() {
    this.issuesSub?.unsubscribe();
    if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
  }

  reload() {
    this.issueService.loadMyIssues().subscribe({
      next: () => (this.error = null),
      error: () => (this.error = 'Could not load your reports. Check that the backend is running.')
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file after removal
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Please choose an image file.', 'danger');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.showToast('Image is too large. Please pick one under 5 MB.', 'danger');
      return;
    }

    if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
    this.imageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  removeImage() {
    if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
    this.imageFile = null;
    this.imagePreviewUrl = null;
  }

  submitReport() {
    if (this.saving || !this.name.trim() || !this.email.trim() || !this.description.trim()) return;

    this.saving = true;
    this.issueService
      .reportIssue({
        name: this.name.trim(),
        email: this.email.trim(),
        description: this.description.trim(),
        image: this.imageFile
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.description = '';
          this.removeImage();
          this.segment = 'my-reports';
          this.showToast('Issue reported — thank you!', 'success');
        },
        error: () => {
          this.saving = false;
          this.showToast('Could not submit your report. Check that the backend is running.', 'danger');
        }
      });
  }

  openLightbox(url: string) {
    this.lightboxUrl = url;
  }

  closeLightbox() {
    this.lightboxUrl = null;
  }

  statusColor(status: IssueStatus): string {
    return STATUS_COLOR[status];
  }

  statusLabel(status: IssueStatus): string {
    return STATUS_LABEL[status];
  }

  /** e.g. "Dec 4, 2025 • 06:22 PM". */
  formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${day} • ${time}`;
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: color === 'danger' ? 3200 : 1800,
      color,
      position: 'bottom',
      cssClass: 'app-toast',
      icon: color === 'danger' ? 'alert-circle-outline' : 'checkmark-circle-outline'
    });
    toast.present();
  }
}
