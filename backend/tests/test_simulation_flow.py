import os
import tempfile
import unittest
from pathlib import Path


TEST_ROOT = tempfile.TemporaryDirectory(prefix="interior-simulation-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(TEST_ROOT.name, 'test.db').as_posix()}"
os.environ["MEDIA_DIR"] = str(Path(TEST_ROOT.name, "media"))
os.environ["ADMIN_LOGIN_ID"] = "simulation-test"
os.environ["ADMIN_PASSWORD"] = "test-password"

from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import inspect

from backend.app.main import app
from backend.app.db import engine
from backend.app.schema_compat import ensure_schema_compatibility


class SimulationFlowTest(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        TEST_ROOT.cleanup()

    def test_create_edit_version_verify_material_and_scan(self):
        with TestClient(app) as client:
            login = client.post("/api/v1/auth/login", data={"username": "simulation-test", "password": "test-password"})
            self.assertEqual(login.status_code, 200, login.text)
            self.assertEqual(login.json()["user"]["login_id"], "simulation-test")
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            company_payload = {
                "business_name": "테스트 인테리어",
                "address": "서울특별시 중구 세종대로 110",
                "business_registration_number": "123-45-67890",
                "representative_name": "홍길동",
                "phone": "02-1234-5678",
                "fax": "02-1234-5679",
                "session_timeout_minutes": 240,
            }
            company = client.put(
                "/api/v1/company-settings",
                json=company_payload,
                headers=headers,
            )
            self.assertEqual(company.status_code, 200, company.text)
            self.assertEqual(company.json(), company_payload)
            loaded_company = client.get("/api/v1/company-settings", headers=headers)
            self.assertEqual(loaded_company.status_code, 200, loaded_company.text)
            self.assertEqual(loaded_company.json(), company_payload)
            configured_login = client.post(
                "/api/v1/auth/login",
                data={"username": "simulation-test", "password": "test-password"},
            )
            configured_claims = jwt.get_unverified_claims(
                configured_login.json()["access_token"]
            )
            self.assertEqual(
                configured_claims["exp"] - configured_claims["iat"], 240 * 60
            )

            project = client.post("/api/v1/projects", json={"title": "시뮬레이션 테스트", "address": "서울특별시 중구 세종대로 110"}, headers=headers)
            self.assertEqual(project.status_code, 201, project.text)
            project_id = project.json()["id"]

            recent = client.get("/api/v1/projects?page_size=5&sort=created_at", headers=headers)
            self.assertEqual(recent.status_code, 200, recent.text)
            self.assertEqual(recent.json()["items"][0]["id"], project_id)

            archived = client.delete(f"/api/v1/projects/{project_id}", headers=headers)
            self.assertEqual(archived.status_code, 204, archived.text)
            active_projects = client.get("/api/v1/projects?page_size=5", headers=headers)
            self.assertNotIn(project_id, [item["id"] for item in active_projects.json()["items"]])
            archived_projects = client.get("/api/v1/projects?page_size=5&archived=true", headers=headers)
            self.assertEqual(archived_projects.status_code, 200, archived_projects.text)
            self.assertIn(project_id, [item["id"] for item in archived_projects.json()["items"]])
            restored = client.patch(f"/api/v1/projects/{project_id}/restore", headers=headers)
            self.assertEqual(restored.status_code, 200, restored.text)
            self.assertEqual(restored.json()["id"], project_id)
            active_projects = client.get("/api/v1/projects?page_size=5", headers=headers)
            self.assertIn(project_id, [item["id"] for item in active_projects.json()["items"]])

            first_photo = client.post(
                f"/api/v1/projects/{project_id}/images",
                files={"file": ("first.jpg", b"first", "image/jpeg")},
                headers=headers,
            )
            second_photo = client.post(
                f"/api/v1/projects/{project_id}/images",
                files={"file": ("second.jpg", b"second", "image/jpeg")},
                headers=headers,
            )
            self.assertTrue(first_photo.json()["is_cover"])
            self.assertFalse(second_photo.json()["is_cover"])
            classified_photo = client.patch(
                f"/api/v1/projects/{project_id}/images/{second_photo.json()['id']}",
                json={"classification": "거실", "is_public": True},
                headers=headers,
            )
            self.assertEqual(classified_photo.status_code, 200, classified_photo.text)
            photo_library = client.get(
                f"/api/v1/images?project_id={project_id}&classification=거실&is_public=true",
                headers=headers,
            )
            self.assertEqual(photo_library.status_code, 200, photo_library.text)
            self.assertEqual(photo_library.json()["total"], 1)
            self.assertEqual(photo_library.json()["items"][0]["id"], second_photo.json()["id"])
            self.assertEqual(photo_library.json()["items"][0]["project_title"], "시뮬레이션 테스트")
            self.assertIn("거실", photo_library.json()["classifications"])
            removed = client.delete(f"/api/v1/projects/{project_id}/images/{first_photo.json()['id']}", headers=headers)
            self.assertEqual(removed.status_code, 204, removed.text)
            refreshed_project = client.get(f"/api/v1/projects/{project_id}", headers=headers)
            self.assertEqual(len(refreshed_project.json()["images"]), 1)
            self.assertTrue(refreshed_project.json()["images"][0]["is_cover"])
            refreshed_list = client.get("/api/v1/projects?page_size=5", headers=headers)
            self.assertEqual(refreshed_list.json()["items"][0]["cover_image"]["id"], second_photo.json()["id"])

            created = client.post(f"/api/v1/projects/{project_id}/simulations", json={"name": "거실 제안"}, headers=headers)
            self.assertEqual(created.status_code, 201, created.text)
            simulation = created.json()
            self.assertEqual(len(simulation["versions"]), 1)
            current = simulation["versions"][0]
            scene = current["scene_json"]
            scene["structure"]["rooms"][0]["width"] = 5.4
            scene["placements"].append({
                "id": "sofa-1", "name": "소파", "category": "sofa",
                "position": {"x": 0.4, "z": 0.2},
                "size": {"width": 2.1, "depth": 0.9, "height": 0.82},
                "rotation": 0, "color": "#78917f",
            })

            saved = client.put(f"/api/v1/simulation-versions/{current['id']}/scene", json={"scene_json": scene}, headers=headers)
            self.assertEqual(saved.status_code, 200, saved.text)
            version_two = client.post(f"/api/v1/simulations/{simulation['id']}/versions", json={"scene_json": scene}, headers=headers)
            self.assertEqual(version_two.status_code, 201, version_two.text)
            self.assertEqual(version_two.json()["version"], 2)
            verified = client.post(f"/api/v1/simulation-versions/{version_two.json()['id']}/verify", headers=headers)
            self.assertEqual(verified.status_code, 200, verified.text)
            self.assertIsNotNone(verified.json()["verified_at"])

            material = client.post(
                f"/api/v1/projects/{project_id}/materials",
                data={"name": "오프화이트 타일", "material_type": "TILE", "real_width": "0.6", "real_height": "0.6", "seamless": "true"},
                files={"file": ("tile.png", b"\x89PNG\r\n\x1a\n", "image/png")},
                headers=headers,
            )
            self.assertEqual(material.status_code, 201, material.text)
            self.assertEqual(material.json()["material_type"], "TILE")

            scan = client.post(
                f"/api/v1/simulations/{simulation['id']}/scan-files",
                data={"source_type": "PHOTOS"},
                files=[("files", ("room.jpg", b"test-image", "image/jpeg"))],
                headers=headers,
            )
            self.assertEqual(scan.status_code, 201, scan.text)
            queued = client.post(f"/api/v1/space-scans/{scan.json()['id']}/process", headers=headers)
            self.assertEqual(queued.status_code, 202, queued.text)
            self.assertEqual(queued.json()["status"], "QUEUED")

            furniture = client.post(
                f"/api/v1/projects/{project_id}/design-assets/generate-from-files",
                files=[("files", ("chair-front.jpg", b"front", "image/jpeg")), ("files", ("chair-side.jpg", b"side", "image/jpeg"))],
                headers=headers,
            )
            self.assertEqual(furniture.status_code, 202, furniture.text)
            self.assertEqual(furniture.json()["job_type"], "FURNITURE_3D")

    def test_z_converted_inquiry_reports_archived_project(self):
        with TestClient(app) as client:
            payment_columns = {
                column["name"] for column in inspect(engine).get_columns("payments")
            }
            self.assertNotIn("status", payment_columns)
            self.assertNotIn("due_date", payment_columns)

            login = client.post(
                "/api/v1/auth/login",
                data={"username": "simulation-test", "password": "test-password"},
            )
            self.assertEqual(login.status_code, 200, login.text)
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            inquiry = client.post(
                "/api/v1/estimate-inquiries",
                json={
                    "customer_name": "삭제 테스트",
                    "customer_phone": "010-1234-5678",
                    "desired_start_date": "2026-09-01",
                    "request_details": "거실과 주방 전체 공사",
                    "memo": "엘리베이터 사용 사전 예약",
                },
                headers=headers,
            )
            self.assertEqual(inquiry.status_code, 201, inquiry.text)
            inquiry_id = inquiry.json()["id"]
            estimate = client.post(
                f"/api/v1/estimate-inquiries/{inquiry_id}/estimates",
                json={
                    "title": "계약 전환 견적",
                    "lines": [
                        {
                            "category": "OTHER",
                            "name": "샷시",
                            "quantity": 1,
                            "unit": "식",
                            "unit_price": 12_000_000,
                        },
                        {
                            "category": "FURNITURE",
                            "name": "싱크대",
                            "quantity": 1,
                            "unit": "식",
                            "unit_price": 3_000_000,
                        },
                        {
                            "category": "WALLPAPER",
                            "name": "도배",
                            "quantity": 1,
                            "unit": "식",
                            "unit_price": 2_500_000,
                        },
                    ],
                },
                headers=headers,
            )
            self.assertEqual(estimate.status_code, 201, estimate.text)
            converted = client.post(
                f"/api/v1/estimate-inquiries/{inquiry_id}/convert",
                json={"project_title": "삭제 상태 확인 현장"},
                headers=headers,
            )
            self.assertEqual(converted.status_code, 201, converted.text)
            self.assertEqual(converted.json()["contract_estimate_id"], estimate.json()["id"])
            self.assertEqual(converted.json()["work_scope"], "거실과 주방 전체 공사")
            self.assertEqual(converted.json()["internal_memo"], "엘리베이터 사용 사전 예약")
            self.assertIsNone(converted.json()["description"])
            self.assertIsNone(converted.json()["planned_start_date"])
            self.assertIsNone(converted.json()["planned_end_date"])
            project_id = converted.json()["id"]

            converted_costs = client.get(
                f"/api/v1/projects/{project_id}/costs", headers=headers
            )
            self.assertTrue(
                all(item["item_type"] == "CONTRACT" for item in converted_costs.json()["items"])
            )
            self.assertEqual(converted_costs.json()["summary"]["final_total"], 19_250_000)

            legacy_cost = client.post(
                f"/api/v1/projects/{project_id}/costs",
                json={
                    "category": "FLOORING",
                    "item_type": "ESTIMATE",
                    "name": "장판",
                    "supply_amount": 2_000_000,
                    "vat_amount": 200_000,
                },
                headers=headers,
            )
            self.assertEqual(legacy_cost.status_code, 201, legacy_cost.text)
            ensure_schema_compatibility(engine)
            migrated_costs = client.get(
                f"/api/v1/projects/{project_id}/costs", headers=headers
            )
            self.assertTrue(
                all(item["item_type"] == "CONTRACT" for item in migrated_costs.json()["items"])
            )
            self.assertEqual(migrated_costs.json()["summary"]["final_total"], 21_450_000)
            payment_summary = client.get(
                f"/api/v1/projects/{project_id}/payments", headers=headers
            )
            self.assertEqual(payment_summary.json()["summary"]["receivable_total"], 21_450_000)

            payment = client.post(
                f"/api/v1/projects/{project_id}/payments",
                json={
                    "stage": "LUMP_SUM",
                    "method": "BANK_TRANSFER",
                    "supply_amount": 5_000_000,
                    "paid_at": "2026-08-21T10:00:00+09:00",
                },
                headers=headers,
            )
            self.assertEqual(payment.status_code, 201, payment.text)
            self.assertEqual(payment.json()["stage"], "LUMP_SUM")
            self.assertNotIn("status", payment.json())
            self.assertNotIn("due_date", payment.json())
            payment_summary = client.get(
                f"/api/v1/projects/{project_id}/payments", headers=headers
            )
            self.assertEqual(payment_summary.json()["summary"]["paid_total"], 5_000_000)
            self.assertEqual(payment_summary.json()["summary"]["receivable_total"], 16_450_000)

            active_inquiry = client.get(
                f"/api/v1/estimate-inquiries/{inquiry_id}", headers=headers
            )
            self.assertFalse(active_inquiry.json()["converted_project_archived"])

            archived = client.delete(f"/api/v1/projects/{project_id}", headers=headers)
            self.assertEqual(archived.status_code, 204, archived.text)

            archived_inquiry = client.get(
                f"/api/v1/estimate-inquiries/{inquiry_id}", headers=headers
            )
            self.assertTrue(archived_inquiry.json()["converted_project_archived"])
            inquiry_list = client.get("/api/v1/estimate-inquiries", headers=headers)
            listed = next(item for item in inquiry_list.json()["items"] if item["id"] == inquiry_id)
            self.assertTrue(listed["converted_project_archived"])

            restored = client.patch(f"/api/v1/projects/{project_id}/restore", headers=headers)
            self.assertEqual(restored.status_code, 200, restored.text)
            restored_inquiry = client.get(
                f"/api/v1/estimate-inquiries/{inquiry_id}", headers=headers
            )
            self.assertFalse(restored_inquiry.json()["converted_project_archived"])


if __name__ == "__main__":
    unittest.main()
