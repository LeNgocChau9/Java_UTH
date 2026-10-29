"""
test_drift_analyze.py — Task S4-09: Kiem tra endpoint /v1/drift/analyze
Chay: python test_drift_analyze.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ["PYTHONIOENCODING"] = "utf-8"

# ── Test 1: Import schemas ────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 1: Import DriftAnalyzeRequest / DriftAnalyzeResponse schemas")
try:
    from app.schemas.ai_schemas import (
        DriftAnalyzeRequest,
        DriftAnalyzeResponse,
        DriftSuggestion,
    )
    req = DriftAnalyzeRequest(
        code_diff="- public void processPayment(Long id, Double amount)\n+ public void processPayment(Long id, Double amount, String currency)",
        current_doc="## processPayment\n- **Tham so:** Long orderId, Double amount\n- **Tra ve:** void",
        entity_name="processPayment",
        entity_type="METHOD",
        file_path="src/main/java/com/example/OrderService.java",
        pr_number=42,
        commit_hash="abc123def456",
    )
    print(f"  entity_name   : {req.entity_name}")
    print(f"  entity_type   : {req.entity_type}")
    print(f"  code_diff len : {len(req.code_diff)}")
    print("  [PASS] TEST 1 PASSED")
except Exception as e:
    print(f"  [FAIL] TEST 1 FAILED: {e}")
    sys.exit(1)

# ── Test 2: Import service ────────────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 2: Import GeminiDriftService")
try:
    from app.services.gemini_drift_service import GeminiDriftService, DRIFT_MODELS, _get_severity, _infer_classification
    print(f"  DRIFT_MODELS             : {DRIFT_MODELS}")
    print(f"  _get_severity(0.1)       : {_get_severity(0.1)}")
    print(f"  _get_severity(0.4)       : {_get_severity(0.4)}")
    print(f"  _get_severity(0.7)       : {_get_severity(0.7)}")
    print(f"  _get_severity(0.9)       : {_get_severity(0.9)}")
    print(f"  _infer_classification('method renamed'): {_infer_classification('method renamed')}")
    print(f"  _infer_classification('parameter changed'): {_infer_classification('parameter changed')}")
    print(f"  _infer_classification('behavior logic changed'): {_infer_classification('behavior logic changed')}")
    print("  [PASS] TEST 2 PASSED")
except Exception as e:
    print(f"  [FAIL] TEST 2 FAILED: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)

# ── Test 3: Goi Gemini API that ───────────────────────────────────────────────
print("\n" + "="*60)
print("TEST 3: Goi GeminiDriftService.analyze() voi Gemini API that")
print("  (Test thuc te goi Gemini -- co the mat 5-15 giay)")
try:
    result = GeminiDriftService.analyze(req)
    print(f"\n  Ket qua phan tich drift:")
    print(f"     drift_score    : {result.drift_score}")
    print(f"     severity       : {result.severity}")
    print(f"     classification : {result.classification}")
    print(f"     is_drifted     : {result.is_drifted}")
    print(f"     model_used     : {result.model_used}")
    expl = result.explanation.encode("utf-8", errors="replace").decode("ascii", errors="replace")
    print(f"     explanation    : {expl[:120]}...")
    print(f"     affected_secs  : {result.affected_sections}")
    print(f"     # suggestions  : {len(result.suggestions)}")
    for i, s in enumerate(result.suggestions, 1):
        print(f"\n     Suggestion #{i}:")
        print(f"        section        : {s.section}")
        print(f"        reason         : {s.reason[:80]}")

    # Assertions
    assert 0.0 <= result.drift_score <= 1.0, f"drift_score ngoai khoang [0.0, 1.0]: {result.drift_score}"
    assert result.severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL"), f"Severity khong hop le: {result.severity}"
    assert result.classification in ("REFERENCE", "SIGNATURE", "SEMANTIC"), f"Classification khong hop le: {result.classification}"
    assert isinstance(result.is_drifted, bool), "is_drifted phai la bool"
    assert len(result.explanation) > 10, "explanation qua ngan"
    assert result.mode == "real", "mode phai la 'real'"
    print("\n  [PASS] TEST 3 PASSED -- Gemini API hoat dong va tra ve ket qua hop le!")
except Exception as e:
    print(f"  [FAIL] TEST 3 FAILED: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)

# ── Test 4: FastAPI app khoi tao khong loi ────────────────────────────────────
print("\n" + "="*60)
print("TEST 4: FastAPI app khoi tao va goi qua TestClient")
try:
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # 4.1 Kiểm tra health check
    res_health = client.get("/health")
    assert res_health.status_code == 200, f"Health check failed: {res_health.status_code}"
    print(f"  GET /health: {res_health.json()}")

    # 4.2 Kiểm tra endpoint /v1/drift/analyze qua TestClient
    payload = {
        "code_diff": "- public void processPayment(Long id, Double amount)\n+ public void processPayment(Long id, Double amount, String currency)",
        "current_doc": "## processPayment\n- **Tham so:** Long orderId, Double amount\n- **Tra ve:** void",
        "entity_name": "processPayment",
        "entity_type": "METHOD",
        "file_path": "src/main/java/com/example/OrderService.java"
    }
    res_drift = client.post("/v1/drift/analyze", json=payload)
    assert res_drift.status_code == 200, f"Endpoint /v1/drift/analyze failed: {res_drift.status_code} - {res_drift.text}"
    drift_data = res_drift.json()
    print(f"  POST /v1/drift/analyze: Status 200 OK")
    print(f"    drift_score    : {drift_data['drift_score']}")
    print(f"    severity       : {drift_data['severity']}")
    print(f"    classification : {drift_data['classification']}")
    print(f"    model_used     : {drift_data['model_used']}")

    print("  [PASS] TEST 4 PASSED -- FastAPI TestClient goi thanh cong /v1/drift/analyze!")
except Exception as e:
    print(f"  [FAIL] TEST 4 FAILED: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)

print("\n" + "="*60)
print("[DONE] TAT CA 4 TEST DA PASS -- Task S4-09 hoan thanh 100%!")
print("="*60)
print("\nCo the chay server: uvicorn app.main:app --reload --port 8000")
print("Swagger UI: http://localhost:8000/docs -> /v1/drift/analyze\n")
