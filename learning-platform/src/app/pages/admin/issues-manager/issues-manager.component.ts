import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { IssueService } from '../../../services/issue.service';
import { IssueReport, IssueStatus } from '../../../models/issue.model';

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
  selector: 'app-issues-manager',
  templateUrl: './issues-manager.component.html',
  styleUrls: ['./issues-manager.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class IssuesManagerComponent implements OnInit, OnDestroy {
  issues: IssueReport[] = [];
  loading = true;
  error: string | null = null;
  lightboxUrl: string | null = null;

  private issuesSub?: Subscription;

  constructor(
    private issueService: IssueService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.issuesSub = this.issueService.allIssues$.subscribe(issues => {
      this.issues = issues;
    });
    this.reload();
  }

  ngOnDestroy() {
    this.issuesSub?.unsubscribe();
  }

  reload() {
    this.loading = true;
    this.issueService.loadAllIssues().subscribe({
      next: () => {
        this.loading = false;
        this.error = null;
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load issue reports. Check that the backend is running.';
      }
    });
  }

  onStatusChange(issue: IssueReport, newStatus: IssueStatus) {
    this.issueService.updateIssueStatus(issue.id, newStatus).subscribe({
      next: () => this.showToast('Status updated', 'success'),
      error: () => this.showToast('Could not update status', 'danger')
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
