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

from backend.app.main import app
from backend.app.db import engine


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


if __name__ == "__main__":
    unittest.main()
