"use client";

import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TemplateDetails } from "@/components/templates/TemplateDetails";

export default function TemplateDetailsPage() {
  const params = useParams<{ templateId: string }>();

  return (
    <AppShell>
      <TemplateDetails templateId={params.templateId} />
    </AppShell>
  );
}
