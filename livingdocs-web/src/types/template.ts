export type DocumentTemplateSection = {
  title: string;
  description: string;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  type: string;
  description: string;
  createdAt: string;
  documentCount: number;
  sections: DocumentTemplateSection[];
};
