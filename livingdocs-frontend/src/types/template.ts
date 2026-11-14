export type DocumentTemplateSection = {
  id?: string;
  key?: string;
  title: string;
  description: string;
  contentPlaceholder?: string;
  required?: boolean;
};

export type TemplateVersionItem = {
  versionId: string | number;
  versionNum: number;
  createdAt: string;
  createdBy?: string;
  changeNote?: string;
  sectionsCount: number;
  sections: DocumentTemplateSection[];
  isCurrent?: boolean;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  type: string;
  description: string;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string;
  currentVersion?: number;
  createdAt: string;
  documentCount: number;
  sections: DocumentTemplateSection[];
  versionHistory?: TemplateVersionItem[];
};
