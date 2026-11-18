import { apiClient } from "./apiClient";

export interface PhantomSymbolDto {
  symbol: string;
  symbolType: "METHOD" | "CLASS" | "API_PATH" | "FIELD" | "PARAM" | string;
  lineNumber: number;
  contextSnippet: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  suggestion: string;
}

export interface MissingEntityDto {
  entityId?: number;
  className: string;
  methodName?: string;
  entityType: string;
  filePath: string;
  signature?: string;
  suggestedMarkdown: string;
}

export interface MissingParamDto {
  methodName: string;
  className: string;
  paramName: string;
  paramType?: string;
  suggestion: string;
}

export interface QualityWarningDto {
  category: "HALLUCINATION" | "ENTITY_COVERAGE" | "PARAM_COVERAGE" | "TEMPLATE_COMPLIANCE" | string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  actionRequired?: string;
}

export interface DocumentQualityEvaluationRequest {
  repositoryId?: number;
  documentId?: number;
  filePath?: string;
  markdown: string;
  templateId?: number;
  minQualityThreshold?: number;
  minAntiHallucinationThreshold?: number;
}

export interface DocumentQualityEvaluationResponse {
  repositoryId?: number;
  repositoryName?: string;
  documentId?: number;
  documentTitle?: string;
  filePath?: string;
  evaluatedAt: string;

  // 3 Real Metrics
  entityCoveragePercent: number;
  paramCoveragePercent: number;
  overallCoveragePercent: number;
  antiHallucinationPercent: number;
  templateCompliancePercent: number;

  // Aggregate & PR Gate
  overallQualityScore: number;
  qualityRating: "EXCELLENT" | "GOOD" | "WARN" | "BLOCKED" | string;
  passed: boolean;
  prGateStatus: "PASSED" | "BLOCKED" | string;
  appliedQualityThreshold: number;
  appliedAntiHallucinationThreshold: number;
  recommendation: string;

  // Counts
  totalCodeEntitiesScanned: number;
  documentedCodeEntitiesCount: number;
  missingCodeEntitiesCount: number;
  totalParamsScanned: number;
  documentedParamsCount: number;
  missingParamsCount: number;
  totalSymbolsChecked: number;
  phantomSymbolsCount: number;
  requiredHeadingsCount: number;
  matchedHeadingsCount: number;

  // Warning lists
  phantomSymbols: PhantomSymbolDto[];
  missingEntities: MissingEntityDto[];
  missingParams: MissingParamDto[];
  missingTemplateHeadings: string[];
  qualityWarnings: QualityWarningDto[];
}

export const docQualityService = {
  async evaluateQuality(
    request: DocumentQualityEvaluationRequest
  ): Promise<DocumentQualityEvaluationResponse> {
    const res = await apiClient.post<DocumentQualityEvaluationResponse>(
      "/api/documents/evaluate-quality",
      request
    );
    return res.data;
  },
};
