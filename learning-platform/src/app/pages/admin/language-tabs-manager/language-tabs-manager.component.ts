import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ContentService } from '../../../services/content.service';
import { LanguageTab, LanguagePlatform } from '../../../models/content.model';

@Component({
  selector: 'app-language-tabs-manager',
  templateUrl: './language-tabs-manager.component.html',
  styleUrls: ['./language-tabs-manager.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LanguageTabsManagerComponent implements OnInit {
  languageTabs: LanguageTab[] = [];
  isModalOpen = false;
  editingTab: LanguageTab | null = null;
  
  formData: Partial<LanguageTab> = {
    name: '',
    code: 'html',
    order: 1,
    isActive: true
  };

  availableLanguages: { code: LanguagePlatform; name: string }[] = [
    { code: 'html', name: 'HTML' },
    { code: 'css', name: 'CSS' },
    { code: 'scss', name: 'SCSS' },
    { code: 'javascript', name: 'JavaScript' },
    { code: 'typescript', name: 'TypeScript' },
    { code: 'angular', name: 'Angular' },
    { code: 'nodejs', name: 'Node.js' },
    { code: 'rxjs', name: 'RxJS' }
  ];

  constructor(private contentService: ContentService) {}

  ngOnInit() {
    this.loadLanguageTabs();
  }

  loadLanguageTabs() {
    this.contentService.languageTabs$.subscribe(tabs => {
      this.languageTabs = tabs.sort((a, b) => a.order - b.order);
    });
  }

  openModal(tab?: LanguageTab) {
    if (tab) {
      this.editingTab = tab;
      this.formData = { ...tab };
    } else {
      this.editingTab = null;
      this.formData = {
        name: '',
        code: 'html',
        order: this.languageTabs.length + 1,
        isActive: true
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingTab = null;
    this.formData = {};
  }

  saveTab() {
    if (this.editingTab) {
      const updatedTab: LanguageTab = {
        ...this.editingTab,
        ...this.formData
      } as LanguageTab;
      this.contentService.updateLanguageTab(updatedTab);
    } else {
      const newTab: LanguageTab = {
        id: Date.now().toString(),
        name: this.formData.name!,
        code: this.formData.code!,
        order: this.formData.order!,
        isActive: this.formData.isActive!
      };
      this.contentService.addLanguageTab(newTab);
    }
    this.closeModal();
  }

  deleteTab(tab: LanguageTab) {
    if (confirm(`Are you sure you want to delete "${tab.name}" tab?`)) {
      this.contentService.deleteLanguageTab(tab.id);
    }
  }

  toggleTabStatus(tab: LanguageTab) {
    const updatedTab = { ...tab, isActive: !tab.isActive };
    this.contentService.updateLanguageTab(updatedTab);
  }
}
